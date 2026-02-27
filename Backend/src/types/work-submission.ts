export type WorkSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface WorkSubmission {
  id: string;
  contractId: string;
  comment: string | null;
  submittedAt: string;
  status: WorkSubmissionStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewerComment: string | null;
  releasedAt: string | null;
}

export interface WorkSubmissionRecord {
  id: string;
  contract_id: string;
  comment: string | null;
  submitted_at: string;
  status: WorkSubmissionStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_comment: string | null;
  released_at: string | null;
  created_at?: string;
  updated_at?: string;
}
