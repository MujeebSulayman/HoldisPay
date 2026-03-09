const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const SETTLEMENT_CHAIN_SLUG = 'base';
  const SETTLEMENT_TOKEN_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'.toLowerCase();
  const userId = 'ab15969c-4b10-4aa8-842c-8a02af945e26'; // user id
  
  // Set back to 500.2372
  const newBalanceWei = '500237200';
  await supabase
      .from('user_chain_balances')
      .update({ balance_wei: newBalanceWei })
      .eq('user_id', userId)
      .eq('chain_id', SETTLEMENT_CHAIN_SLUG)
      .eq('token_address', SETTLEMENT_TOKEN_ADDRESS);
}
main();
