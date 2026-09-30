import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';
import type { AnnouncementAudience } from '@prisma/client';

/**
 * GET /api/notices — announcements visible to the current user,
 * scoped by role and grade exactly like the /notices page.
 */
export async function GET() {
  const auth = await apiUser('notices.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const audiences: AnnouncementAudience[] = ['ALL'];
  if (user.role === 'PARENT') audiences.push('PARENTS');
  if (user.role === 'TEACHER') audiences.push('TEACHERS');
  if (user.role === 'STAFF') audiences.push('STAFF');
  if (user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL') {
    audiences.push('PARENTS', 'TEACHERS', 'STAFF');
  }

  let gradeIds: string[] | null = null;
  if (user.role === 'PARENT') {
    const kids = await childStudentIds(user.id);
    const studs = await prisma.student.findMany({ where: { id: { in: kids } }, select: { gradeId: true } });
    gradeIds = [...new Set(studs.map((s) => s.gradeId))];
  } else if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { gradeId: true } });
    gradeIds = student ? [student.gradeId] : [];
  } else if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: { allocations: { select: { gradeId: true } } },
    });
    gradeIds = [...new Set(teacher?.allocations.map((a) => a.gradeId) ?? [])];
  }

  const notices = await prisma.announcement.findMany({
    where: {
      OR: [
        { audience: { in: audiences } },
        ...(gradeIds === null
          ? [{ audience: 'GRADES' as AnnouncementAudience }]
          : gradeIds.length > 0
            ? [{ audience: 'GRADES' as AnnouncementAudience, gradeId: { in: gradeIds } }]
            : []),
      ],
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 60,
  });

  return NextResponse.json({
    notices: notices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      priority: n.priority,
      audience: n.audience,
      gradeId: n.gradeId,
      createdBy: n.createdBy.name,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
