# HoldisPay Frontend

The frontend is the user-facing side of HoldisPay. It is built with Next.js and gives users a clean interface to manage invoices, payment contracts, wallets, and transactions. It also includes an admin-facing panel for platform management.

## What it does

- Landing page that introduces the platform to new visitors
- Sign up, sign in, email verification, and password reset flows
- A main dashboard where users can see an overview of their activity
- Invoice creation, management, and detail views
- Payment contract creation and tracking
- Wallet management and withdrawal flows
- Transaction history
- Analytics for tracking payments and earnings
- An admin panel for platform-level oversight
- QR code scanning for payments
- Multi-chain network switching support


## Pages and sections

| Section | What it covers |
|---|---|
| Landing | Public-facing page for new visitors |
| Sign In / Sign Up | User authentication |
| Verify Email | Email confirmation after registration |
| Forgot / Reset Password | Password recovery |
| Dashboard | Overview of user activity and balances |
| Invoices | Create and manage invoices |
| Contracts | Create and track payment contracts |
| Wallet | View balances and supported assets |
| Withdraw | Initiate withdrawals from the wallet |
| Transactions | Full history of payments and activity |
| Analytics | Charts and stats on payment performance |
| Settings | Account and profile settings |
| Admin | Platform management for administrators |


## Getting started

Make sure you have Node.js 18 or higher installed.

**Install dependencies**

```bash
npm install
```

**Set up your environment**

Create a `.env` file in this folder with the following:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

This should point to wherever the backend is running locally.

**Run in development**

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

**Build for production**

```bash
npm run build
npm start
```

## Project structure

```
app/              Pages and routing (Next.js App Router)
components/       Shared UI components used across pages
lib/
  api/            Functions for talking to the backend
  contexts/       React context providers (auth, wallet, etc.)
  hooks/          Custom React hooks
  utils/          Helper functions
public/           Static assets
scripts/          Build utilities
```


## Notes

- The frontend expects the backend to be running before most features will work
- All API calls go through the `lib/api` folder, which targets the `NEXT_PUBLIC_API_URL` you set in `.env`
- Authentication is handled via JWT tokens returned by the backend
