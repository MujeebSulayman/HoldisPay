'use client';

import { useEffect, useRef, useState } from 'react';
import {
  format,
  parseISO,
  isValid,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
} from 'date-fns';

const DISPLAY_FORMAT = 'd MMMM yyyy';
const API_FORMAT = 'yyyy-MM-dd';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CELL_SIZE = 'w-9 h-9';

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
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    selected ?? minDate
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && isValid(parseISO(value))) {
      const d = parseISO(value);
      setSelected(d);
      setViewMonth(d);
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

  const handleSelect = (date: Date) => {
    setSelected(date);
    onChange(format(date, API_FORMAT));
    setOpen(false);
  };

  const min = startOfDay(minDate);
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

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
          className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 p-4 bg-white border border-gray-200 rounded-xl shadow-lg">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 7-column grid: weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className={`${CELL_SIZE} flex items-center justify-center text-xs font-medium text-gray-500`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 7-column grid: days — same column width as weekday headers */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              const disabled = isBefore(day, min) || !isSameMonth(day, viewMonth);
              const isSelected = selected && isSameDay(day, selected);
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isClickable = isCurrentMonth && !isBefore(day, min);
              return (
                <div key={i} className={`${CELL_SIZE} flex items-center justify-center p-0`}>
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && handleSelect(day)}
                    className={`
                      w-full h-full rounded-lg text-sm font-medium transition-colors
                      ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-900'}
                      ${!isClickable ? 'cursor-default' : 'hover:bg-gray-100'}
                      ${isSelected ? '!bg-teal-500 !text-white hover:!bg-teal-600' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
