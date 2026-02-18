import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminWalletId = process.env.BLOCKRADAR_WALLET_ID;
    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS;

    if (!adminEmail || !adminPassword || !adminWalletId || !adminWalletAddress) {
      console.error('Error: ADMIN_EMAIL, ADMIN_PASSWORD, BLOCKRADAR_WALLET_ID, and ADMIN_WALLET_ADDRESS must be set in .env');
      process.exit(1);
    }
    
    console.log('Checking if admin exists...');

    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    console.log('Creating admin user...');

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const { data: admin, error } = await supabase
      .from('users')
      .insert({
        email: adminEmail,
        password: hashedPassword,
        account_type: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        phone_number: '+2341234567890',
        wallet_address_id: adminWalletId,
        wallet_address: adminWalletAddress,
        kyc_status: 'verified',
        is_active: true,
        email_verified: true,
        phone_verified: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create admin:', error);
      return;
    }

    console.log('Admin user created successfully!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('\nIMPORTANT: Change this password after first login!');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    process.exit(0);
  }
}

createAdmin();
