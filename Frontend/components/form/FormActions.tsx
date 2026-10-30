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
        className="px-6 py-3 glass-strong hover:bg-white/[0.08] text-white font-medium rounded-lg border border-white/10 transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={isSubmitting || submitDisabled}
        className="flex-1 px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
      >
        {isSubmitting ? 'Creating…' : submitLabel}
      </button>
    </div>
  );
}
