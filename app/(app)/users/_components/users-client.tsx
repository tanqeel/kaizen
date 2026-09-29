'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from '@/components/ui';

interface UserRow {
  id: string;
  kaizenId: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  forcePasswordReset: boolean;
  phone: string | null;
}

const STATUSES = ['ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED', 'GRADUATED', 'TRANSFERRED'];

export function UsersClient({ canManage }: { canManage: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load.');
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    if (!confirm(`Change account status to ${status}?`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed.');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy('');
    }
  };

  const resetPassword = async (id: string, name: string) => {
    if (!confirm(`Issue a password reset link for ${name}? They will set their own private password — you will never see it.`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed.');
      const link = `${window.location.origin}${data.activationPath}`;
      // Copy to clipboard for easy sharing.
      try { await navigator.clipboard.writeText(link); } catch { /* clipboard unavailable */ }
      alert(`Reset link issued for ${name}.\n\n${link}\n\nLink copied to clipboard. Share it with the user — they set their own password. Valid 48 hours, single use.`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy('');
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search name, email, KAIZEN ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All roles</option>
          {['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'].map((r) => (
            <option key={r} value={r}>{r.replace('_', ' ')}</option>
          ))}
        </select>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {users.length === 0 ? (
        <EmptyState icon="users" title="No users found" guidance="Try a different search." />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-slate-500">
                      {u.kaizenId ?? 'No KAIZEN ID yet'} · {u.email}
                      {u.phone ? ` · ${u.phone}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="info">{u.role.replace('_', ' ')}</Badge>
                      <Badge variant={u.status === 'ACTIVE' ? 'present' : 'absent'}>{u.status}</Badge>
                      {u.forcePasswordReset && <Badge variant="pending">Must reset password</Badge>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={u.status}
                        onChange={(e) => setStatus(u.id, e.target.value)}
                        disabled={busy === u.id}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                        aria-label={`Status for ${u.name}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="secondary" disabled={busy === u.id} onClick={() => resetPassword(u.id, u.name)}>
                        {busy === u.id ? 'Sending…' : 'Send reset link'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
