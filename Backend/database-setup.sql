-- ============================================
-- Holdis Database Setup for Supabase
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'business', 'admin')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT,
  date_of_birth DATE,
  address JSONB,
  business_info JSONB,
  wallet_address_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'under_review', 'verified', 'rejected')),
  kyc_info JSONB,
  email_verified BOOLEAN DEFAULT TRUE,
  phone_verified BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- User wallets table for multi-chain support
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  chain_id TEXT NOT NULL,
  chain_name TEXT NOT NULL,
  wallet_address_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chain_id)
);

CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_user_wallets_chain_id ON user_wallets(chain_id);
CREATE INDEX idx_user_wallets_wallet_address ON user_wallets(wallet_address);

-- Invoice tracking table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id BIGINT NOT NULL UNIQUE,
  issuer_id UUID REFERENCES users(id),
  amount TEXT NOT NULL,
  description TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'expired')),
  payment_link_id TEXT,
  payment_link_url TEXT,
  payment_link_slug TEXT,
  payer_address TEXT,
  receiver_address TEXT,
  token_address TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_invoice_id ON invoices(invoice_id);
CREATE INDEX idx_invoices_issuer ON invoices(issuer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_customer_email ON invoices(customer_email);
CREATE INDEX idx_invoices_receiver ON invoices(receiver_address);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Transactions table (for audit trail)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  invoice_id BIGINT,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('invoice_create', 'invoice_fund', 'delivery_submit', 'delivery_confirm', 'transfer')),
  tx_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  amount TEXT,
  token_address TEXT,
  from_address TEXT,
  to_address TEXT,
  blockradar_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_status ON transactions(status);

-- KYC documents table (separate for better organization)
CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'drivers_license', 'national_id', 'business_registration')),
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  issuing_country TEXT,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT,
  selfie_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kyc_documents_user ON kyc_documents(user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Policies: Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Policies: Users can view their invoices
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (
    issuer_id::text = auth.uid()::text OR
    payer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
    receiver_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text)
  );

-- Policies: Users can view their transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Policies: Users can view their KYC documents
CREATE POLICY "Users can view own KYC" ON kyc_documents
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Service role can do everything (bypass RLS policies)
-- No explicit policy needed - service_role bypasses RLS automatically
