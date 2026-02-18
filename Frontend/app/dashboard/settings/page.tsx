'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { userApi, UserProfile } from '@/lib/api/user';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        const response = await userApi.getProfile(user.id);
        if (response.success && response.data) {
          setProfile(response.data);
          setProfileForm({
            firstName: response.data.firstName,
            lastName: response.data.lastName,
            phoneNumber: response.data.phoneNumber || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await userApi.updateProfile(user.id, profileForm);
      if (response.success) {
        setSuccess('Profile updated successfully!');
        if (response.data) {
          setProfile(response.data);
        }
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      setError(error.message || 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'kyc', name: 'KYC Verification', icon: '✓' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
  ];

  return (
    <PremiumDashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>

        <div className="flex gap-6">
          {/* Tabs Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-2 sticky top-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    activeTab === tab.id
                      ? 'bg-teal-400/10 text-teal-400 border border-teal-400/20'
                      : 'text-gray-400 hover:bg-[#0a0a0a] hover:text-white'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Profile Information</h3>
                  
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
                      <p className="text-green-400 text-sm">{success}</p>
                    </div>
                  )}

                  {isLoadingProfile ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
                    </div>
                  ) : (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={profileForm.firstName}
                            onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                            className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={profileForm.lastName}
                            onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                            className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profile?.email || ''}
                          disabled
                          className="w-full px-4 py-2 bg-[#0a0a0a] text-gray-500 border border-gray-800 rounded-lg cursor-not-allowed"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-gray-500 text-xs">Email cannot be changed</p>
                          {profile?.emailVerified && (
                            <span className="text-green-400 text-xs flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={profileForm.phoneNumber}
                          onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                          placeholder="+234"
                          className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
                        />
                        {profile?.phoneVerified ? (
                          <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </p>
                        ) : (
                          <p className="text-gray-500 text-xs mt-1">Not verified</p>
                        )}
                      </div>

                      <div className="mt-6">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="px-6 py-2 bg-teal-400 hover:bg-teal-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'kyc' && (
              <div className="space-y-6">
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white">KYC Verification</h3>
                    {profile && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                        profile.kycStatus === 'verified' || profile.kycStatus === 'approved'
                          ? 'bg-green-400/10 text-green-400 border-green-400/20'
                          : profile.kycStatus === 'pending' || profile.kycStatus === 'in_review'
                          ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                          : 'bg-gray-400/10 text-gray-400 border-gray-400/20'
                      }`}>
                        {profile.kycStatus || 'Not Submitted'}
                      </span>
                    )}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                    <p className="text-blue-400 text-sm">
                      Go to the <a href="/dashboard/kyc" className="underline hover:text-blue-300">KYC Verification page</a> to submit your documents.
                    </p>
                  </div>

                  {profile?.kycStatus === 'pending' || profile?.kycStatus === 'in_review' ? (
                    <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4">
                      <div className="flex gap-3">
                        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-yellow-400 font-medium mb-1">Verification In Progress</p>
                          <p className="text-gray-400 text-sm">
                            Your KYC documents are being reviewed. This usually takes 1-2 business days.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : profile?.kycStatus === 'verified' || profile?.kycStatus === 'approved' ? (
                    <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-4">
                      <div className="flex gap-3">
                        <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-green-400 font-medium mb-1">Verified</p>
                          <p className="text-gray-400 text-sm">
                            Your identity has been verified. You have full access to all features.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>
                  <div className="mt-6">
                    <button className="px-6 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg transition-colors">
                      Update Password
                    </button>
                  </div>
                </div>

                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Two-Factor Authentication</h3>
                  <p className="text-gray-400 mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <button className="px-6 py-2 bg-[#0a0a0a] hover:bg-[#141414] text-white border border-gray-800 rounded-lg transition-colors">
                    Enable 2FA
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                      <div>
                        <p className="text-white font-medium">Invoice Payments</p>
                        <p className="text-gray-400 text-sm">Get notified when invoices are paid</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                      <div>
                        <p className="text-white font-medium">Deposits</p>
                        <p className="text-gray-400 text-sm">Get notified when you receive deposits</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                      <div>
                        <p className="text-white font-medium">KYC Updates</p>
                        <p className="text-gray-400 text-sm">Get notified about KYC status changes</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-white font-medium">Marketing Emails</p>
                        <p className="text-gray-400 text-sm">Receive updates about new features</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
