-- ============================================
-- Holdis Payment Contracts Migration
-- Add tables for the new HoldisPayments system
-- ============================================

-- Payment Contracts table
CREATE TABLE IF NOT EXISTS payment_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT NOT NULL UNIQUE,
  employer_id UUID REFERENCES users(id),
  employer_address TEXT NOT NULL,
  contractor_address TEXT NOT NULL,
  payment_amount TEXT NOT NULL,
  number_of_payments INTEGER NOT NULL,
  payment_interval BIGINT NOT NULL,
  payments_made INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  next_payment_date TIMESTAMPTZ NOT NULL,
  last_payment_date TIMESTAMPTZ,
  release_type TEXT NOT NULL CHECK (release_type IN ('TIME_BASED', 'MILESTONE_BASED')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED', 'DEFAULTED')),
  token_address TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  remaining_balance TEXT NOT NULL,
  job_title TEXT,
  description TEXT,
  contract_hash TEXT,
  grace_period_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_contracts_contract_id ON payment_contracts(contract_id);
CREATE INDEX idx_payment_contracts_employer ON payment_contracts(employer_id);
CREATE INDEX idx_payment_contracts_employer_address ON payment_contracts(employer_address);
CREATE INDEX idx_payment_contracts_contractor_address ON payment_contracts(contractor_address);
CREATE INDEX idx_payment_contracts_status ON payment_contracts(status);
CREATE INDEX idx_payment_contracts_release_type ON payment_contracts(release_type);
CREATE INDEX idx_payment_contracts_created_at ON payment_contracts(created_at);

-- Milestones table
CREATE TABLE IF NOT EXISTS contract_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT NOT NULL,
  milestone_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  amount TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  proof_hash TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, milestone_id),
  FOREIGN KEY (contract_id) REFERENCES payment_contracts(contract_id) ON DELETE CASCADE
);

CREATE INDEX idx_contract_milestones_contract_id ON contract_milestones(contract_id);
CREATE INDEX idx_contract_milestones_is_completed ON contract_milestones(is_completed);
CREATE INDEX idx_contract_milestones_is_approved ON contract_milestones(is_approved);

-- Team Members table
CREATE TABLE IF NOT EXISTS contract_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT NOT NULL,
  member_address TEXT NOT NULL,
  share_percentage INTEGER NOT NULL CHECK (share_percentage >= 0 AND share_percentage <= 10000),
  is_active BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(contract_id, member_address),
  FOREIGN KEY (contract_id) REFERENCES payment_contracts(contract_id) ON DELETE CASCADE
);

CREATE INDEX idx_contract_team_members_contract_id ON contract_team_members(contract_id);
CREATE INDEX idx_contract_team_members_member_address ON contract_team_members(member_address);
CREATE INDEX idx_contract_team_members_is_active ON contract_team_members(is_active);

-- Performance Bonuses table
CREATE TABLE IF NOT EXISTS contract_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT NOT NULL,
  bonus_id BIGINT NOT NULL,
  amount TEXT NOT NULL,
  reason TEXT,
  is_claimed BOOLEAN DEFAULT FALSE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  UNIQUE(contract_id, bonus_id),
  FOREIGN KEY (contract_id) REFERENCES payment_contracts(contract_id) ON DELETE CASCADE
);

CREATE INDEX idx_contract_bonuses_contract_id ON contract_bonuses(contract_id);
CREATE INDEX idx_contract_bonuses_is_claimed ON contract_bonuses(is_claimed);

-- Disputes table
CREATE TABLE IF NOT EXISTS contract_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT NOT NULL,
  dispute_id BIGINT NOT NULL,
  raised_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, dispute_id),
  FOREIGN KEY (contract_id) REFERENCES payment_contracts(contract_id) ON DELETE CASCADE
);

CREATE INDEX idx_contract_disputes_contract_id ON contract_disputes(contract_id);
CREATE INDEX idx_contract_disputes_is_resolved ON contract_disputes(is_resolved);
CREATE INDEX idx_contract_disputes_raised_by ON contract_disputes(raised_by);

-- Payment History table
CREATE TABLE IF NOT EXISTS contract_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id BIGINT NOT NULL,
  payment_number INTEGER NOT NULL,
  amount TEXT NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  tx_hash TEXT,
  FOREIGN KEY (contract_id) REFERENCES payment_contracts(contract_id) ON DELETE CASCADE
);

CREATE INDEX idx_contract_payments_contract_id ON contract_payments(contract_id);
CREATE INDEX idx_contract_payments_paid_at ON contract_payments(paid_at);
CREATE INDEX idx_contract_payments_tx_hash ON contract_payments(tx_hash);

-- Updated_at triggers
CREATE TRIGGER update_payment_contracts_updated_at BEFORE UPDATE ON payment_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_milestones_updated_at BEFORE UPDATE ON contract_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE payment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;

-- Policies: Users can view contracts they're involved in
CREATE POLICY "Users can view own payment contracts" ON payment_contracts
  FOR SELECT USING (
    employer_id::text = auth.uid()::text OR
    employer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
    contractor_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
    contract_id IN (SELECT contract_id FROM contract_team_members WHERE member_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text))
  );

-- Policies: Users can view milestones for their contracts
CREATE POLICY "Users can view contract milestones" ON contract_milestones
  FOR SELECT USING (
    contract_id IN (
      SELECT contract_id FROM payment_contracts WHERE
        employer_id::text = auth.uid()::text OR
        employer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contractor_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text)
    )
  );

-- Policies: Users can view team members for their contracts
CREATE POLICY "Users can view contract team members" ON contract_team_members
  FOR SELECT USING (
    contract_id IN (
      SELECT contract_id FROM payment_contracts WHERE
        employer_id::text = auth.uid()::text OR
        employer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contractor_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text)
    )
  );

-- Policies: Users can view bonuses for their contracts
CREATE POLICY "Users can view contract bonuses" ON contract_bonuses
  FOR SELECT USING (
    contract_id IN (
      SELECT contract_id FROM payment_contracts WHERE
        employer_id::text = auth.uid()::text OR
        employer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contractor_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contract_id IN (SELECT contract_id FROM contract_team_members WHERE member_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text))
    )
  );

-- Policies: Users can view disputes for their contracts
CREATE POLICY "Users can view contract disputes" ON contract_disputes
  FOR SELECT USING (
    contract_id IN (
      SELECT contract_id FROM payment_contracts WHERE
        employer_id::text = auth.uid()::text OR
        employer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contractor_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text)
    )
  );

-- Policies: Users can view payments for their contracts
CREATE POLICY "Users can view contract payments" ON contract_payments
  FOR SELECT USING (
    contract_id IN (
      SELECT contract_id FROM payment_contracts WHERE
        employer_id::text = auth.uid()::text OR
        employer_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contractor_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text) OR
        contract_id IN (SELECT contract_id FROM contract_team_members WHERE member_address IN (SELECT wallet_address FROM users WHERE id::text = auth.uid()::text))
    )
  );
