import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { ConfirmProvider } from '@/components/ui';
import { BiometricClient } from './_components/biometric-client';

/** /biometric — terminal config + gate check-in simulator. */
export default async function BiometricPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'biometric.use');

  return (
    <ConfirmProvider>
      <BiometricClient canManage={can(user.role, 'biometric.manage')} />
    </ConfirmProvider>
  );
}
