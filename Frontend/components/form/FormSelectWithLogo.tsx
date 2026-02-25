'use client';

import { useEffect, useRef, useState } from 'react';

export interface FormSelectWithLogoOption {
  value: string;
  label: string;
  logoUrl?: string;
}

const base =
  'w-full px-3 sm:px-4 py-2.5 bg-transparent text-white border border-gray-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500 transition-colors cursor-pointer text-left flex items-center gap-2';
const disabledClass = 'opacity-50 cursor-not-allowed';

interface FormSelectWithLogoProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: FormSelectWithLogoOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function LogoOrPlaceholder({ logoUrl, alt, size = 20 }: { logoUrl?: string; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImg = logoUrl?.trim() && !failed;
  return (
    <span
      className="rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        alt.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function FormSelectWithLogo({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  required,
  className = '',
}: FormSelectWithLogoProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const size = 22;

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${base} ${disabled ? disabledClass : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <LogoOrPlaceholder logoUrl={selected.logoUrl} alt={selected.label} size={size} />
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-gray-500 truncate">{placeholder}</span>
        )}
        <svg
          className={`w-5 h-5 text-gray-400 shrink-0 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-gray-700/80 bg-gray-900 py-1 shadow-xl"
          role="listbox"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-gray-800 transition-colors ${
                opt.value === value ? 'bg-teal-500/20 text-teal-300' : 'text-white'
              }`}
            >
              <LogoOrPlaceholder logoUrl={opt.logoUrl} alt={opt.label} size={size} />
              <span className="truncate">{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
