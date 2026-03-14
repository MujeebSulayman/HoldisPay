'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { format, isValid } from 'date-fns';

interface Option {
  id: string;
  label: string;
  detail?: string;
}

interface RecurrenceSelectProps {
  value: string;
  onChange: (value: any) => void;
  referenceDate: string;
}

export default function RecurrenceSelect({ value, onChange, referenceDate }: RecurrenceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getOrdinal = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1:  return "st";
      case 2:  return "nd";
      case 3:  return "rd";
      default: return "th";
    }
  };

  const dateObj = referenceDate ? new Date(referenceDate) : null;
  const isDateValid = dateObj && isValid(dateObj);
  
  const dayOfMonth = isDateValid ? dateObj.getDate() : null;
  const dayName = isDateValid ? format(dateObj, 'eeee') : null;

  const options: Option[] = [
    { id: 'NONE', label: 'Never' },
    { 
      id: 'MONTHLY', 
      label: 'Monthly', 
      detail: dayOfMonth ? `${dayOfMonth}${getOrdinal(dayOfMonth)} of every month` : undefined 
    },
    { 
      id: 'BI_WEEKLY', 
      label: 'Bi-weekly', 
      detail: dayName ? `Every 2 ${dayName}s` : undefined 
    },
    { id: 'CUSTOM', label: 'Custom' },
  ];

  const selectedOption = options.find(o => o.id === value) || options[0];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-800 bg-black/30 text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition group min-h-[46px]"
      >
        <div className="flex items-center gap-2 overflow-hidden">
           <span className="whitespace-nowrap">{selectedOption.label}</span>
           {selectedOption.detail && (
             <span className="text-gray-500 text-[10px] hidden sm:inline whitespace-nowrap opacity-60">
                ({selectedOption.detail})
             </span>
           )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[200px]">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-white/5 ${opt.id === value ? 'bg-white/5 text-teal-400' : 'text-gray-300'}`}
            >
              <div className="flex flex-col items-start">
                <span className="font-semibold">{opt.label}</span>
              </div>
              <div className="flex items-center gap-4">
                {opt.detail && <span className="text-gray-500 text-[11px] font-medium">{opt.detail}</span>}
                {opt.id === value && <Check className="w-4 h-4 shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
