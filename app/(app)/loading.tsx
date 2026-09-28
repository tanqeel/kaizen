/**
 * Instant loading skeleton for every page under app/(app)/.
 * The layout (sidebar + header) stays mounted during navigation, so this
 * replaces only the content area — users see feedback immediately instead of
 * a blank page while a cold lambda runs its queries.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      {/* Page title row */}
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        <div className="skeleton-shimmer hidden h-10 w-32 rounded-lg sm:block" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <div className="skeleton-shimmer h-3 w-20 rounded" />
            <div className="skeleton-shimmer mt-3 h-7 w-16 rounded" />
          </div>
        ))}
      </div>
      {/* Main content block */}
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="skeleton-shimmer h-5 w-40 rounded" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
