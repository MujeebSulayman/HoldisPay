'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

interface ContractRow {
  id?: string;
  contract_id?: string;
  status?: string;
  employer_address?: string;
  contractor_address?: string;
  start_date?: string;
  created_at?: string;
  chain_slug?: string;
  contract_name?: string;
  [key: string]: unknown;
}

export default function AdminContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [employerFilter, setEmployerFilter] = useState('');
  const [contractorFilter, setContractorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof adminApi.getContracts>[0] = {};
      if (statusFilter) params.status = statusFilter;
      if (employerFilter.trim()) params.employer = employerFilter.trim();
      if (contractorFilter.trim()) params.contractor = contractorFilter.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const result = await adminApi.getContracts(params);
      setContracts(result.contracts as ContractRow[]);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to load contracts', e);
      setContracts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [statusFilter, employerFilter, contractorFilter, startDate, endDate]);

  if (loading && contracts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
        <PageLoader />
      </div>
    );
  }

  const shorten = (addr: string | undefined) => {
    if (!addr) return '—';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">Payment Contracts</h2>
          <span className="text-gray-400">{total} total</span>
        </div>

        <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="DISPUTED">Disputed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Employer (address)</label>
              <input
                type="text"
                value={employerFilter}
                onChange={(e) => setEmployerFilter(e.target.value)}
                placeholder="0x…"
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contractor (address)</label>
              <input
                type="text"
                value={contractorFilter}
                onChange={(e) => setContractorFilter(e.target.value)}
                placeholder="0x…"
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start from</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">End by</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
          {contracts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No contracts match the filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1a1a1a] border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID / Contract</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Employer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contractor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Chain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {contracts.map((c) => {
                    const contractId = c.id ?? c.contract_id;
                    const href = contractId ? `/admin/contracts/${contractId}` : null;
                    return (
                    <tr
                      key={c.id ?? c.contract_id ?? String(c.created_at)}
                      role={href ? 'button' : undefined}
                      tabIndex={href ? 0 : undefined}
                      onClick={href ? () => router.push(href) : undefined}
                      onKeyDown={href ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(href); } } : undefined}
                      className={`hover:bg-[#1a1a1a] transition-colors ${href ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-6 py-3 text-sm text-white">
                        {c.contract_name ? (
                          <span className="font-medium">{c.contract_name}</span>
                        ) : (
                          <span className="text-gray-400 font-mono">{c.contract_id ? shorten(c.contract_id) : c.id ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          c.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          c.status === 'COMPLETED' ? 'bg-teal-500/20 text-teal-400' :
                          c.status === 'DRAFT' ? 'bg-gray-500/20 text-gray-400' :
                          c.status === 'DISPUTED' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {c.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-300 font-mono">{shorten(c.employer_address)}</td>
                      <td className="px-6 py-3 text-sm text-gray-300 font-mono">{shorten(c.contractor_address)}</td>
                      <td className="px-6 py-3 text-sm text-gray-400">{c.chain_slug ?? '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-400">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
