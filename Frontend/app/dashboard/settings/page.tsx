'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { userApi, UserProfile } from '@/lib/api/user';
import {
  paymentMethodsApi,
  PaymentMethod,
  PaystackBank,
  PaystackCountry,
  RecipientType,
} from '@/lib/api/payment-methods';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, User, ShieldCheck, Bell, BadgeCheck, CreditCard, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('general');
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [countries, setCountries] = useState<PaystackCountry[]>([]);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    country: '',
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    currency: 'NGN',
  });
  const [selectedBankType, setSelectedBankType] = useState<RecipientType | null>(null);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

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

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!user?.id) return;
      setLoadingPaymentMethods(true);
      try {
        const res = await paymentMethodsApi.getPaymentMethods(user.id);
        if (res.success && res.data) setPaymentMethods(res.data);
        else toast.error(getErrorMessage(res, 'Failed to load'));
      } catch (e) {
        toast.error(getErrorMessage(e, 'Failed to load payment methods'));
      } finally {
        setLoadingPaymentMethods(false);
      }
    };
    if (user?.id && activeTab === 'payment-methods') fetchPaymentMethods();
  }, [user?.id, activeTab]);

  useEffect(() => {
    const fetchCountries = async () => {
      const res = await paymentMethodsApi.getCountries();
      if (res.success && res.data) setCountries(res.data);
    };
    if (showAddBank) fetchCountries();
  }, [showAddBank]);

  useEffect(() => {
    if (!addForm.country || !addForm.currency) {
      setBanks([]);
      return;
    }
    const fetchBanks = async () => {
      setLoadingBanks(true);
      const res = await paymentMethodsApi.getBanks(addForm.country, addForm.currency);
      if (res.success && res.data) setBanks(res.data);
      else setBanks([]);
      setLoadingBanks(false);
    };
    fetchBanks();
  }, [addForm.country, addForm.currency]);

  const bankSearchLower = bankSearch.trim().toLowerCase();
  const filteredBanks = bankSearchLower
    ? banks.filter((b) => b.name.toLowerCase().includes(bankSearchLower))
    : banks;
  const isMobileMoney = selectedBankType === 'mobile_money';

  const handleVerifyAccount = async () => {
    if (!addForm.accountNumber.trim() || !addForm.bankCode.trim()) return;
    setVerifyingAccount(true);
    setResolvedAccountName(null);
    try {
      const res = await paymentMethodsApi.resolveAccount(addForm.accountNumber.trim(), addForm.bankCode);
      if (res.success && res.data) {
        setResolvedAccountName(res.data.account_name);
        setAddForm((f) => ({ ...f, accountName: res.data!.account_name }));
      } else toast.error(getErrorMessage(res, 'Could not verify account'));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not verify account'));
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleSaveBank = async () => {
    const recType: RecipientType = selectedBankType ?? 'nuban';
    if (!user?.id || !addForm.bankCode || !addForm.bankName || !addForm.accountNumber.trim() || !addForm.accountName.trim() || !addForm.currency || !addForm.country) return;
    setSavingBank(true);
    try {
      const res = await paymentMethodsApi.addPaymentMethod(user.id, {
        account_number: addForm.accountNumber.trim(),
        bank_code: addForm.bankCode,
        bank_name: addForm.bankName,
        account_name: addForm.accountName.trim(),
        currency: addForm.currency,
        country: addForm.country,
        recipient_type: recType,
      });
      if (res.success) {
        toast.success('Payout method added');
        setPaymentMethods((prev) => (res.data ? [...prev, res.data] : prev));
        setShowAddBank(false);
        setAddForm({ country: '', bankCode: '', bankName: '', accountNumber: '', accountName: '', currency: 'NGN' });
        setResolvedAccountName(null);
        setSelectedBankType(null);
      } else toast.error(getErrorMessage(res, 'Failed to add'));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add payout method'));
    } finally {
      setSavingBank(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user?.id) return;
    const res = await paymentMethodsApi.setDefault(user.id, id);
    if (res.success) {
      toast.success('Default payout method updated');
      setPaymentMethods((prev) => prev.map((m) => ({ ...m, is_default: m.id === id })));
    } else toast.error(getErrorMessage(res, 'Failed to set default'));
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (!user?.id) return;
    setDeletingId(id);
    try {
      const res = await paymentMethodsApi.deletePaymentMethod(user.id, id);
      if (res.success) {
        toast.success('Payment method removed');
        setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
      } else toast.error(getErrorMessage(res, 'Failed to remove'));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to remove'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!user?.id) return false;

    setIsSaving(true);
    try {
      const response = await userApi.updateProfile(user.id, profileForm);
      if (response.success) {
        toast.success('Profile updated successfully!');
        if (response.data) setProfile(response.data);
        return true;
      }
      toast.error(getErrorMessage(response, 'Failed to update profile'));
      return false;
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(getErrorMessage(error, 'An error occurred'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const tabs = [
    { id: 'general', name: 'Profile', icon: User },
    { id: 'payment-methods', name: 'Payment methods', icon: CreditCard },
    { id: 'security', name: 'Security', icon: ShieldCheck },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'kyc', name: 'KYC Verification', icon: BadgeCheck },
  ];

  return (
    <PremiumDashboardLayout>
      <div className="min-w-0 px-3 sm:px-0">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Sidebar */}
          <nav className="w-full lg:w-56 shrink-0 -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="lg:sticky lg:top-8 flex flex-row lg:flex-col gap-0.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-sm font-medium ${
                      activeTab === tab.id
                        ? 'bg-gray-800/80 text-white'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-10">
            {activeTab === 'general' && (
                <div className="w-full min-w-0 space-y-6">
                  {isLoadingProfile ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-[180px]" />
                            <Skeleton className="h-3 w-[120px]" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-9 w-full" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-9 w-full" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-9 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : !showProfileForm ? (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                          <Avatar className="h-14 w-14">
                            <AvatarFallback className="text-base">
                              {profileForm.firstName?.[0]}{profileForm.lastName?.[0] || user?.email?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <CardTitle>
                              {profileForm.firstName && profileForm.lastName ? `${profileForm.firstName} ${profileForm.lastName}` : '—'}
                            </CardTitle>
                            <CardDescription>{profile?.email || '—'}</CardDescription>
                          </div>
                          <Button variant="outline" size="sm" className="sm:ml-auto shrink-0" onClick={() => setShowProfileForm(true)}>
                            Edit profile
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-0">
                        <dl className="flex flex-col gap-0">
                          <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <Label className="text-gray-400 font-normal">Full name</Label>
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-white truncate">{profileForm.firstName && profileForm.lastName ? `${profileForm.firstName} ${profileForm.lastName}` : '—'}</span>
                              <Button variant="link" size="sm" className="shrink-0 h-auto p-0" onClick={() => setShowProfileForm(true)}>Update</Button>
                            </div>
                          </div>
                          <Separator />
                          <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <Label className="text-gray-400 font-normal">Email address</Label>
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-white truncate">{profile?.email || '—'}</span>
                              <span className="text-xs text-gray-500 shrink-0">Cannot change</span>
                            </div>
                          </div>
                          {user.tag && (
                            <>
                              <Separator />
                              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <Label className="text-gray-400 font-normal">Your tag</Label>
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span className="text-teal-400 font-mono truncate">@{user.tag}</span>
                                  <Button variant="link" size="sm" className="shrink-0 h-auto p-0" onClick={() => { navigator.clipboard.writeText(user.tag!); toast.success('Tag copied to clipboard'); }}>
                                    <Copy className="h-4 w-4" /> Copy
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                          <Separator />
                          <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <Label className="text-gray-400 font-normal">Phone number</Label>
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-white truncate">{profileForm.phoneNumber || '—'}</span>
                              <Button variant="link" size="sm" className="shrink-0 h-auto p-0" onClick={() => setShowProfileForm(true)}>Update</Button>
                            </div>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>Edit profile</CardTitle>
                        <CardDescription>Update your public information.</CardDescription>
                      </CardHeader>
                      <form onSubmit={(e) => { handleUpdateProfile(e).then((ok) => ok && setShowProfileForm(false)); }}>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="profile-first-name">First name</Label>
                              <Input id="profile-first-name" value={profileForm.firstName} onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="profile-last-name">Last name</Label>
                              <Input id="profile-last-name" value={profileForm.lastName} onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))} required />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="profile-email">Email</Label>
                            <Input id="profile-email" type="email" value={profile?.email || ''} disabled className="opacity-70" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="profile-phone">Phone number</Label>
                            <Input id="profile-phone" type="tel" value={profileForm.phoneNumber} onChange={(e) => setProfileForm((f) => ({ ...f, phoneNumber: e.target.value }))} placeholder="+234" />
                          </div>
                        </CardContent>
                        <CardFooter className="flex flex-wrap gap-3">
                          <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                          <Button type="button" variant="outline" onClick={() => setShowProfileForm(false)}>Cancel</Button>
                        </CardFooter>
                      </form>
                    </Card>
                  )}
                </div>
            )}

            {activeTab === 'payment-methods' && (
                <div className="w-full max-w-2xl">
                  <h2 className="text-lg font-semibold text-white mb-1">Payment methods</h2>
                  <p className="text-sm text-gray-400 mb-6">Connect bank accounts to receive payouts.</p>

                  <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6 border-b border-gray-800">
                      <span className="text-sm font-medium text-white">Payout methods</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBank(true);
                          setAddForm({ country: '', bankCode: '', bankName: '', accountNumber: '', accountName: '', currency: 'NGN' });
                          setResolvedAccountName(null);
                          setSelectedBankType(null);
                        }}
                        className="text-sm font-medium text-teal-400 hover:text-teal-300 shrink-0"
                      >
                        Add payout method
                      </button>
                    </div>
                    {loadingPaymentMethods ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-teal-400" />
                      </div>
                    ) : paymentMethods.length > 0 ? (
                      <ul className="divide-y divide-gray-800">
                        {paymentMethods.map((m) => (
                          <li key={m.id} className="flex flex-col gap-2 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate">{m.bank_name}</p>
                              <p className="text-gray-400 text-sm truncate">{m.account_name} · {m.account_number_masked}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {!m.is_default && <button type="button" onClick={() => handleSetDefault(m.id)} className="text-sm text-gray-400 hover:text-teal-400">Set default</button>}
                              {m.is_default && <span className="text-xs text-teal-400 border border-teal-400/30 px-2 py-1 rounded">Default</span>}
                              <button type="button" onClick={() => handleDeletePaymentMethod(m.id)} disabled={deletingId === m.id} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50">Remove</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : !showAddBank ? (
                      <p className="px-4 py-8 sm:px-6 text-gray-400 text-sm">No bank accounts yet. Add one to receive payouts.</p>
                    ) : null}
                  </div>

                  {showAddBank && (
                    <div className="mt-6 bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="font-medium text-white">Link account</h3>
                        <button type="button" onClick={() => { setShowAddBank(false); setAddForm({ country: '', bankCode: '', bankName: '', accountNumber: '', accountName: '', currency: 'NGN' }); setResolvedAccountName(null); setSelectedBankType(null); setBankSearch(''); setBankDropdownOpen(false); setBanks([]); }} className="text-sm text-gray-400 hover:text-white shrink-0">Cancel</button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Country</label>
                          <select value={addForm.country} onChange={(e) => { const name = e.target.value; const c = countries.find((x) => x.name === name); setAddForm((f) => ({ ...f, country: name, currency: c?.default_currency_code || 'NGN', bankCode: '', bankName: '' })); setSelectedBankType(null); setBankSearch(''); setResolvedAccountName(null); }} className="w-full px-4 py-2.5 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:border-teal-400">
                            <option value="">Select country</option>
                            {countries.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                        {addForm.country && (
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Currency</label>
                            {(() => { const c = countries.find((x) => x.name === addForm.country); const extra = (c as { relationships?: { currency?: { data?: string[] } } })?.relationships?.currency?.data; const list = Array.isArray(extra) && extra.length ? extra : [c?.default_currency_code].filter(Boolean); const singleCurrency = list.length <= 1; return (
                              <select value={addForm.currency} onChange={(e) => { setAddForm((f) => ({ ...f, currency: e.target.value, bankCode: '', bankName: '' })); setSelectedBankType(null); setBankSearch(''); }} disabled={singleCurrency} className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 focus:border-teal-400 ${singleCurrency ? 'bg-[#0d0d0d] text-gray-500 border-gray-800 cursor-not-allowed opacity-80' : 'bg-[#0a0a0a] text-white border-gray-800'}`}>
                                {(list as string[]).map((cc) => <option key={cc} value={cc}>{cc}</option>)}
                              </select>
                            ); })()}
                          </div>
                        )}
                        {addForm.country && addForm.currency && (
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Bank or provider</label>
                            <InputGroup className="w-full">
                              <InputGroupAddon><Search className="w-4 h-4" /></InputGroupAddon>
                              <InputGroupInput type="text" value={addForm.bankCode ? addForm.bankName : bankSearch} onChange={(e) => { if (!addForm.bankCode) { setBankSearch(e.target.value); setBankDropdownOpen(true); } }} onFocus={() => { setBankDropdownOpen(true); if (!addForm.bankCode) setBankSearch(bankSearch || ''); }} onBlur={() => setTimeout(() => setBankDropdownOpen(false), 200)} placeholder={loadingBanks ? 'Loading...' : 'Search...'} disabled={loadingBanks} />
                              <InputGroupAddon align="inline-end">{addForm.bankCode ? <button type="button" onClick={() => { setAddForm((f) => ({ ...f, bankCode: '', bankName: '' })); setSelectedBankType(null); setBankSearch(''); setResolvedAccountName(null); }} className="text-gray-400 hover:text-white text-sm">Clear</button> : <span className="text-sm tabular-nums">{loadingBanks ? '...' : `${filteredBanks.length} result${filteredBanks.length === 1 ? '' : 's'}`}</span>}</InputGroupAddon>
                            </InputGroup>
                            {bankDropdownOpen && !addForm.bankCode && (
                              <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-[#0d0d0d] border border-gray-800 rounded-lg shadow-lg">
                                {filteredBanks.length === 0 ? <li className="px-4 py-3 text-gray-500 text-sm">{loadingBanks ? 'Loading...' : 'No matches'}</li> : filteredBanks.map((b) => (
                                  <li key={b.code} className="px-4 py-2.5 text-white text-sm hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 last:border-0" onMouseDown={(e) => { e.preventDefault(); setAddForm((f) => ({ ...f, bankCode: b.code, bankName: b.name, currency: b.currency || addForm.currency })); setSelectedBankType(b.type as RecipientType); setBankSearch(''); setBankDropdownOpen(false); }}>{b.name}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {addForm.bankCode && !isMobileMoney && (
                          <>
                            <div><label className="block text-sm font-medium text-gray-400 mb-1">Account number</label><input type="text" inputMode="numeric" value={addForm.accountNumber} onChange={(e) => setAddForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 0123456789" className="w-full px-4 py-2.5 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:border-teal-400" /></div>
                            {!resolvedAccountName ? <button type="button" onClick={handleVerifyAccount} disabled={verifyingAccount || addForm.accountNumber.length < 8} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">{verifyingAccount ? 'Verifying...' : 'Verify'}</button> : (
                              <> <p className="text-gray-400 text-sm">Account name: <span className="text-white">{resolvedAccountName}</span></p>
                                <div className="flex flex-wrap gap-2"><button type="button" onClick={handleSaveBank} disabled={savingBank} className="px-4 py-2.5 bg-teal-400 hover:bg-teal-500 disabled:opacity-50 text-black font-medium rounded-lg">{savingBank ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => setShowAddBank(false)} className="px-4 py-2.5 bg-[#0a0a0a] border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800">Cancel</button></div>
                              </>
                            )}
                          </>
                        )}
                        {addForm.bankCode && isMobileMoney && (
                          <>
                            <div><label className="block text-sm font-medium text-gray-400 mb-1">Phone number</label><input type="tel" value={addForm.accountNumber} onChange={(e) => setAddForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 0241234567" className="w-full px-4 py-2.5 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:border-teal-400" /></div>
                            <div><label className="block text-sm font-medium text-gray-400 mb-1">Account name</label><input type="text" value={addForm.accountName} onChange={(e) => setAddForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Full name on the mobile wallet" className="w-full px-4 py-2.5 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:border-teal-400" /></div>
                            <div className="flex flex-wrap gap-2"><button type="button" onClick={handleSaveBank} disabled={savingBank || !addForm.accountNumber.trim() || !addForm.accountName.trim()} className="px-4 py-2.5 bg-teal-400 hover:bg-teal-500 disabled:opacity-50 text-black font-medium rounded-lg">{savingBank ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => setShowAddBank(false)} className="px-4 py-2.5 bg-[#0a0a0a] border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800">Cancel</button></div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            )}

            {activeTab === 'kyc' && (
              <div className="w-full min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1">KYC Verification</h2>
                <p className="text-sm text-gray-400 mb-6">Verify your identity to access full features.</p>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <span className="text-white font-medium">Status</span>
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
                        <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="w-full min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1">Security</h2>
                <p className="text-sm text-gray-400 mb-6">Manage your password and two-factor authentication.</p>
                <div className="space-y-6">
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Change Password</h3>
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
                    <button className="w-full sm:w-auto px-6 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg transition-colors">
                      Update Password
                    </button>
                  </div>
                </div>

                <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Two-Factor Authentication</h3>
                  <p className="text-gray-400 mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <button className="px-6 py-2 bg-[#0a0a0a] hover:bg-[#141414] text-white border border-gray-800 rounded-lg transition-colors">
                    Enable 2FA
                  </button>
                </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="w-full min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1">Notifications</h2>
                <p className="text-sm text-gray-400 mb-6">Choose how you want to be notified.</p>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 py-3 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-white font-medium">Invoice Payments</p>
                        <p className="text-gray-400 text-sm">Get notified when invoices are paid</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 py-3 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-white font-medium">Deposits</p>
                        <p className="text-gray-400 text-sm">Get notified when you receive deposits</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 py-3 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-white font-medium">KYC Updates</p>
                        <p className="text-gray-400 text-sm">Get notified about KYC status changes</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
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
