'use client';

interface FormLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
  required?: boolean;
  className?: string;
}

export function FormLabel({ htmlFor, children, optional, required, className = '' }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-zinc-400 mb-1.5 ${className}`}>
      {children}
      {required && <span className="text-teal-400"> *</span>}
      {optional && <span className="font-normal text-zinc-500 ml-1.5"> (optional)</span>}
    </label>
  );
}
