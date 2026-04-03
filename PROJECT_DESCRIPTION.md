# 🏗️ BountyChain — Decentralized Bounty Platform on Algorand

> A trustless, GitHub-integrated bounty platform built on the Algorand blockchain. Admins post bounties tied to GitHub issues with ALGO rewards locked in smart contract escrows. Contributors claim, solve, and submit pull requests — and get paid on-chain once approved.

---

## 🧰 Tech Stack

| Layer            | Technology                                                         |
| ---------------- | ------------------------------------------------------------------ |
| Frontend         | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4      |
| Authentication   | BetterAuth (GitHub OAuth), Supabase PostgreSQL                     |
| Blockchain       | Algorand TestNet, PyTEAL smart contracts, algosdk v3               |
| Wallet           | Pera Wallet (`@txnlab/use-wallet-react`, `@perawallet/connect`)   |
| Database         | Supabase PostgreSQL (via `pg` driver)                              |
| Deployment       | Python `deploy_testnet.py` for on-chain contracts                  |

---

## 📁 Project Folder Structure

```
PVG-Hackathon-main/
├── .agent/                          # Agent workflows (deploy-and-test)
├── .env                             # Root env vars (ALGO_MNEMONIC for deploy scripts)
├── HACKATHON_PLAN.md                # 36-hour hackathon build plan document
├── README.md                        # Original project readme
│
│── ── Smart Contract Layer (PyTEAL → TEAL) ──
├── bounty_escrow.py                 # PyTEAL source for BountyEscrow contract
├── bounty_escrow_approval.teal      # Compiled TEAL approval program for Escrow
├── bounty_escrow_clear.teal         # Compiled TEAL clear-state program for Escrow
├── bounty_registry.py               # PyTEAL source for BountyRegistry contract
├── bounty_registry_approval.teal    # Compiled TEAL approval program for Registry
├── bounty_registry_clear.teal       # Compiled TEAL clear-state program for Registry
├── gen_teal.py                      # Script to compile PyTEAL → TEAL
├── deploy_testnet.py                # Deploy contracts to Algorand TestNet
├── test_contracts.py                # Unit tests for smart contracts
├── deploy.log                       # Deployment log output
├── test_localnet.log                # Local test results
├── test_log.txt                     # Test log output
├── test_output.log                  # Test output log
│
│── ── Next.js Web Application ──
└── auth/
    ├── .env.local                   # App env vars (DB, GitHub OAuth, Algorand keys)
    ├── .gitignore                   # Git ignore rules
    ├── AGENTS.md                    # Agent instructions
    ├── CLAUDE.md                    # Model instructions
    ├── SUPABASE_SCHEMA.sql          # Full PostgreSQL schema for Supabase
    ├── package.json                 # Node dependencies & scripts
    ├── next.config.ts               # Next.js configuration
    ├── tsconfig.json                # TypeScript configuration
    ├── postcss.config.mjs           # PostCSS (Tailwind) config
    ├── eslint.config.mjs            # ESLint configuration
    │
    ├── contracts/                   # TEAL files copied for runtime compilation
    │   ├── bounty_escrow_approval.teal
    │   └── bounty_escrow_clear.teal
    │
    ├── public/                      # Static assets (SVG icons)
    │   ├── file.svg
    │   ├── globe.svg
    │   ├── next.svg
    │   ├── vercel.svg
    │   └── window.svg
    │
    └── src/
        ├── proxy.ts                 # Edge middleware — route protection & auth checks
        │
        ├── lib/                     # Core libraries
        │   ├── auth.ts              # BetterAuth server config (GitHub OAuth, PG pool)
        │   ├── auth-client.ts       # BetterAuth client-side hooks (signIn, signOut, useSession)
        │   └── algorand.ts          # Algorand SDK helpers (build txns, read state, balance checks)
        │
        ├── hooks/                   # React custom hooks
        │   ├── useBountyContracts.ts # Full bounty lifecycle: create, claim, submit via Pera Wallet
        │   └── useWalletLinking.ts  # Link Pera Wallet address to user account
        │
        ├── components/              # UI components
        │   ├── DashboardClient.tsx   # Dynamic imports for client-only wallet/bounty components
        │   ├── auth/
        │   │   └── SignInButton.tsx  # GitHub OAuth sign-in/sign-out button
        │   ├── wallet/
        │   │   ├── ConnectWallet.tsx # Pera Wallet connection UI (connect, disconnect, link)
        │   │   └── WalletProvider.tsx # @txnlab/use-wallet-react provider (TestNet, Pera)
        │   └── bounty/
        │       ├── PostBountyForm.tsx     # Multi-step bounty creation form with progress UI
        │       └── BountyInteraction.tsx  # Claim / Submit PR / Review status component
        │
        └── app/                     # Next.js App Router pages
            ├── favicon.ico          # App favicon
            ├── globals.css          # Global Tailwind CSS imports
            ├── layout.tsx           # Root layout (Geist font, WalletProvider wrapper)
            ├── page.tsx             # Landing page (hero, sign-in CTA, feature list)
            │
            ├── login/
            │   └── page.tsx         # Login page (GitHub OAuth, info cards)
            │
            ├── choose-role/
            │   └── page.tsx         # Role selection (Admin vs Contributor)
            │
            ├── connect-wallet/
            │   └── page.tsx         # Pera Wallet connection + linking flow
            │
            ├── dashboard/
            │   ├── page.tsx         # Dashboard router (redirects by role)
            │   ├── admin/
            │   │   └── page.tsx     # Admin dashboard (stats, post bounty, manage submissions)
            │   └── contributor/
            │       └── page.tsx     # Contributor dashboard (my claims, open bounty marketplace)
            │
            ├── bounties/
            │   ├── page.tsx         # Bounty Explorer (grid of all bounties from DB)
            │   └── [id]/
            │       └── page.tsx     # Bounty detail page (metadata, reward, interaction panel)
            │
            └── api/                 # Backend API routes
                ├── auth/
                │   └── [...all]/
                │       └── route.ts # BetterAuth catch-all handler (GET/POST)
                │
                ├── bounties/        # Bounty CRUD endpoints (on-chain synced)
                │   ├── create/
                │   │   └── route.ts # POST: Create bounty record (syncs with GitHub API)
                │   ├── claim/
                │   │   └── route.ts # POST: Claim a bounty (update DB status to CLAIMED)
                │   ├── submit/
                │   │   └── route.ts # POST: Submit PR URL (update DB status to SUBMITTED)
                │   ├── list/
                │   │   └── route.ts # GET: List all bounties
                │   └── [id]/
                │       ├── claim/   # Individual bounty claim actions
                │       ├── submit/  # Individual bounty submit actions
                │       └── settle/  # Individual bounty settle actions
                │
                ├── bounty/          # Legacy/alternative bounty API routes
                │   ├── create/
                │   │   └── route.ts # POST: Create bounty (legacy)
                │   ├── list/
                │   │   └── route.ts # GET: List bounties (legacy)
                │   └── [id]/
                │       ├── route.ts # GET: Single bounty details
                │       ├── activity/
                │       ├── cancel/
                │       ├── claim/
                │       ├── claims/
                │       ├── publish/
                │       └── withdraw/
                │
                ├── contracts/
                │   └── compile/
                │       └── route.ts # GET: Compile TEAL → base64 via algod (runtime compilation)
                │
                └── user/
                    ├── update/
                    │   └── route.ts # POST: Update user role, roleSelected, walletAddress
                    └── verify-wallet/
                        └── route.ts # POST: Verify & link Algorand wallet to user account
```

---

## 📄 File-by-File Descriptions

### Root Level — Smart Contract Layer

| File | Description |
|------|-------------|
| `bounty_escrow.py` | **BountyEscrow smart contract** written in PyTEAL. Implements the full bounty lifecycle: `createApplication`, `registerWithRegistry`, `depositReward`, `claimBounty`, `submitWork`, `settleBounty`, `rejectWork`, `claimStale`, and `cancelBounty`. Each escrow holds funds for a single bounty and interacts with the central Registry via inner transactions. |
| `bounty_registry.py` | **BountyRegistry smart contract** written in PyTEAL. Central index of all bounties stored as on-chain Box storage (344 bytes per bounty). Supports `registerBounty`, `updateStatus`, `updateRewardAmount`, plus admin controls: `emergencyPause`, `unpause`, `updateMaintainer`, `updatePlatformFee`. Validates state transitions and enforces ownership. |
| `bounty_escrow_approval.teal` | Compiled TEAL approval program for the Escrow contract. |
| `bounty_escrow_clear.teal` | Compiled TEAL clear-state program for the Escrow contract. |
| `bounty_registry_approval.teal` | Compiled TEAL approval program for the Registry contract. |
| `bounty_registry_clear.teal` | Compiled TEAL clear-state program for the Registry contract. |
| `gen_teal.py` | Helper script that compiles PyTEAL source files into TEAL bytecode. |
| `deploy_testnet.py` | Deployment script for Algorand TestNet. Deploys Registry and Escrow contracts using an account funded via the Algorand TestNet faucet. Supports `generate` (new account), default (deploy registry), and `escrow` (deploy escrow) commands. |
| `test_contracts.py` | Unit tests for the smart contracts using the Algorand SDK. Tests the full bounty lifecycle on a local network. |
| `HACKATHON_PLAN.md` | The 36-hour hackathon build plan outlining the architecture, milestones, and deliverables. |

---

### `auth/` — Next.js Web Application

#### Configuration Files

| File | Description |
|------|-------------|
| `.env.local` | Environment variables: `DATABASE_URL` (Supabase PG connection string), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXT_PUBLIC_ALGOD_ADDRESS`, `NEXT_PUBLIC_REGISTRY_APP_ID`. |
| `SUPABASE_SCHEMA.sql` | Complete PostgreSQL schema for Supabase — includes `user`, `session`, `account`, `verification` tables (BetterAuth), plus `bounties`, `claims`, `submissions`, `activity_log`, and `notifications` tables with indexes, triggers, and realtime publication config. |
| `package.json` | Dependencies: Next.js 16, React 19, algosdk v3, BetterAuth, Pera Wallet SDK, Supabase JS, TailwindCSS 4, date-fns, pg driver. |

---

#### `src/lib/` — Core Libraries

| File | Description |
|------|-------------|
| `auth.ts` | BetterAuth server-side configuration. Sets up GitHub OAuth as the social provider, connects to Supabase PostgreSQL via a connection pool, defines custom user fields (`role`, `roleSelected`, `walletAddress`, `walletVerified`), configures 7-day sessions with cache disabled to prevent stale data. |
| `auth-client.ts` | Client-side auth helper. Creates the BetterAuth React client and exports `signIn`, `signOut`, `useSession`, `getSession` hooks for use in client components. |
| `algorand.ts` | Algorand SDK utility library. Provides functions to build all on-chain transactions: `buildDeployEscrowTxn`, `buildFundMBRTxn`, `buildRegisterEscrowTxn`, `buildDepositRewardGroup`, `buildClaimBountyTxn`, `buildSubmitWorkTxn`, `buildSettleBountyTxn`. Also includes helpers for reading on-chain global state (`readGlobalState`, `readGlobalStateBytes`) and balance checks (`checkUserBalance`). |

---

#### `src/hooks/` — Custom React Hooks

| File | Description |
|------|-------------|
| `useBountyContracts.ts` | Full bounty lifecycle hook. Provides `createBounty` (5-step deploy: compile TEAL → deploy escrow → fund MBR → register with registry → deposit reward), `claimBounty` (lock bounty on-chain), and `submitWork` (attach PR URL on-chain). Each operation signs transactions via Pera Wallet, confirms on-chain, then syncs to the Supabase database. Includes balance pre-checks and step-by-step progress callbacks. |
| `useWalletLinking.ts` | Wallet linking hook. Validates Algorand address format (58-char base32), generates a challenge message, and sends a verification request to `/api/user/verify-wallet` to persistently link a Pera Wallet address to the authenticated user's account. |

---

#### `src/components/` — UI Components

| File | Description |
|------|-------------|
| `DashboardClient.tsx` | Client-side wrapper that dynamically imports `ConnectWallet` and `PostBountyForm` with SSR disabled (they require browser-only wallet APIs). |
| `auth/SignInButton.tsx` | GitHub OAuth sign-in button. Shows sign-in state, authenticated user info (avatar, name, email), or a loading spinner. Handles both `signIn.social({ provider: "github" })` and `signOut()`. |
| `wallet/WalletProvider.tsx` | Wraps the entire app with `@txnlab/use-wallet-react` context. Configures Pera Wallet on Algorand TestNet so all child components can use `useWallet()` hook for wallet operations. |
| `wallet/ConnectWallet.tsx` | Full Pera Wallet connection UI. Shows disconnected state (connect button with getting-started guide) or connected state (address display, link-to-account button, disconnect). On successful linking, auto-redirects to the dashboard. |
| `bounty/PostBountyForm.tsx` | Multi-step bounty creation form for admins. Takes a GitHub issue URL and ALGO reward amount. Shows real-time deploy progress through 5 steps (Compiling → Deploying → Funding → Registering → Depositing) with Pera Wallet signing prompts at each step. Displays blockchain cost breakdown and links to Pera Explorer on success. |
| `bounty/BountyInteraction.tsx` | Context-aware bounty interaction panel. Renders different UI based on bounty status and user role: OPEN (claim button), CLAIMED by current user (PR submission form), CLAIMED by someone else (info message), SUBMITTED for creator (review link), SUBMITTED for contributor (confirmation), SETTLED (completion badge). |

---

#### `src/app/` — Pages (App Router)

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout. Applies Geist/Geist Mono fonts, wraps all pages in the `WalletProvider` for global Pera Wallet context. |
| `page.tsx` | **Landing page**. Dark gradient hero with "Bounty Platform" branding, feature highlights (Browse Tasks, Work & Submit, Get Paid), and a GitHub OAuth sign-in CTA. |
| `login/page.tsx` | **Login page**. Redirects authenticated users to dashboard. Shows sign-in button, platform explanation ("What is this?"), and step-by-step how-it-works guide. |
| `choose-role/page.tsx` | **Role selection page**. Two large cards: Admin (🏢 "I want to POST bounties") vs Contributor (👨‍💻 "I want to WORK on bounties"). Calls `/api/user/update` to persist the role, then redirects to wallet connection. |
| `connect-wallet/page.tsx` | **Wallet connection page**. Renders the Pera Wallet connection component with auto-redirect on success. Includes a "Skip for now" fallback link. |
| `dashboard/page.tsx` | **General dashboard**. Shows user info, wallet management, bounty form, and feature cards. Redirects based on role via the middleware. |
| `dashboard/admin/page.tsx` | **Admin dashboard**. Server-rendered page that queries Supabase for all bounties created by the logged-in admin. Displays analytics (total, active, under review, completed, ALGO locked/paid), the `PostBountyForm` for creating new bounties, and a detailed bounty list with status badges, claim counts, PR links, and action buttons (View Issue, Review Submission, Approve, Reject). |
| `dashboard/contributor/page.tsx` | **Contributor dashboard**. Server-rendered page with two sections: "My Bounties" (claimed/submitted by the contributor with status and PR links) and "Open Bounties" marketplace (all OPEN bounties as a card grid with reward amounts and claim buttons). Shows stats: active claims, pending review, total earned, reputation score. |
| `bounties/page.tsx` | **Bounty Explorer**. Public listing of all bounties from the database as a responsive card grid. Each card shows status badge, registry ID, title, issue URL, reward amount, and creation time. Links to the detail page. |
| `bounties/[id]/page.tsx` | **Bounty detail page**. Shows full bounty info: status, registry ID, title, repository link, creator wallet, contributor wallet, escrow app ID, PR URL, and creation time. Renders the `BountyInteraction` component for on-chain actions (claim, submit PR). |

---

#### `src/app/api/` — Backend API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...all]` | GET/POST | BetterAuth catch-all handler. Handles all authentication flows (OAuth callbacks, session management, sign-out). |
| `/api/bounties/create` | POST | Creates a new bounty record in the database after on-chain deployment. Fetches GitHub issue metadata (title, description, repo info) via the GitHub API. Requires authentication. |
| `/api/bounties/claim` | POST | Updates a bounty's status to `CLAIMED` and records the contributor's ID and wallet. Guards against double-claiming with SQL `WHERE status = 'OPEN'`. |
| `/api/bounties/submit` | POST | Updates a bounty's status to `SUBMITTED` and stores the PR URL. Validates that the caller is the assigned contributor. |
| `/api/bounties/list` | GET | Returns all bounties from the database ordered by creation date. |
| `/api/contracts/compile` | GET | Reads TEAL source files from `contracts/` directory, compiles them via the Algorand node (`algod.compile()`), and returns base64-encoded bytecode for client-side deployment. |
| `/api/user/update` | POST | Updates user profile fields: `role`, `roleSelected`, `walletAddress`, `walletVerified`. Dynamically builds the SQL UPDATE query based on provided fields. |
| `/api/user/verify-wallet` | POST | Verifies and links an Algorand wallet address to the user's account. Validates address format, checks for conflicts (wallet already linked to another user), clears stale links, and persists the association. |

---

#### `src/proxy.ts` — Edge Middleware

The middleware protects routes and enforces the onboarding flow:

| Route | Logic |
|-------|-------|
| `/dashboard/*` | Requires auth → requires role → redirects to correct role-specific dashboard |
| `/choose-role` | Redirects away if role already selected + wallet linked |
| `/connect-wallet` | Requires role selection first; redirects if wallet already linked |
| `/bounties/*` | Requires authentication only |
| `/api/user/*` | Returns 401 if not authenticated |
| `/api/bounties/*`, `/api/contracts/*` | Skipped (handle their own auth) |

---

## ✅ Currently Implemented Features

### 🔐 Authentication & Identity
- [x] **GitHub OAuth** sign-in/sign-out via BetterAuth
- [x] **Session management** with 7-day expiry (cookie-based, no caching)
- [x] **Role-based access control** — Admin vs Contributor selection at onboarding
- [x] **Route protection** via Edge middleware with redirect-based onboarding flow
- [x] **Custom user fields** — role, roleSelected, walletAddress, walletVerified

### 💰 Algorand Wallet Integration
- [x] **Pera Wallet** connection via `@txnlab/use-wallet-react` popup
- [x] **TestNet** configuration (network, algod node)
- [x] **Wallet-to-account linking** with address validation and conflict detection
- [x] **Balance pre-checks** before any on-chain transaction
- [x] **Skip wallet** option — users can access dashboard without connecting wallet

### 📜 Smart Contracts (PyTEAL → TEAL)
- [x] **BountyEscrow** — Per-bounty escrow contract with 8 methods:
  - `createApplication` — Deploy with GitHub issue URL, deadline, registry reference
  - `registerWithRegistry` — Register in central index via inner transaction
  - `depositReward` — Atomic group (app call + payment) with platform fee calculation
  - `claimBounty` — Contributor locks the bounty
  - `submitWork` — Attach PR URL with GitHub URL validation
  - `settleBounty` — Creator approves → pays contributor + platform fee → closes escrow
  - `rejectWork` — Creator rejects with feedback (10+ char requirement)
  - `claimStale` — Trustless escape hatch after dispute window (7 days)
  - `cancelBounty` — Full refund (OPEN or CLAIMED+expired)
- [x] **BountyRegistry** — Central on-chain index with Box storage (344 bytes/bounty):
  - `registerBounty` — Stores escrow, creator, reward, status, timestamp, URL
  - `updateStatus` — Enforced state machine transitions
  - `updateRewardAmount` — Updates reward after deposit
  - `emergencyPause` / `unpause` — Platform-wide circuit breaker
  - `updateMaintainer` / `updatePlatformFee` — Admin config (default 2.5% fee)
- [x] **Compiled TEAL** — Both approval and clear-state programs
- [x] **Testnet deployment** script with account generation and funding instructions
- [x] **Runtime TEAL compilation** — API endpoint compiles TEAL via algod for fresh deployments

### 🎯 Bounty Lifecycle (End-to-End)
- [x] **Create Bounty** (Admin) — 5-step on-chain deployment with progress UI:
  1. Compile TEAL programs via backend API
  2. Deploy Escrow contract (Pera Wallet sign)
  3. Fund Escrow MBR — 0.3 ALGO (Pera Wallet sign)
  4. Register with Registry via inner transaction (Pera Wallet sign)
  5. Deposit Reward as atomic group (Pera Wallet sign)
- [x] **Claim Bounty** (Contributor) — On-chain lock + DB sync
- [x] **Submit Work** (Contributor) — Attach GitHub PR URL on-chain + DB sync
- [x] **View Bounty Status** — Real-time status display across all pages
- [x] **GitHub Issue Metadata** — Auto-fetches title, description, repo info from GitHub API at bounty creation

### 📊 Dashboards
- [x] **Admin Dashboard** — Analytics grid (total bounties, active, under review, completed, ALGO locked, ALGO paid), post-new-bounty form, bounty list with status badges, action buttons
- [x] **Contributor Dashboard** — Personal stats (active claims, pending review, total earned, reputation), "My Bounties" section, open bounty marketplace grid
- [x] **Bounty Explorer** — Public listing with card grid, status badges, reward amounts, time-ago timestamps
- [x] **Bounty Detail Page** — Full metadata display, on-chain escrow info, interactive claim/submit panel

### 🗄️ Database (Supabase PostgreSQL)
- [x] **BetterAuth tables** — `user`, `session`, `account`, `verification`
- [x] **Bounties table** — Full state machine with `bounty_state` enum (DRAFT → OPEN → CLAIMED → SUBMITTED → SETTLED/CANCELLED)
- [x] **Claims table** — Tracks individual contributor claims per bounty
- [x] **Submissions table** — Stores PR URLs with AI validation score fields (prepared for future use)
- [x] **Activity Log** — Audit trail for bounty lifecycle events
- [x] **Notifications** — User notification system (schema ready)
- [x] **Auto-updating triggers** — `updated_at` columns managed by PG triggers
- [x] **Supabase Realtime** — Publication configured for bounties, activity_log, notifications

### 🎨 UI/UX
- [x] **Dark theme** design with gradient backgrounds and glassmorphism
- [x] **Responsive layout** — Mobile-friendly across all pages
- [x] **Geist font family** — Modern typography (Geist Sans + Geist Mono)
- [x] **Status badges** — Color-coded bounty status indicators
- [x] **Loading states** — Spinners, progress messages, disabled states during transactions
- [x] **Error handling** — User-friendly error messages for failed transactions
- [x] **Pera Explorer links** — Direct links to view deployed contracts on-chain

---

## 🔮 Prepared But Not Yet Fully Integrated

- **AI/ML Validation Fields** — `ai_quality_score`, `ai_plagiarism_flag`, `ai_report_json` columns exist in the submissions schema (ready for the 4-layer validation pipeline: SBERT, CodeBERT, Semgrep, Gemini)
- **Dispute Resolution** — Smart contract has `rejectWork` and `claimStale` methods implemented; UI for these flows is partial
- **Settle Bounty UI** — Backend `buildSettleBountyTxn` is implemented; admin settle button wiring is in progress
- **Notifications** — Database schema and table ready; real-time push not yet wired
- **Activity Timeline** — `activity_log` table ready; no UI rendering yet

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
cd auth
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Fill in: DATABASE_URL, BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET, NEXT_PUBLIC_REGISTRY_APP_ID

# 3. Run the database schema
# Paste SUPABASE_SCHEMA.sql into your Supabase SQL Editor

# 4. Start the development server
npm run dev
# → http://localhost:3000

# 5. (Optional) Deploy smart contracts
cd ..
pip install py-algorand-sdk python-dotenv
python deploy_testnet.py              # Deploy Registry
python deploy_testnet.py escrow ...   # Deploy Escrow
```
