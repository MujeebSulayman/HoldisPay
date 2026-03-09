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

  const amountStr = '500.2372';
  const amountNum = parseFloat(amountStr);
  let amountWei = BigInt(Math.round(amountNum * 10 ** 6));
  
  const { data: dbRow } = await supabase
        .from('user_chain_balances')
        .select('balance_wei')
        .eq('user_id', userId)
        .eq('chain_id', SETTLEMENT_CHAIN_SLUG)
        .eq('token_address', SETTLEMENT_TOKEN_ADDRESS)
        .maybeSingle();

  if (dbRow?.balance_wei) {
      const availableWei = BigInt(dbRow.balance_wei);
      if (amountWei > availableWei && amountWei - availableWei <= 10000n) {
          amountWei = availableWei;
      }
  }
  
  // Simulate balanceService.tryDebit
  const { data: dbRowForDebit } = await supabase
      .from('user_chain_balances')
      .select('balance_wei')
      .eq('user_id', userId)
      .eq('chain_id', SETTLEMENT_CHAIN_SLUG)
      .eq('token_address', SETTLEMENT_TOKEN_ADDRESS)
      .single();

  const currentWei = BigInt(dbRowForDebit.balance_wei);
  console.log('BalanceService.tryDebit check:');
  console.log('CurrentWei:', currentWei.toString());
  console.log('Requested Wei:', amountWei.toString());
  
  if (currentWei < amountWei) {
      console.log('-> tryDebit FAILS! Returns false');
  } else {
      console.log('-> tryDebit SUCCEEDS! Deducting...');
      const updatedBalance = currentWei - amountWei;
      await supabase
        .from('user_chain_balances')
        .update({ balance_wei: updatedBalance.toString() })
        .eq('user_id', userId)
        .eq('chain_id', SETTLEMENT_CHAIN_SLUG)
        .eq('token_address', SETTLEMENT_TOKEN_ADDRESS);
        
      console.log('-> Simulating Monnify...');
      const ngnRate = 1450;
      const amountNgnFloat = amountNum * ngnRate; // original problem
      const amountNgnFixed = Number((amountNum * ngnRate).toFixed(2));
      console.log('Amount NGN to send to Monnify:', amountNgnFixed);
  }
}

main();
