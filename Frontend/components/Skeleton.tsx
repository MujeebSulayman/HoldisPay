'use client';

const base = 'rounded-lg bg-gray-800/60 animate-pulse';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`${base} ${className}`} />;
}

/** Placeholder for a list item (e.g. invoice row). */
export function SkeletonRow() {
  return (
    <div className="p-4 bg-black/30 border border-gray-800 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full max-w-[200px]" />
        </div>
        <Skeleton className="h-6 w-14" />
      </div>
    </div>
  );
}

/** Placeholder for a small stat card. */
export function SkeletonStatCard() {
  return (
    <div className="p-4 bg-black/30 border border-gray-800 rounded-lg space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}
