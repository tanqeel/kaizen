'use client';

/** Print button (hidden in print output). Client component. */
export function PrintButton() {
  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-[44px] rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Print / Save PDF
      </button>
    </div>
  );
}
