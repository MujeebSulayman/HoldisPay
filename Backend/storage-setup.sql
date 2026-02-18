-- ============================================
-- Holdis Storage Policies for KYC Documents
-- Run this AFTER creating the kyc-documents bucket
-- ============================================

-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read their own documents
CREATE POLICY "Users can view own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service role can do everything
CREATE POLICY "Service role full access" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'kyc-documents');
