import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { supabase } from '../src/config/supabase';
import { multiChainWalletService } from '../src/services/multi-chain-wallet.service';
import { logger } from '../src/utils/logger';

async function migrateUserWallets() {
  try {
    console.log('Starting user wallet migration...');

    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, wallet_address_id, wallet_address');

    if (error || !users) {
      console.error('Failed to fetch users:', error);
      return;
    }

    console.log(`Found ${users.length} users to migrate`);

    for (const user of users) {
      try {
        // Check if user already has multi-chain wallets
        const { data: existingWallets } = await supabase
          .from('user_wallets')
          .select('chain_id')
          .eq('user_id', user.id);

        if (existingWallets && existingWallets.length > 0) {
          console.log(`User ${user.id} already has ${existingWallets.length} wallets, skipping`);
          continue;
        }

        // Insert base wallet record first (from existing data)
        await supabase.from('user_wallets').insert({
          user_id: user.id,
          chain_id: 'base',
          chain_name: 'Base Sepolia',
          wallet_address_id: user.wallet_address_id,
          wallet_address: user.wallet_address,
          is_primary: true,
        });

        console.log(`Created base wallet record for user ${user.id}`);

        // Create wallets on all other chains
        const userName = `${user.first_name} ${user.last_name}`;
        await multiChainWalletService.createWalletsOnAllChains(user.id, userName);

        console.log(`✓ Migrated wallets for user ${user.id} (${userName})`);
      } catch (error) {
        console.error(`Failed to migrate user ${user.id}:`, error);
      }
    }

    console.log('Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateUserWallets();
