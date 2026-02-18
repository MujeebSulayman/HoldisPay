import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

config({ path: resolve(__dirname, '../.env') });

const API_KEY = process.env.BLOCKRADAR_API_KEY;
const API_URL = process.env.BLOCKRADAR_API_URL || 'https://api.blockradar.co';

async function verifyWallets() {
  try {
    console.log('Fetching all wallets from Blockradar...\n');

    const response = await axios.get(`${API_URL}/v1/wallets`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    const wallets = response.data.data;
    console.log(`Found ${wallets.length} wallet(s) in your account:\n`);

    wallets.forEach((wallet: any, idx: number) => {
      console.log(`${idx + 1}. ${wallet.name || 'Unnamed Wallet'}`);
      console.log(`   ID: ${wallet.id}`);
      console.log(`   Chain: ${wallet.blockchain || 'N/A'}`);
      console.log(`   Type: ${wallet.type || 'N/A'}`);
      console.log('');
    });

    console.log('Wallet IDs in your .env file:');
    console.log(`BLOCKRADAR_WALLET_ID_BASE=${process.env.BLOCKRADAR_WALLET_ID_BASE}`);
    console.log(`BLOCKRADAR_WALLET_ID_ETHEREUM=${process.env.BLOCKRADAR_WALLET_ID_ETHEREUM}`);
    console.log(`BLOCKRADAR_WALLET_ID_POLYGON=${process.env.BLOCKRADAR_WALLET_ID_POLYGON}`);
    console.log(`BLOCKRADAR_WALLET_ID_BNB=${process.env.BLOCKRADAR_WALLET_ID_BNB}`);
    console.log(`BLOCKRADAR_WALLET_ID_ARBITRUM=${process.env.BLOCKRADAR_WALLET_ID_ARBITRUM}`);
    console.log(`BLOCKRADAR_WALLET_ID_OPTIMISM=${process.env.BLOCKRADAR_WALLET_ID_OPTIMISM}`);
    console.log(`BLOCKRADAR_WALLET_ID_TRON=${process.env.BLOCKRADAR_WALLET_ID_TRON}`);
    console.log(`BLOCKRADAR_WALLET_ID_SOLANA=${process.env.BLOCKRADAR_WALLET_ID_SOLANA}`);

  } catch (error: any) {
    console.error('Failed to fetch wallets:', error.response?.data || error.message);
  }
}

verifyWallets();
