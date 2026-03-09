const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, blockradar_reference, status, amount, created_at')
    .eq('tx_type', 'withdraw')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Pending Withdrawals:', data);
}

main();
