'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState,
  FormGrid, Input, PageHeader, Select, Skeleton, Table, TBody, TD, TH, THead, TRow,
  Tabs, Textarea, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pkr, pktDate, pktDateTime, todayPKT } from '@/lib/format';
import { TEMPLATE_VARIABLES, renderTemplate } from '@/lib/comms-shared';

interface GradeOption { id: string; name: string; level: number }

interface Announcement {
  id: string; title: string; body: string;
  priority: 'NORMAL' | 'URGENT';
  audience: 'ALL' | 'PARENTS' | 'STAFF' | 'TEACHERS' | 'GRADES';
  gradeId: string | null;
  createdBy: string; createdAt: string;
}

interface NotificationRow {
  id: string; type: string; channel: string; status: string;
  message: string; sentAt: string; user: string | null; student: string | null;
}

interface Template { id: string; name: string; body: string }

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'Everyone (all users)' },
  { value: 'PARENTS', label: 'Parents' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'TEACHERS', label: 'Teachers' },
  { value: 'GRADES', label: 'Parents of a grade…' },
];

const AUDIENCE_SHORT: Record<string, string> = {
  ALL: 'Everyone', PARENTS: 'Parents', STAFF: 'Staff', TEACHERS: 'Teachers', GRADES: 'Grade parents',
};

export function CommsClient({ grades }: { grades: GradeOption[] }) {
  const [tab, setTab] = useState('announcements');
  return (
    <div>
      <PageHeader title="Notices & SMS" subtitle="Announcements, the notification log, and SMS templates." />
      <Tabs
        tabs={[
          { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
          { id: 'log', label: 'Notification log', icon: 'bell' },
          { id: 'templates', label: 'SMS templates', icon: 'info' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-6"
      />
      {tab === 'announcements' && <AnnouncementsTab grades={grades} />}
      {tab === 'log' && <LogTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}

/* ------------------------------ Announcements ----------------------------- */

function AnnouncementsTab({ grades }: { grades: GradeOption[] }) {
  const confirm = useConfirm();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [audience, setAudience] = useState('PARENTS');
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [audienceInfo, setAudienceInfo] = useState<{ count: number; label: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/comms/announcements', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setItems(data.announcements);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPreview = async () => {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError('Title and message are both required.');
      return;
    }
    if (audience === 'GRADES' && !gradeId) {
      setError('Pick a grade for the grade-parents audience.');
      return;
    }
    setAudienceInfo(null);
    setPreviewOpen(true);
    try {
      const p = new URLSearchParams({ audience });
      if (audience === 'GRADES') p.set('gradeId', gradeId);
      const res = await fetch(`/api/comms/audience?${p}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setAudienceInfo({ count: data.count, label: data.label });
    } catch {
      /* count is a nicety; sending still works */
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/comms/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), body: body.trim(), priority, audience,
          ...(audience === 'GRADES' ? { gradeId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setPreviewOpen(false);
      setTitle('');
      setBody('');
      setPriority('NORMAL');
      setNotice(`Announcement sent — ${data.notified} recipient${data.notified === 1 ? '' : 's'} notified in-app.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string, t: string) => {
    if (!(await confirm({ title: 'Delete announcement?', message: `“${t}” will be removed from the notice board.`, confirmLabel: 'Delete' }))) return;
    await fetch(`/api/comms/announcements/${id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setPriority(a.priority as 'NORMAL' | 'URGENT');
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setPriority('NORMAL');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!title.trim() || !body.trim()) {
      setError('Title and message are both required.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/comms/announcements/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), priority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      cancelEdit();
      setNotice('Announcement updated.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSending(false);
    }
  };

  const gradeName = grades.find((g) => g.id === gradeId)?.name ?? '';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader><CardTitle>{editingId ? 'Edit announcement' : 'Compose announcement'}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input label="Title" placeholder="e.g. Parent-Teacher Meeting on Friday" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea label="Message" placeholder="Write the notice…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} required />
          <FormGrid>
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'URGENT')}
              options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'URGENT', label: 'Urgent' }]}
            />
            {!editingId && (
              <Select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)} options={AUDIENCE_OPTIONS} />
            )}
          </FormGrid>
          {!editingId && audience === 'GRADES' && (
            <Select label="Grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)} options={grades.map((g) => ({ value: g.id, label: g.name }))} />
          )}
          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}
          <div className="flex gap-2">
            {editingId ? (
              <>
                <Button onClick={saveEdit} disabled={sending}>
                  <Icon name="check" size={18} /> {sending ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={openPreview}>
                <Icon name="eye" size={18} /> Preview & send
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="xl:col-span-3">
        {loading ? (
          <Skeleton className="h-64" />
        ) : items.length === 0 ? (
          <EmptyState icon="megaphone" title="No announcements yet" guidance="Compose the first notice — it will appear on everyone's board and in the notification log." />
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((a) => (
              <Card key={a.id} className={a.priority === 'URGENT' ? 'border-l-4 border-l-red-500' : ''}>
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                        {a.priority === 'URGENT' && <Badge variant="overdue">Urgent</Badge>}
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{a.body}</p>
                      <p className="tnum mt-2 text-xs text-slate-500 dark:text-slate-400">
                        To {AUDIENCE_SHORT[a.audience] ?? a.audience} · by {a.createdBy} · {pktDateTime(a.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(a)} aria-label={`Edit announcement “${a.title}”`}>
                        <Icon name="book-open" size={18} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(a.id, a.title)} aria-label={`Delete announcement “${a.title}”`}>
                        <Icon name="x" size={18} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview-before-send: renders exactly how the notice will look. */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>Back to editing</Button>
            <Button onClick={send} loading={sending}>
              <Icon name="megaphone" size={18} /> Send announcement
            </Button>
          </>
        }
      >
        <Card className={priority === 'URGENT' ? 'border-l-4 border-l-red-500' : ''}>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title || 'Untitled'}</h3>
              {priority === 'URGENT' && <Badge variant="overdue">Urgent</Badge>}
            </div>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{body || '…'}</p>
          </CardContent>
        </Card>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Audience: </span>
          {audience === 'GRADES' ? `parents of ${gradeName}` : AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label}
          {audienceInfo && (
            <span className="tnum"> — this will notify <b>{audienceInfo.count}</b> {audienceInfo.label} in-app.</span>
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </Dialog>
    </div>
  );
}

/* ------------------------------ Notification log -------------------------- */

function LogTab() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (type) p.set('type', type);
      if (channel) p.set('channel', channel);
      if (status) p.set('status', status);
      const res = await fetch(`/api/comms/notifications?${p}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setRows(data.notifications);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [type, channel, status]);

  useEffect(() => { load(); }, [load]);

  const typeBadge = (t: string): 'info' | 'present' | 'pending' | 'overdue' | 'neutral' =>
    t === 'ARRIVAL' ? 'present' : t === 'DEPARTURE' ? 'info' : t === 'LECTURE_ABSENCE' ? 'overdue' : t === 'FEE_REMINDER' ? 'pending' : 'neutral';

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}
            options={[{ value: '', label: 'All types' }, { value: 'ARRIVAL', label: 'Arrival' }, { value: 'DEPARTURE', label: 'Departure' }, { value: 'LECTURE_ABSENCE', label: 'Lecture absence' }, { value: 'FEE_REMINDER', label: 'Fee reminder' }, { value: 'ANNOUNCEMENT', label: 'Announcement' }]}
            className="w-48" />
          <Select label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)}
            options={[{ value: '', label: 'All channels' }, { value: 'SMS', label: 'SMS' }, { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'IN_APP', label: 'In-app' }]}
            className="w-44" />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
            options={[{ value: '', label: 'All' }, { value: 'SENT', label: 'Sent' }, { value: 'FAILED', label: 'Failed' }]}
            className="w-36" />
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState icon="bell" title="No notifications" guidance="Nothing in the log matches these filters yet." />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Sent at</TH>
              <TH>Type</TH>
              <TH>Channel</TH>
              <TH>Message</TH>
              <TH>To</TH>
              <TH>Status</TH>
            </TRow>
          </THead>
          <TBody>
            {rows.map((n) => (
              <TRow key={n.id}>
                <TD className="tnum whitespace-nowrap">{pktDateTime(n.sentAt)}</TD>
                <TD><Badge variant={typeBadge(n.type)}>{n.type.replace(/_/g, ' ')}</Badge></TD>
                <TD className="whitespace-nowrap">{n.channel.replace('_', ' ')}</TD>
                <TD className="max-w-72 truncate" title={n.message}>{n.message}</TD>
                <TD className="whitespace-nowrap">{n.student ?? n.user ?? '—'}</TD>
                <TD>
                  <Badge variant={n.status === 'SENT' ? 'paid' : 'overdue'}>{n.status}</Badge>
                </TD>
              </TRow>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

/* ------------------------------- SMS templates ---------------------------- */

function TemplatesTab() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/comms/templates', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setTemplates(data.templates);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (t: Template) => {
    if (!(await confirm({ title: 'Delete template?', message: `“${t.name}” will be removed.`, confirmLabel: 'Delete' }))) return;
    await fetch(`/api/comms/templates/${t.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
          <Icon name="plus" size={18} /> New template
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : templates.length === 0 ? (
        <EmptyState icon="info" title="No SMS templates" guidance="Create reusable message templates with {{variable}} placeholders." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{t.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPreviewTpl(t)}>
                    <Icon name="eye" size={16} /> Preview with student
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setEditing(t); setEditorOpen(true); }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t)}>
                    <Icon name="x" size={16} /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />
      {previewTpl && (
        <TemplatePreview template={previewTpl} onClose={() => setPreviewTpl(null)} />
      )}
    </div>
  );
}

function TemplateEditor({
  open, initial, onClose, onSaved,
}: {
  open: boolean; initial: Template | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setBody(initial?.body ?? '');
      setError(null);
    }
  }, [open, initial]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = initial ? `/api/comms/templates/${initial.id}` : '/api/comms/templates';
      const res = await fetch(url, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), body: body.trim() }),
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
      title={initial ? 'Edit template' : 'New SMS template'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!name.trim() || !body.trim()}>
            <Icon name="check" size={18} /> Save template
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" placeholder="e.g. Fee Reminder" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea label="Body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required
          hint="Use {{student_name}}, {{amount}}, {{date}} — they resolve per student at send time." />
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Available variables</p>
          <ul className="list-disc pl-5">
            {TEMPLATE_VARIABLES.map((v) => (
              <li key={v.key}><code className="tnum">{`{{${v.key}}}`}</code> — {v.description}</li>
            ))}
          </ul>
        </div>
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </Dialog>
  );
}

/** Renders a template with {{variables}} resolved against a REAL sample student. */
function TemplatePreview({ template, onClose }: { template: Template; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; admissionNo: string; grade: string; section: string }>>([]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);

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

  const pick = async (s: { id: string; name: string }) => {
    setPicked(s);
    setOutstanding(null);
    try {
      const res = await fetch(`/api/lookup/students/${s.id}/balance`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setOutstanding(data.outstanding);
    } catch {
      /* amount falls back below */
    }
  };

  const resolved = picked
    ? renderTemplate(template.body, {
        student_name: picked.name,
        amount: pkr(outstanding ?? 0),
        date: pktDate(todayPKT()),
      })
    : null;

  return (
    <Dialog open onClose={onClose} title={`Preview: ${template.name}`} size="lg">
      <div className="flex flex-col gap-4">
        <div>
          <Input label="Sample student" placeholder="Type at least 2 letters of a name…" value={q} onChange={(e) => setQ(e.target.value)} />
          {searching && <p className="mt-1 text-xs text-slate-500">Searching…</p>}
          {results.length > 0 && !picked && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                  <span className="tnum text-xs text-slate-500">{s.admissionNo} · {s.grade} {s.section}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Template source</p>
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm whitespace-pre-line text-slate-600 dark:bg-slate-800 dark:text-slate-300">{template.body}</p>
        </div>

        {picked && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              Resolved for {picked.name}
              {outstanding !== null && <span className="tnum ml-2 text-xs font-normal text-slate-500">outstanding: {pkr(outstanding)}</span>}
            </p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-100">{resolved}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Exactly what the parent would receive — variables resolved from live school data.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
