'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { userApi, UserProfile } from '@/lib/api/user';
import {
  paymentMethodsApi,
  PaymentMethod,
  SupportedBank,
  SupportedCountry,
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
import { Badge } from '@/components/ui/badge';
import { Search, User, ShieldCheck, Bell, BadgeCheck, CreditCard, Copy, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() =>
    tabParam === 'payment-methods' ? 'payment-methods' : 'general'
  );
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
  const [countries, setCountries] = useState<SupportedCountry[]>([]);
  const [banks, setBanks] = useState<SupportedBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const bankInputRef = useRef<HTMLDivElement>(null);
  const countryTriggerRef = useRef<HTMLButtonElement>(null);
  const DROPDOWN_MAX_H = 240;
  const DROPDOWN_GAP = 4;
  const [bankDropdownPosition, setBankDropdownPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const [countryDropdownPosition, setCountryDropdownPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
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
    if (tabParam === 'payment-methods') setActiveTab('payment-methods');
  }, [tabParam]);

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

  const fitDropdownInViewport = (rect: DOMRect) => {
    const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - rect.bottom - DROPDOWN_GAP : DROPDOWN_MAX_H;
    const spaceAbove = typeof window !== 'undefined' ? rect.top - DROPDOWN_GAP : DROPDOWN_MAX_H;
    const openAbove = spaceBelow < Math.min(DROPDOWN_MAX_H, 200) && spaceAbove >= Math.min(DROPDOWN_MAX_H, 200);
    const maxHeight = openAbove ? Math.min(DROPDOWN_MAX_H, spaceAbove) : Math.min(DROPDOWN_MAX_H, spaceBelow);
    return {
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openAbove ? { bottom: (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.top + DROPDOWN_GAP } : { top: rect.bottom + DROPDOWN_GAP }),
    };
  };

  useLayoutEffect(() => {
    if (bankDropdownOpen && !addForm.bankCode && bankInputRef.current && typeof document !== 'undefined') {
      setBankDropdownPosition(fitDropdownInViewport(bankInputRef.current.getBoundingClientRect()));
    } else {
      setBankDropdownPosition(null);
    }
  }, [bankDropdownOpen, addForm.bankCode]);

  useLayoutEffect(() => {
    if (countryDropdownOpen && countryTriggerRef.current && typeof document !== 'undefined') {
      setCountryDropdownPosition(fitDropdownInViewport(countryTriggerRef.current.getBoundingClientRect()));
    } else {
      setCountryDropdownPosition(null);
    }
  }, [countryDropdownOpen]);

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
                    className={`whitespace-nowrap shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-sm font-medium ${activeTab === tab.id
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
                      <CardFooter>
                        <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">{isSaving ? 'Saving...' : 'Save'}</Button>
                        <Button type="button" variant="outline" onClick={() => setShowProfileForm(false)} className="w-full sm:w-auto">Cancel</Button>
                      </CardFooter>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'payment-methods' && (
              <div className="w-full min-w-0 max-w-2xl space-y-6">
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Payment methods</CardTitle>
                      <CardDescription>Connect bank accounts to receive payouts.</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setShowAddBank(true);
                        setAddForm({ country: 'Nigeria', currency: 'NGN', bankCode: '', bankName: '', accountNumber: '', accountName: '' });
                        setResolvedAccountName(null);
                        setSelectedBankType(null);
                      }}
                    >
                      Add payout method
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {loadingPaymentMethods ? (
                      <div className="space-y-4 py-8">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : paymentMethods.length > 0 ? (
                      <ul className="divide-y divide-gray-800 -mx-4 sm:-mx-6">
                        {paymentMethods.map((m) => (
                          <li key={m.id} className="flex flex-col gap-2 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate">{m.bank_name}</p>
                              <p className="text-gray-400 text-sm truncate">{m.account_name} · {m.account_number_masked}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {!m.is_default && (
                                <Button variant="link" size="sm" className="h-auto p-0 text-gray-400" onClick={() => handleSetDefault(m.id)}>Set default</Button>
                              )}
                              {m.is_default && <Badge>Default</Badge>}
                              <Button variant="link" size="sm" className="h-auto p-0 text-red-400 hover:text-red-300" onClick={() => handleDeletePaymentMethod(m.id)} disabled={deletingId === m.id}>Remove</Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : !showAddBank ? (
                      <CardDescription className="py-8">No bank accounts yet. Add one to receive payouts.</CardDescription>
                    ) : null}
                  </CardContent>
                </Card>

                {showAddBank && (
                  <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                      <CardTitle>Link account</CardTitle>
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setShowAddBank(false); setAddForm({ country: '', bankCode: '', bankName: '', accountNumber: '', accountName: '', currency: 'NGN' }); setResolvedAccountName(null); setSelectedBankType(null); setBankSearch(''); setBankDropdownOpen(false); setCountryDropdownOpen(false); setBanks([]); }}>Cancel</Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <div className="flex h-9 w-full items-center rounded-lg border border-gray-800 bg-[#0d0d0d] px-4 py-2 text-gray-400">Nigeria</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <div className="flex h-9 w-full items-center rounded-lg border border-gray-800 bg-[#0d0d0d] px-4 py-2 text-gray-400">NGN</div>
                      </div>
                      {addForm.country && addForm.currency && (
                        <div ref={bankInputRef} className="relative space-y-2">
                          <Label>Bank or provider</Label>
                          <InputGroup className="w-full">
                            <InputGroupAddon><Search className="w-4 h-4" /></InputGroupAddon>
                            <InputGroupInput type="text" value={addForm.bankCode ? addForm.bankName : bankSearch} onChange={(e) => { if (!addForm.bankCode) { setBankSearch(e.target.value); setBankDropdownOpen(true); } }} onFocus={() => { setBankDropdownOpen(true); if (!addForm.bankCode) setBankSearch(bankSearch || ''); }} onBlur={() => setTimeout(() => setBankDropdownOpen(false), 200)} placeholder={loadingBanks ? 'Loading...' : 'Search...'} disabled={loadingBanks} />
                            <InputGroupAddon align="inline-end">{addForm.bankCode ? <Button type="button" variant="ghost" size="sm" className="h-auto text-gray-400" onClick={() => { setAddForm((f) => ({ ...f, bankCode: '', bankName: '' })); setSelectedBankType(null); setBankSearch(''); setResolvedAccountName(null); }}>Clear</Button> : <span className="text-sm tabular-nums">{loadingBanks ? '...' : `${filteredBanks.length} result${filteredBanks.length === 1 ? '' : 's'}`}</span>}</InputGroupAddon>
                          </InputGroup>
                          {bankDropdownOpen && !addForm.bankCode && bankDropdownPosition && typeof document !== 'undefined' && createPortal(
                            <ul
                              className="fixed z-[9999] overflow-auto rounded-lg border border-gray-800 bg-[#0d0d0d] shadow-xl"
                              style={{
                                left: bankDropdownPosition.left,
                                width: bankDropdownPosition.width,
                                maxHeight: bankDropdownPosition.maxHeight,
                                ...(bankDropdownPosition.top != null ? { top: bankDropdownPosition.top } : { bottom: bankDropdownPosition.bottom }),
                              }}
                            >
                              {filteredBanks.length === 0 ? <li className="px-4 py-3 text-gray-500 text-sm">{(loadingBanks ? 'Loading...' : 'No matches')}</li> : filteredBanks.map((b) => (
                                <li key={b.code} className="px-4 py-2.5 text-white text-sm hover:bg-gray-800 active:bg-gray-700 cursor-pointer border-b border-gray-800/50 last:border-0" onMouseDown={(e) => { e.preventDefault(); setAddForm((f) => ({ ...f, bankCode: b.code, bankName: b.name, currency: b.currency || addForm.currency })); setSelectedBankType(b.type as RecipientType); setBankSearch(''); setBankDropdownOpen(false); }}>{b.name}</li>
                              ))}
                            </ul>,
                            document.body
                          )}
                        </div>
                      )}
                      {addForm.bankCode && !isMobileMoney && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="pm-account">Account number</Label>
                            <Input id="pm-account" type="text" inputMode="numeric" value={addForm.accountNumber} onChange={(e) => setAddForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 0123456789" />
                          </div>
                          {!resolvedAccountName ? (
                            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={handleVerifyAccount} disabled={verifyingAccount || addForm.accountNumber.length < 8}>{verifyingAccount ? 'Verifying...' : 'Verify'}</Button>
                          ) : (
                            <>
                              <p className="text-gray-400 text-sm break-words">Account name: <span className="text-white">{resolvedAccountName}</span></p>
                              <CardFooter className="p-0">
                                <Button type="button" className="w-full sm:w-auto" onClick={handleSaveBank} disabled={savingBank}>{savingBank ? 'Saving...' : 'Save'}</Button>
                                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowAddBank(false)}>Cancel</Button>
                              </CardFooter>
                            </>
                          )}
                        </>
                      )}
                      {addForm.bankCode && isMobileMoney && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="pm-phone">Phone number</Label>
                            <Input id="pm-phone" type="tel" value={addForm.accountNumber} onChange={(e) => setAddForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 0241234567" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="pm-account-name">Account name</Label>
                            <Input id="pm-account-name" value={addForm.accountName} onChange={(e) => setAddForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Full name on the mobile wallet" />
                          </div>
                          <CardFooter className="p-0">
                            <Button type="button" className="w-full sm:w-auto" onClick={handleSaveBank} disabled={savingBank || !addForm.accountNumber.trim() || !addForm.accountName.trim()}>{savingBank ? 'Saving...' : 'Save'}</Button>
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowAddBank(false)}>Cancel</Button>
                          </CardFooter>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'kyc' && (
              <div className="w-full min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1">KYC Verification</h2>
                <p className="text-sm text-gray-400 mb-6">Verify your identity to access full features.</p>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6 min-w-0 overflow-hidden">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6 min-w-0">
                    <span className="text-white font-medium">Status</span>
                    {profile && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border capitalize ${profile.kycStatus === 'verified' || profile.kycStatus === 'approved'
                          ? 'bg-green-400/10 text-green-400 border-green-400/20'
                          : profile.kycStatus === 'pending' || profile.kycStatus === 'in_review'
                            ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                            : 'bg-gray-400/10 text-gray-400 border-gray-400/20'
                        }`}>
                        {profile.kycStatus || 'Not Submitted'}
                      </span>
                    )}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 min-w-0">
                    <p className="text-blue-400 text-sm break-words">
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
              <div className="w-full min-w-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your password to keep your account secure.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="security-current-password">Current Password</Label>
                      <Input id="security-current-password" type="password" placeholder="••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="security-new-password">New Password</Label>
                      <Input id="security-new-password" type="password" placeholder="••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="security-confirm-password">Confirm New Password</Label>
                      <Input id="security-confirm-password" type="password" placeholder="••••••••" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full sm:w-auto">Update Password</Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Two-Factor Authentication</CardTitle>
                    <CardDescription>Add an extra layer of security to your account.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-400">Protect your account with a second factor when signing in.</p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full sm:w-auto">Enable 2FA</Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="w-full min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1">Notifications</h2>
                <p className="text-sm text-gray-400 mb-6">Choose how you want to be notified.</p>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6 min-w-0 overflow-hidden">
                  <h3 className="text-lg font-medium text-white mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 py-3 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0">
                        <p className="text-white font-medium">Invoice Payments</p>
                        <p className="text-gray-400 text-sm">Get notified when invoices are paid</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 py-3 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0">
                        <p className="text-white font-medium">Deposits</p>
                        <p className="text-gray-400 text-sm">Get notified when you receive deposits</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 py-3 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0">
                        <p className="text-white font-medium">KYC Updates</p>
                        <p className="text-gray-400 text-sm">Get notified about KYC status changes</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0">
                        <p className="text-white font-medium">Marketing Emails</p>
                        <p className="text-gray-400 text-sm">Receive updates about new features</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
