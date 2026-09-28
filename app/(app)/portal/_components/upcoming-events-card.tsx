import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate } from '@/lib/format';
import type { PortalEventItem } from '@/lib/portal-events';

/**
 * Presentational portal card: renders the viewer's upcoming events.
 * Data is fetched once inside getPortalSummary (same parallel batch as the
 * rest of the portal) and passed in — this component does no fetching of
 * its own. Renders nothing when there are none.
 */
export function UpcomingEventsCard({ events }: { events: PortalEventItem[] }) {
  if (events.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Upcoming events</CardTitle>
          <Link
            href="/events"
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            <Icon name="calendar-days" size={16} /> All events
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {events.map((e) => {
            // pktDate → "28 Sep 2026"
            const [dayNum, mon] = pktDate(e.date).split(' ');
            return (
              <li key={e.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
                  >
                    <span className="tnum text-base font-bold leading-none">{dayNum}</span>
                    <span className="text-[10px] font-semibold uppercase leading-tight">{mon}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{e.title}</p>
                    <p className="tnum mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {pktDate(e.date)}
                      {e.gradeName ? ` · ${e.gradeName}` : ''}
                      {e.venue ? ` · ${e.venue}` : ''}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
