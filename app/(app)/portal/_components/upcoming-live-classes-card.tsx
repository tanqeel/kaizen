import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getUpcomingLiveClasses } from '@/lib/portal-live-classes';
import { pktDateTime } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Icon } from '@/components/icons';

/**
 * Self-contained portal card: the viewer's live classes starting within the
 * next 48 hours (or started in the last 30 minutes). Renders nothing when the
 * viewer has none. Wired into /portal by the coordinator.
 */
export async function UpcomingLiveClassesCard({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return null;

  const classes = await getUpcomingLiveClasses(userId, user.role, 3);
  if (classes.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Upcoming live classes</CardTitle>
          <Link
            href="/live-classes"
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            <Icon name="wifi" size={16} /> All live classes
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {classes.map((c) => {
            const live = Date.now() >= c.startsAt.getTime() && Date.now() < c.endsAt.getTime();
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
              >
                <span
                  className={
                    live
                      ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }
                >
                  <Icon name="wifi" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.title}</p>
                  <p className="tnum mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {pktDateTime(c.startsAt)} · {c.sectionLabel}
                    {c.subject ? ` · ${c.subject}` : ''} · {c.teacher}
                  </p>
                </div>
                {live && <Badge variant="present">Live now</Badge>}
                <a
                  href={c.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <Icon name="wifi" size={16} /> Join
                </a>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
