-- Run in Supabase SQL editor.
-- Creates table for contract attachments (docs uploaded by employer when creating a contract).
-- Storage: create a bucket named "contract-attachments" in Supabase Dashboard > Storage (private).

CREATE TABLE IF NOT EXISTS contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES payment_contracts(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  label text,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_attachments_contract_id ON contract_attachments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_attachments_uploaded_by ON contract_attachments(uploaded_by);

COMMENT ON TABLE contract_attachments IS 'Files attached by employer when creating a contract (brief, NDA, scope docs).';
