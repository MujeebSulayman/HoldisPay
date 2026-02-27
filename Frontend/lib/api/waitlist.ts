import { apiClient } from './client';

export async function joinWaitlist(email: string, name?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await apiClient.post<{ message?: string }>('/api/waitlist', { email: email.trim(), name: name?.trim() || undefined });
  if (res.success) return { success: true, message: res.message || "You're on the list." };
  return { success: false, error: res.error || 'Failed to join' };
}
