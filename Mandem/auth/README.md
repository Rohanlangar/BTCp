# Bounty Platform - Authentication Module

A modern, decentralized bounty platform built with Next.js, Better Auth, and Algorand wallet integration. Users can earn cryptocurrency by completing tasks and solving challenges.

## 🚀 Features

### ✅ Implemented Features

#### **GitHub Authentication**
- OAuth 2.0 integration with GitHub
- Secure session management (24-hour expiration)
- User profile display (name, email, avatar)
- Sign in / Sign out functionality
- Session persistence across browser refresh/close

#### **Protected Routes**
- `/dashboard` - Authenticated user dashboard
- `/login` - Login page for unauthenticated users
- `/api/user/*` - Protected API endpoints
- Automatic redirection based on auth state
- Proxy-based route protection

#### **Wallet Linking**
- Support for Algorand wallets (Pera, Lute, etc.)
- Wallet address validation (58-character base32 format)
- Wallet verification and persistent storage
- User can link/unlink wallets
- Beautiful wallet status display

#### **Database**
- SQLite database with custom schemas
- User table with additional fields:
  - `walletAddress` (string, optional)
  - `walletVerified` (boolean)
- Session management
- Account linking for OAuth providers

#### **UI/UX**
- Modern gradient design with Tailwind CSS
- Responsive layout (mobile, tablet, desktop)
- Clear error and success messages
- Intuitive wallet linking interface
- Professional dashboard interface

---

## 📋 Tech Stack

### Frontend
- **Next.js 16.2.2** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React** - UI library

### Backend
- **Next.js API Routes** - Serverless backend
- **Better Auth** - Authentication library
- **SQLite 3** - Database

### Blockchain/Wallet
- **Algorand SDK (algosdk)** - Blockchain integration
- **@txnlab/use-wallet-react** - Wallet connection
- **Pera Wallet / Lute Wallet** - User wallets

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts         # Auth handlers
│   │   └── user/verify-wallet/route.ts    # Wallet verification API
│   ├── dashboard/page.tsx                  # Dashboard (protected)
│   ├── login/page.tsx                      # Login page
│   ├── page.tsx                            # Home page
│   ├── layout.tsx                          # Root layout
│   └── globals.css                         # Global styles
├── components/
│   ├── auth/
│   │   └── SignInButton.tsx                # GitHub sign-in button
│   ├── wallet/
│   │   └── ConnectWallet.tsx               # Wallet linking component
│   ├── DashboardClient.tsx                 # Client wrapper for dashboard
├── hooks/
│   └── useWalletLinking.ts                 # Wallet linking hook
├── lib/
│   ├── auth.ts                             # Better Auth configuration
│   └── auth-client.ts                      # Client-side auth utilities
└── proxy.ts                                # Route protection proxy

public/                                     # Static assets
sqlite.db                                   # SQLite database
.env.local                                  # Environment variables
package.json                                # Dependencies
tsconfig.json                               # TypeScript config
tailwind.config.ts                          # Tailwind config
next.config.ts                              # Next.js config
```

---

## 🛠️ Installation

### Prerequisites
- Node.js 18+ and npm
- Git

### Step 1: Clone/Setup Project
```bash
cd /path/to/project
npm install
```

### Step 2: Environment Variables
Create `.env.local` file in the project root:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=Ov23liBfyKscYHXrN0OH
GITHUB_CLIENT_SECRET=152183674643d7be4cff9edfb5266331f2260c58

# Better Auth
BETTER_AUTH_SECRET=920d7744c1489b876445bec2dc0ed2f30ff3ad196b2dbca0f1aed6bad9c77c5f
BETTER_AUTH_URL=http://localhost:3000
```

**Generate a new secret (recommended for production):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Database Setup
The SQLite database and schema are automatically created on first run. To manually migrate:

```bash
npx @better-auth/cli migrate --config ./src/lib/auth.ts
```

### Step 4: Start Development Server
```bash
npm run dev
```

Server runs at `http://localhost:3000`

---

## 🧪 Testing Guide

### Test 1: GitHub Login Flow
1. Open http://localhost:3000
2. Click **"Sign in with GitHub"** button
3. Authorize the application on GitHub
4. Should redirect back and display your GitHub name/avatar
5. Dashboard should be accessible at http://localhost:3000/dashboard

### Test 2: Protected Routes
1. **While logged in:** Access http://localhost:3000/dashboard ✅
2. **While logged out:** 
   - Try to access http://localhost:3000/dashboard
   - Should redirect to http://localhost:3000/login ✅

### Test 3: Wallet Linking
1. **Prerequisites:**
   - Sign in with GitHub first
   - Have an Algorand wallet (Pera, Lute, etc.) on TestNet

2. **Steps:**
   - Go to http://localhost:3000/dashboard
   - Scroll to "Wallet Management" section
   - Enter your Algorand wallet address (58 characters)
   - Click **"🔗 Link Wallet"** button
   - Should see success message: ✅ "Wallet linked successfully"

3. **Verify in Database:**
   ```bash
   sqlite3 sqlite.db
   SELECT email, walletAddress, walletVerified FROM user;
   ```
   Expected output: Wallet address with `walletVerified = 1`

### Test 4: Session Persistence
1. Login with GitHub
2. Refresh the page (Ctrl+R)
3. Should remain logged in ✅
4. Close and reopen the tab
5. Should still be logged in ✅
6. Click "Sign Out" and refresh
7. Should be logged out ✅

---

## 🔑 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | `Ov23liBfyKscYHXrN0OH` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | `152183674...` |
| `BETTER_AUTH_SECRET` | Session encryption secret | `920d7744c...` |
| `BETTER_AUTH_URL` | App base URL | `http://localhost:3000` |

**To get GitHub credentials:**
1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create a new OAuth Application
3. Set Authorization callback URL to `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env.local`

---

## 📱 API Routes

### Authentication
- `POST /api/auth/callback/github` - GitHub OAuth redirect
- `GET /api/auth/get-session` - Get current session
- `POST /api/auth/sign-out` - Sign out user

### User Management
- `POST /api/user/verify-wallet` - Link/verify wallet address

**Example: Link Wallet**
```bash
curl -X POST http://localhost:3000/api/user/verify-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "LT7UPFQMWXPG5IGZ5DG2JAM4AD4ZRDCGPZ2EJMZNW535PJBES6DASDOPMA",
    "signature": "base64_encoded_signature",
    "challenge": "Link wallet LT7UPFQ... at 1712851200000"
  }'
```

---

## 💾 Database Schema

### User Table
```sql
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  emailVerified TEXT,
  image TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  walletAddress TEXT,        -- Algorand wallet address
  walletVerified BOOLEAN      -- Whether wallet is linked
);
```

### Session Table
```sql
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  expiresAt TEXT,
  token TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT FOREIGN KEY
);
```

### Account Table (OAuth)
```sql
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  accountId TEXT,
  providerId TEXT,
  userId TEXT FOREIGN KEY,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
```

---

## 🔐 Security Features

- ✅ **Session Management:** 24-hour expiration with automatic refresh
- ✅ **HTTPS Ready:** Base URL configurable for production
- ✅ **Cookie Prefix:** Sessions use `bounty-platform-` prefix
- ✅ **Protected Routes:** All sensitive routes require authentication
- ✅ **Wallet Validation:** Address format validation before storage
- ✅ **SQLite Encryption:** Database-level support available

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Environment Setup (Production)
Update `.env.local` with production values:
```env
GITHUB_CLIENT_ID=your_prod_github_id
GITHUB_CLIENT_SECRET=your_prod_github_secret
BETTER_AUTH_SECRET=your_prod_secret
BETTER_AUTH_URL=https://yourdomain.com
```

### Run Production Server
```bash
npm run start
```

---

## 📊 Dashboard Features

The authenticated user dashboard includes:

1. **User Profile** - Display name and email
2. **Account Status** - Shows protection status
3. **Earnings Tracker** - Total ALGO earnings (future feature)
4. **Bounty Counter** - Completed bounties count (future feature)
5. **Wallet Management**
   - Link/unlink Algorand wallet
   - View linked wallet address
   - Wallet verification status
6. **Feature Overview** - Browse, submit, and earn features

---

## 🔄 Workflow

### User Registration & Login
```
GitHub → OAuth Redirect → Create Session → Dashboard Access
```

### Wallet Linking
```
User Enters Address → Validation → Database Update → Verification ✅
```

### Protected Route Access
```
Request Route → Check Session → Authenticated? → Grant/Redirect
                                   ↓
                                Access Dashboard
```

---

## 🐛 Troubleshooting

### "Unauthorized" Error on Wallet Linking
- **Solution:** Make sure you're logged in with GitHub first
- Check browser console for session errors

### "Invalid Wallet Address" Error
- **Solution:** Algorand addresses must be exactly 58 characters
- Format: Uppercase letters A-Z and digits 2-7 only
- Copy directly from your wallet extension

### Session Not Persisting
- **Solution:** Check if cookies are enabled in browser
- Clear browser cache and try again
- Check `.env.local` has correct `BETTER_AUTH_URL`

### Database Lock Error
- **Solution:** If SQLite is locked, restart the dev server
- Close any other processes accessing `sqlite.db`

---

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth Docs](https://www.better-auth.com)
- [Algorand SDK Docs](https://github.com/algorand/js-algorand-sdk)
- [Tailwind CSS Docs](https://tailwindcss.com)

---

## 🎯 Future Enhancements

### Phase 2: Bounty Management
- [ ] Create bounty listings
- [ ] Browse available bounties
- [ ] Filter by category, difficulty, reward
- [ ] Bounty details and requirements

### Phase 3: Submission & Review
- [ ] Submit solutions to bounties
- [ ] File/code upload support
- [ ] Review and approval workflow
- [ ] Feedback system

### Phase 4: Payments
- [ ] Algorand payment integration
- [ ] Automatic wallet payouts
- [ ] Transaction history
- [ ] ALGO balance display

### Phase 5: Community
- [ ] User profiles and reputation
- [ ] Leaderboard system
- [ ] User reviews and ratings
- [ ] Discord/social integration

---

## 📄 License

This project is part of the VIT 3rd Semester PVG Hackathon.

---

## 👨‍💻 Contributors

- **Sahil Khaire** - Full Stack Development
- Better Auth Team - Authentication Framework
- Algorand Foundation - Blockchain Integration

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API documentation
3. Check terminal logs for detailed errors
4. Verify all environment variables are set correctly

---

## 🎉 Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
# (Edit .env.local with your GitHub OAuth credentials)

# Start development server
npm run dev

# Open browser
# http://localhost:3000
```

That's it! You're ready to go. 🚀

---

**Last Updated:** April 3, 2026  
**Version:** 1.0.0 (Authentication Module Complete)
