'use client';

import { useState } from 'react';
import type { Role } from '@prisma/client';
import type { ProviderInfo } from '@/lib/ai/providers';
import { pktDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmProvider,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AiActivity {
  total: number;
  avgLatencyMs: number;
  distinctUsers: number;
  perDay: Array<{ day: string; count: number }>;
  topIntents: Array<{ intent: string; count: number }>;
}

interface AdminClientProps {
  initialUsers: AdminUser[];
  providers: ProviderInfo[];
  activity: AiActivity;
  selfId: string;
}

function RoleBadge({ role }: { role: Role }) {
  const variant = role === 'SUPER_ADMIN' ? 'info' : role === 'PRINCIPAL' ? 'info' : 'neutral';
  return <Badge variant={variant}>{role.replace('_', ' ')}</Badge>;
}

function ProviderCard({ p }: { p: ProviderInfo }) {
  return (
    <Card className={p.active ? 'ring-2 ring-brand-500' : undefined}>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.label}</p>
          <div className="flex shrink-0 gap-1">
            {p.configured ? <Badge variant="present">Configured</Badge> : <Badge variant="neutral">Not set</Badge>}
            {p.active && <Badge variant="info">Active</Badge>}
          </div>
        </div>
        <p className="tnum mt-1 text-xs text-slate-500 dark:text-slate-400">Model: {p.model}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{p.hint}</p>
      </CardContent>
    </Card>
  );
}

function AdminInner({ initialUsers, providers, activity, selfId }: AdminClientProps) {
  const confirm = useConfirm();
  const [users, setUsers] = useState(initialUsers);
  const [toggling, setToggling] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreOutput, setRestoreOutput] = useState<string | null>(null);

  async function toggleUser(u: AdminUser) {
    if (u.id === selfId) {
      setNotice({ kind: 'err', text: 'You cannot deactivate your own account.' });
      return;
    }
    setToggling(u.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toggle failed');
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, isActive: data.user.isActive } : x)));
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Toggle failed' });
    } finally {
      setToggling(null);
    }
  }

  async function restoreDemo() {
    const ok = await confirm({
      title: 'Restore demo state?',
      message:
        'This wipes ALL current data — students, attendance, fees, everything — and reseeds the clean demo school. This cannot be undone.',
      confirmLabel: 'Wipe & reseed',
    });
    if (!ok) return;
    setRestoring(true);
    setRestoreOutput(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/restore', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Restore failed');
      setNotice({ kind: 'ok', text: 'Demo state restored. Reload the page to see fresh data.' });
      setRestoreOutput(data.output ?? '');
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Restore failed' });
      setRestoreOutput(null);
    } finally {
      setRestoring(false);
    }
  }

  const maxDay = Math.max(1, ...activity.perDay.map((d) => d.count));

  return (
    <div>
      <PageHeader title="Admin" subtitle="Users, AI providers, assistant activity and demo data controls." />

      {notice && (
        <div
          role="alert"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            notice.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Users */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="users" size={18} /> Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </TRow>
            </THead>
            <TBody>
              {users.map((u) => (
                <TRow key={u.id}>
                  <TD className="font-medium">
                    {u.name}
                    {u.id === selfId && (
                      <Badge variant="info" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TD>
                  <TD>{u.email}</TD>
                  <TD>
                    <RoleBadge role={u.role} />
                  </TD>
                  <TD>
                    <Badge variant={u.isActive ? 'present' : 'neutral'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TD>
                  <TD>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.isActive}
                      aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.name}`}
                      disabled={toggling === u.id || u.id === selfId}
                      onClick={() => toggleUser(u)}
                      title={u.id === selfId ? 'You cannot deactivate your own account' : undefined}
                      className={`relative inline-flex h-[32px] w-[58px] min-h-[44px] shrink-0 cursor-pointer items-center rounded-full px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        u.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                          u.isActive ? 'translate-x-[26px]' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI providers */}
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">AI providers</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {providers.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>

      {/* AI activity */}
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
        Assistant activity (last 7 days)
      </h2>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Queries" value={String(activity.total)} icon="sparkles" tone="info" />
        <Stat label="Avg latency" value={`${activity.avgLatencyMs} ms`} icon="clock" tone="neutral" />
        <Stat label="Active users" value={String(activity.distinctUsers)} icon="users" tone="neutral" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Queries per day</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.total === 0 ? (
              <EmptyState icon="sparkles" title="No queries yet" guidance="Assistant usage will appear here once people start chatting." />
            ) : (
              <div className="space-y-2">
                {activity.perDay.map((d) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="tnum w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {pktDate(d.day)}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.round((d.count / maxDay) * 100)}%` }}
                      />
                    </div>
                    <span className="tnum w-8 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top intents</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.topIntents.length === 0 ? (
              <EmptyState icon="info" title="No intents yet" guidance="Intent usage will appear here once people start chatting." />
            ) : (
              <Table>
                <THead>
                  <TRow>
                    <TH>Intent</TH>
                    <TH>Queries</TH>
                  </TRow>
                </THead>
                <TBody>
                  {activity.topIntents.map((t) => (
                    <TRow key={t.intent}>
                      <TD>
                        <Badge variant="info">{t.intent}</Badge>
                      </TD>
                      <TD className="tnum font-semibold">{t.count}</TD>
                    </TRow>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="border-rose-300 dark:border-rose-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <Icon name="alert-triangle" size={18} /> Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <strong>Restore demo state</strong> wipes all data and reseeds the clean demo school
            (same as <span className="tnum">npx prisma db seed</span>). Use only on the demo
            environment.
          </p>
          <div className="mt-4">
            <Button variant="danger" loading={restoring} onClick={restoreDemo}>
              <Icon name="refresh-cw" size={18} /> Restore demo state
            </Button>
          </div>
          {restoreOutput && (
            <pre className="tnum nice-scroll mt-4 max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">
              {restoreOutput}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminClient(props: AdminClientProps) {
  return (
    <ConfirmProvider>
      <AdminInner {...props} />
    </ConfirmProvider>
  );
}
