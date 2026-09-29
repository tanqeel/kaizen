'use client';

/** Print button (hidden in print output). Client component. */
export function PrintButton() {
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] items-center justify-between py-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-[#1b2a5e] px-6 py-2 text-sm font-semibold text-white hover:bg-[#243a7d]"
      >
        Print / Save PDF
      </button>
    </div>
  );
}
