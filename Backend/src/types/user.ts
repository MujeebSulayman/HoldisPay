export type KYCStatus = 'pending' | 'submitted' | 'under_review' | 'verified' | 'rejected';
export type AccountType = 'individual' | 'business' | 'admin';
export type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'business_registration';

export interface User {
  id: string;
  email: string;
  password?: string;
  accountType: AccountType;
  profile: UserProfile;
  tag?: string;
  kycInfo?: KYCInfo;
  walletAddressId: string;
  walletAddress: string;
  kycStatus: KYCStatus;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth?: string;
  address?: Address;
  businessInfo?: BusinessInfo;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BusinessInfo {
  businessName: string;
  registrationNumber: string;
  taxId: string;
  businessType: string;
  website?: string;
  description?: string;
}

export interface KYCInfo {
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  documents: KYCDocument[];
  verificationLevel: 'basic' | 'advanced' | 'business';
  rejectionReason?: string;
  notes?: string;
}

export interface KYCDocument {
  id: string;
  type: DocumentType;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingCountry?: string;
  frontImageUrl: string;
  backImageUrl?: string;
  selfieUrl?: string;
  uploadedAt: Date;
  verified: boolean;
}

/** Normalized username used as the user's tag (e.g. @johndoe). 3–30 chars, a-z0-9_- */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface CreateUserRequest {
  email: string;
  password: string;
  accountType: AccountType;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  dateOfBirth?: string;
  address?: Address;
  businessInfo?: BusinessInfo;
  sessionInfo?: { ipAddress?: string; userAgent?: string };
}

export interface SubmitKYCRequest {
  documents: Array<{
    type: DocumentType;
    documentNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    issuingCountry?: string;
    frontImageUrl: string;
    backImageUrl?: string;
    selfieUrl?: string;
  }>;
  verificationLevel: 'basic' | 'advanced' | 'business';
  additionalInfo?: Record<string, any>;
}

export interface UpdateKYCStatusRequest {
  status: KYCStatus;
  rejectionReason?: string;
  notes?: string;
  reviewedBy: string;
}

export interface UserRegistrationResponseSuccess {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    accountType: AccountType;
    firstName: string;
    lastName: string;
    tag?: string;
    phoneNumber: string | null;
    walletAddress: string;
    kycStatus: KYCStatus;
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  wallet: {
    address: string;
    balance: string;
  };
}

export interface UserRegistrationResponseRequiresVerification {
  requiresEmailVerification: true;
  email: string;
}

export type UserRegistrationResponse =
  | UserRegistrationResponseSuccess
  | UserRegistrationResponseRequiresVerification;

export interface UserProfileResponse {
  id: string;
  email: string;
  accountType: AccountType;
  profile: UserProfile;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  tag?: string;
  walletAddress: string;
  walletBalance: {
    native: string;
    nativeInUSD: string;
    tokens: Array<{
      symbol: string;
      balance: string;
      balanceInUSD: string;
    }>;
  };
  invoiceStats: {
    totalIssued: number;
    totalPaid: number;
    totalReceived: number;
    pendingAmount: string;
  };
  kycStatus: KYCStatus;
  kycInfo?: KYCInfo;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
