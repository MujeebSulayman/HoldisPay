'use client';

const base =
  'w-full px-3 sm:px-4 py-3 bg-transparent text-white border border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500 transition-colors cursor-pointer appearance-none pr-10 [&_option]:bg-zinc-900 [&_option]:text-white [&_option]:py-2';
const disabledClass = 'opacity-50 cursor-not-allowed';

const chevronSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E";

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function FormSelect({ disabled, className = '', children, ...rest }: FormSelectProps) {
  return (
    <select
      disabled={disabled}
      className={`${base} ${disabled ? disabledClass : ''} ${className}`}
      style={{
        backgroundImage: `url("${chevronSvg}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '1.25rem',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}
