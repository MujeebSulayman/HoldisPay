'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { userApi, UserProfile } from '@/lib/api/user';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';

export default function KYCPage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);

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

  const handleInitiateVerification = async () => {
    if (!user?.id) return;
    setIsInitiating(true);

    try {
      const response = await userApi.initiateDiditKyc(user.id);
      
      if (response.success && response.data?.url) {
        // Redirect to Didit's hosted verification flow
        window.location.href = response.data.url;
      } else {
        toast.error(getErrorMessage(response, 'Failed to start verification'));
      }
    } catch (error) {
      console.error('Failed to initiate KYC:', error);
      toast.error(getErrorMessage(error, 'An error occurred starting verification'));
    } finally {
      setIsInitiating(false);
    }
  };

  const getStatusColor = (status: string, hasSession?: boolean) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'verified':
      case 'approved':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'pending':
      case 'under_review':
      case 'in_review':
        return hasSession 
          ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
          : 'bg-gray-400/10 text-gray-400 border-gray-400/20';
      case 'rejected':
      case 'failed':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      case 'unverified':
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 py-4 px-2">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-teal-400 text-black text-[10px] font-bold uppercase tracking-wider rounded">KYC</span>
              <h1 className="text-3xl font-bold text-white tracking-tight">Verification</h1>
            </div>
            <p className="text-gray-400 text-sm max-w-md">
              Securely verify your identity to protect your account and unlock elevated transaction limits.
            </p>
          </div>
          {profile && (
            <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-sm self-start sm:self-auto uppercase tracking-wide ${getStatusColor(profile.kycStatus, !!profile.diditSessionId)}`}>
              {((profile.kycStatus === 'pending' || profile.kycStatus === 'unverified') && !profile.diditSessionId) 
                ? 'Not Started' 
                : profile.kycStatus}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0a0a0a] border border-gray-800 rounded-2xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400 mb-4"></div>
            <p className="text-gray-500 text-sm animate-pulse">Syncing verification status...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Main Action Area */}
            <div className="md:col-span-12 lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                {profile?.kycStatus === 'verified' || profile?.kycStatus === 'approved' ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 border border-green-500/20">
                      <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Identity Confirmed</h2>
                    <p className="text-gray-400 text-sm mb-0">Your HoldisPay account is fully verified. You have unrestricted access to all premium features.</p>
                  </div>
                ) : (profile?.kycStatus === 'pending' || profile?.kycStatus === 'in_review') && profile?.diditSessionId ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20">
                      <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Verification In Progress</h2>
                    <p className="text-gray-400 text-sm mb-0">We are currently reviewing your documents. This process is typically completed within 24-48 hours. We'll notify you via email.</p>
                  </div>
                ) : (
                  <div className="p-8 sm:p-12">
                     <div className="grid md:grid-cols-2 gap-10 items-center">
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <h3 className="text-xl font-bold text-white">Automated Verification</h3>
                              <p className="text-gray-400 text-sm leading-relaxed">
                                 Powered by <span className="text-white font-medium">Didit</span>. Our automated system ensures a secure and lightning-fast verification experience.
                              </p>
                           </div>
                           
                           <ul className="space-y-4">
                              <li className="flex items-center gap-3 text-sm text-gray-300">
                                 <div className="w-5 h-5 rounded-full bg-teal-400/10 flex items-center justify-center shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
                                 </div>
                                 Valid Passport or Government ID
                              </li>
                              <li className="flex items-center gap-3 text-sm text-gray-300">
                                 <div className="w-5 h-5 rounded-full bg-teal-400/10 flex items-center justify-center shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
                                 </div>
                                 Live facial scanning
                              </li>
                           </ul>

                           <button
                              onClick={handleInitiateVerification}
                              disabled={isInitiating}
                              className="w-full sm:w-auto px-10 py-4 bg-teal-400 hover:bg-teal-500 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(45,212,191,0.2)]"
                           >
                              {isInitiating ? (
                                 <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                              ) : (
                                 <>
                                    Verify Now
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                 </>
                              )}
                           </button>
                        </div>
                        
                        <div className="hidden md:block relative">
                           <div className="aspect-square rounded-2xl bg-gray-900/40 border border-gray-800 flex items-center justify-center p-8">
                              <svg className="w-full h-full text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
                                 <path d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                              </svg>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar info */}
            <div className="md:col-span-12 lg:col-span-4 space-y-6">
               <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 space-y-6">
                  <h4 className="text-sm font-bold text-white uppercase tracking-widest">Why Verify?</h4>
                  
                  <div className="space-y-4">
                     {[
                        { title: 'Elevated Limits', desc: 'Higher withdrawal & transaction thresholds.' },
                        { title: 'Priority Support', desc: 'Faster response times from our team.' },
                        { title: 'Global Compliance', desc: 'Adherence to international standards.' }
                     ].map((item, i) => (
                        <div key={i} className="flex gap-4">
                           <div className="mt-1">
                              <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                           </div>
                           <div>
                              <p className="text-white text-[13px] font-bold">{item.title}</p>
                              <p className="text-gray-500 text-[12px]">{item.desc}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="bg-teal-400/5 border border-teal-400/10 rounded-2xl p-6">
                  <div className="flex gap-3 mb-3">
                     <svg className="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                     </svg>
                     <p className="text-teal-400 text-sm font-bold">Data Privacy</p>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">
                     Your sensitive information is encrypted at rest and in transit. We never share your personal data with third parties for marketing purposes.
                  </p>
               </div>
            </div>
          </div>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
