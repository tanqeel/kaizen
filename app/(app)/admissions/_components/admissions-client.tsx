'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Table,
  THead,
  TBody,
  TRow,
  TH,
  TD,
  EmptyState,
  Dialog,
  Tabs,
  useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate } from '@/lib/format';
import { safeJson } from '@/lib/api-client';

interface Application {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
  grade: string;
  parentName: string;
  parentPhone: string;
  address: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const TABS = [
  { id: 'PENDING', label: 'Pending', icon: 'clock' as const },
  { id: 'APPROVED', label: 'Approved', icon: 'check' as const },
  { id: 'REJECTED', label: 'Rejected', icon: 'x' as const },
];

function statusBadge(status: Application['status']) {
  if (status === 'APPROVED') return <Badge variant="paid">Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="absent">Rejected</Badge>;
  return <Badge variant="pending">Pending</Badge>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
      <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}

export function AdmissionsClient({ canDecide }: { canDecide: boolean }) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<string>('PENDING');
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Application | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admissions?status=${status}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load applications.');
      const data = await safeJson(res);
      setApps(data.applications ?? []);
    } catch {
      setError('Could not load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setNotice('');
    load(tab);
  }, [tab, load]);

  async function decide(app: Application, action: 'approve' | 'reject') {
    const ok = await confirm({
      title: action === 'approve' ? 'Approve application' : 'Reject application',
      message:
        action === 'approve'
          ? `Enrol ${app.name} as a student of ${app.grade}? A parent record will be linked by the phone number.`
          : `Reject the application from ${app.name}?`,
      confirmLabel: action === 'approve' ? 'Approve' : 'Reject',
    });
    if (!ok) return;

    setBusyId(app.id);
    setNotice('');
    try {
      const res = await fetch(`/api/admissions/${app.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Decision failed.');
      if (data.admissionNo) {
        setNotice(`Enrolled as admission no. ${data.admissionNo}`);
      } else {
        setNotice('Application rejected.');
      }
      setDetail(null);
      await load(tab);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Decision failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Application status" />

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading applications…
          </CardContent>
        </Card>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={tab === 'PENDING' ? 'clock' : tab === 'APPROVED' ? 'check' : 'x'}
          title={
            tab === 'PENDING'
              ? 'No pending applications'
              : tab === 'APPROVED'
                ? 'No approved applications'
                : 'No rejected applications'
          }
          guidance={
            tab === 'PENDING'
              ? 'New applications from the public form will appear here.'
              : 'Decided applications will appear here.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TRow>
                  <TH>Applicant</TH>
                  <TH>Grade</TH>
                  <TH>Parent</TH>
                  <TH>Applied</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </TRow>
              </THead>
              <TBody>
                {apps.map((app) => (
                  <TRow key={app.id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => setDetail(app)}
                        className="min-h-[44px] text-left font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
                      >
                        {app.name}
                      </button>
                    </TD>
                    <TD>{app.grade}</TD>
                    <TD>
                      <span className="block">{app.parentName}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {app.parentPhone}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap">{pktDate(app.createdAt)}</TD>
                    <TD>{statusBadge(app.status)}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View details of ${app.name}`}
                          onClick={() => setDetail(app)}
                        >
                          <Icon name="eye" size={20} />
                        </Button>
                        {canDecide && app.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Approve ${app.name}`}
                              className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                              loading={busyId === app.id}
                              onClick={() => decide(app, 'approve')}
                            >
                              <Icon name="check" size={20} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Reject ${app.name}`}
                              className="text-rose-700 hover:text-rose-800 dark:text-rose-400"
                              loading={busyId === app.id}
                              onClick={() => decide(app, 'reject')}
                            >
                              <Icon name="x" size={20} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Application details"
        footer={
          detail && canDecide && detail.status === 'PENDING' ? (
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button variant="danger" onClick={() => detail && decide(detail, 'reject')}>
                Reject
              </Button>
              <Button onClick={() => detail && decide(detail, 'approve')}>
                Approve
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
          )
        }
      >
        {detail && (
          <dl>
            <DetailRow label="Applicant" value={detail.name} />
            <DetailRow label="Date of birth" value={detail.dob ? pktDate(detail.dob) : '—'} />
            <DetailRow label="Gender" value={detail.gender ?? '—'} />
            <DetailRow label="Grade" value={detail.grade} />
            <DetailRow label="Parent name" value={detail.parentName} />
            <DetailRow label="Parent phone" value={detail.parentPhone} />
            <DetailRow label="Address" value={detail.address ?? '—'} />
            <DetailRow label="Applied" value={pktDate(detail.createdAt)} />
            <DetailRow label="Status" value={statusBadge(detail.status)} />
            {detail.status !== 'PENDING' && (
              <>
                <DetailRow label="Decided by" value={detail.decidedBy ?? '—'} />
                <DetailRow
                  label="Decided on"
                  value={detail.decidedAt ? pktDate(detail.decidedAt) : '—'}
                />
              </>
            )}
          </dl>
        )}
      </Dialog>
    </div>
  );
}
