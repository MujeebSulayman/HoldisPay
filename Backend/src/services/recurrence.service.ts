import { addDays, addWeeks, addMonths } from 'date-fns';

export type RecurrenceFrequency = 'NONE' | 'BI_WEEKLY' | 'MONTHLY' | 'CUSTOM';

export class RecurrenceService {
  /**
   * Calculates the next occurrence date based on the current date and frequency.
   * @param startDate The date of the last occurrence (or the start date).
   * @param frequency The recurrence frequency.
   * @param customDays Number of days for CUSTOM frequency.
   * @returns The next occurrence date.
   */
  getNextOccurrenceDate(
    startDate: Date,
    frequency: RecurrenceFrequency,
    customDays?: number
  ): Date {
    switch (frequency) {
      case 'BI_WEEKLY':
        return addWeeks(startDate, 2);
      case 'MONTHLY':
        return addMonths(startDate, 1);
      case 'CUSTOM':
        if (!customDays || customDays <= 0) {
          throw new Error('Custom recurrence requires a positive number of days');
        }
        return addDays(startDate, customDays);
      case 'NONE':
      default:
        return startDate;
    }
  }

  /**
   * Determines if a payment is due based on the next occurrence date.
   * @param nextDate The calculated next occurrence date.
   * @returns Boolean indicating if the date is in the past or present.
   */
  isPaymentDue(nextDate: Date): boolean {
    return nextDate.getTime() <= Date.now();
  }
}

export const recurrenceService = new RecurrenceService();
