import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { providerStatus } from '@/lib/ai/providers';
import { todayPKT } from '@/lib/format';
import { AdminClient, type AdminUser, type AiActivity } from './AdminClient';

function buildActivity(logs: Array<{ createdAt: Date; intent: string; latencyMs: number; userId: string }>): AiActivity {
  const today = todayPKT();
  const perDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(`${today}T12:00:00+05:00`);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    perDay.set(key, 0);
  }
  const intents = new Map<string, number>();
  const users = new Set<string>();
  let latencySum = 0;
  const pktDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  for (const l of logs) {
    const key = pktDay.format(l.createdAt);
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
    intents.set(l.intent, (intents.get(l.intent) ?? 0) + 1);
    users.add(l.userId);
    latencySum += l.latencyMs;
  }
  const topIntents = [...intents.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return {
    total: logs.length,
    avgLatencyMs: logs.length === 0 ? 0 : Math.round(latencySum / logs.length),
    distinctUsers: users.size,
    perDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
    topIntents,
  };
}

export default async function AdminPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'admin.manage');

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
  const [users, logs] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    }),
    prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, intent: true, latencyMs: true, userId: true },
    }),
  ]);

  const initialUsers: AdminUser[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <AdminClient
      initialUsers={initialUsers}
      providers={providerStatus()}
      activity={buildActivity(logs)}
      selfId={user.id}
    />
  );
}
