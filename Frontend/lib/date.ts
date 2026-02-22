import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/** Display format for dates in lists and cards: "15 Mar 2025" */
export const DATE_DISPLAY = 'd MMM yyyy';

/** Display format for due date when selected: "15 March 2025" */
export const DUE_DATE_DISPLAY = 'd MMMM yyyy';

/** Date + time for detail pages: "15 Mar 2025, 2:30 pm" */
export const DATETIME_DISPLAY = "d MMM yyyy, h:mm a";

export function formatDate(date: Date | string | null | undefined): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, DATE_DISPLAY) : '—';
}

export function formatDueDate(date: Date | string | null | undefined): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, DUE_DATE_DISPLAY) : '—';
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, DATETIME_DISPLAY) : '—';
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}
