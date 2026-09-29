'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from '@/components/ui';

interface RegRequest {
  id: string;
  fullName: string;
  accountType: string;
  phone: string;
  email: string | null;
  admissionNo: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export function RegistrationsClient() {
  const [requests, setRequests] = useState<RegRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/registrations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load.');
      setRequests(data.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED') => {
    setDeciding(id);
    setError('');
    try {
      const tempPassword = tempPasswords[id] ?? '';
      const res = await fetch(`/api/registrations/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, tempPassword: decision === 'APPROVED' ? tempPassword : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Decision failed.');
      if (data.tempPassword) {
        alert(`Approved!\nKAIZEN ID: ${data.kaizenId}\nTemporary password: ${data.tempPassword}\n\nShare these securely with the user. They must change the password on first login.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed.');
    } finally {
      setDeciding('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'CORRECTION_REQUIRED');

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {pending.length === 0 ? (
        <EmptyState icon="info" title="No pending requests" guidance="New self-registration requests will appear here for review." />
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{r.fullName}</CardTitle>
                  <Badge variant={r.status === 'PENDING' ? 'pending' : 'info'}>{r.status.replace('_', ' ')}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs text-slate-500">Account type</dt><dd className="font-medium">{r.accountType}</dd></div>
                  <div><dt className="text-xs text-slate-500">Phone</dt><dd className="font-medium">{r.phone}</dd></div>
                  {r.email && <div><dt className="text-xs text-slate-500">Email</dt><dd className="font-medium">{r.email}</dd></div>}
                  {r.admissionNo && <div><dt className="text-xs text-slate-500">Admission No</dt><dd className="font-medium">{r.admissionNo}</dd></div>}
                  {r.guardianName && <div><dt className="text-xs text-slate-500">Guardian</dt><dd className="font-medium">{r.guardianName}{r.guardianPhone ? ` · ${r.guardianPhone}` : ''}</dd></div>}
                  {r.notes && <div className="col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd>{r.notes}</dd></div>}
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Temp password (min 8 chars) — for approval"
                    value={tempPasswords[r.id] ?? ''}
                    onChange={(e) => setTempPasswords((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="max-w-xs"
                  />
                  <Button size="sm" disabled={deciding === r.id} onClick={() => decide(r.id, 'APPROVED')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" disabled={deciding === r.id} onClick={() => decide(r.id, 'CORRECTION_REQUIRED')}>
                    Request Correction
                  </Button>
                  <Button size="sm" variant="ghost" disabled={deciding === r.id} onClick={() => decide(r.id, 'REJECTED')}>
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
