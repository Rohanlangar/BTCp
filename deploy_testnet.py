"""
Deploy BountyRegistry and BountyEscrow to Algorand Testnet.

Prerequisites:
  1. pip install py-algorand-sdk
  2. Get a testnet account:
     - Go to https://bank.testnet.algorand.network/ to fund it
     - Or use goal clerk to create one
  3. Set your mnemonic below or in ALGO_MNEMONIC env var

Usage:
  python deploy_testnet.py                    # Deploy registry
  python deploy_testnet.py escrow <registry_app_id> <issue_url> <deadline_timestamp>
"""

import sys
import os
import time
import base64
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.transaction import (
    ApplicationCreateTxn,
    ApplicationCallTxn,
    PaymentTxn,
    OnComplete,
    StateSchema,
    wait_for_confirmation,
)

from dotenv import load_dotenv
load_dotenv()

# ============================================================
# CONFIG — edit these or set as environment variables
# ============================================================

# Algorand Testnet node (free public API)
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""  # No token needed for algonode

# Your 25-word mnemonic — set via env var ALGO_MNEMONIC or paste here
MNEMONIC = os.getenv("ALGO_MNEMONIC", "")

# ============================================================
# Helpers
# ============================================================

def get_client():
    """Connect to Algorand testnet."""
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


def compile_teal(client, filename):
    """Read and compile a TEAL file, return base64-decoded bytes."""
    with open(filename, "r") as f:
        teal_source = f.read()
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def wait_for_txn(client, txid):
    """Wait for a transaction to be confirmed and return the result."""
    confirmed = wait_for_confirmation(client, txid, 4)
    print(f"  ✅ Confirmed in round {confirmed['confirmed-round']}")
    return confirmed


# ============================================================
# Deploy Registry
# ============================================================

def deploy_registry(client, sender, private_key):
    """Deploy the BountyRegistry contract."""
    print("\n📦 Deploying BountyRegistry...")

    approval = compile_teal(client, "bounty_registry_approval.teal")
    clear = compile_teal(client, "bounty_registry_clear.teal")

    # Registry global state: maintainerAddress, platformFeeBps, totalBounties, paused
    global_schema = StateSchema(num_uints=3, num_byte_slices=1)
    local_schema = StateSchema(num_uints=0, num_byte_slices=0)

    params = client.suggested_params()

    txn = ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=global_schema,
        local_schema=local_schema,
    )

    signed = txn.sign(private_key)
    txid = client.send_transaction(signed)
    print(f"  Sent txid: {txid}")

    result = wait_for_txn(client, txid)
    app_id = result["application-index"]
    app_address = algosdk_app_address(app_id)

    print(f"  🎉 Registry App ID:      {app_id}")
    print(f"  🎉 Registry App Address:  {app_address}")
    print(f"\n  View on explorer:")
    print(f"  https://testnet.explorer.perawallet.app/application/{app_id}/")
    return app_id


# ============================================================
# Deploy Escrow
# ============================================================

def deploy_escrow(client, sender, private_key, registry_app_id, issue_url, deadline):
    """Deploy a BountyEscrow contract and register it with the registry."""
    print(f"\n📦 Deploying BountyEscrow...")
    print(f"   Registry: {registry_app_id}")
    print(f"   Issue:    {issue_url}")
    print(f"   Deadline: {deadline}")

    approval = compile_teal(client, "bounty_escrow_approval.teal")
    clear = compile_teal(client, "bounty_escrow_clear.teal")

    # Escrow global state:
    # uint64: registryAppId, rewardAmount, platformFeeAmount, status,
    #         deadline, disputeDeadline, createdAt, bountyId = 8
    # bytes:  bountyCreator, contributorAddress, prUrl, issueUrl = 4
    global_schema = StateSchema(num_uints=8, num_byte_slices=4)
    local_schema = StateSchema(num_uints=0, num_byte_slices=0)

    params = client.suggested_params()
    # Extra fee for the inner txn to registry during creation (fee pooling)
    params.fee = 2000  # 2x min fee to cover inner txn
    params.flat_fee = True

    txn = ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=[
            registry_app_id.to_bytes(8, "big"),  # args[0] = registryAppId
            issue_url.encode(),                    # args[1] = issueUrl
            deadline.to_bytes(8, "big"),           # args[2] = deadline
        ],
        foreign_apps=[registry_app_id],  # so inner txn + globalGetEx work
    )

    signed = txn.sign(private_key)
    txid = client.send_transaction(signed)
    print(f"  Sent txid: {txid}")

    result = wait_for_txn(client, txid)
    app_id = result["application-index"]
    app_address = algosdk_app_address(app_id)

    print(f"  🎉 Escrow App ID:      {app_id}")
    print(f"  🎉 Escrow App Address:  {app_address}")
    print(f"\n  View on explorer:")
    print(f"  https://testnet.explorer.perawallet.app/application/{app_id}/")
    print(f"\n  ⚠️  Next steps:")
    print(f"  1. Fund the escrow: send ALGO to {app_address}")
    print(f"  2. Call 'depositReward' with a payment txn in an atomic group")
    return app_id


def algosdk_app_address(app_id):
    """Get the address of an application."""
    from algosdk.logic import get_application_address
    return get_application_address(app_id)


# ============================================================
# Main
# ============================================================

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "generate":
        # Helper: generate a new account
        sk, addr = account.generate_account()
        mn = mnemonic.from_private_key(sk)
        print(f"Address:  {addr}")
        print(f"Mnemonic: {mn}")
        print(f"\nFund at: https://bank.testnet.algorand.network/")
        sys.exit(0)

    if not MNEMONIC:
        print("❌ No mnemonic set!")
        print()
        print("Set your 25-word Algorand mnemonic:")
        print("  Option A: Set env var ALGO_MNEMONIC")
        print('  Option B: Edit MNEMONIC in this script')
        print()
        print("To create a new testnet account:")
        print("  python deploy_testnet.py generate")
        print()
        print("Then fund it at: https://bank.testnet.algorand.network/")
        sys.exit(1)

    private_key = mnemonic.to_private_key(MNEMONIC)
    sender = account.address_from_private_key(private_key)

    client = get_client()

    # Check balance
    info = client.account_info(sender)
    balance = info["amount"] / 1_000_000
    print(f"🔑 Account:  {sender}")
    print(f"💰 Balance:  {balance:.6f} ALGO")

    if balance < 1:
        print(f"\n❌ Insufficient balance. Fund your account at:")
        print(f"   https://bank.testnet.algorand.network/")
        sys.exit(1)

    if len(sys.argv) == 1:
        # Deploy registry only
        app_id = deploy_registry(client, sender, private_key)
        print(f"\n🚀 Registry deployed! Use this to deploy escrows:")
        print(f"   python deploy_testnet.py escrow {app_id} \"https://github.com/org/repo/issues/1\" {int(time.time()) + 172800}")

    elif sys.argv[1] == "escrow":
        if len(sys.argv) < 5:
            print("Usage: python deploy_testnet.py escrow <registry_app_id> <issue_url> <deadline_timestamp>")
            print(f"\nExample:")
            print(f"  python deploy_testnet.py escrow 12345 \"https://github.com/org/repo/issues/1\" {int(time.time()) + 172800}")
            sys.exit(1)

        registry_app_id = int(sys.argv[2])
        issue_url = sys.argv[3]
        deadline = int(sys.argv[4])

        deploy_escrow(client, sender, private_key, registry_app_id, issue_url, deadline)

    else:
        print(f"Unknown command: {sys.argv[1]}")
        print("Usage:")
        print("  python deploy_testnet.py              # Deploy registry")
        print("  python deploy_testnet.py escrow ...   # Deploy an escrow")
        print("  python deploy_testnet.py generate     # Generate new account")


if __name__ == "__main__":
    main()
