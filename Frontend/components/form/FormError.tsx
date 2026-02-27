'use client';

export function FormError({ message }: { message: string }) {
  return (
    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
      <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-red-400 text-sm">{message}</p>
    </div>
  );
}
