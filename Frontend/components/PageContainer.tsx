'use client';

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
