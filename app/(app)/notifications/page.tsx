import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { ConfirmProvider } from '@/components/ui';
import { NotificationsClient } from './_components/notifications-client';

/** /notifications — the user's in-app notification inbox. */
export default async function NotificationsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'notifications.view');

  return (
    <ConfirmProvider>
      <NotificationsClient />
    </ConfirmProvider>
  );
}
