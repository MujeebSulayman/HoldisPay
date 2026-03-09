const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'success' }) // TransactionService uses 'success', 'pending', 'failed'
    .eq('tx_type', 'withdraw')
    .eq('status', 'pending');

  console.log('Updated stuck pending withdrawals:', error ? error : 'Success!');
}

main();
