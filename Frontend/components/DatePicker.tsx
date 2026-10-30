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
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const DISPLAY_FORMAT = 'd MMMM yyyy';
const API_FORMAT = 'yyyy-MM-dd';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  minDate?: Date;
  placeholder?: string;
  id?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  minDate = new Date(),
  placeholder = 'Pick a date',
  id,
  className = '',
  compact = false,
  disabled = false,
}: DatePickerProps) {
  const cellSize = compact ? 'w-7 h-7' : 'w-10 h-10';
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
    <div ref={containerRef} className={`relative ${open ? 'z-9999' : 'z-10'}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-4 py-3 bg-black/30 text-white border border-white/10 rounded-lg text-left text-sm focus:outline-none focus:border-brand-500 transition-colors flex items-center justify-between gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-gray-500'}`}>
          {selected ? format(selected, DISPLAY_FORMAT) : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute z-9999 mt-2 left-0 sm:left-0 sm:right-auto right-0 glass-strong border border-white/10 rounded-xl shadow-2xl ${compact ? 'min-w-48 p-3' : 'sm:min-w-[18rem] min-w-full p-4 sm:p-5'
            } backdrop-blur-xl max-w-[calc(100vw-2rem)]`}
        >
          {/* Month nav */}
          <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>
            <span className={`font-semibold text-white ${compact ? 'text-xs' : 'text-sm'}`}>
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>
          </div>

          {/* 7-column grid: weekday headers */}
          <div className={`grid grid-cols-7 gap-0.5 mb-1.5 ${compact ? '' : 'mb-2'}`}>
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className={`${cellSize} flex items-center justify-center font-medium text-zinc-500 ${compact ? 'text-[10px]' : 'text-xs'}`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 7-column grid: days */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              const isSelected = selected && isSameDay(day, selected);
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isPast = isBefore(day, min);
              const isClickable = isCurrentMonth && !isPast;
              return (
                <div key={i} className={`${cellSize} flex items-center justify-center p-0 ${isPast ? 'blur-[1px] opacity-40 select-none' : ''}`}>
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && handleSelect(day)}
                    className={`
                      w-full h-full rounded-lg font-medium transition-colors
                      ${compact ? 'text-xs' : 'text-sm'}
                      ${!isCurrentMonth ? 'text-zinc-600' : 'text-white'}
                      ${!isClickable ? 'cursor-default' : 'hover:bg-white/[0.08]'}
                      ${isSelected ? 'bg-brand-500! text-black! hover:bg-brand-400!' : ''}
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
