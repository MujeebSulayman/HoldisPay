'use client';

import { FormSection, FormLabel } from '@/components/form';
import { DatePicker } from '@/components/DatePicker';

export type ScheduleDuration = 'FIXED' | 'ONGOING';

export interface PaymentScheduleFormValue {
  duration: ScheduleDuration;
  paymentAmount: string;
  numberOfPayments: string;
  paymentInterval: string;
  startDate: string;
}

interface PaymentScheduleSectionProps {
  value: PaymentScheduleFormValue;
  onChange: (patch: Partial<PaymentScheduleFormValue>) => void;
  onClearError?: () => void;
  inputClassName: string;
  displayTotal: number | null;
  isOngoing: boolean;
}

export function PaymentScheduleSection({
  value,
  onChange,
  onClearError,
  inputClassName,
  displayTotal,
  isOngoing,
}: PaymentScheduleSectionProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value: v } = e.target;
    onClearError?.();
    onChange({ [name]: v });
  };

  const endDateLabel =
    value.startDate &&
    (parseInt(value.numberOfPayments, 10) || 0) > 0 &&
    (parseInt(value.paymentInterval, 10) || 0) > 0
      ? new Date(
          new Date(value.startDate).getTime() +
            (parseInt(value.numberOfPayments, 10) || 0) *
              (parseInt(value.paymentInterval, 10) || 0) *
              24 * 60 * 60 * 1000
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

  return (
    <FormSection
      title="How you'll pay"
      subtitle="Scheduled payments (with or without an end date), or project paid when you submit and the employer approves."
    >
      <div className="space-y-5 sm:space-y-6">
        {/* Single option: Scheduled payments — sub-choice for end date vs ongoing */}
        <div className="rounded-lg border-2 border-teal-500/40 bg-linear-to-b from-teal-500/10 to-transparent p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/20">
              <svg className="h-5 w-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Scheduled payments</p>
              <p className="mt-0.5 text-sm text-gray-400">
                Same amount every interval. Choose an end date or run until you stop.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearError?.();
                    onChange({ duration: 'FIXED' });
                  }}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    value.duration === 'FIXED'
                      ? 'border-teal-400 bg-teal-400/20 text-white shadow-sm'
                      : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-800/70'
                  }`}
                >
                  With end date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearError?.();
                    onChange({ duration: 'ONGOING' });
                  }}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    value.duration === 'ONGOING'
                      ? 'border-teal-400 bg-teal-400/20 text-white shadow-sm'
                      : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-800/70'
                  }`}
                >
                  No end date (ongoing)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed: amount, number of payments, interval, start date */}
        {!isOngoing && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300 sm:mb-2">Payment amount (USD)</label>
                <input
                  type="number"
                  name="paymentAmount"
                  value={value.paymentAmount}
                  onChange={handleChange}
                  required
                  min={0}
                  step={1}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300 sm:mb-2">Number of payments</label>
                <input
                  type="number"
                  name="numberOfPayments"
                  value={value.numberOfPayments}
                  onChange={handleChange}
                  required
                  min={1}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300 sm:mb-2">Interval (days)</label>
                <input
                  type="number"
                  name="paymentInterval"
                  value={value.paymentInterval}
                  onChange={handleChange}
                  required
                  min={1}
                  className={inputClassName}
                />
              </div>
              <div>
                <FormLabel htmlFor="startDate-schedule">Start date</FormLabel>
                <DatePicker
                  id="startDate-schedule"
                  value={value.startDate}
                  onChange={(v) => onChange({ startDate: v })}
                  minDate={new Date()}
                  placeholder="Select start date"
                />
              </div>
            </div>
            {value.startDate && endDateLabel && (
              <div className="flex items-center gap-2 rounded-lg bg-gray-800/40 px-3 py-2 text-sm text-gray-400">
                <span>Ends</span>
                <span className="font-medium text-white">{endDateLabel}</span>
              </div>
            )}
          </>
        )}

        {/* Ongoing: amount, interval, start date */}
        {isOngoing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300 sm:mb-2">Payment amount (USD)</label>
              <input
                type="number"
                name="paymentAmount"
                value={value.paymentAmount}
                onChange={handleChange}
                required
                min={0}
                step={1}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300 sm:mb-2">Interval (days)</label>
              <input
                type="number"
                name="paymentInterval"
                value={value.paymentInterval}
                onChange={handleChange}
                required
                min={1}
                className={inputClassName}
              />
            </div>
            <div>
              <FormLabel htmlFor="startDate-ongoing">Start date</FormLabel>
              <DatePicker
                id="startDate-ongoing"
                value={value.startDate}
                onChange={(v) => onChange({ startDate: v })}
                minDate={new Date()}
                placeholder="Select start date"
              />
            </div>
          </div>
        )}

        {/* Total value summary */}
        {((displayTotal !== null && displayTotal > 0) || (isOngoing && value.paymentAmount)) && (
          <div className="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/40 py-3 px-4 sm:py-3.5 sm:px-5">
            <span className="text-sm text-gray-400">Total value</span>
            <span className="text-lg font-semibold text-white sm:text-xl">
              {isOngoing ? 'Recurring' : `$${displayTotal != null && displayTotal > 0 ? displayTotal.toFixed(2) : '0.00'}`}
            </span>
          </div>
        )}
      </div>
    </FormSection>
  );
}
