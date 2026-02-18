# Holdis Smart Contract

Production-grade blockchain invoice and payment protocol with hybrid on-chain/off-chain architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technical Specification](#technical-specification)
- [Core Functionality](#core-functionality)
- [Integration Guide](#integration-guide)
- [API Reference](#api-reference)
- [Security Model](#security-model)
- [Deployment](#deployment)
- [Testing](#testing)
- [License](#license)

---

## Overview

Holdis is an invoice and payment protocol that leverages blockchain technology for immutable state tracking while maintaining funds in off-chain custody. The system provides two operational modes: direct payment for instant settlements and escrow mode for deliverable-based transactions.

### Key Characteristics

- **Hybrid Architecture**: On-chain state registry with off-chain fund custody
- **Dual Payment Modes**: Direct payment and escrow-based workflows
- **Multi-Token Support**: Native cryptocurrency and ERC20 tokens
- **Upgradeable Design**: UUPS (Universal Upgradeable Proxy Standard) pattern
- **Event-Driven Integration**: Real-time backend orchestration via contract events
- **Enterprise-Ready**: Role-based access control, pausable operations, and comprehensive audit trails

### Use Cases

- **Freelance Platforms**: Instant payments or milestone-based escrow
- **E-commerce**: Buyer protection with delivery confirmation
- **B2B Invoicing**: Corporate payment workflows with audit trails
- **Service Marketplaces**: Gig economy transaction management
- **International Remittance**: Cross-border payments with verifiable records

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Blockchain Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Holdis Smart Contract                      │ │
│  │  - Invoice state registry                              │ │
│  │  - State transition logic                              │ │
│  │  - Event emissions                                     │ │
│  │  - Access control                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Events
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Orchestration Layer                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Backend Services                           │ │
│  │  - Event listeners                                     │ │
│  │  - Business logic                                      │ │
│  │  - KYC/compliance                                      │ │
│  │  - Notification services                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Custody Layer                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Blockradar Wallet Service                      │ │
│  │  - Custodial wallets                                   │ │
│  │  - Fund transfers                                      │ │
│  │  - Multi-token support                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Payment Modes

#### Mode 1: Direct Payment
```
┌─────────┐     ┌─────────┐     ┌───────────┐
│ Invoice │ ──> │  Funded │ ──> │ Completed │
│ Created │     │         │     │           │
└─────────┘     └─────────┘     └───────────┘
                                       ↓
                              Funds Released
```

**Characteristics:**
- Immediate settlement upon payment confirmation
- No deliverable verification required
- Suitable for services, consultations, donations

#### Mode 2: Escrow Payment
```
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│ Invoice │ ──> │  Funded │ ──> │ Delivered │ ──> │ Confirmed │ ──> │ Completed │
│ Created │     │         │     │           │     │           │     │           │
└─────────┘     └─────────┘     └───────────┘     └───────────┘     └───────────┘
                     ↓                ↓                  ↓                 ↓
               Funds Held      Proof Submitted    Receiver Verifies  Funds Released
```

**Characteristics:**
- Funds held until deliverable confirmation
- Issuer provides proof of delivery (IPFS hash)
- Receiver must confirm before release
- Suitable for goods, development work, custom services

---

## Technical Specification

### Contract Details

- **Contract Name**: `Holdis`
- **Solidity Version**: `^0.8.30`
- **License**: MIT
- **Upgradeability**: UUPS (ERC-1967)
- **Standards**: OpenZeppelin Upgradeable Contracts

### State Variables

#### Core Storage
- Invoice ID counter
- Global platform configuration
- Invoice registry mapping

#### Indexing
- Invoices by creator
- Invoices by payer
- Invoices by receiver

#### Token Management
- Whitelist of supported tokens
- Array of supported token addresses

### Data Structures

#### Invoice
- Unique identifier
- Issuer, payer, and receiver addresses
- Amount and token address
- Current status
- Escrow mode flag
- Description and attachment hash
- Timestamps (created, funded, delivered, completed)

#### Status Lifecycle
- **Pending**: Initial state, awaiting payment
- **Funded**: Payment received, funds in custody
- **Delivered**: Deliverables submitted (escrow only)
- **Completed**: Transaction finalized, funds released
- **Cancelled**: Invoice cancelled

#### Platform Settings
- Platform fee in basis points (250 = 2.5%)
- Maximum and minimum invoice amounts

### Access Control

#### Roles

- **ADMIN_ROLE**: Platform administration and configuration management
- **Users**: Permissionless invoice creation (no role required)

#### Function Authorization

| Function | Authorization |
|----------|--------------|
| `createInvoice` | Anyone |
| `markAsFunded` | Payer or Admin |
| `submitDelivery` | Issuer only |
| `confirmDelivery` | Receiver only |
| `cancelInvoice` | Issuer, Payer, or Admin |
| `updatePlatformSettings` | Admin only |
| `setSupportedToken` | Admin only |
| `pause` / `unpause` | Admin only |

---

## Core Functionality

### Invoice Creation

**Parameters:**
- `payer`: Address responsible for payment
- `receiver`: Address receiving funds upon completion
- `amount`: Invoice value in token decimals
- `token`: Token contract address (address(0) for native)
- `requiresDelivery`: Enable escrow mode if true
- `description`: Human-readable invoice description
- `attachmentHash`: IPFS hash for additional documentation

**Returns:** Unique invoice identifier

**Events Emitted:** `InvoiceCreated`

### Payment Confirmation

**Behavior:**
- **Direct Mode** (`requiresDelivery = false`): Automatically transitions to Completed
- **Escrow Mode** (`requiresDelivery = true`): Transitions to Funded, awaits delivery

**Authorization:** Payer or Admin

**Events Emitted:** `InvoiceFunded`, `InvoiceStatusUpdated`, `InvoiceCompleted` (direct mode)

### Delivery Submission

**Requirements:**
- Invoice must have `requiresDelivery = true`
- Current status must be Funded
- Caller must be invoice issuer

**Events Emitted:** `DeliverySubmitted`, `InvoiceStatusUpdated`

### Delivery Confirmation

**Behavior:**
- Validates deliverable quality
- Triggers fund release flow
- Calculates and emits platform fee

**Authorization:** Receiver only

**Events Emitted:** `DeliveryConfirmed`, `InvoiceCompleted`, `InvoiceStatusUpdated`

### Invoice Cancellation

**Constraints:**
- Only allowed for Pending invoices
- Cannot cancel after funding

**Authorization:** Issuer, Payer, or Admin

**Events Emitted:** `InvoiceCancelled`, `InvoiceStatusUpdated`

---

## Integration Guide

### Backend Event Listening

The backend should listen to contract events to orchestrate off-chain actions:

**InvoiceCreated Event:**
- Store invoice data in database
- Send notifications to payer

**InvoiceFunded Event:**
- Hold funds in custodial wallet
- Update invoice status to funded

**InvoiceCompleted Event:**
- Calculate net amount after platform fee
- Execute fund transfer from payer to receiver
- Collect platform fee
- Send payment completion notifications

### Payment Link Generation

Generate payment links with:
- Invoice ID in URL
- QR code for mobile payments
- Invoice details (amount, token, description, status)

### Query Functions

- Get invoice details by ID
- Get user's invoices (paginated)
- Get platform statistics and supported tokens

---

## API Reference

### Read Functions

#### `getInvoice(uint256 invoiceId)`
Returns complete invoice data structure.

#### `getIssuerInvoices(address issuer, uint256 offset, uint256 limit)`
Returns paginated list of invoices created by address.

#### `getPayerInvoices(address payer, uint256 offset, uint256 limit)`
Returns paginated list of invoices to be paid by address.

#### `getReceiverInvoices(address receiver, uint256 offset, uint256 limit)`
Returns paginated list of invoices receiving funds to address.

#### `getTotalInvoices()`
Returns total number of invoices created.

#### `getSupportedTokens()`
Returns array of supported token addresses.

#### `platformSettings()`
Returns current platform configuration.

### Administrative Functions

#### `updatePlatformSettings(uint256 platformFee, uint256 maxAmount, uint256 minAmount)`
Updates global platform parameters.

**Constraints:**
- `platformFee` ≤ 1000 (10% maximum)
- Requires `ADMIN_ROLE`

#### `setSupportedToken(address token, bool supported)`
Adds or removes token from whitelist.

**Requires:** `ADMIN_ROLE`

#### `pause()` / `unpause()`
Emergency circuit breaker for contract operations.

**Requires:** `ADMIN_ROLE`

### Events

- **InvoiceCreated**: Emitted when new invoice is created
- **InvoiceFunded**: Emitted when payment is confirmed
- **DeliverySubmitted**: Emitted when issuer submits proof of delivery
- **DeliveryConfirmed**: Emitted when receiver confirms delivery
- **InvoiceCompleted**: Emitted when transaction is finalized
- **InvoiceCancelled**: Emitted when invoice is cancelled
- **InvoiceStatusUpdated**: Emitted on any status change
- **TokenSupported**: Emitted when token whitelist is updated
- **PlatformSettingsUpdated**: Emitted when platform settings change

---

## Security Model

### Design Principles

1. **Separation of Concerns**: State management on-chain, fund custody off-chain
2. **Defense in Depth**: Multiple layers of validation and access control
3. **Fail-Safe Defaults**: Operations default to most restrictive permissions
4. **Principle of Least Privilege**: Minimal role permissions required

### Security Features

#### Reentrancy Protection
All state-changing functions with external calls protected via `ReentrancyGuardUpgradeable`.

#### Access Control
OpenZeppelin `AccessControlUpgradeable` for role-based permissions with revocable grants.

#### Pausability
Emergency stop mechanism via `PausableUpgradeable` for critical vulnerabilities.

#### Upgradeability
UUPS pattern allows bug fixes while maintaining state and address continuity.

#### Input Validation
- Amount bounds checking (min/max)
- Token whitelist enforcement
- Status transition validation
- Address zero checks

### Audit Considerations

- **No Fund Custody**: Contract holds no tokens, eliminating custody-related attack vectors
- **Immutable Audit Trail**: All state transitions permanently recorded via events
- **Limited Trust Assumptions**: Backend trusted for fund custody; on-chain logic independently verifiable
- **Upgrade Transparency**: Proxy pattern allows verification of implementation changes

### Best Practices for Integrators

1. **Event Monitoring**: Subscribe to all relevant events with redundant listeners
2. **State Reconciliation**: Periodically sync backend state with on-chain data
3. **Transaction Confirmation**: Wait for sufficient block confirmations before fund movements
4. **Error Handling**: Implement robust retry logic for failed transactions
5. **Rate Limiting**: Implement backend rate limits to prevent spam attacks

---

## Deployment

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Hardhat >= 3.0.0

### Installation

Run `npm install` to install dependencies.

### Compilation

Run `npm run compile` to compile contracts.

### Local Testing

- `npm test` - Run test suite
- `REPORT_GAS=true npm test` - Run with gas reporting

### Environment Configuration

Create a `.env` file in the Contract directory with:

**Base Mainnet:**
- BASE_RPC_URL
- BASE_PRIVATE_KEY

**Base Sepolia Testnet:**
- BASE_SEPOLIA_RPC_URL
- BASE_SEPOLIA_PRIVATE_KEY

**BaseScan:**
- BASESCAN_API_KEY

**Important:** Never commit your `.env` file. Keep your private keys secure.

### Network Deployment

The project uses a custom deployment script that deploys both the implementation contract and the UUPS proxy.

**Deploy to Base Sepolia (Testnet):**
- Run `npm run deploy:sepolia`

**Deploy to Base Mainnet:**
- Run `npm run deploy:mainnet`

**Deployment Process:**
1. Deploys the Holdis implementation contract
2. Deploys the HoldisProxy (UUPS proxy) with initialization
3. Saves deployment data to `deployments/<network>.json`
4. Displays contract addresses and explorer links

**Important:** Always interact with the **Proxy address**, not the implementation address.

### Contract Verification

After deployment, verify the contracts on BaseScan for transparency and easier interaction.

**Verify on Base Sepolia:**
- Run `npm run verify:sepolia`

**Verify on Base Mainnet:**
- Run `npm run verify:mainnet`

**Verification Process:**
1. Reads deployment data from `deployments/<network>.json`
2. Verifies the Holdis implementation contract
3. Verifies the HoldisProxy contract with constructor arguments
4. Submits to multiple block explorers (BaseScan, Blockscout, Sourcify)

### Deployment Files

Deployment data is saved to `deployments/<network>.json` containing:
- Network name and chain ID
- Implementation and proxy addresses
- Admin and deployer addresses
- Deployment timestamp and block number

### Upgrading Contracts

The Holdis contract uses the UUPS (Universal Upgradeable Proxy Standard) pattern, allowing upgrades while maintaining the same proxy address and state.

To upgrade the implementation:

1. Deploy new implementation contract
2. Call `upgradeToAndCall()` on the proxy with admin privileges
3. Verify the new implementation contract

Refer to OpenZeppelin's UUPS upgrade documentation for detailed procedures.

---

## Testing

### Test Coverage

Run `npx hardhat coverage` to generate test coverage report.

### Test Suite Structure

The test suite covers:
- Deployment & Initialization
- Direct Payment Mode
- Escrow Mode
- Invoice Cancellation
- Query Functions
- Admin Functions
- Access Control
- Event Emissions

### Running Tests

- `npx hardhat test` - Run all tests
- `REPORT_GAS=true npx hardhat test` - Run with gas reporting
- `npx hardhat test test/Holdis.test.ts` - Run specific test file

---

