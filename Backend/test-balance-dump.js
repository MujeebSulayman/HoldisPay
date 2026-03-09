const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const email = 'sulaymanmujeeb6@gmail.com'; 
  const { data: users } = await supabase.from('users').select('id, email').eq('email', email).single();
  
  if (users) {
    const { data } = await supabase
      .from('user_chain_balances')
      .select('*')
      .eq('user_id', users.id);
      
    console.log(`Balances for ${email}:`, data);
  } else {
    console.log('User not found');
  }
}
main();
