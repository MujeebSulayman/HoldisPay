const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const SETTLEMENT_CHAIN_SLUG = 'base';
  const SETTLEMENT_TOKEN_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'.toLowerCase();
  const userId = 'ab15969c-4b10-4aa8-842c-8a02af945e26'; // user id
  
  const amountStr = '500.2372';
  const amountNum = parseFloat(amountStr);
  let amountWei = BigInt(Math.round(amountNum * 10 ** 6));
  
  console.log('1. Requested Amount:', amountStr);
  console.log('2. Requested Wei:', amountWei.toString());
  
  const { data: dbRow } = await supabase
        .from('user_chain_balances')
        .select('balance_wei')
        .eq('user_id', userId)
        .eq('chain_id', SETTLEMENT_CHAIN_SLUG)
        .eq('token_address', SETTLEMENT_TOKEN_ADDRESS)
        .maybeSingle();

  console.log('3. DB Row:', dbRow);
  
  if (dbRow?.balance_wei) {
      const availableWei = BigInt(dbRow.balance_wei);
      console.log('4. Available Wei:', availableWei.toString());
      console.log('5. Difference:', (amountWei - availableWei).toString());
      
      if (amountWei > availableWei && amountWei - availableWei <= 10000n) {
          console.log('-> Capping amountWei to availableWei');
          amountWei = availableWei;
      }
  }
  
  console.log('6. Final AmountWei:', amountWei.toString());
  
  // NGN Calculation
  const ngnRate = 1450;
  const amountNgnFloat = amountNum * ngnRate;
  const amountNgnFixed = Number((amountNum * ngnRate).toFixed(2));
  
  console.log('7. Final NGN Amount (Float):', amountNgnFloat);
  console.log('8. Final NGN Amount (Fixed):', amountNgnFixed);
}

main();
