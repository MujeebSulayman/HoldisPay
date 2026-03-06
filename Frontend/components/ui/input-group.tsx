'use client';

import * as React from 'react';

const inputGroupStyles =
  'flex items-center w-full overflow-hidden bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus-within:ring-1 focus-within:border-teal-400 focus-within:ring-teal-400/20';

const inputStyles =
  'flex-1 min-w-0 px-4 py-2.5 bg-transparent text-white placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

export function InputGroup({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${inputGroupStyles} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export const InputGroupInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(function InputGroupInput({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`${inputStyles} ${className}`}
      {...props}
    />
  );
});

export function InputGroupAddon({
  align,
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { align?: 'inline-end' }) {
  return (
    <div
      className={`flex items-center shrink-0 text-gray-400 ${align === 'inline-end' ? 'pl-2 pr-3' : 'pr-2 pl-3'} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
