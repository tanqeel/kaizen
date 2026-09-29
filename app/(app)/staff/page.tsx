import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pkr, pktDate } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Table, TBody, TD, TH, THead, TRow } from '@/components/ui';
import { Icon } from '@/components/icons';
import PerformanceSection from './_components/performance-section';
import { AddStaffDialog } from './_components/add-staff-dialog';
import { DeactivateStaffButton } from './_components/deactivate-staff-button';

export default async function StaffPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'staff.manage');

  const [teachers, staffMembers] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        user: true,
        allocations: { include: { subject: true }, orderBy: { subject: { name: 'asc' } } },
      },
      orderBy: { employeeId: 'asc' },
    }),
    prisma.staffMember.findMany({
      include: { user: true },
      orderBy: { employeeId: 'asc' },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Teachers & Staff"
        subtitle="Faculty and operational staff. Salary figures are visible to leadership roles (Super Admin, Principal) only."
        actions={<AddStaffDialog />}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="users" size={18} /> Teachers ({teachers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <EmptyState icon="users" title="No teachers" guidance="No active teacher records found." />
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>Name</TH>
                  <TH>Employee ID</TH>
                  <TH>Phone</TH>
                  <TH>Subjects</TH>
                  <TH>Monthly salary</TH>
                  <TH>Hired</TH>
                  <TH>ID Card</TH>
                  <TH>Actions</TH>
                </TRow>
              </THead>
              <TBody>
                {teachers
                  .slice()
                  .sort((a, b) => (a.user?.name ?? '').localeCompare(b.user?.name ?? ''))
                  .map((t) => (
                  <TRow key={t.id}>
                    <TD className="font-medium">{t.user?.name ?? '—'}</TD>
                    <TD className="tnum">{t.employeeId}</TD>
                    <TD className="tnum">{t.phone}</TD>
                    <TD>
                      <span className="flex flex-wrap gap-1">
                        {t.allocations.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          t.allocations.map((a) => (
                            <Badge key={a.id} variant="info">
                              {a.subject.name}
                            </Badge>
                          ))
                        )}
                      </span>
                    </TD>
                    <TD className="tnum font-semibold">{pkr(t.salaryMonthly)}</TD>
                    <TD className="tnum">{pktDate(t.hireDate)}</TD>
                    <TD>
                      <Link
                        href={`/staff/${t.id}/id-card`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Icon name="id-card" size={14} /> ID Card
                      </Link>
                    </TD>
                    <TD>
                      <DeactivateStaffButton id={t.id} kind="TEACHER" name={t.user?.name ?? t.employeeId} isActive={t.isActive} />
                    </TD>
                  </TRow>
                  ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="id-card" size={18} /> Staff members ({staffMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffMembers.length === 0 ? (
            <EmptyState icon="id-card" title="No staff members" guidance="No active staff records found." />
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>Name</TH>
                  <TH>Employee ID</TH>
                  <TH>Designation</TH>
                  <TH>Phone</TH>
                  <TH>Monthly salary</TH>
                  <TH>Hired</TH>
                  <TH>ID Card</TH>
                  <TH>Actions</TH>
                </TRow>
              </THead>
              <TBody>
                {staffMembers
                  .slice()
                  .sort((a, b) => (a.user?.name ?? '').localeCompare(b.user?.name ?? ''))
                  .map((s) => (
                  <TRow key={s.id}>
                    <TD className="font-medium">{s.user?.name ?? '—'}</TD>
                    <TD className="tnum">{s.employeeId}</TD>
                    <TD>{s.designation}</TD>
                    <TD className="tnum">{s.phone}</TD>
                    <TD className="tnum font-semibold">{pkr(s.salaryMonthly)}</TD>
                    <TD className="tnum">{pktDate(s.hireDate)}</TD>
                    <TD>
                      <Link
                        href={`/staff/${s.id}/id-card`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Icon name="id-card" size={14} /> ID Card
                      </Link>
                    </TD>
                    <TD>
                      <DeactivateStaffButton id={s.id} kind="STAFF" name={s.user?.name ?? s.employeeId} isActive={s.isActive} />
                    </TD>
                  </TRow>
                  ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Teacher performance analytics */}
      <PerformanceSection />
    </div>
  );
}
