import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { todayPKT } from '@/lib/format';
import { ConfirmProvider } from '@/components/ui';
import { StaffAttendanceClient } from './_components/staff-attendance-client';

/** /staff/attendance — daily attendance for teachers and non-teaching staff. */
export default async function StaffAttendancePage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'staff.attendance.view');
  const canMark = can(user.role, 'staff.attendance.manage');

  return (
    <ConfirmProvider>
      <StaffAttendanceClient canMark={canMark} initialDate={todayPKT()} />
    </ConfirmProvider>
  );
}
