'use client';

const base =
  'w-full px-3 sm:px-4 py-3 bg-black/30 text-white border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-teal-500 placeholder-zinc-500 transition-colors resize-y';
const errorClass = 'border-red-500/50 focus:border-red-500';

export function FormTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
) {
  const { error, className = '', ...rest } = props;
  return <textarea className={`${base} ${error ? errorClass : ''} ${className}`} {...rest} />;
}
