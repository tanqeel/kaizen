import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getSessionUser } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';

const execFileAsync = promisify(execFile);

/**
 * POST /api/admin/restore — wipe the database and reseed the demo school.
 * Super Admin only. Runs `npx prisma db seed` (the same path as `npm run seed`)
 * in the project root with a generous timeout.
 *
 * DANGER: this deletes ALL current data. The client must confirm first.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    requirePermission(user.role, 'admin.manage');
  } catch {
    return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      'npx',
      ['prisma', 'db', 'seed'],
      {
        cwd: process.cwd(), // project root when running via next dev / next start
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
        env: process.env,
      },
    );
    const output = `${stdout}\n${stderr}`.trim();
    const tail = output.slice(-2000);
    return NextResponse.json({ ok: true, output: tail });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Seed process failed with an unknown error';
    return NextResponse.json({ ok: false, error: message.slice(0, 2000) }, { status: 500 });
  }
}
