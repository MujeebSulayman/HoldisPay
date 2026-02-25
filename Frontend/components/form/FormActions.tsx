'use client';

export function FormActions({
  onCancel,
  submitLabel,
  isSubmitting,
  submitDisabled,
  cancelLabel = 'Cancel',
  className = '',
}: {
  onCancel: () => void;
  submitLabel: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  cancelLabel?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row gap-3 ${className}`}>
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={isSubmitting || submitDisabled}
        className="flex-1 px-6 py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl"
      >
        {isSubmitting ? 'Creating…' : submitLabel}
      </button>
    </div>
  );
}
