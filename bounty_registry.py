from pyteal import *

GITHUB_PREFIX = Bytes("https://github.com/")

STATUS_OPEN = Int(0)
STATUS_CLAIMED = Int(1)
STATUS_SUBMITTED = Int(2)
STATUS_SETTLED = Int(3)
STATUS_CANCELLED = Int(4)

# Box layout (344 bytes total):
# escrowAddress:  32 bytes  (offset 0)
# creatorAddress: 32 bytes  (offset 32)
# rewardAmount:    8 bytes  (offset 64)
# status:          8 bytes  (offset 72)
# createdAt:       8 bytes  (offset 80)
# issueUrl:      256 bytes  (offset 88)


def approval_program():
    maintainerAddress = Bytes("maintainerAddress")
    platformFeeBps = Bytes("platformFeeBps")
    totalBounties = Bytes("totalBounties")
    paused = Bytes("paused")

    tmp_bounty_id = ScratchVar(TealType.uint64)
    tmp_box_key = ScratchVar(TealType.bytes)
    tmp_new_status = ScratchVar(TealType.uint64)

    # ========================================
    # Init — deploy the registry once
    # ========================================
    init = Seq([
        App.globalPut(maintainerAddress, Txn.sender()),
        App.globalPut(platformFeeBps, Int(250)),  # 2.5%
        App.globalPut(totalBounties, Int(0)),
        App.globalPut(paused, Int(0)),
        Approve(),
    ])

    # ========================================
    # registerBounty — called via inner txn FROM escrow
    # args[0] = "registerBounty"
    # args[1] = issueUrl
    # args[2] = rewardAmount (Itob)
    # accounts[1] = creatorAddress
    # Txn.sender() = escrow contract address
    # ========================================
    register_bounty = Seq([
        Assert(App.globalGet(paused) == Int(0),
               comment="Platform is paused"),
        # Verify issueUrl starts with https://github.com/
        Assert(Len(Txn.application_args[1]) > Len(GITHUB_PREFIX),
               comment="Issue URL too short"),
        Assert(
            Extract(Txn.application_args[1], Int(0), Len(GITHUB_PREFIX))
            == GITHUB_PREFIX,
            comment="Issue URL must start with https://github.com/",
        ),
        # Assign new bountyId
        tmp_bounty_id.store(App.globalGet(totalBounties) + Int(1)),
        App.globalPut(totalBounties, tmp_bounty_id.load()),
        tmp_box_key.store(Itob(tmp_bounty_id.load())),
        # Store box: escrow(32)+creator(32)+reward(8)+status(8)+created(8)+url(256)
        App.box_put(
            tmp_box_key.load(),
            Concat(
                Txn.sender(),                    # escrowAddress (32)
                Txn.accounts[1],                 # creatorAddress (32)
                Txn.application_args[2],         # rewardAmount (8)
                Itob(STATUS_OPEN),               # status (8)
                Itob(Global.latest_timestamp()), # createdAt (8)
                Concat(                          # issueUrl padded to 256
                    Txn.application_args[1],
                    BytesZero(Int(256) - Len(Txn.application_args[1])),
                ),
            ),
        ),
        Approve(),
    ])

    # ========================================
    # updateStatus — called via inner txn FROM escrow
    # args[0] = "updateStatus"
    # args[1] = bountyId (Itob)
    # args[2] = newStatus (Itob)
    # Verifies Txn.sender() == stored escrowAddress
    # ========================================
    update_status = Seq([
        Assert(App.globalGet(paused) == Int(0),
               comment="Platform is paused"),
        tmp_bounty_id.store(Btoi(Txn.application_args[1])),
        tmp_box_key.store(Itob(tmp_bounty_id.load())),
        tmp_new_status.store(Btoi(Txn.application_args[2])),
        App.box_get(tmp_box_key.load()).outputReducer(
            lambda box_contents, exists: Seq([
                Assert(exists, comment="Bounty does not exist"),
                # Verify caller is the escrow that owns this bounty
                Assert(Txn.sender() == Extract(box_contents, Int(0), Int(32)),
                       comment="Only the owning escrow can update status"),
                # Verify valid state transition
                Assert(
                    Or(
                        And(Btoi(Extract(box_contents, Int(72), Int(8))) == STATUS_OPEN,
                            tmp_new_status.load() == STATUS_CLAIMED),
                        And(Btoi(Extract(box_contents, Int(72), Int(8))) == STATUS_CLAIMED,
                            tmp_new_status.load() == STATUS_SUBMITTED),
                        And(Btoi(Extract(box_contents, Int(72), Int(8))) == STATUS_CLAIMED,
                            tmp_new_status.load() == STATUS_CANCELLED),
                        And(Btoi(Extract(box_contents, Int(72), Int(8))) == STATUS_SUBMITTED,
                            tmp_new_status.load() == STATUS_SETTLED),
                        And(Btoi(Extract(box_contents, Int(72), Int(8))) == STATUS_SUBMITTED,
                            tmp_new_status.load() == STATUS_CLAIMED),
                        And(Btoi(Extract(box_contents, Int(72), Int(8))) == STATUS_OPEN,
                            tmp_new_status.load() == STATUS_CANCELLED),
                    ),
                    comment="Invalid state transition",
                ),
                # Update status field in box (offset 72, 8 bytes)
                App.box_put(
                    tmp_box_key.load(),
                    Concat(
                        Extract(box_contents, Int(0), Int(72)),   # escrow+creator+reward
                        Itob(tmp_new_status.load()),              # new status
                        Extract(box_contents, Int(80), Int(264)), # createdAt+issueUrl
                    ),
                ),
                Approve(),
            ])
        ),
    ])

    # ========================================
    # updateRewardAmount — called via inner txn FROM escrow
    # args[0] = "updateRewardAmount"
    # args[1] = bountyId (Itob)
    # args[2] = newRewardAmount (Itob, 8 bytes)
    # ========================================
    update_reward = Seq([
        tmp_bounty_id.store(Btoi(Txn.application_args[1])),
        tmp_box_key.store(Itob(tmp_bounty_id.load())),
        App.box_get(tmp_box_key.load()).outputReducer(
            lambda box_contents, exists: Seq([
                Assert(exists, comment="Bounty does not exist"),
                # Verify caller is the escrow
                Assert(Txn.sender() == Extract(box_contents, Int(0), Int(32)),
                       comment="Only the owning escrow can update reward"),
                # Update reward amount (offset 64, 8 bytes)
                App.box_put(
                    tmp_box_key.load(),
                    Concat(
                        Extract(box_contents, Int(0), Int(64)),   # escrow+creator
                        Txn.application_args[2],                  # new reward (8 bytes)
                        Extract(box_contents, Int(72), Int(272)), # status+createdAt+url
                    ),
                ),
                Approve(),
            ])
        ),
    ])

    # ========================================
    # emergencyPause / unpause — maintainer only
    # ========================================
    emergency_pause = Seq([
        Assert(Txn.sender() == App.globalGet(maintainerAddress),
               comment="Only maintainer can pause"),
        App.globalPut(paused, Int(1)),
        Approve(),
    ])

    unpause = Seq([
        Assert(Txn.sender() == App.globalGet(maintainerAddress),
               comment="Only maintainer can unpause"),
        App.globalPut(paused, Int(0)),
        Approve(),
    ])

    # ========================================
    # updateMaintainer — args[1] = new address
    # ========================================
    update_maintainer = Seq([
        Assert(Txn.sender() == App.globalGet(maintainerAddress),
               comment="Only maintainer"),
        App.globalPut(maintainerAddress, Txn.application_args[1]),
        Approve(),
    ])

    # ========================================
    # updatePlatformFee — args[1] = new fee bps (Itob)
    # ========================================
    update_fee = Seq([
        Assert(Txn.sender() == App.globalGet(maintainerAddress),
               comment="Only maintainer"),
        App.globalPut(platformFeeBps, Btoi(Txn.application_args[1])),
        Approve(),
    ])

    # ========================================
    # Router
    # ========================================
    program = Cond(
        [Txn.application_id() == Int(0), init],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.on_completion() == OnComplete.CloseOut, Reject()],
        [Txn.on_completion() == OnComplete.UpdateApplication, Reject()],
        [Txn.on_completion() == OnComplete.DeleteApplication, Reject()],
        [Txn.application_args[0] == Bytes("registerBounty"), register_bounty],
        [Txn.application_args[0] == Bytes("updateStatus"), update_status],
        [Txn.application_args[0] == Bytes("updateRewardAmount"), update_reward],
        [Txn.application_args[0] == Bytes("emergencyPause"), emergency_pause],
        [Txn.application_args[0] == Bytes("unpause"), unpause],
        [Txn.application_args[0] == Bytes("updateMaintainer"), update_maintainer],
        [Txn.application_args[0] == Bytes("updatePlatformFee"), update_fee],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    with open("bounty_registry_approval.teal", "w") as f:
        compiled = compileTeal(
            approval_program(), mode=Mode.Application, version=MAX_TEAL_VERSION
        )
        f.write(compiled)

    with open("bounty_registry_clear.teal", "w") as f:
        compiled = compileTeal(
            clear_state_program(), mode=Mode.Application, version=MAX_TEAL_VERSION
        )
        f.write(compiled)

    print("BountyRegistry contracts compiled successfully!")
