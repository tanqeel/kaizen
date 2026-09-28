'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, Dialog, EmptyState, Input,
  PageHeader, Select, Tabs, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDateTime } from '@/lib/format';

interface LiveClassItem {
  id: string;
  title: string;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
  subject: { id: string; name: string; code: string } | null;
  section: { id: string; name: string; grade: string };
  teacher: string;
  teacherId: string;
  mine: boolean;
}

interface Option { id: string; label: string; }

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

const emptyForm = {
  title: '',
  sectionId: '',
  subjectId: '',
  teacherId: '',
  meetingUrl: '',
  startsAt: '',
  endsAt: '',
};

/** Countdown / status text for a class, computed from Date.now() at render. */
function statusOf(startsAt: string, endsAt: string): { text: string; live: boolean; ended: boolean } {
  const now = Date.now();
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (now >= s && now < e) return { text: 'Live now', live: true, ended: false };
  if (now >= e) return { text: 'Ended', live: false, ended: true };
  const mins = Math.round((s - now) / 60000);
  if (mins < 60) return { text: `Starts in ${mins} min`, live: false, ended: false };
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return { text: `Starts in ${hrs}h ${mins % 60}m`, live: false, ended: false };
  return { text: `Starts in ${Math.floor(hrs / 24)}d ${hrs % 24}h`, live: false, ended: false };
}

export function LiveClassesClient({
  sections, subjects, teachers, myTeacherId, canManage, isAdmin,
}: {
  sections: Option[];
  subjects: Option[];
  /** Host-teacher options for principals/admins; empty for teachers. */
  teachers: Option[];
  /** Admin's own teacher profile id (null when none). */
  myTeacherId: string | null;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const confirm = useConfirm();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [sectionId, setSectionId] = useState('');
  const [classes, setClasses] = useState<LiveClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const showSectionFilter = canManage && sections.length > 1;
  // Principals/admins without a linked teacher profile must pick a host.
  const teacherRequired = canManage && teachers.length > 0 && !myTeacherId;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set('scope', scope);
    if (canManage && sectionId) p.set('sectionId', sectionId);
    const r = await api(`/api/live-classes?${p.toString()}`, 'GET');
    setLoading(false);
    if (r.ok) setClasses((r.data.liveClasses ?? []) as LiveClassItem[]);
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not load live classes') });
  }, [scope, sectionId, canManage]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    if (!(await confirm({
      title: 'Cancel this live class?',
      message: 'This removes the class for everyone. This cannot be undone.',
      confirmLabel: 'Delete',
    }))) return;
    const r = await api(`/api/live-classes/${id}`, 'DELETE');
    if (r.ok) void load();
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not delete') });
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const urlInvalid = form.meetingUrl.trim() !== '' && !/^https?:\/\//.test(form.meetingUrl.trim());
  const startOk = form.startsAt !== '' && !isNaN(new Date(form.startsAt).getTime());
  const endOk = form.endsAt !== '' && !isNaN(new Date(form.endsAt).getTime());
  const rangeOk = startOk && endOk && new Date(form.endsAt).getTime() > new Date(form.startsAt).getTime();
  const canSave =
    form.title.trim() !== '' &&
    form.sectionId !== '' &&
    !urlInvalid && form.meetingUrl.trim() !== '' &&
    startOk && endOk && rangeOk &&
    (!teacherRequired || form.teacherId !== '') &&
    !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    const r = await api('/api/live-classes', 'POST', {
      title: form.title.trim(),
      sectionId: form.sectionId,
      subjectId: form.subjectId || null,
      teacherId: form.teacherId || undefined,
      meetingUrl: form.meetingUrl.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
    });
    setSaving(false);
    if (r.ok) {
      setDialogOpen(false);
      setForm(emptyForm);
      setScope('upcoming');
      void load();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not schedule class') });
    }
  };

  const joinButton = (lc: LiveClassItem) => (
    <a
      href={lc.meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 dark:hover:bg-emerald-500"
    >
      <Icon name="wifi" size={16} /> Join class
    </a>
  );

  const card = (lc: LiveClassItem) => {
    const st = statusOf(lc.startsAt, lc.endsAt);
    return (
      <Card key={lc.id}>
        <CardContent>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {st.live ? (
                <Badge variant="present">
                  <Icon name="wifi" size={14} /> Live now
                </Badge>
              ) : st.ended ? (
                <Badge variant="neutral">Ended</Badge>
              ) : (
                <Badge variant="info">
                  <Icon name="clock" size={14} /> {st.text}
                </Badge>
              )}
              {lc.subject && <Badge variant="info">{lc.subject.name}</Badge>}
            </div>
            {(lc.mine || isAdmin) && (
              <Button variant="ghost" size="sm" onClick={() => remove(lc.id)} aria-label={`Delete ${lc.title}`}>
                <Icon name="x" size={16} />
              </Button>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{lc.title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lc.section.grade} · Section {lc.section.name} · by {lc.teacher}
          </p>
          <p className="tnum mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {pktDateTime(lc.startsAt)} – {pktDateTime(lc.endsAt)}
          </p>
          {!st.ended && (
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              {joinButton(lc)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Live Classes"
        subtitle="Scheduled online classes. Join from here when a class goes live."
        actions={canManage ? (
          <Button onClick={() => { setMsg(null); setForm({ ...emptyForm, teacherId: myTeacherId ?? '' }); setDialogOpen(true); }}>
            <Icon name="plus" size={16} /> Schedule class
          </Button>
        ) : undefined}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: 'upcoming', label: 'Upcoming', icon: 'calendar-days' },
            { id: 'past', label: 'Past', icon: 'clock' },
          ]}
          value={scope}
          onChange={(id) => setScope(id as 'upcoming' | 'past')}
          ariaLabel="Live class scope"
        />
        {showSectionFilter && (
          <div className="min-w-[200px]">
            <Select
              aria-label="Filter by section"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              options={[{ value: '', label: 'All sections' }, ...sections.map((s) => ({ value: s.id, label: s.label }))]}
            />
          </div>
        )}
      </div>

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading live classes…</p></CardContent></Card>
      ) : classes.length === 0 ? (
        <EmptyState
          icon="wifi"
          title={scope === 'upcoming' ? 'No upcoming live classes' : 'No live classes in the last 14 days'}
          guidance={canManage
            ? 'Schedule the first online class for your sections using the button above.'
            : 'No online classes are scheduled right now. Teachers post them here when they plan one.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map(card)}
        </div>
      )}

      {canManage && (
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Schedule a live class"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={!canSave}>
                <Icon name="check" size={16} /> {saving ? 'Scheduling…' : 'Schedule'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Title"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Grade 8 · Physics — Chapter 5 revision"
              maxLength={200}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Section"
                value={form.sectionId}
                onChange={set('sectionId')}
                options={sections.map((s) => ({ value: s.id, label: s.label }))}
                placeholder={sections.length === 0 ? 'No sections assigned to you' : 'Select section'}
                required
                disabled={sections.length === 0}
              />
              <Select
                label="Subject (optional)"
                value={form.subjectId}
                onChange={set('subjectId')}
                options={[{ value: '', label: 'General' }, ...subjects.map((s) => ({ value: s.id, label: s.label }))]}
              />
            </div>
            {teachers.length > 0 && (
              <Select
                label="Host teacher"
                value={form.teacherId}
                onChange={set('teacherId')}
                options={teachers.map((t) => ({ value: t.id, label: t.label }))}
                placeholder={myTeacherId ? 'You (default)' : 'Select host teacher'}
                required={teacherRequired}
                hint={myTeacherId ? 'Defaults to you; pick someone else to schedule on their behalf.' : undefined}
              />
            )}
            <Input
              label="Meeting link"
              value={form.meetingUrl}
              onChange={set('meetingUrl')}
              placeholder="https://meet.google.com/… or Zoom link"
              inputMode="url"
              required
              error={urlInvalid ? 'Must start with http:// or https://' : undefined}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Starts at"
                type="datetime-local"
                value={form.startsAt}
                onChange={set('startsAt')}
                required
              />
              <Input
                label="Ends at"
                type="datetime-local"
                value={form.endsAt}
                onChange={set('endsAt')}
                required
                error={startOk && endOk && !rangeOk ? 'End must be after start' : undefined}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
