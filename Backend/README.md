# HoldisPay Backend

The backend is the server that powers HoldisPay. It handles user accounts, invoices, payment contracts, wallets, blockchain interactions, webhooks, and everything that happens behind the scenes. It is built with Express and TypeScript.


## What it does

- User registration, login, email verification, and password reset
- Invoice creation, status tracking, and expiry management
- Payment contract creation and lifecycle management (including milestones, disputes, and team payments)
- Crypto wallet management for users across multiple blockchain networks
- Real-time payment detection through blockchain event listeners
- Webhook handling for incoming payment notifications from Blockradar
- Email notifications for payments, invoices, and account events
- Fiat off-ramp via Monnify integration
- Rate fetching and balance management
- Admin controls for platform management and analytics
- Swagger API documentation

## Services overview

| Service | What it handles |
|---|---|
| User | Account management, profile updates, KYC |
| Auth | Login, tokens, sessions, password resets |
| Invoice | Invoice lifecycle and expiry |
| Payment Contract | Smart contract interactions, milestones, disputes |
| Wallet | User wallet creation and balance tracking |
| Blockchain | On-chain reads and writes via ethers/viem |
| Blockradar | Wallet-as-a-service for multi-chain deposits |
| Webhook | Processing incoming payment events |
| Email | Transactional emails via Resend |
| Transaction | Recording and querying payment history |
| Cache | Redis-based caching layer |
| Analytics | Platform-wide stats and reporting |
| Monnify | Fiat payment processing |
| Rate | Crypto exchange rate lookups |


## Getting started

Make sure you have Node.js 18 or higher and npm 9 or higher installed.

**Install dependencies**

```bash
npm install
```

**Set up your environment**

Copy the example environment file and fill in the values:

```bash
cp .env.example .env
```

The key variables you need to configure are:

```
PORT=3001
NODE_ENV=development

# Blockchain
RPC_URL=
CHAIN_ID=
HOLDIS_CONTRACT_ADDRESS=

# Database
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis
REDIS_URL=

# Blockradar (crypto wallet provider)
BLOCKRADAR_API_KEY=
BLOCKRADAR_API_URL=
BLOCKRADAR_WALLET_ID=

# Security
JWT_SECRET=
ENCRYPTION_KEY=

# Email
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_FROM_NAME=

# Frontend URL (for links in emails and CORS)
FRONTEND_URL=
```

**Run in development**

```bash
npm run dev
```

The server will start on `http://localhost:3001` by default.

**Build and run for production**

```bash
npm run build
npm start
```


## Project structure


src/
  app.ts            Express app setup (middleware, routes, CORS)
  index.ts          Server entry point
  routes/           Route definitions for each area of the API
  controllers/      Request handlers for each route
  services/         Business logic and third-party integrations
  middlewares/      Auth, file upload, and webhook verification
  config/           Configuration and environment loading
  constants/        Shared constants
  types/            TypeScript types and interfaces
  utils/            Shared helper functions
  contracts/        ABI files for on-chain interactions
scripts/            One-off admin and maintenance scripts
```

---

## Utility scripts

These scripts are run manually when needed:

| Script | What it does |
|---|---|
| `npm run create-admin` | Creates the initial admin account |
| `npm run migrate-wallets` | Migrates existing user wallets |
| `npm run verify-wallets` | Verifies wallet setup with Blockradar |
| `npm run check-contract` | Checks the deployed smart contract state |
| `npm run setup-auto-settlement` | Configures auto-settlement for Base USDC |

---

## API documentation

When the server is running, Swagger docs are available at:

```
http://localhost:3001/api-docs
```

---

## Notes

- The backend connects to Supabase as its database and auth layer
- Redis is used for caching and session management; the server will warn if it is not reachable
- Blockchain event listeners run automatically on startup and listen for on-chain payment events
- All blockchain interactions target Base (and optionally Ethereum, Polygon, BNB, Arbitrum, Optimism, Tron, and Solana) through Blockradar
