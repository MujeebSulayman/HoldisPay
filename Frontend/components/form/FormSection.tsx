'use client';

export function FormSection({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 sm:p-6 md:p-8 backdrop-blur-sm ${className}`}>
      <h3 className="text-sm sm:text-base md:text-lg font-medium text-white mb-1.5 sm:mb-2">{title}</h3>
      {subtitle && <p className="text-xs sm:text-sm text-zinc-500 mb-4 sm:mb-6 leading-relaxed -mt-1 sm:-mt-2">{subtitle}</p>}
      {children}
    </div>
  );
}
