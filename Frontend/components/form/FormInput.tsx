'use client';

const base =
  'w-full px-3 sm:px-4 py-3 bg-black/30 text-white border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-teal-500 placeholder-zinc-500 transition-colors';
const errorClass = 'border-red-500/50 focus:border-red-500';

export function FormInput({
  id,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  min,
  max,
  step,
  disabled,
  error,
  className = '',
  ...rest
}: React.ComponentProps<'input'> & { error?: boolean }) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={`${base} ${error ? errorClass : ''} ${className}`}
      {...rest}
    />
  );
}
