  """
End-to-end test of BountyRegistry + BountyEscrow on Algorand Testnet.

Tests the full lifecycle:
  1. Deploy Escrow (registers with Registry)
  2. Deposit Reward (atomic group: app call + payment)
  3. Claim Bounty (from a second account)
  4. Submit Work (PR URL)
  5. Settle Bounty (pay contributor + platform fee)

Usage:
  python test_contracts.py <registry_app_id>
"""

import sys
import os
import time
import base64

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.logic import get_application_address
from algosdk.transaction import (
    ApplicationCreateTxn,
    ApplicationCallTxn,
    PaymentTxn,
    OnComplete,
    StateSchema,
    wait_for_confirmation,
    assign_group_id,
)

from dotenv import load_dotenv
load_dotenv()

# ============================================================
# CONFIG
# ============================================================
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""
MNEMONIC = os.environ.get("ALGO_MNEMONIC", "")

# ============================================================
# Helpers
# ============================================================

def get_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


def compile_teal(client, filename):
    with open(filename, "r") as f:
        teal_source = f.read()
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def confirm(client, txid, label=""):
    result = wait_for_confirmation(client, txid, 6)
    rnd = result["confirmed-round"]
    print(f"  [OK] {label} confirmed in round {rnd}")
    return result


def read_global_state(client, app_id):
    """Read an app's global state and return as a dict."""
    info = client.application_info(app_id)
    state = {}
    for kv in info.get("params", {}).get("global-state", []):
        key = base64.b64decode(kv["key"]).decode("utf-8", errors="replace")
        value = kv["value"]
        if value["type"] == 2:  # uint
            state[key] = value["uint"]
        else:  # bytes
            state[key] = base64.b64decode(value["bytes"])
    return state


def print_state(label, state):
    """Pretty-print global state."""
    STATUS_NAMES = {0: "OPEN", 1: "CLAIMED", 2: "SUBMITTED", 3: "SETTLED", 4: "CANCELLED"}
    print(f"\n  [{label}]:")
    for k, v in sorted(state.items()):
        if k == "status":
            print(f"      {k}: {v} ({STATUS_NAMES.get(v, '?')})")
        elif k in ("rewardAmount", "platformFeeAmount"):
            print(f"      {k}: {v} ({v / 1_000_000:.6f} ALGO)")
        elif isinstance(v, bytes) and len(v) == 32:
            from algosdk.encoding import encode_address
            print(f"      {k}: {encode_address(v)}")
        elif isinstance(v, bytes):
            try:
                s = v.rstrip(b'\x00').decode('utf-8')
                if s and s.isprintable():
                    print(f"      {k}: \"{s}\"")
                else:
                    print(f"      {k}: <{len(v)} bytes>")
            except:
                print(f"      {k}: <{len(v)} bytes>")
        else:
            print(f"      {k}: {v}")


# ============================================================
# TEST LIFECYCLE
# ============================================================

def run_tests(registry_app_id):
    client = get_client()

    # --- Creator account (from .env mnemonic) ---
    creator_sk = mnemonic.to_private_key(MNEMONIC)
    creator_addr = account.address_from_private_key(creator_sk)

    # --- Contributor account (generate fresh) ---
    contributor_sk, contributor_addr = account.generate_account()

    info = client.account_info(creator_addr)
    balance = info["amount"] / 1_000_000
    print(f"Creator:      {creator_addr}")
    print(f"Balance:      {balance:.6f} ALGO")
    print(f"Contributor:  {contributor_addr} (new, unfunded)")
    print(f"Registry:     {registry_app_id}")

    if balance < 3:
        print(f"\nERROR: Need at least 3 ALGO. Fund at: https://bank.testnet.algorand.network/")
        sys.exit(1)

    # --- Fund contributor with 0.5 ALGO for txn fees ---
    print(f"\n{'='*60}")
    print("STEP 0: Fund contributor account")
    print(f"{'='*60}")
    params = client.suggested_params()
    fund_txn = PaymentTxn(creator_addr, params, contributor_addr, 700_000)  # 0.7 ALGO for fees
    signed = fund_txn.sign(creator_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Fund contributor")

    # Fund registry for box storage MBR (each box = 2500 + 400*size microALGO)
    # Box size=8+344=352 bytes => MBR = 2500 + 400*352 = 143700 microALGO, round up to 200000
    print("  Funding registry box storage MBR...")
    params = client.suggested_params()
    fund_reg = PaymentTxn(creator_addr, params, get_application_address(registry_app_id), 300_000)
    signed = fund_reg.sign(creator_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Fund registry MBR")

    # =====================================================
    # STEP 1: Deploy Escrow
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 1: Deploy BountyEscrow")
    print(f"{'='*60}")

    approval = compile_teal(client, "bounty_escrow_approval.teal")
    clear = compile_teal(client, "bounty_escrow_clear.teal")

    deadline = int(time.time()) + 172800  # 48 hours from now

    reg_state = read_global_state(client, registry_app_id)
    bounty_id = reg_state.get("totalBounties", 0) + 1
    box_ref = (registry_app_id, bounty_id.to_bytes(8, "big"))

    params = client.suggested_params()

    create_txn = ApplicationCreateTxn(
        sender=creator_addr,
        sp=params,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=StateSchema(num_uints=8, num_byte_slices=4),
        local_schema=StateSchema(num_uints=0, num_byte_slices=0),
        app_args=[
            registry_app_id.to_bytes(8, "big"),
            b"https://github.com/test/repo/issues/42",
            deadline.to_bytes(8, "big"),
        ],
        foreign_apps=[registry_app_id],
    )

    signed = create_txn.sign(creator_sk)
    txid = client.send_transaction(signed)
    result = confirm(client, txid, "Create escrow")

    escrow_app_id = result["application-index"]
    escrow_addr = get_application_address(escrow_app_id)
    print(f"  Escrow App ID:  {escrow_app_id}")
    print(f"  Escrow Address: {escrow_addr}")

    # Read and display escrow state
    state = read_global_state(client, escrow_app_id)
    print_state("Escrow state after creation", state)

    # =====================================================
    # STEP 1b: Fund escrow + Register with Registry
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 1b: Fund Escrow + Register with Registry")
    print(f"{'='*60}")

    # Fund the escrow so it can make inner txns
    params = client.suggested_params()
    fund_escrow = PaymentTxn(creator_addr, params, escrow_addr, 300_000)
    signed = fund_escrow.sign(creator_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Fund escrow")

    # Register with registry
    params = client.suggested_params()
    params.fee = 2000
    params.flat_fee = True

    register_txn = ApplicationCallTxn(
        sender=creator_addr,
        sp=params,
        index=escrow_app_id,
        on_complete=OnComplete.NoOpOC,
        app_args=[b"registerWithRegistry"],
        foreign_apps=[registry_app_id],
        boxes=[(registry_app_id, bounty_id.to_bytes(8, "big"))],
    )

    signed = register_txn.sign(creator_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Register with registry")

    state = read_global_state(client, escrow_app_id)
    print_state("Escrow state after registration", state)

    # =====================================================
    # STEP 2: Deposit Reward (1 ALGO)
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 2: Deposit Reward (1 ALGO)")
    print(f"{'='*60}")

    # Atomic group: app call + payment
    params = client.suggested_params()
    params.fee = 2000  # cover inner txn
    params.flat_fee = True

    app_call = ApplicationCallTxn(
        sender=creator_addr,
        sp=params,
        index=escrow_app_id,
        on_complete=OnComplete.NoOpOC,
        app_args=[b"depositReward"],
        foreign_apps=[registry_app_id],
        boxes=[box_ref],
    )

    params2 = client.suggested_params()
    pay_txn = PaymentTxn(creator_addr, params2, escrow_addr, 1_000_000)  # 1 ALGO

    # Group them
    group = assign_group_id([app_call, pay_txn])
    signed_call = group[0].sign(creator_sk)
    signed_pay = group[1].sign(creator_sk)
    txid = client.send_transactions([signed_call, signed_pay])
    confirm(client, txid, "Deposit reward")

    state = read_global_state(client, escrow_app_id)
    print_state("Escrow state after deposit", state)

    # =====================================================
    # STEP 3: Claim Bounty (contributor)
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 3: Claim Bounty (contributor)")
    print(f"{'='*60}")

    params = client.suggested_params()
    params.fee = 2000
    params.flat_fee = True

    claim_txn = ApplicationCallTxn(
        sender=contributor_addr,
        sp=params,
        index=escrow_app_id,
        on_complete=OnComplete.NoOpOC,
        app_args=[b"claimBounty"],
        foreign_apps=[registry_app_id],
        boxes=[box_ref],
    )

    signed = claim_txn.sign(contributor_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Claim bounty")

    state = read_global_state(client, escrow_app_id)
    print_state("Escrow state after claim", state)

    # =====================================================
    # STEP 4: Submit Work (contributor)
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 4: Submit Work (contributor)")
    print(f"{'='*60}")

    params = client.suggested_params()
    params.fee = 2000
    params.flat_fee = True

    submit_txn = ApplicationCallTxn(
        sender=contributor_addr,
        sp=params,
        index=escrow_app_id,
        on_complete=OnComplete.NoOpOC,
        app_args=[
            b"submitWork",
            b"https://github.com/test/repo/pull/99",
        ],
        foreign_apps=[registry_app_id],
        boxes=[box_ref],
    )

    signed = submit_txn.sign(contributor_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Submit work")

    state = read_global_state(client, escrow_app_id)
    print_state("Escrow state after submit", state)

    # =====================================================
    # STEP 5: Settle Bounty (creator approves)
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 5: Settle Bounty (creator approves)")
    print(f"{'='*60}")

    # Check contributor balance before
    contrib_info = client.account_info(contributor_addr)
    print(f"    Contributor balance BEFORE: {contrib_info['amount'] / 1_000_000:.6f} ALGO")

    params = client.suggested_params()
    params.fee = 5000  # cover multiple inner txns (pay + pay + app_call + close)
    params.flat_fee = True

    settle_txn = ApplicationCallTxn(
        sender=creator_addr,
        sp=params,
        index=escrow_app_id,
        on_complete=OnComplete.NoOpOC,
        app_args=[b"settleBounty"],
        foreign_apps=[registry_app_id],
        accounts=[contributor_addr],  # needed so inner pay can resolve address
        boxes=[box_ref],
    )

    signed = settle_txn.sign(creator_sk)
    txid = client.send_transaction(signed)
    confirm(client, txid, "Settle bounty")

    # Check contributor balance after
    contrib_info = client.account_info(contributor_addr)
    print(f"    Contributor balance AFTER:  {contrib_info['amount'] / 1_000_000:.6f} ALGO")

    # =====================================================
    # STEP 6: Verify Registry State
    # =====================================================
    print(f"\n{'='*60}")
    print("STEP 6: Verify Registry")
    print(f"{'='*60}")

    reg_state = read_global_state(client, registry_app_id)
    print_state("Registry global state", reg_state)

    # =====================================================
    # RESULTS
    # =====================================================
    print(f"\n{'='*60}")
    print("ALL TESTS PASSED!")
    print(f"{'='*60}")
    print(f"  Registry App ID: {registry_app_id}")
    print(f"  Escrow App ID:   {escrow_app_id}")
    print(f"  Explorer links:")
    print(f"    Registry: https://testnet.explorer.perawallet.app/application/{registry_app_id}/")
    print(f"    Escrow:   https://testnet.explorer.perawallet.app/application/{escrow_app_id}/")


if __name__ == "__main__":
    if not MNEMONIC:
        print("ERROR: Set ALGO_MNEMONIC in .env first")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: python test_contracts.py <registry_app_id>")
        print("Example: python test_contracts.py 758193753")
        sys.exit(1)

    registry_id = int(sys.argv[1])
    try:
        run_tests(registry_id)
    except Exception as e:
        print(f"\nFAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
