'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

function shorten(addr: string | undefined) {
  if (!addr) return '—';
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function AdminContractDetailPage() {
  const params = useParams();
  const contractId = params.contractId as string;
  const [contract, setContract] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!contractId) return;
    setLoading(true);
    setError(null);
    adminApi
      .getContractById(contractId)
      .then(setContract)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [contractId]);

  if (loading && !contract) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
        <PageLoader />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-red-400">{error ?? 'Contract not found'}</p>
          <Link href="/admin/contracts" className="mt-4 inline-block text-teal-400 hover:underline">
            ← Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  const status = (contract.status as string) ?? '—';
  const created = contract.created_at ? new Date(contract.created_at as string).toLocaleString() : '—';
  const startDate = contract.start_date ? new Date(contract.start_date as string).toLocaleDateString() : '—';

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/contracts" className="text-gray-400 hover:text-white">
            ← Contracts
          </Link>
          <h2 className="text-2xl font-bold text-white">
            {(contract.contract_name as string) || 'Contract'} {(contract.contract_id as string) ? `(${String(contract.contract_id).slice(0, 8)}…)` : ''}
          </h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : status === 'CANCELLED' || status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {status}
          </span>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'ok' ? 'bg-teal-500/20 text-teal-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {(status === 'ACTIVE' || status === 'DRAFT') && (
          <div className="mb-6 p-4 bg-[#111111] border border-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Admin actions</h3>
            <button
              type="button"
              disabled={statusUpdating}
              onClick={async () => {
                if (!confirm('Cancel this contract? This will set its status to CANCELLED.')) return;
                setStatusUpdating(true);
                setMessage(null);
                try {
                  await adminApi.updateContractStatus(contractId, 'CANCELLED');
                  setMessage({ type: 'ok', text: 'Contract cancelled.' });
                  setContract((c) => (c ? { ...c, status: 'CANCELLED' } : null));
                } catch (e: unknown) {
                  setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Update failed.' });
                } finally {
                  setStatusUpdating(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30 text-sm font-medium disabled:opacity-50"
            >
              {statusUpdating ? 'Updating…' : 'Cancel contract'}
            </button>
          </div>
        )}

        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Contract ID</h3>
            <p className="text-white font-mono text-sm">{String(contract.id ?? contract.contract_id ?? '') || '—'}</p>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Parties</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Employer</dt><dd className="text-white font-mono">{shorten(contract.employer_address as string)}</dd></div>
              <div><dt className="text-gray-500">Contractor</dt><dd className="text-white font-mono">{shorten(contract.contractor_address as string)}</dd></div>
            </dl>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Dates & chain</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><dt className="text-gray-500">Created</dt><dd className="text-gray-300">{created}</dd></div>
              <div><dt className="text-gray-500">Start date</dt><dd className="text-gray-300">{startDate}</dd></div>
              <div><dt className="text-gray-500">Chain</dt><dd className="text-gray-300">{contract.chain_slug != null ? String(contract.chain_slug) : '—'}</dd></div>
            </dl>
          </section>
          {Object.keys(contract).length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 mb-2">All fields</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(contract)
                  .filter(([k]) => !['employer_address', 'contractor_address', 'contract_id', 'contract_name', 'id', 'status', 'created_at', 'start_date', 'chain_slug'].includes(k))
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="text-gray-300 break-all">{v != null ? String(v) : '—'}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
