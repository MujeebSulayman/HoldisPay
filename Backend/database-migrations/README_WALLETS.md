# Where multi-chain addresses are stored

## One address in `users` table

The **`users`** table has a single primary wallet for display and EVM use:

- `wallet_address` – one address (the EVM primary, e.g. `0x...`)
- `wallet_address_id` – Blockradar address ID for that primary

That is why you only see one address in the API response or in `users`.

## All chain addresses in `user_wallets` table

**Solana, Tron, and every other chain** are stored in **`user_wallets`** (one row per chain per user):

| Column            | Example                          |
|------------------|-----------------------------------|
| `user_id`        | user UUID                          |
| `chain_id`       | `base`, `ethereum`, `tron`, `solana`, … |
| `chain_name`     | Base, Ethereum, Tron, Solana        |
| `wallet_address` | `0x...` (EVM) or `T...` (Tron) or `4D4d...` (Solana) |
| `wallet_address_id` | Blockradar address ID          |
| `is_primary`     | true only for the primary EVM chain (e.g. base) |

## How to see Solana and Tron in the database

Run in Supabase SQL Editor:

```sql
SELECT user_id, chain_id, chain_name, wallet_address, is_primary
FROM user_wallets
WHERE user_id = 'YOUR_USER_ID'
ORDER BY is_primary DESC, chain_id;
```

Replace `YOUR_USER_ID` with the user’s UUID (e.g. `a43275af-4ebf-47a3-8814-709ca9027f60`).

You should see 8 rows for a user with multi-chain enabled (base, ethereum, polygon, bnb, arbitrum, optimism, tron, solana).  
EVM chains share the same `wallet_address`; Tron and Solana have different formats (`T...`, base58).

## API to get all chains

- **GET** `/api/users/:userId/wallets` – returns all chain wallets (including Solana and Tron).
- **GET** `/api/users/:userId/wallets/:chainId` – one chain, e.g. `chainId` = `solana` or `tron` (lowercase).
