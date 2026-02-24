/**
 * One-time backfill: populate user_chain_balances from existing transactions.
 * Run after applying migration 003_user_chain_balances.sql.
 *
 * Usage: npx tsx scripts/backfill-balances.ts   (from Backend folder, with .env present)
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

async function main() {
  const { balanceService } = await import('../src/services/balance.service');
  console.log('Backfilling user_chain_balances from transactions...');
  const result = await balanceService.backfillFromTransactions();
  console.log('Done.', result);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
