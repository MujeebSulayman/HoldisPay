-- ============================================
-- Holdis Database Setup for Supabase
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

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

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_chain_id ON user_wallets(chain_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets(wallet_address);

-- Invoice tracking table
CREATE TABLE IF NOT EXISTS invoices (
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

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_id ON invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issuer ON invoices(issuer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_receiver ON invoices(receiver_address);

-- Transactions table (for audit trail)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Payment contracts (escrow agreements: on-chain sync + drafts from create form)
CREATE TABLE IF NOT EXISTS payment_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT UNIQUE,
  employer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  employer_address TEXT NOT NULL,
  contractor_address TEXT NOT NULL,
  payment_amount TEXT NOT NULL,
  number_of_payments INT NOT NULL DEFAULT 0,
  payment_interval TEXT,
  payments_made INT NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  last_payment_date TIMESTAMPTZ,
  release_type TEXT NOT NULL CHECK (release_type IN ('TIME_BASED', 'MILESTONE_BASED')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED', 'DEFAULTED')),
  token_address TEXT,
  total_amount TEXT,
  remaining_balance TEXT,
  job_title TEXT,
  description TEXT,
  contract_hash TEXT,
  chain_slug TEXT,
  asset_slug TEXT,
  grace_period_days INT DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Extended contract fields (from create form)
  contract_name TEXT,
  recipient_email TEXT,
  deliverables TEXT,
  out_of_scope TEXT,
  review_period_days INT,
  notice_period_days INT,
  priority TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  contract_reference TEXT,
  is_ongoing BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_payment_contracts_contract_id ON payment_contracts(contract_id);
CREATE INDEX IF NOT EXISTS idx_payment_contracts_employer ON payment_contracts(employer_address);
CREATE INDEX IF NOT EXISTS idx_payment_contracts_contractor ON payment_contracts(contractor_address);
CREATE INDEX IF NOT EXISTS idx_payment_contracts_status ON payment_contracts(status);

-- Individual payments released from a contract
CREATE TABLE IF NOT EXISTS contract_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id TEXT NOT NULL,
  payment_number INT NOT NULL,
  amount TEXT NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON contract_payments(contract_id);

-- Milestones (for MILESTONE_BASED contracts)
CREATE TABLE IF NOT EXISTS contract_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,
  description TEXT,
  amount TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  proof_hash TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract ON contract_milestones(contract_id);

-- Team members (share splits)
CREATE TABLE IF NOT EXISTS contract_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id TEXT NOT NULL,
  member_address TEXT NOT NULL,
  share_percentage NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_team_members_contract ON contract_team_members(contract_id);

-- Bonuses
CREATE TABLE IF NOT EXISTS contract_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id TEXT NOT NULL,
  bonus_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  reason TEXT,
  is_claimed BOOLEAN DEFAULT FALSE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_bonuses_contract ON contract_bonuses(contract_id);

-- Disputes
CREATE TABLE IF NOT EXISTS contract_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id TEXT NOT NULL,
  dispute_id TEXT NOT NULL,
  raised_by TEXT NOT NULL,
  reason TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_disputes_contract ON contract_disputes(contract_id);

-- KYC documents table (separate for better organization)
CREATE TABLE IF NOT EXISTS kyc_documents (
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

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user ON kyc_documents(user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables (drop first so re-run is safe)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_contracts_updated_at ON payment_contracts;
CREATE TRIGGER update_payment_contracts_updated_at BEFORE UPDATE ON payment_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Policies: Users can read their own data (drop first so re-run is safe)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Policies: Users can view their invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (
    issuer_id::text = auth.uid()::text OR
    payer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
    receiver_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text)
  );

-- Policies: Users can view their transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Policies: Users can view their KYC documents
DROP POLICY IF EXISTS "Users can view own KYC" ON kyc_documents;
CREATE POLICY "Users can view own KYC" ON kyc_documents
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Service role can do everything (bypass RLS policies)
-- No explicit policy needed - service_role bypasses RLS automatically
