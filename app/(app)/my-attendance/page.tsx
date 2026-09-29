import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate } from '@/lib/format';

/** /my-attendance — the signed-in teacher/staff member's own attendance record. */
export default async function MyAttendancePage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'my.attendance.view');

  const [teacher, staffMember] = await Promise.all([
    user.role === 'TEACHER'
      ? prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } })
      : null,
    user.role === 'STAFF'
      ? prisma.staffMember.findUnique({ where: { userId: user.id }, select: { id: true } })
      : null,
  ]);

  const where = teacher
    ? { teacherId: teacher.id }
    : staffMember
      ? { staffMemberId: staffMember.id }
      : { id: 'none' };

  const records = await prisma.staffAttendance.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 60,
  });

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const leave = records.filter((r) => r.status === 'LEAVE').length;

  return (
    <div>
      <PageHeader title="My Attendance" subtitle="Your personal attendance record." />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{present}</p>
            <p className="mt-1 text-sm text-slate-500">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-red-600">{absent}</p>
            <p className="mt-1 text-sm text-slate-500">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-amber-600">{leave}</p>
            <p className="mt-1 text-sm text-slate-500">Leave</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <EmptyState
              icon="info"
              title="No attendance records yet"
              guidance="Your attendance will appear here once marked by the school office."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500 uppercase">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{pktDate(r.date)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={r.status === 'PRESENT' ? 'present' : r.status === 'ABSENT' ? 'absent' : 'pending'}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-600">{r.note ?? '—'}</td>
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
