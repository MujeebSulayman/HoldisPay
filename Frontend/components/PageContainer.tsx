'use client';

/** Wraps dashboard page content with consistent max-width and padding. Use for all dashboard pages. */
export default function PageContainer({
  children,
  className = '',
  maxWidth = 'max-w-7xl',
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl' | 'max-w-full';
}) {
  return (
    <div className={`w-full min-w-0 ${maxWidth} mx-auto ${className}`}>
      {children}
    </div>
  );
}
