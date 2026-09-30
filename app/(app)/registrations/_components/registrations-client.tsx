'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from '@/components/ui';
import { safeJson } from '@/lib/api-client';

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
  const [deciding, setDeciding] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/registrations');
      const data = await safeJson(res);
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
    if (decision === 'APPROVED' && !confirm('Approve this registration? The user will receive a KAIZEN ID and a one-time activation link to set their own password.')) return;
    setDeciding(id);
    setError('');
    try {
      const res = await fetch(`/api/registrations/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Decision failed.');
      if (data.activationPath) {
        const link = `${window.location.origin}${data.activationPath}`;
        try { await navigator.clipboard.writeText(link); } catch { /* clipboard unavailable */ }
        alert(`Approved!\nKAIZEN ID: ${data.kaizenId}\n\nActivation link (copied to clipboard):\n${link}\n\nShare it with the user — they set their own private password. Valid 48 hours, single use.`);
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
                  {r.email && <div><dt className="text-xs text-slate-500">Email</dt><dd className="font-medium break-all">{r.email}</dd></div>}
                  {r.admissionNo && <div><dt className="text-xs text-slate-500">Admission No</dt><dd className="font-medium">{r.admissionNo}</dd></div>}
                  {r.guardianName && <div><dt className="text-xs text-slate-500">Guardian</dt><dd className="font-medium">{r.guardianName}{r.guardianPhone ? ` · ${r.guardianPhone}` : ''}</dd></div>}
                  {r.notes && <div className="col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd>{r.notes}</dd></div>}
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={deciding === r.id} onClick={() => decide(r.id, 'APPROVED')}>
                    Approve & issue activation link
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
