'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { userApi, UserProfile } from '@/lib/api/user';

export default function KYCPage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    verificationLevel: 'basic' as 'basic' | 'advanced',
    documentType: 'passport' as 'passport' | 'drivers_license' | 'national_id',
    documentNumber: '',
    issuingCountry: '',
    issueDate: '',
    expiryDate: '',
  });
  
  const [files, setFiles] = useState<{
    front?: File;
    back?: File;
    selfie?: File;
  }>({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        const response = await userApi.getProfile(user.id);
        if (response.success && response.data) {
          setProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Upload files to backend (backend will handle cloud storage)
      let frontImageUrl = '';
      let backImageUrl = '';
      let selfieUrl = '';

      if (files.front || files.back || files.selfie) {
        const uploadFormData = new FormData();
        if (files.front) uploadFormData.append('frontImage', files.front);
        if (files.back) uploadFormData.append('backImage', files.back);
        if (files.selfie) uploadFormData.append('selfie', files.selfie);

        // Upload to backend endpoint that handles cloud storage
        try {
          const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}/kyc/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: uploadFormData,
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            frontImageUrl = uploadData.data?.frontImageUrl || '';
            backImageUrl = uploadData.data?.backImageUrl || '';
            selfieUrl = uploadData.data?.selfieUrl || '';
          }
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          throw new Error('Failed to upload documents. Please try again.');
        }
      }

      // Submit KYC with uploaded document URLs
      const response = await userApi.submitKYC(user.id, {
        documents: [
          {
            type: formData.documentType,
            documentNumber: formData.documentNumber,
            issuingCountry: formData.issuingCountry,
            issueDate: formData.issueDate,
            expiryDate: formData.expiryDate,
            frontImageUrl,
            backImageUrl,
            selfieUrl,
          },
        ],
        verificationLevel: formData.verificationLevel,
      });

      if (response.success) {
        setSuccess('KYC verification request submitted successfully!');
        // Refresh profile to get updated KYC status
        const profileResponse = await userApi.getProfile(user.id);
        if (profileResponse.success && profileResponse.data) {
          setProfile(profileResponse.data);
        }
      } else {
        setError(response.error || 'Failed to submit KYC');
      }
    } catch (error: any) {
      console.error('KYC submission error:', error);
      setError(error.message || 'An error occurred during KYC submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'verified':
      case 'approved':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'pending':
      case 'in_review':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'rejected':
      case 'failed':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">KYC Verification</h1>
          <p className="text-gray-400">Complete your identity verification to unlock full features</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Current Status</h3>
                  {profile && (
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium border capitalize ${getStatusColor(profile.kycStatus)}`}>
                      {profile.kycStatus || 'Not Submitted'}
                    </span>
                  )}
                </div>

                {profile?.kycStatus === 'verified' || profile?.kycStatus === 'approved' ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-xl font-bold text-white mb-2">Verification Complete!</h4>
                    <p className="text-gray-400">Your identity has been verified successfully</p>
                  </div>
                ) : profile?.kycStatus === 'pending' || profile?.kycStatus === 'in_review' ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-xl font-bold text-white mb-2">Verification In Progress</h4>
                    <p className="text-gray-400">Your documents are being reviewed. This usually takes 1-2 business days.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <p className="text-red-400 text-sm">{error}</p>
                      </div>
                    )}

                    {success && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-green-400 text-sm">{success}</p>
                      </div>
                    )}

                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                      <p className="text-white mb-4">
                        To complete your identity verification, please select your verification level and submit your request. Our team will contact you via email with further instructions.
                      </p>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Verification Level
                          </label>
                          <select
                            value={formData.verificationLevel}
                            onChange={(e) => setFormData({ ...formData, verificationLevel: e.target.value as 'basic' | 'advanced' })}
                            className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 cursor-pointer"
                            required
                          >
                            <option value="basic">Basic Verification - For individual users</option>
                            <option value="advanced">Advanced Verification - For business accounts</option>
                          </select>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                          <p className="text-blue-400 text-sm">
                            <strong>Note:</strong> After submitting, you'll receive an email with instructions on how to complete your verification. This typically includes uploading a government-issued ID and proof of address.
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3 bg-teal-400 hover:bg-teal-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          {isSubmitting ? 'Submitting...' : 'Request Verification'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Verification Benefits</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-white font-medium text-sm">Higher Limits</p>
                      <p className="text-xs text-gray-500">Increase transaction and withdrawal limits</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-white font-medium text-sm">Enhanced Security</p>
                      <p className="text-xs text-gray-500">Protect your account with verified identity</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-white font-medium text-sm">Full Access</p>
                      <p className="text-xs text-gray-500">Unlock all platform features</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-white font-medium text-sm">Compliance</p>
                      <p className="text-xs text-gray-500">Meet regulatory requirements</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <div>
                    <p className="text-blue-400 font-medium text-sm mb-1">Important Notes</p>
                    <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                      <li>Documents must be valid and not expired</li>
                      <li>Images should be clear and readable</li>
                      <li>Processing takes 1-2 business days</li>
                      <li>Your data is encrypted and secure</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
