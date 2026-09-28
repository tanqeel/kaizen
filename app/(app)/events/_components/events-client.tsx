'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, Dialog, EmptyState, Input,
  PageHeader, Select, Textarea, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate, pktDateTime } from '@/lib/format';
import { DAY_NAMES } from '@/lib/days';
import type { AnnouncementAudience } from '@prisma/client';

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  audience: AnnouncementAudience;
  venue: string | null;
  createdBy: string;
  grade: { id: string; name: string } | null;
}

interface GradeOption { id: string; name: string; }

type Scope = 'upcoming' | 'past';

const AUDIENCE_META: Record<AnnouncementAudience, { label: string; variant: 'neutral' | 'info' | 'pending' | 'present' }> = {
  ALL: { label: 'Everyone', variant: 'neutral' },
  PARENTS: { label: 'Parents', variant: 'info' },
  STAFF: { label: 'Staff', variant: 'pending' },
  TEACHERS: { label: 'Teachers', variant: 'present' },
  GRADES: { label: 'Specific grade', variant: 'info' },
};
const AUDIENCE_OPTIONS = (Object.keys(AUDIENCE_META) as AnnouncementAudience[])
  .map((a) => ({ value: a, label: AUDIENCE_META[a].label }));

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
  date: '',
  endDate: '',
  audience: 'ALL' as AnnouncementAudience,
  gradeId: '',
  venue: '',
  description: '',
};

/** Default start: next hour, formatted for datetime-local (browser-local time). */
function defaultDateTimeLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Full weekday name of an event date, resolved in Asia/Karachi. */
function pktWeekday(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso)).split('-').map(Number);
  return DAY_NAMES[new Date(parts[0], parts[1] - 1, parts[2], 12).getDay()];
}

function EventCard({
  event: e, canManage, onDelete,
}: {
  event: SchoolEvent;
  canManage: boolean;
  onDelete: () => void;
}) {
  // pktDate → "28 Sep 2026": reuse it for the badge so the badge and text agree.
  const [dayNum, mon] = pktDate(e.date).split(' ');
  const meta = AUDIENCE_META[e.audience];
  const audienceLabel = e.audience === 'GRADES' && e.grade ? e.grade.name : meta.label;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
          >
            <span className="tnum text-xl font-bold leading-none">{dayNum}</span>
            <span className="text-[11px] font-semibold uppercase leading-tight">{mon}</span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">{e.title}</h3>
            <p className="tnum mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {pktWeekday(e.date)} · {pktDateTime(e.date)}
              {e.endDate ? ` – ${pktDateTime(e.endDate)}` : ''}
            </p>
          </div>
          {canManage && (
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${e.title}`}>
              <Icon name="x" size={16} />
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={meta.variant}>{audienceLabel}</Badge>
          {e.venue && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Icon name="school" size={14} /> {e.venue}
            </span>
          )}
        </div>
        {e.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{e.description}</p>
        )}
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Added by {e.createdBy}
        </p>
      </CardContent>
    </Card>
  );
}

export function EventsClient({ grades, canManage }: { grades: GradeOption[]; canManage: boolean }) {
  const confirm = useConfirm();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`/api/events?scope=${scope}`, 'GET');
    setLoading(false);
    if (r.ok) setEvents((r.data.events ?? []) as SchoolEvent[]);
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not load events') });
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string, title: string) => {
    if (!(await confirm({
      title: 'Delete this event?',
      message: `"${title}" will be removed for everyone. This cannot be undone.`,
      confirmLabel: 'Delete',
    }))) return;
    const r = await api(`/api/events/${id}`, 'DELETE');
    if (r.ok) void load();
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not delete event') });
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const dateValid = form.date.trim() !== '' && !isNaN(new Date(form.date).getTime());
  const endValid = form.endDate.trim() === '' || !isNaN(new Date(form.endDate).getTime());
  const endAfterStart = !dateValid || form.endDate.trim() === '' || !endValid || new Date(form.endDate) >= new Date(form.date);
  const gradeOk = form.audience !== 'GRADES' || form.gradeId !== '';
  const canSave = form.title.trim() !== '' && dateValid && endValid && endAfterStart && gradeOk && !saving;

  const openNew = () => {
    setMsg(null);
    setForm({ ...emptyForm, date: defaultDateTimeLocal() });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    const r = await api('/api/events', 'POST', {
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: new Date(form.date).toISOString(),
      endDate: form.endDate.trim() ? new Date(form.endDate).toISOString() : null,
      audience: form.audience,
      gradeId: form.audience === 'GRADES' ? form.gradeId : null,
      venue: form.venue.trim() || null,
    });
    setSaving(false);
    if (r.ok) {
      setDialogOpen(false);
      setForm(emptyForm);
      // A new event is always upcoming; switch there so it is visible.
      if (scope !== 'upcoming') setScope('upcoming'); // effect reloads
      else void load();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not create event') });
    }
  };

  return (
    <div>
      <PageHeader
        title="School Events"
        subtitle="Assemblies, holidays, parent-teacher meetings, sports days and other school events."
        actions={canManage ? (
          <Button onClick={openNew}>
            <Icon name="plus" size={16} /> New event
          </Button>
        ) : undefined}
      />

      <div className="mb-5 flex gap-2" role="tablist" aria-label="Event time range">
        {(['upcoming', 'past'] as Scope[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={
              scope === s
                ? 'inline-flex min-h-[44px] items-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white dark:bg-brand-500'
                : 'inline-flex min-h-[44px] items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }
          >
            {s === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading events…</p></CardContent></Card>
      ) : events.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title={scope === 'upcoming' ? 'No upcoming events' : 'No past events'}
          guidance={canManage
            ? 'Create the first event — an assembly, holiday, parent-teacher meeting or sports day.'
            : scope === 'upcoming'
              ? 'No events are scheduled right now. Check back later.'
              : 'No events were held in this period.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} canManage={canManage} onDelete={() => remove(e.id, e.title)} />
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="New event"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>
              <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Create event'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. Annual sports day"
            maxLength={200}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date & time"
              type="datetime-local"
              value={form.date}
              onChange={set('date')}
              required
            />
            <Input
              label="Ends (optional)"
              type="datetime-local"
              value={form.endDate}
              onChange={set('endDate')}
              error={!endAfterStart ? 'End must be after the start' : undefined}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Audience"
              value={form.audience}
              onChange={set('audience')}
              options={AUDIENCE_OPTIONS}
              required
            />
            {form.audience === 'GRADES' && (
              <Select
                label="Grade"
                value={form.gradeId}
                onChange={set('gradeId')}
                options={grades.map((g) => ({ value: g.id, label: g.name }))}
                placeholder={grades.length === 0 ? 'No grades found' : 'Select grade'}
                required
              />
            )}
          </div>
          <Input
            label="Venue (optional)"
            value={form.venue}
            onChange={set('venue')}
            placeholder="e.g. Main ground"
            maxLength={200}
          />
          <Textarea
            label="Description (optional)"
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="Details about the event"
            maxLength={2000}
          />
        </div>
      </Dialog>
    </div>
  );
}
