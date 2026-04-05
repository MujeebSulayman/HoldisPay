# HoldisPay

Pay and get paid with confidence.

HoldisPay is a payment platform for businesses, freelancers, and global teams. Create invoices, set up recurring payments, process fiat and crypto transactions, and protect funds with smart escrow until work is completed.


## What this repository contains

This is a monorepo made up of three parts that work together:

| Folder | What it is |
|---|---|
| `Frontend/` | The user-facing web application |
| `Backend/` | The server that powers the platform |
| `Contract/` | The smart contracts that handle on-chain payments |

Each folder has its own README with setup instructions specific to that part.



## What HoldisPay does

### The problem

Getting paid across borders is complicated and risky. Freelancers worry about not being paid after delivering work. Clients hesitate to pay upfront with no guarantees. Companies struggle to track distributed payments and reconcile transaction histories.

### The solution

HoldisPay gives both sides of a payment agreement confidence:

- The payer knows their money is protected until work is done
- The payee knows the money is already committed and waiting
- Both sides have a permanent record of everything that happened

### Payment types

**Invoices** — One-time requests for payment. Send a link, get paid.

**Recurring contracts** — Automated payments on a weekly, bi-weekly, or monthly schedule. Set the terms once and the system handles the rest.

**Milestone contracts** — Funds are released in phases as each milestone is completed and approved. Designed for longer projects with multiple stages.

**Team and split contracts** — A single payment automatically distributed to multiple contributors at defined percentages or fixed amounts.

### Two payment modes

**Quick Pay** — Direct transfers for trusted parties, tips, or one-off peer-to-peer transactions.

**Protected Pay** — Escrow-backed payments held until both parties confirm the agreed criteria are met.



## How it works

1. The sender creates a payment agreement (invoice, contract, or recurring schedule)
2. Funds are deposited into a user wallet or locked into an escrow contract on-chain
3. The recipient completes the work and the funds are released
4. Both parties can withdraw in stablecoins (USDC, USDT, DAI) or to a local bank account



## Who uses it

**Freelancers and contractors** — Issue professional invoices to clients globally and get paid without chasing.

**Startups and companies** — Automate payroll for remote teams and manage contracts with built-in milestones.

**Agencies** — Build trust with new clients by holding funds securely until delivery is confirmed.

**Global teams** — Distribute payments across borders without the delays and fees of traditional banking.



## Running the project locally

Each part of the system runs independently. Start them in this order:

### 1. Smart contracts (optional for local development)

See `Contract/README.md` for how to deploy and test the contracts on a local or test network.

### 2. Backend

```bash
cd Backend
npm install
# Copy .env and fill in your values
npm run dev
```

The server runs on `http://localhost:3001` by default.

### 3. Frontend

```bash
cd Frontend
npm install
# Set NEXT_PUBLIC_API_URL=http://localhost:3001 in .env
npm run dev
```

The app runs on `http://localhost:3000`.



## Security model

- Every user has a dedicated crypto wallet managed through Blockradar
- Payment contracts are deployed on-chain and enforced by code, not trust
- Funds in escrow cannot be moved without the agreed conditions being met
- JWT-based authentication with encrypted tokens and session management
- Rate limiting and request validation on all API endpoints



## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | Supabase (PostgreSQL) |
| Cache | Redis |
| Blockchain | Base (EVM-compatible), Hardhat, ethers.js |
| Wallet infrastructure | Blockradar |
| Email | Resend |
| Fiat off-ramp | Monnify |
