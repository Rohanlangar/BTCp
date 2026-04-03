# 🏗️ Hackathon Build Plan — 36 Hours, 4 People

## Design Principles

1. **Company handles GitHub, we handle bounties** — Company creates their own issue on GitHub, then comes to our platform to post the bounty with the issue link. No API-driven issue creation.
2. **Contributor handles PRs, we handle submissions** — Contributor raises the PR on GitHub themselves, then pastes the PR URL on our platform. No auto-PR creation.
3. **GitHub API is read-only** — We only *fetch* data from GitHub (PR diff, merge status, file changes) for validation and transparency. We never *write* to GitHub.
4. **Real ML validation** — A fine-tuned LLM prompt (Gemini API) that genuinely analyzes whether the PR solves the issue and flags vulnerabilities.
5. **2 contracts, clear separation** — Registry tracks all bounties. Escrow holds money per bounty.
6. **Pera Wallet only** — One wallet, clean integration, no confusion.
7. **Full transparency** — Every participant sees the same data: escrow balance, ML scores, PR diff, submission history.
8. **Wallet ownership is proven** — Users sign a challenge message to prove they own the wallet before linking.
9. **Frontend signs, backend records** — All on-chain transactions are signed by the user's wallet in the browser. The backend never holds keys — it only updates the database after confirming the transaction landed.
10. **Merge-first settlement** — Company can only approve AFTER the PR is actually merged on GitHub. No paying for unmerged code.

---

## How This Compares to AlgoDevs

| Aspect | AlgoDevs | Our Platform |
|---|---|---|
| Bounty creation | Generic form, no GitHub link | Linked to a real GitHub issue URL |
| Submissions | Paste text as "proof of work" | Paste actual GitHub PR URL — verifiable |
| Verification | Creator manually clicks Accept (subjective, no data) | ML scores the PR + validator sees real code diff (data-driven) |
| Transparency | Submissions visible but unverifiable | PR diff, ML score, merge status — all visible to everyone |
| Settlement | Creator manually calls `sendReward()` | Triggered after approval, automated payout |
| Identity | Wallet-only, anonymous | GitHub handle + wallet linked — real identity |
| Escrow visibility | ALGO sits in app account, not surfaced | Escrow contract address shown, link to explorer |
| Wallet support | Pera, Defly, Exodus, Lute | Pera only (simpler, cleaner) |

---

## The 7 Phases — How They Work

### Phase 1: Company Posts Bounty

**What the company does:**
1. Creates the issue on their GitHub repo themselves (as they normally would)
2. Comes to our platform → logs in with **GitHub OAuth** → connects **Pera Wallet**
3. Fills the bounty form:
   - GitHub Issue URL (e.g. `https://github.com/company/repo/issues/42`)
   - Bounty title (auto-fetched from issue if possible)
   - Description / additional context
   - Reward amount (in ALGO)
4. Clicks "Create Bounty" → locks ALGO in the **EscrowContract**

**What happens on-chain:**
- `EscrowContract` is deployed for this bounty (one per bounty)
- Creator sends a pay transaction to the escrow, locking the reward
- `BountyRegistry` records the bounty metadata (escrow app ID, status = OPEN)

**What happens in Supabase:**
- Bounty row created with `issue_url`, `creator_wallet`, `contract_app_id`, `status = OPEN`

**What everyone sees:**
- The bounty appears on the public board with the GitHub issue link and escrow contract address

---

### Phase 2: Contributor Claims It

**What the contributor does:**
1. Browses the bounty board (public, no login needed to view)
2. Clicks into a bounty → sees the issue description, reward, escrow balance (live from chain), deadline
3. Logs in with **GitHub OAuth** → connects **Pera Wallet**
4. **Signs a challenge message** to prove wallet ownership
5. Clicks **"Claim"**

**What happens:**
- Backend verifies the wallet signature before saving anything
- Their `github_handle` ↔ `wallet_address` mapping is saved in Supabase (only after signature verified)
- **Frontend** calls `EscrowContract.claimBounty(contributor_address)` — the user's Pera Wallet signs the transaction directly
- Backend confirms the on-chain transaction landed, then updates bounty status to **CLAIMED** in Supabase

**What everyone sees:**
- Bounty now shows "Claimed by @contributor_handle" with their verified wallet address

---

### Phase 3: Submission

**What the contributor does:**
1. Writes the fix locally, pushes to their fork, raises a PR on the company's repo **on GitHub** (normal GitHub workflow)
2. Comes back to our platform → pastes the **PR URL** (e.g. `https://github.com/company/repo/pull/43`)
3. Optionally writes a note explaining their approach
4. Clicks **"Submit"**

**What happens:**
- Backend fetches the PR details via GitHub API (validates it exists, belongs to the right repo)
- `EscrowContract.submitWork(pr_url)` records the PR URL on-chain
- Bounty status changes to **SUBMITTED**
- **ML validation is triggered automatically** (Phase 4)

---

### Phase 4: AI Validation (4-Layer Pipeline)

#### Step 1: Fetch Data via GitHub API
- PR metadata, files, diff, and original issue description.

#### Step 2: Run All 4 Layers in Parallel
- **SBERT**: Fine-tuned for semantic relevance.
- **CodeBERT**: Code-level alignment.
- **Semgrep**: Deterministic security scanning (3000+ rules).
- **Gemini**: Quality assessment and human-readable summary.

#### Step 3: Combine Scores & Store
- Overall score and verdict (PASS/WARN/FAIL) saved to Supabase and displayed publicly.

---

### Phase 5: Validator (Company) Reviews & Approves

1. Company reviews ML analysis and code diff.
2. Company merges the PR on GitHub.
3. Platform auto-detects merge; "Approve & Settle" button activates.
4. Company clicks "Approve & Settle".

---

### Phase 6: Settlement 💰

- Transaction signed by company's Pera Wallet in the browser.
- Backend verifies on-chain transaction and updates DB.

---

### Phase 7: Broadcast

- Bounty becomes a public record of accomplishment and reputation.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 15, Tailwind, shadcn/ui |
| Auth | BetterAuth (GitHub OAuth) |
| Wallet | @txnlab/use-wallet-react (Pera Only) |
| Database | Supabase (PostgreSQL) |
| Blockchain | Algorand TestNet, TEALScript, AlgoKit |
| ML Pipeline | SBERT, CodeBERT, Semgrep, Gemini API |

---

## Security Fixes

1. **Wallet Ownership Proof**: Challenge-response signing required to link GitHub to Wallet.
2. **Client-Side Signing**: Backend never holds private keys; all transactions signed by user's wallet.
3. **Merge-First Settlement**: Reward payout is blocked until PR merge is confirmed via GitHub API.
