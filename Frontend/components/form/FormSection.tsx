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
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg sm:rounded-lg p-4 sm:p-5 md:p-6 ${className}`}>
      <h3 className="text-sm sm:text-base font-semibold text-white mb-1 sm:mb-2">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mb-3 sm:mb-4 -mt-1 sm:-mt-2">{subtitle}</p>}
      {children}
    </div>
  );
}
