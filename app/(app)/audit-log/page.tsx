import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from '@/components/ui';
import { pktDateTime } from '@/lib/format';

/** /audit-log — sensitive action audit trail. Principal / Super Admin only. */
export default async function AuditLogPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'users.manage');

  const school = await prisma.school.findFirst({ select: { id: true } });
  const logs = school
    ? await prisma.auditLog.findMany({
        where: { schoolId: school.id },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : [];

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Sensitive actions across the system. Newest first." />
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState icon="info" title="No audit entries yet" guidance="Sensitive actions will be recorded here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Actor</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Target</th>
                    <th className="py-2 pr-4">Result</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-500">
                        {pktDateTime(l.createdAt)}
                      </td>
                      <td className="py-2 pr-4 font-medium">{l.actor?.name ?? 'System'}</td>
                      <td className="py-2 pr-4">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                          {l.action}
                        </code>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-600">
                        {l.targetType ? `${l.targetType}${l.targetId ? ` · ${l.targetId.slice(0, 8)}…` : ''}` : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={l.result === 'ALLOWED' ? 'present' : 'absent'}>{l.result}</Badge>
                      </td>
                      <td className="py-2 text-xs text-slate-600">{l.detail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
