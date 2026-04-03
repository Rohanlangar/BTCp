"""
Regenerate TEAL files from updated PyTEAL contracts.
Run this after any changes to bounty_escrow.py or bounty_registry.py.
"""
from pyteal import *
from bounty_escrow import approval_program as escrow_approval, clear_state_program as escrow_clear
from bounty_registry import approval_program as registry_approval, clear_state_program as registry_clear

def generate():
    print("Compiling bounty_escrow_approval.teal...")
    with open("bounty_escrow_approval.teal", "w") as f:
        f.write(compileTeal(escrow_approval(), mode=Mode.Application, version=8))
    print("  ✓ done")

    print("Compiling bounty_escrow_clear.teal...")
    with open("bounty_escrow_clear.teal", "w") as f:
        f.write(compileTeal(escrow_clear(), mode=Mode.Application, version=8))
    print("  ✓ done")

    print("Compiling bounty_registry_approval.teal...")
    with open("bounty_registry_approval.teal", "w") as f:
        f.write(compileTeal(registry_approval(), mode=Mode.Application, version=8))
    print("  ✓ done")

    print("Compiling bounty_registry_clear.teal...")
    with open("bounty_registry_clear.teal", "w") as f:
        f.write(compileTeal(registry_clear(), mode=Mode.Application, version=8))
    print("  ✓ done")

    print("\nAll TEAL files regenerated successfully!")
    print("Next: redeploy escrow contract with 'python deploy_testnet.py escrow <registry_id> <issue_url> <deadline>'")

if __name__ == "__main__":
    generate()
