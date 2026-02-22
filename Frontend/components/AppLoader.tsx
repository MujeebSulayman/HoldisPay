'use client';

/** Branded full-screen or inline loader. Use for auth gate and page loads. */
export function AppLoader({ inline = false }: { inline?: boolean }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-12 h-12 rounded-full border-2 border-gray-800" />
        <div
          className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-teal-400 animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        {/* Inner H mark (Holdis) - static, ring spins around it */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-teal-400 font-bold text-lg tracking-tighter select-none" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
            H
          </span>
        </div>
      </div>
      {!inline && (
        <div className="h-1 w-20 rounded-full bg-gray-800/50 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-teal-400/70 animate-pulse" />
        </div>
      )}
    </div>
  );

  if (inline) {
    return <div className="flex items-center justify-center py-8">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      {content}
    </div>
  );
}
