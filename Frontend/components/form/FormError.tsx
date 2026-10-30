'use client';
import { CircleAlert } from 'lucide-react';

export function FormError({ message }: { message: string }) {
  return (
    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
      <CircleAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <p className="text-red-400 text-sm">{message}</p>
    </div>
  );
}
