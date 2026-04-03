from pyteal import *

# Constants
MIN_DEADLINE = Int(86400)    # 24 hours minimum
MIN_DEPOSIT = Int(500000)    # 0.5 ALGO minimum (500000 microALGO)
DISPUTE_WINDOW = Int(604800) # 7 days in seconds
GITHUB_PREFIX = Bytes("https://github.com/")

# Status constants
STATUS_OPEN = Int(0)
STATUS_CLAIMED = Int(1)
STATUS_SUBMITTED = Int(2)
STATUS_SETTLED = Int(3)
STATUS_CANCELLED = Int(4)


def approval_program():
    # Global state keys
    registryAppId = Bytes("registryAppId")
    bountyCreator = Bytes("bountyCreator")
    contributorAddress = Bytes("contributorAddress")
    rewardAmount = Bytes("rewardAmount")
    platformFeeAmount = Bytes("platformFeeAmount")
    status = Bytes("status")
    prUrl = Bytes("prUrl")
    issueUrl = Bytes("issueUrl")
    deadline = Bytes("deadline")
    disputeDeadline = Bytes("disputeDeadline")
    createdAt = Bytes("createdAt")
    bountyId = Bytes("bountyId")

    # Scratch variables
    tmp_amount = ScratchVar(TealType.uint64)
    tmp_fee = ScratchVar(TealType.uint64)
    tmp_status = ScratchVar(TealType.uint64)
    tmp_fee_bps = ScratchVar(TealType.uint64)
    tmp_maintainer = ScratchVar(TealType.bytes)
    tmp_next_bounty_id = ScratchVar(TealType.uint64)  # for box key in inner txn

    # MaybeValues for reading registry global state
    maybe_fee_bps = App.globalGetEx(Int(1), Bytes("platformFeeBps"))
    maybe_maintainer = App.globalGetEx(Int(1), Bytes("maintainerAddress"))
    maybe_bounty_id = App.globalGetEx(Int(1), Bytes("totalBounties"))

    # ======================================================
    # Method 1: createApplication(registryAppId, issueUrl, deadline)
    # Called at app creation by the creator's wallet.
    # ======================================================
    # NOTE: args[0]=registryAppId, args[1]=issueUrl, args[2]=deadline
    # (No method selector at creation — routed by Txn.application_id()==0)
    create_application = Seq([
        # Validate deadline
        Assert(
            Btoi(Txn.application_args[2]) > Global.latest_timestamp() + MIN_DEADLINE,
            comment="Deadline must be at least 24 hours in the future",
        ),
        # Validate issueUrl
        Assert(Len(Txn.application_args[1]) > Len(GITHUB_PREFIX),
               comment="Issue URL too short"),
        Assert(
            Extract(Txn.application_args[1], Int(0), Len(GITHUB_PREFIX))
            == GITHUB_PREFIX,
            comment="Issue URL must start with https://github.com/",
        ),
        # Store values
        App.globalPut(registryAppId, Btoi(Txn.application_args[0])),
        App.globalPut(issueUrl, Txn.application_args[1]),
        App.globalPut(deadline, Btoi(Txn.application_args[2])),
        App.globalPut(createdAt, Global.latest_timestamp()),
        App.globalPut(bountyCreator, Txn.sender()),
        App.globalPut(status, STATUS_OPEN),
        App.globalPut(rewardAmount, Int(0)),
        App.globalPut(platformFeeAmount, Int(0)),
        App.globalPut(prUrl, Bytes("")),
        App.globalPut(contributorAddress, BytesZero(Int(32))),
        App.globalPut(disputeDeadline, Int(0)),
        App.globalPut(bountyId, Int(0)),
        Approve(),
    ])

    # ======================================================
    # Method 1b: registerWithRegistry
    # Called AFTER creation + funding. Registers this escrow
    # with the registry and stores the assigned bountyId.
    # args[0] = "registerWithRegistry" (method selector)
    # ======================================================
    register_with_registry = Seq([
        # Only creator can register
        Assert(Txn.sender() == App.globalGet(bountyCreator),
               comment="Only creator can register"),
        # Only register once
        Assert(App.globalGet(bountyId) == Int(0),
               comment="Already registered"),
        # Read current totalBounties BEFORE inner txn to know next box key
        maybe_bounty_id,
        Assert(maybe_bounty_id.hasValue(), comment="Failed to read registry totalBounties"),
        tmp_next_bounty_id.store(maybe_bounty_id.value() + Int(1)),
        # Register with registry via inner transaction
        # IMPORTANT: boxes must be declared in the inner txn for the registry to access them
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("registerBounty"),
                App.globalGet(issueUrl),
                Itob(Int(0)),             # initial reward = 0
            ],
            TxnField.accounts: [Txn.sender()],  # creator address
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # After inner txn, totalBounties has been incremented = next_bounty_id
        App.globalPut(bountyId, tmp_next_bounty_id.load()),
        Approve(),
    ])

    # ======================================================
    # Method 2: depositReward — atomic group [appCall, payTxn]
    # args[0] = "depositReward" (no other args needed)
    # Gtxn[0] = this app call, Gtxn[1] = pay txn
    # Reads platformFeeBps from registry via App.globalGetEx
    # ======================================================
    deposit_reward = Seq([
        # Verify sender is bounty creator
        Assert(Txn.sender() == App.globalGet(bountyCreator),
               comment="Only creator can deposit reward"),
        # Verify status is OPEN
        Assert(App.globalGet(status) == STATUS_OPEN,
               comment="Bounty must be open for deposit"),
        # Verify payment transaction in group
        Assert(Global.group_size() == Int(2),
               comment="Must be atomic group of 2"),
        Assert(Gtxn[1].type_enum() == TxnType.Payment,
               comment="Second txn must be payment"),
        Assert(Gtxn[1].receiver() == Global.current_application_address(),
               comment="Payment must go to this escrow"),
        Assert(Gtxn[1].amount() >= MIN_DEPOSIT,
               comment="Minimum deposit is 0.5 ALGO"),
        # Read platformFeeBps from registry
        maybe_fee_bps,
        Assert(maybe_fee_bps.hasValue(), comment="Failed to read fee bps"),
        tmp_fee_bps.store(maybe_fee_bps.value()),
        # Calculate fee split
        tmp_amount.store(Gtxn[1].amount()),
        tmp_fee.store(tmp_amount.load() * tmp_fee_bps.load() / Int(10000)),
        # Store amounts
        App.globalPut(platformFeeAmount, tmp_fee.load()),
        App.globalPut(rewardAmount, tmp_amount.load() - tmp_fee.load()),
        # Tell registry the real reward amount
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("updateRewardAmount"),
                Itob(App.globalGet(bountyId)),
                Itob(App.globalGet(rewardAmount)),
            ],
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # ======================================================
    # Method 3: claimBounty — contributor claims
    # args[0] = "claimBounty" (no other args)
    # ======================================================
    claim_bounty = Seq([
        Assert(App.globalGet(status) == STATUS_OPEN,
               comment="Bounty must be open to claim"),
        Assert(Txn.sender() != App.globalGet(bountyCreator),
               comment="Creator cannot claim own bounty"),
        Assert(Global.latest_timestamp() < App.globalGet(deadline),
               comment="Cannot claim expired bounty"),
        Assert(App.globalGet(rewardAmount) > Int(0),
               comment="Cannot claim before funds deposited"),
        # Lock in contributor
        App.globalPut(contributorAddress, Txn.sender()),
        App.globalPut(status, STATUS_CLAIMED),
        # Update registry
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("updateStatus"),
                Itob(App.globalGet(bountyId)),
                Itob(STATUS_CLAIMED),
            ],
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # ======================================================
    # Method 4: submitWork(prUrl)
    # args[0] = "submitWork", args[1] = prUrl
    # ======================================================
    submit_work = Seq([
        Assert(Txn.sender() == App.globalGet(contributorAddress),
               comment="Only contributor can submit work"),
        Assert(App.globalGet(status) == STATUS_CLAIMED,
               comment="Work can only be submitted after claiming"),
        Assert(Global.latest_timestamp() < App.globalGet(deadline),
               comment="Cannot submit after deadline"),
        # Validate prUrl
        Assert(Len(Txn.application_args[1]) > Int(0),
               comment="PR URL cannot be empty"),
        Assert(
            Extract(Txn.application_args[1], Int(0), Len(GITHUB_PREFIX))
            == GITHUB_PREFIX,
            comment="PR URL must start with https://github.com/",
        ),
        # Store PR and update status
        App.globalPut(prUrl, Txn.application_args[1]),
        App.globalPut(status, STATUS_SUBMITTED),
        App.globalPut(disputeDeadline, Global.latest_timestamp() + DISPUTE_WINDOW),
        # Update registry
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("updateStatus"),
                Itob(App.globalGet(bountyId)),
                Itob(STATUS_SUBMITTED),
            ],
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # ======================================================
    # Method 5: settleBounty — creator approves
    # args[0] = "settleBounty" (no other args)
    # Reads maintainerAddress from registry via App.globalGetEx
    # ======================================================
    settle_bounty = Seq([
        Assert(Txn.sender() == App.globalGet(bountyCreator),
               comment="Only creator can settle"),
        Assert(App.globalGet(status) == STATUS_SUBMITTED,
               comment="Can only settle submitted work"),
        # SET STATUS FIRST — re-entrancy protection
        App.globalPut(status, STATUS_SETTLED),
        # Read maintainer address from registry
        maybe_maintainer,
        Assert(maybe_maintainer.hasValue(), comment="Failed to read maintainer"),
        tmp_maintainer.store(maybe_maintainer.value()),
        # Pay contributor their reward
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: App.globalGet(contributorAddress),
            TxnField.amount: App.globalGet(rewardAmount),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Pay platform fee to maintainer
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: tmp_maintainer.load(),
            TxnField.amount: App.globalGet(platformFeeAmount),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Notify registry
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("updateStatus"),
                Itob(App.globalGet(bountyId)),
                Itob(STATUS_SETTLED),
            ],
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Close escrow — return MBR to creator
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: App.globalGet(bountyCreator),
            TxnField.amount: Int(0),
            TxnField.close_remainder_to: App.globalGet(bountyCreator),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # ======================================================
    # Method 6: rejectWork(feedback)
    # args[0] = "rejectWork", args[1] = feedback
    # ======================================================
    reject_work = Seq([
        Assert(Txn.sender() == App.globalGet(bountyCreator),
               comment="Only creator can reject work"),
        Assert(App.globalGet(status) == STATUS_SUBMITTED,
               comment="Can only reject submitted work"),
        Assert(Global.latest_timestamp() < App.globalGet(disputeDeadline),
               comment="Cannot reject after dispute window"),
        Assert(Len(Txn.application_args[1]) >= Int(10),
               comment="Feedback must be at least 10 characters"),
        # Revert to CLAIMED — same contributor stays locked in
        App.globalPut(status, STATUS_CLAIMED),
        App.globalPut(prUrl, Bytes("")),
        App.globalPut(disputeDeadline, Int(0)),
        # Log feedback as transaction note
        Log(Txn.application_args[1]),
        # Update registry
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("updateStatus"),
                Itob(App.globalGet(bountyId)),
                Itob(STATUS_CLAIMED),
            ],
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # ======================================================
    # Method 7: claimStale — trustless escape hatch
    # args[0] = "claimStale" (no other args)
    # ======================================================
    claim_stale = Seq([
        Assert(Txn.sender() == App.globalGet(contributorAddress),
               comment="Only contributor can claim stale"),
        Assert(App.globalGet(status) == STATUS_SUBMITTED,
               comment="Can only claim stale on submitted work"),
        Assert(Global.latest_timestamp() > App.globalGet(disputeDeadline),
               comment="Dispute window not yet expired"),
        # SET STATUS FIRST
        App.globalPut(status, STATUS_SETTLED),
        # Read maintainer address from registry
        maybe_maintainer,
        Assert(maybe_maintainer.hasValue(), comment="Failed to read maintainer"),
        tmp_maintainer.store(maybe_maintainer.value()),
        # Pay contributor
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: App.globalGet(contributorAddress),
            TxnField.amount: App.globalGet(rewardAmount),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Pay platform fee
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: tmp_maintainer.load(),
            TxnField.amount: App.globalGet(platformFeeAmount),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Notify registry
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.application_id: App.globalGet(registryAppId),
            TxnField.on_completion: OnComplete.NoOp,
            TxnField.application_args: [
                Bytes("updateStatus"),
                Itob(App.globalGet(bountyId)),
                Itob(STATUS_SETTLED),
            ],
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Close escrow
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: App.globalGet(bountyCreator),
            TxnField.amount: Int(0),
            TxnField.close_remainder_to: App.globalGet(bountyCreator),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # ======================================================
    # Method 8: cancelBounty
    # args[0] = "cancelBounty" (no other args)
    # Scenario A: OPEN bounty — full refund
    # Scenario B: CLAIMED + deadline expired — full refund
    # ======================================================
    cancel_bounty = Seq([
        Assert(Txn.sender() == App.globalGet(bountyCreator),
               comment="Only creator can cancel"),
        tmp_status.store(App.globalGet(status)),
        Cond(
            [
                tmp_status.load() == STATUS_OPEN,
                Seq([
                    App.globalPut(status, STATUS_CANCELLED),
                    # Full refund: reward + fee
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields({
                        TxnField.type_enum: TxnType.Payment,
                        TxnField.receiver: App.globalGet(bountyCreator),
                        TxnField.amount: App.globalGet(rewardAmount)
                                        + App.globalGet(platformFeeAmount),
                        TxnField.close_remainder_to: App.globalGet(bountyCreator),
                        TxnField.fee: Int(0),
                    }),
                    InnerTxnBuilder.Submit(),
                    # Notify registry
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields({
                        TxnField.type_enum: TxnType.ApplicationCall,
                        TxnField.application_id: App.globalGet(registryAppId),
                        TxnField.on_completion: OnComplete.NoOp,
                        TxnField.application_args: [
                            Bytes("updateStatus"),
                            Itob(App.globalGet(bountyId)),
                            Itob(STATUS_CANCELLED),
                        ],
                        TxnField.fee: Int(0),
                    }),
                    InnerTxnBuilder.Submit(),
                ]),
            ],
            [
                And(
                    tmp_status.load() == STATUS_CLAIMED,
                    Global.latest_timestamp() > App.globalGet(deadline),
                ),
                Seq([
                    App.globalPut(status, STATUS_CANCELLED),
                    # Full refund
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields({
                        TxnField.type_enum: TxnType.Payment,
                        TxnField.receiver: App.globalGet(bountyCreator),
                        TxnField.amount: App.globalGet(rewardAmount)
                                        + App.globalGet(platformFeeAmount),
                        TxnField.close_remainder_to: App.globalGet(bountyCreator),
                        TxnField.fee: Int(0),
                    }),
                    InnerTxnBuilder.Submit(),
                    # Notify registry
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields({
                        TxnField.type_enum: TxnType.ApplicationCall,
                        TxnField.application_id: App.globalGet(registryAppId),
                        TxnField.on_completion: OnComplete.NoOp,
                        TxnField.application_args: [
                            Bytes("updateStatus"),
                            Itob(App.globalGet(bountyId)),
                            Itob(STATUS_CANCELLED),
                        ],
                        TxnField.fee: Int(0),
                    }),
                    InnerTxnBuilder.Submit(),
                ]),
            ],
            [
                Int(1),
                Reject(),
            ]
        ),
        Approve(),
    ])

    # ======================================================
    # Router — only creation uses positional args;
    # all other methods use args[0] as method selector
    # ======================================================
    program = Cond(
        [Txn.application_id() == Int(0), create_application],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.on_completion() == OnComplete.CloseOut, Reject()],
        [Txn.on_completion() == OnComplete.UpdateApplication, Reject()],
        [Txn.on_completion() == OnComplete.DeleteApplication, Reject()],
        [Txn.application_args[0] == Bytes("registerWithRegistry"), register_with_registry],
        [Txn.application_args[0] == Bytes("depositReward"), deposit_reward],
        [Txn.application_args[0] == Bytes("claimBounty"), claim_bounty],
        [Txn.application_args[0] == Bytes("submitWork"), submit_work],
        [Txn.application_args[0] == Bytes("settleBounty"), settle_bounty],
        [Txn.application_args[0] == Bytes("rejectWork"), reject_work],
        [Txn.application_args[0] == Bytes("claimStale"), claim_stale],
        [Txn.application_args[0] == Bytes("cancelBounty"), cancel_bounty],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    with open("bounty_escrow_approval.teal", "w") as f:
        compiled = compileTeal(
            approval_program(), mode=Mode.Application, version=MAX_TEAL_VERSION
        )
        f.write(compiled)

    with open("bounty_escrow_clear.teal", "w") as f:
        compiled = compileTeal(
            clear_state_program(), mode=Mode.Application, version=MAX_TEAL_VERSION
        )
        f.write(compiled)

    print("BountyEscrow contracts compiled successfully!")
