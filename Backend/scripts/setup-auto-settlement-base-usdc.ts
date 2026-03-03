import 'dotenv/config';
import { blockradarService } from '../src/services/blockradar.service';
import { SUPPORTED_CHAINS } from '../src/config/chains';
import { env } from '../src/config/env';

const WALLET_ID = SUPPORTED_CHAINS.base?.walletId || env.BLOCKRADAR_WALLET_ID;
const API_KEY = env.BLOCKRADAR_API_KEY;

async function main() {
  if (!WALLET_ID || !API_KEY) {
    console.error('Missing BLOCKRADAR_WALLET_ID (or Base walletId) or BLOCKRADAR_API_KEY');
    process.exit(1);
  }

  console.log('Wallet ID:', WALLET_ID);
  console.log('Enabling auto-settlement for wallet...');
  await blockradarService.enableAutoSettlementForWallet(WALLET_ID, { apiKey: API_KEY });
  console.log('Auto-settlement enabled.');

  const existingRules = await blockradarService.getAutoSettlementRules(WALLET_ID, { apiKey: API_KEY });
  const baseUsdcRule = existingRules.find(
    (r) =>
      r.destination?.blockchain?.toLowerCase() === 'base' &&
      r.destination?.asset?.toUpperCase() === 'USDC'
  );
  if (baseUsdcRule) {
    console.log('Rule "Settle all to Base USDC" already exists:', baseUsdcRule.id);
    return;
  }

  console.log('Creating rule: settle USDC/USDT/DAI to Base USDC...');
  await blockradarService.createAutoSettlementRule(
    WALLET_ID,
    {
      name: 'Settle all to Base USDC',
      order: 'RECOMMENDED',
      slippageTolerance: '-1',
      source: {
        assets: ['USDC', 'USDT', 'DAI'],
        minAmount: '0',
        maxAmount: '-1',
      },
      destination: {
        blockchain: 'base',
        asset: 'USDC',
      },
    },
    { apiKey: API_KEY }
  );
  console.log('Rule created. All matching deposits will be auto-settled to Base USDC.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
