'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';

type FilterType = 'all' | 'employer' | 'contractor';
type StatusFilter = 'all' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED';

export default function ContractsPage() {
  const { user, loading } = useAuth();
  const [contracts, setContracts] = useState<PaymentContract[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fundExplainContractId, setFundExplainContractId] = useState<string | null>(null);

  useEffect(() => {
    const fetchContracts = async () => {
      if (!user?.id) return;

      try {
        const response = await paymentContractApi.getUserContracts();
        if (response.success && response.data && Array.isArray((response.data as any).contracts)) {
          setContracts((response.data as any).contracts);
        }
      } catch (error) {
        console.error('Failed to fetch contracts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchContracts();
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await paymentContractApi.deleteContract(id);
      if (res.success) {
        setContracts((prev) => prev.filter((c) => c.id !== id));
        setDeleteConfirmId(null);
      } else {
        setActionError((res as { error?: string }).error || 'Failed to delete');
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete contract');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    const userWallet = user?.walletAddress?.toLowerCase();
    const isEmployer = contract.employer.toLowerCase() === userWallet;
    const isContractor = contract.contractor.toLowerCase() === userWallet;

    const roleMatch =
      filter === 'all' ||
      (filter === 'employer' && isEmployer) ||
      (filter === 'contractor' && isContractor);

    const statusMatch = statusFilter === 'all' || contract.status === statusFilter;

    return roleMatch && statusMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'PAUSED':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'COMPLETED':
        return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'DRAFT':
        return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'TERMINATED':
      case 'DEFAULTED':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Payment Contracts</h1>
            <p className="text-gray-400">Manage your recurring payment agreements</p>
          </div>

          <a
            href="/dashboard/contracts/create"
            className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Contract
          </a>
        </div>

        {/* How it works */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-3">How payment contracts work</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-400/20 text-teal-400 flex items-center justify-center font-medium">1</span>
              <span><strong className="text-gray-300">Create</strong> — Add a contract (recipient, amount, schedule). It’s saved as a <strong className="text-amber-400">Draft</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-400/20 text-teal-400 flex items-center justify-center font-medium">2</span>
              <span><strong className="text-gray-300">Fund</strong> — As the payer, you deposit the total into escrow. The contract becomes <strong className="text-green-400">Active</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-400/20 text-teal-400 flex items-center justify-center font-medium">3</span>
              <span><strong className="text-gray-300">Work</strong> — The recipient does the work (or hits milestones).</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-400/20 text-teal-400 flex items-center justify-center font-medium">4</span>
              <span><strong className="text-gray-300">Claim</strong> — The recipient claims payments as they’re released.</span>
            </li>
          </ol>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Total Contracts</p>
            <p className="text-2xl font-bold text-white">{contracts.length}</p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">As Payer</p>
            <p className="text-2xl font-bold text-blue-400">
              {contracts.filter((c) => c.employer.toLowerCase() === user.walletAddress?.toLowerCase()).length}
            </p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">As Recipient</p>
            <p className="text-2xl font-bold text-purple-400">
              {contracts.filter((c) => c.contractor.toLowerCase() === user.walletAddress?.toLowerCase()).length}
            </p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {contracts.filter((c) => c.status === 'ACTIVE').length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Role:</span>
              <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === 'all' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('employer')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === 'employer' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Payer
                </button>
                <button
                  onClick={() => setFilter('contractor')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === 'contractor' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Recipient
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Status:</span>
              <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    statusFilter === 'all' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('DRAFT')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    statusFilter === 'DRAFT' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    statusFilter === 'ACTIVE' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('COMPLETED')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    statusFilter === 'COMPLETED' ? 'bg-teal-400 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>

            <div className="ml-auto text-sm text-gray-400">
              {filteredContracts.length} {filteredContracts.length === 1 ? 'contract' : 'contracts'}
            </div>
          </div>
        </div>

        {actionError && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-red-400 text-sm">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-300 text-sm cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Contracts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          </div>
        ) : filteredContracts.length > 0 ? (
          <div className="space-y-4">
            {filteredContracts.map((contract) => {
              const isEmployer = contract.employer.toLowerCase() === user.walletAddress?.toLowerCase();
              const isOngoing = contract.isOngoing === true;
              const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
              const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
              const formatAmount = (s: string) =>
                parseFloat(s) >= 1e15 ? (parseFloat(s) / 1e18).toFixed(2) : parseFloat(s).toFixed(2);

              return (
                <div
                  key={contract.id}
                  className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 sm:p-6 hover:border-gray-700 transition-colors min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-white break-words">
                          {contract.jobTitle || 'Untitled Contract'}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(
                            contract.status
                          )}`}
                        >
                          {contract.status}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            isEmployer ? 'bg-blue-400/10 text-blue-400' : 'bg-purple-400/10 text-purple-400'
                          }`}
                        >
                          {isEmployer ? 'Payer' : 'Recipient'}
                        </span>
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400">
                          {contract.releaseType === 'TIME_BASED' ? 'Time-Based' : 'Milestone-Based'}
                        </span>
                        {isOngoing && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-teal-400/10 text-teal-400">
                            Recurring
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-400 mb-3">{contract.description || 'No description'}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">
                            {isEmployer ? 'Recipient' : 'Payer'}
                          </p>
                          <p className="text-gray-300 font-mono">
                            {(isEmployer ? contract.contractor : contract.employer).slice(0, 6)}...
                            {(isEmployer ? contract.contractor : contract.employer).slice(-4)}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500 text-xs mb-1">Payment Amount</p>
                          <p className="text-white font-semibold">${formatAmount(contract.paymentAmount)}</p>
                        </div>

                        <div>
                          <p className="text-gray-500 text-xs mb-1">Total Amount</p>
                          <p className="text-white font-semibold">
                            {isOngoing ? 'Recurring' : `$${formatAmount(contract.totalAmount)}`}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500 text-xs mb-1">Start Date</p>
                          <p className="text-gray-300">{formatDate(contract.startDate)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right sm:ml-4 flex-shrink-0">
                      <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                        ${formatAmount(contract.paymentAmount)}
                      </p>
                      <p className="text-xs text-gray-500">per payment</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Payment Progress</span>
                      <span className="text-gray-300 font-medium">
                        {isOngoing
                          ? `${contract.paymentsMade} payments made`
                          : `${contract.paymentsMade}/${contract.numberOfPayments} payments`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isEmployer ? 'bg-blue-400' : 'bg-purple-400'
                        }`}
                        style={{
                          width: isOngoing
                            ? `${Math.min(15, parseInt(contract.paymentsMade, 10) * 2)}%`
                            : `${Math.min(100, progress)}%`,
                        }}
                      />
                    </div>
                    {!isOngoing && (
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Remaining: ${formatAmount(contract.remainingBalance)}</span>
                        <span>{progress.toFixed(0)}% complete</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {contract.status === 'DRAFT' && isEmployer && (
                    <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setFundExplainContractId(contract.id)}
                        className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-all cursor-pointer"
                      >
                        Fund contract
                      </button>
                      <a
                        href={`/dashboard/contracts/create?id=${contract.id}`}
                        className="px-4 py-2 bg-teal-400/10 hover:bg-teal-400/20 border border-teal-400/20 hover:border-teal-400/40 text-teal-400 font-medium rounded-xl transition-all cursor-pointer"
                      >
                        Edit
                      </a>
                      {deleteConfirmId === contract.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">Delete this draft?</span>
                          <button
                            onClick={() => handleDelete(contract.id)}
                            disabled={deletingId === contract.id}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg border border-red-400/30 cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === contract.id ? 'Deleting...' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={deletingId === contract.id}
                            className="px-3 py-1.5 text-gray-400 hover:text-white text-sm cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(contract.id)}
                          className="px-4 py-2 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-400 font-medium rounded-xl transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                  {contract.status === 'ACTIVE' && !isEmployer && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <button className="w-full sm:w-auto px-4 py-2 bg-teal-400/10 hover:bg-teal-400/20 border border-teal-400/20 hover:border-teal-400/40 text-teal-400 font-medium rounded-xl transition-all">
                        Claim Next Payment
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">No contracts found</h3>
            <p className="text-gray-400 mb-6">
              {filter !== 'all'
                ? `You don't have any contracts as ${filter === 'employer' ? 'payer' : filter === 'contractor' ? 'recipient' : 'either role'}`
                : 'Create your first payment contract to get started'}
            </p>
            <a
              href="/dashboard/contracts/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Contract
            </a>
          </div>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
