import { apiClient } from './client';

export interface PaymentContract {
  id: string;
  employer: string;
  contractor: string;
  employerDisplayName?: string | null;
  contractorDisplayName?: string | null;
  paymentAmount: string;
  numberOfPayments: string;
  paymentsMade: string;
  totalAmount: string;
  remainingBalance: string;
  tokenAddress: string;
  startDate: number;
  endDate: number;
  nextPaymentDate: number;
  lastPaymentDate?: number;
  paymentInterval: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' | 'DEFAULTED';
  releaseType: 'PROJECT_BASED' | 'TIME_BASED';
  jobTitle?: string;
  description?: string;
  contractHash?: string;
  contractName?: string;
  recipientEmail?: string;
  deliverables?: string;
  gracePeriodDays: string;
  createdAt: number;
  isOngoing?: boolean;
  chainSlug?: string;
  assetSlug?: string;
}

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

export interface ContractAttachment {
  id: string;
  fileName: string;
  label: string | null;
  fileSize: number;
  mimeType: string | null;
  createdAt: string;
}

export interface TeamMember {
  memberAddress: string;
  sharePercentage: string;
  isActive: boolean;
}

export interface ContractStats {
  asEmployer: string;
  asContractor: string;
  totalPlatform: string;
}

export interface UserContractsResponse {
  contracts: PaymentContract[];
  pagination: {
    totalEmployer: string;
    totalContractor: string;
    offset: string;
    limit: string;
  };
}

export interface CreateContractRequest {
  contractorAddress?: string;
  contractorTag?: string;
  paymentAmount: string;
  numberOfPayments: number;
  paymentInterval: number;
  startDate: number;
  releaseType?: 'PROJECT_BASED' | 'TIME_BASED';
  chainSlug: string;
  assetSlug: string;
  jobTitle?: string;
  description?: string;
  contractHash?: string;
  contractName?: string;
  deliverables?: string;
  endDate?: number;
  ongoing?: boolean;
}

export const paymentContractApi = {
  createContract: async (data: CreateContractRequest) => {
    const response = await apiClient.post('/api/payment-contracts/create', data);
    return response;
  },

  getUserContracts: async () => {
    const response = await apiClient.get<UserContractsResponse>('/api/payment-contracts/my-contracts');
    return response;
  },

  validateContractorTag: async (tag: string) => {
    const t = tag.trim().toLowerCase().replace(/^@/, '');
    if (!t) return { success: true, data: { exists: false } };
    const response = await apiClient.get<{ exists: boolean; displayName?: string }>(
      `/api/payment-contracts/validate-contractor?tag=${encodeURIComponent(t)}`
    );
    return response;
  },

  getContract: async (contractId: string) => {
    const response = await apiClient.get<{
      contract: PaymentContract;
      workSubmission: WorkSubmission | null;
      attachments?: ContractAttachment[];
      userRole: 'employer' | 'contractor' | 'admin';
    }>(`/api/payment-contracts/${contractId}`);
    return response;
  },

  uploadAttachment: async (contractId: string, file: File, label?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (label != null && label.trim()) form.append('label', label.trim());
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payment-contracts/${contractId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || 'Upload failed' };
    return { success: true, data: data.data };
  },

  getAttachmentDownloadUrl: async (contractId: string, attachmentId: string) => {
    const response = await apiClient.get<{ url: string }>(
      `/api/payment-contracts/${contractId}/attachments/${attachmentId}/download-url`
    );
    return response;
  },

  submitWork: async (contractId: string, comment?: string) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/payment-contracts/${contractId}/submit-work`,
      { comment: comment ?? '' }
    );
    return response;
  },

  approveWork: async (contractId: string, approved: boolean, comment?: string) => {
    const response = await apiClient.post<{ success: boolean; message: string; data?: { approved: boolean } }>(
      `/api/payment-contracts/${contractId}/approve-work`,
      { approved, comment: comment ?? '' }
    );
    return response;
  },

  releasePayment: async (contractId: string) => {
    const response = await apiClient.post<{ success: boolean; message: string; data?: { releasedAt: string } }>(
      `/api/payment-contracts/${contractId}/release-payment`
    );
    return response;
  },

  getTeamMembers: async (contractId: string) => {
    const response = await apiClient.get<{
      success: boolean;
      data: {
        teamMembers: TeamMember[];
      };
    }>(`/api/payment-contracts/${contractId}/team`);
    return response;
  },

  getContractStats: async () => {
    const response = await apiClient.get<{
      success: boolean;
      data: ContractStats;
    }>('/api/payment-contracts/stats/overview');
    return response;
  },

  claimPayment: async (contractId: string) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: any;
    }>(`/api/payment-contracts/${contractId}/claim`);
    return response;
  },

  updateContract: async (contractId: string, data: Partial<CreateContractRequest>) => {
    const response = await apiClient.patch<{ success: boolean; message?: string; data?: { id: string } }>(
      `/api/payment-contracts/${contractId}`,
      data
    );
    return response;
  },

  deleteContract: async (contractId: string) => {
    const response = await apiClient.delete<{ success: boolean; message?: string }>(
      `/api/payment-contracts/${contractId}`
    );
    return response;
  },

  createFundLink: async (contractId: string, amount?: string) => {
    const response = await apiClient.post<{
      paymentLinkUrl: string;
      paymentLinkId: string;
    }>(`/api/payment-contracts/${contractId}/fund-link`, amount != null ? { amount } : {});
    return response;
  },
};
