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
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-400 mb-1.5 ${className}`}>
      {children}
      {required && <span className="text-amber-400"> *</span>}
      {optional && <span className="font-normal text-gray-500"> (optional)</span>}
    </label>
  );
}
