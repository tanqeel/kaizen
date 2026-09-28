import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate } from '@/lib/format';
import { getUpcomingEvents } from '@/lib/portal-events';

/**
 * Upcoming events card for the parent portal. Self-contained: looks up the
 * user's role, fetches the next 3 audience-relevant upcoming events, and
 * renders nothing when there are none. (Wiring into /portal is the
 * coordinator's job — this component only needs <UpcomingEventsCard userId={user.id} />.)
 */
export async function UpcomingEventsCard({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return null;

  const events = await getUpcomingEvents(userId, user.role, 3);
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
