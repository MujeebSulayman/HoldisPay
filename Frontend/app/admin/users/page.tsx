'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

interface User {
  id: string;
  email: string;
  accountType: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  kycStatus: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkKycStatus, setBulkKycStatus] = useState('');
  const [bulkReviewedBy, setBulkReviewedBy] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      router.push('/admin/login');
      return;
    }

    const parsedUser = JSON.parse(user);
    if (parsedUser.accountType !== 'admin') {
      router.push('/');
      return;
    }

    fetchUsers();
  }, [router, searchQuery, kycFilter]);

  const fetchUsers = async () => {
    try {
      const response = await adminApi.searchUsers({
        searchQuery,
        kycStatus: kycFilter || undefined,
      });
      if (response && Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">User Management</h2>
        </div>

        {/* Filters */}
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email or name..."
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                KYC Status
              </label>
              <select
                value={kycFilter}
                onChange={(e) => setKycFilter(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-400"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 p-4 bg-[#111111] border border-gray-800 rounded-lg flex flex-wrap items-center gap-4">
            <span className="text-gray-400 text-sm">{selectedIds.size} selected</span>
            <select
              value={bulkKycStatus}
              onChange={(e) => setBulkKycStatus(e.target.value)}
              className="px-3 py-2 bg-[#0A0A0A] border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">Set KYC status</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              type="text"
              value={bulkReviewedBy}
              onChange={(e) => setBulkReviewedBy(e.target.value)}
              placeholder="Reviewed by"
              className="px-3 py-2 bg-[#0A0A0A] border border-gray-700 rounded-lg text-white text-sm w-40"
            />
            <button
              type="button"
              disabled={bulkSubmitting || !bulkKycStatus || !bulkReviewedBy.trim()}
              onClick={async () => {
                setBulkSubmitting(true);
                setBulkMessage(null);
                try {
                  const res = await adminApi.bulkUpdateKYC({
                    userIds: Array.from(selectedIds),
                    status: bulkKycStatus,
                    reviewedBy: bulkReviewedBy.trim(),
                  });
                  const data = res as { successful?: string[]; failed?: { userId: string; error: string }[] };
                  const ok = data.successful?.length ?? 0;
                  const fail = data.failed?.length ?? 0;
                  setBulkMessage({ type: 'ok', text: `Updated ${ok} user(s).${fail > 0 ? ` ${fail} failed.` : ''}` });
                  setSelectedIds(new Set());
                  fetchUsers();
                } catch (e: unknown) {
                  setBulkMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Bulk update failed.' });
                } finally {
                  setBulkSubmitting(false);
                }
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-500 disabled:opacity-50"
            >
              {bulkSubmitting ? 'Updating…' : 'Update KYC'}
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white text-sm">
              Clear selection
            </button>
            {bulkMessage && <span className={bulkMessage.type === 'ok' ? 'text-teal-400 text-sm' : 'text-red-400 text-sm'}>{bulkMessage.text}</span>}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1a1a1a] border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === users.length && users.length > 0}
                        onChange={(e) => setSelectedIds(e.target.checked ? new Set(users.map((u) => u.id)) : new Set())}
                        className="rounded border-gray-600 text-teal-500 focus:ring-teal-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Account Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      KYC Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/admin/users/${user.id}`); } }}
                      className="hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(user.id);
                              else next.delete(user.id);
                              return next;
                            });
                          }}
                          className="rounded border-gray-600 text-teal-500 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-sm font-medium text-white">
                            {user.profile?.firstName} {user.profile?.lastName}
                          </span>
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-800 text-gray-300 rounded">
                          {user.accountType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            user.kycStatus === 'verified'
                              ? 'bg-green-500/10 text-green-400'
                              : user.kycStatus === 'rejected'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                          }`}
                        >
                          {user.kycStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            user.isActive
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
