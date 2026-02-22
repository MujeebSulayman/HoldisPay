'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import 'react-day-picker/style.css';

const DISPLAY_FORMAT = 'd MMMM yyyy';
const API_FORMAT = 'yyyy-MM-dd';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  minDate?: Date;
  placeholder?: string;
  id?: string;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  minDate = new Date(),
  placeholder = 'Pick a date',
  id,
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(() =>
    value && isValid(parseISO(value)) ? parseISO(value) : undefined
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && isValid(parseISO(value))) {
      setSelected(parseISO(value));
    } else {
      setSelected(undefined);
    }
  }, [value]);

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

  const handleSelect = (date: Date | undefined) => {
    setSelected(date);
    onChange(date ? format(date, API_FORMAT) : '');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl text-left focus:outline-none focus:border-teal-500 transition-colors flex items-center justify-between ${className}`}
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>
          {selected ? format(selected, DISPLAY_FORMAT) : placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 p-3 bg-[#0f0f0f] border border-gray-800 rounded-xl shadow-xl">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={{ before: startOfDay(minDate) }}
            defaultMonth={selected ?? minDate}
            classNames={{
              root: 'rdp-root',
              month: 'rdp-month',
              month_caption: 'flex justify-between items-center h-10 mb-3 text-white font-medium',
              nav: 'flex gap-1',
              button_previous: 'p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors',
              button_next: 'p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors',
              month_grid: 'w-full border-collapse',
              weekdays: 'text-gray-500 text-xs font-medium',
              weekday: 'p-2 text-center',
              week: 'flex',
              day: 'p-0',
              day_button:
                'w-10 h-10 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800 text-white',
              selected: '!bg-teal-500 !text-white hover:!bg-teal-600',
              today: 'ring-1 ring-teal-400/50',
              disabled: 'text-gray-600 cursor-not-allowed opacity-50',
              outside: 'text-gray-600 opacity-50',
              hidden: 'invisible',
            }}
          />
        </div>
      )}
    </div>
  );
}
