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
  releaseType: 'TIME_BASED' | 'MILESTONE_BASED';
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

export interface Milestone {
  id: string;
  description: string;
  amount: string;
  isCompleted: boolean;
  isApproved: boolean;
  proofHash?: string;
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
  releaseType: 'TIME_BASED' | 'MILESTONE_BASED';
  chainSlug: string;
  assetSlug: string;
  jobTitle?: string;
  description?: string;
  contractHash?: string;
  contractName?: string;
  recipientEmail?: string;
  deliverables?: string;
  outOfScope?: string;
  reviewPeriodDays?: number;
  noticePeriodDays?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  endDate?: number;
  ongoing?: boolean;
  milestones?: { description: string; amount: string }[];
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

  getContract: async (contractId: string) => {
    const response = await apiClient.get<{
      contract: PaymentContract;
      userRole: 'employer' | 'contractor';
    }>(`/api/payment-contracts/${contractId}`);
    return response;
  },

  getMilestones: async (contractId: string) => {
    const response = await apiClient.get<{
      milestones: Milestone[];
    }>(`/api/payment-contracts/${contractId}/milestones`);
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
