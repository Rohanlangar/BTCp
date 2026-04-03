---
description: How to compile, deploy, and test the Algorand bounty contracts
---

# Deploy & Test Workflow

## Prerequisites

Ensure dependencies are installed and `.env` is configured:

```bash
pip install pyteal py-algorand-sdk python-dotenv
```

Your `.env` file must contain:
```
ALGO_MNEMONIC=word1 word2 word3 ... word25
```

## Step 1: Compile Contracts (after any PyTEAL changes)

// turbo
```bash
cd /home/likhit12/Vit/projects/PVG && python gen_teal.py
```

This regenerates the four `.teal` files from `bounty_escrow.py` and `bounty_registry.py`.

## Step 2: Deploy Registry (one-time)

```bash
cd /home/likhit12/Vit/projects/PVG && python deploy_testnet.py
```

Note the **Registry App ID** from the output — you'll need it for all escrow deployments.

## Step 3: Deploy an Escrow (per bounty)

```bash
cd /home/likhit12/Vit/projects/PVG && python deploy_testnet.py escrow <REGISTRY_APP_ID> "https://github.com/org/repo/issues/N" <DEADLINE_UNIX_TS>
```

## Step 4: Run End-to-End Tests

```bash
cd /home/likhit12/Vit/projects/PVG && python test_contracts.py <REGISTRY_APP_ID>
```

This runs the full lifecycle: deploy escrow → deposit → claim → submit → settle → verify.

## Step 5: Generate a New Account (if needed)

// turbo
```bash
cd /home/likhit12/Vit/projects/PVG && python deploy_testnet.py generate
```

Then fund it at https://bank.testnet.algorand.network/
