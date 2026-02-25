import { Address } from 'viem';

export enum ContractStatus {
  ACTIVE = 0,
  PAUSED = 1,
  COMPLETED = 2,
  TERMINATED = 3,
  DEFAULTED = 4,
}

export enum ReleaseType {
  TIME_BASED = 0,
  MILESTONE_BASED = 1,
}

export interface PaymentContract {
  id: bigint;
  employer: Address;
  contractor: Address;
  paymentAmount: bigint;
  numberOfPayments: bigint;
  paymentsMade: bigint;
  totalAmount: bigint;
  remainingBalance: bigint;
  tokenAddress: Address;
  startDate: bigint;
  endDate: bigint;
  nextPaymentDate: bigint;
  lastPaymentDate: bigint;
  paymentInterval: bigint;
  status: ContractStatus;
  releaseType: ReleaseType;
  jobTitle: string;
  description: string;
  contractHash: string;
  gracePeriodDays: bigint;
  createdAt: bigint;
  contractName?: string;
}

export interface TeamMember {
  memberAddress: Address;
  sharePercentage: bigint;
  isActive: boolean;
}

export interface PerformanceBonus {
  id: bigint;
  amount: bigint;
  reason: string;
  isClaimed: boolean;
}

export interface Dispute {
  id: bigint;
  raisedBy: Address;
  reason: string;
  isResolved: boolean;
}


export interface PaymentContractRecord {
  id: string;
  contract_id: string;
  employer_id?: string;
  employer_address: string;
  contractor_address: string;
  payment_amount: string;
  number_of_payments: number;
  payment_interval: string;
  payments_made: number;
  start_date: Date;
  end_date: Date;
  next_payment_date: Date;
  last_payment_date?: Date;
  release_type: 'TIME_BASED' | 'MILESTONE_BASED';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' | 'DEFAULTED';
  token_address: string;
  total_amount: string;
  remaining_balance: string;
  job_title?: string;
  description?: string;
  contract_hash?: string;
  grace_period_days: number;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  terminated_at?: Date;
}

export interface TeamMemberRecord {
  id: string;
  contract_id: string;
  member_address: string;
  share_percentage: number;
  is_active: boolean;
  added_at: Date;
  removed_at?: Date;
}

export interface BonusRecord {
  id: string;
  contract_id: string;
  bonus_id: string;
  amount: string;
  reason?: string;
  is_claimed: boolean;
  awarded_at: Date;
  claimed_at?: Date;
}

export interface DisputeRecord {
  id: string;
  contract_id: string;
  dispute_id: string;
  raised_by: string;
  reason: string;
  is_resolved: boolean;
  resolved_at?: Date;
  resolution?: string;
  created_at: Date;
}

export interface PaymentRecord {
  id: string;
  contract_id: string;
  payment_number: number;
  amount: string;
  paid_at: Date;
  tx_hash?: string;
}


export interface ContractCreatedEvent {
  contractId: bigint;
  employer: Address;
  contractor: Address;
  totalAmount: bigint;
  paymentAmount: bigint;
  paymentInterval: bigint;
  releaseType: ReleaseType;
  timestamp: bigint;
}

export interface ContractFundedEvent {
  contractId: bigint;
  amount: bigint;
  timestamp: bigint;
}

export interface PaymentReleasedEvent {
  contractId: bigint;
  amount: bigint;
  recipient: Address;
  paymentNumber: bigint;
  timestamp: bigint;
}

export interface ContractStatusChangedEvent {
  contractId: bigint;
  oldStatus: ContractStatus;
  newStatus: ContractStatus;
  timestamp: bigint;
}

export interface TeamMemberAddedEvent {
  contractId: bigint;
  memberAddress: Address;
  sharePercentage: bigint;
  timestamp: bigint;
}

export interface BonusAwardedEvent {
  contractId: bigint;
  bonusId: bigint;
  amount: bigint;
  reason: string;
  timestamp: bigint;
}

export interface DisputeRaisedEvent {
  contractId: bigint;
  disputeId: bigint;
  raisedBy: Address;
  reason: string;
  timestamp: bigint;
}

export interface DisputeResolvedEvent {
  contractId: bigint;
  disputeId: bigint;
  timestamp: bigint;
}
