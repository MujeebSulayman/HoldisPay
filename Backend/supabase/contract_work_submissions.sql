-- Run this in Supabase SQL editor to add work submission flow for project-based contracts.
-- One submission per contract: contractor submits work + comment, employer approves/rejects + comment, then can release.

CREATE TABLE IF NOT EXISTS contract_work_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES payment_contracts(id) ON DELETE CASCADE,
  comment text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  reviewer_comment text,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_work_submissions_contract_id ON contract_work_submissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_work_submissions_status ON contract_work_submissions(status);

COMMENT ON TABLE contract_work_submissions IS 'One row per contract: contractor submits work + comment, employer approves/rejects, then releases payment.';
