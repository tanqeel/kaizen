import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { IntelligenceClient } from './_components/intelligence-client';

/**
 * /intelligence — KAIZEN Intelligence dashboard for principal/admin.
 * Evidence-based recommendations with human-in-the-loop review.
 */
export default async function IntelligencePage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'users.manage');

  return (
    <div>
      <PageHeader
        title="KAIZEN Intelligence"
        subtitle="Evidence-based insights from operational patterns. Nothing changes until you review and approve it."
      />
      <IntelligenceClient />
    </div>
  );
}
