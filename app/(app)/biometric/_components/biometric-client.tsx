'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState,
  FormGrid, Input, PageHeader, Select, Skeleton, Table, TBody, TD, TH, THead, TRow,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDateTime } from '@/lib/format';

interface Terminal {
  id: string; name: string; ipAddress: string; port: number;
  status: 'ONLINE' | 'OFFLINE'; lastHeartbeat: string | null;
}

interface StudentPick { id: string; name: string; admissionNo: string; grade: string; section: string }

const SCAN_METHODS = [
  { value: 'FINGERPRINT', label: 'Fingerprint', icon: 'fingerprint' },
  { value: 'FACE', label: 'Face', icon: 'eye' },
  { value: 'RFID', label: 'RFID', icon: 'id-card' },
] as const;

export function BiometricClient({ canManage }: { canManage: boolean }) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Terminal | null>(null);
  const [heartbeatBusy, setHeartbeatBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/biometric/terminals', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setTerminals(data.terminals);
    } catch {
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const heartbeat = async (id: string) => {
    setHeartbeatBusy(id);
    try {
      const res = await fetch(`/api/biometric/terminals/${id}/heartbeat`, { method: 'POST' });
      if (res.ok) load();
    } finally {
      setHeartbeatBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Biometric Attendance"
        subtitle="Terminal configuration and the gate check-in simulator."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={18} /> Add terminal
            </Button>
          ) : undefined
        }
      />

      {/* ── Terminals ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Terminals</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40" />
          ) : terminals.length === 0 ? (
            <EmptyState icon="fingerprint" title="No terminals configured" guidance={canManage ? 'Add the first terminal to start simulating gate check-ins.' : 'No terminals have been configured yet.'} />
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>Name</TH>
                  <TH>Address</TH>
                  <TH>Status</TH>
                  <TH>Last heartbeat</TH>
                  <TH><span className="sr-only">Actions</span></TH>
                </TRow>
              </THead>
              <TBody>
                {terminals.map((t) => (
                  <TRow key={t.id}>
                    <TD className="font-medium text-slate-900 dark:text-white">{t.name}</TD>
                    <TD className="tnum whitespace-nowrap">{t.ipAddress}:{t.port}</TD>
                    <TD>
                      <Badge variant={t.status === 'ONLINE' ? 'present' : 'neutral'}>
                        <Icon name={t.status === 'ONLINE' ? 'wifi' : 'wifi-off'} size={14} />
                        {t.status === 'ONLINE' ? 'Online' : 'Offline'}
                      </Badge>
                    </TD>
                    <TD className="tnum whitespace-nowrap">{t.lastHeartbeat ? pktDateTime(t.lastHeartbeat) : 'Never'}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" loading={heartbeatBusy === t.id} onClick={() => heartbeat(t.id)}>
                          <Icon name="refresh-cw" size={16} /> Send heartbeat
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                            <Icon name="settings" size={16} /> Configure
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            Simulation mode — for ZKTeco hardware integration, configure the terminal IP above. Heartbeats mark a terminal online.
          </p>
        </CardContent>
      </Card>

      {/* ── Simulator ─────────────────────────────────────────── */}
      <SimulatorPanel terminals={terminals} onScanned={load} />

      {canManage && (
        <TerminalDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={load}
          initial={null}
        />
      )}
      {canManage && editing && (
        <TerminalDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          onSaved={load}
          initial={editing}
        />
      )}
    </div>
  );
}

/* ------------------------------ Terminal dialog --------------------------- */

function TerminalDialog({
  open, onClose, onSaved, initial,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; initial: Terminal | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ipAddress, setIpAddress] = useState(initial?.ipAddress ?? '');
  const [port, setPort] = useState(String(initial?.port ?? 4370));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setIpAddress(initial?.ipAddress ?? '');
      setPort(String(initial?.port ?? 4370));
      setError(null);
    }
  }, [open, initial]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = initial ? `/api/biometric/terminals/${initial.id}` : '/api/biometric/terminals';
      const res = await fetch(url, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), ipAddress: ipAddress.trim(), port: parseInt(port, 10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? `Configure ${initial.name}` : 'Add terminal'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!name.trim() || !ipAddress.trim()}>
            <Icon name="check" size={18} /> Save terminal
          </Button>
        </>
      }
    >
      <FormGrid>
        <Input label="Name" placeholder="e.g. Main Gate" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="IP address" placeholder="e.g. 192.168.1.201" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required className="tnum" />
        <Input label="Port" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} hint="ZKTeco default is 4370." />
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </FormGrid>
    </Dialog>
  );
}

/* ------------------------------ Simulator panel --------------------------- */

function SimulatorPanel({ terminals, onScanned }: { terminals: Terminal[]; onScanned: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<StudentPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentPick | null>(null);
  const [terminalId, setTerminalId] = useState('');
  const [scanning, setScanning] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ name: string; at: string; via: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (terminals.length > 0 && !terminalId) setTerminalId(terminals[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lookup/students?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const data = await res.json();
        setResults(res.ok ? data.students : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const scan = async (method: string) => {
    if (!student) return;
    setScanning(method);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch('/api/biometric/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, method, ...(terminalId ? { terminalId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan failed');
      setSuccess({ name: data.student.name, at: data.checkInTimeLabel, via: data.methodLabel });
      onScanned();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(null);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Gate check-in simulator</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <Input
              label="Student"
              placeholder="Type at least 2 letters of a name…"
              value={student ? `${student.name} (${student.admissionNo})` : q}
              onChange={(e) => { setQ(e.target.value); setStudent(null); setSuccess(null); }}
              hint={student ? `${student.grade} · Section ${student.section}` : undefined}
            />
            {!student && results.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {results.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStudent(s); setResults([]); }}
                    className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                    <span className="tnum text-xs text-slate-500">{s.admissionNo} · {s.grade} {s.section}</span>
                  </button>
                ))}
              </div>
            )}
            {!student && searching && <p className="mt-1 text-xs text-slate-500">Searching…</p>}
          </div>
          <Select
            label="Terminal"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            options={terminals.map((t) => ({ value: t.id, label: `${t.name} (${t.ipAddress}:${t.port})` }))}
            placeholder={terminals.length === 0 ? 'No terminals configured' : undefined}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Scan method</p>
          <div className="grid grid-cols-3 gap-3">
            {SCAN_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                disabled={!student || scanning !== null}
                onClick={() => scan(m.value)}
                className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
              >
                {scanning === m.value ? (
                  <Icon name="refresh-cw" size={32} className="animate-spin" />
                ) : (
                  <Icon name={m.icon as 'fingerprint'} size={32} />
                )}
                <span className="text-sm font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {success && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Icon name="check" size={20} />
            </span>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              {success.name} checked in at <span className="tnum font-bold">{success.at}</span> via {success.via}.
            </p>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <Icon name="alert-triangle" size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-900 dark:text-amber-200">{error}</p>
          </div>
        )}

        <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          Each scan writes a real gate check-in row and notifies the parent in-app. A student can only check in once per day — repeat scans are rejected honestly.
        </p>
      </CardContent>
    </Card>
  );
}
