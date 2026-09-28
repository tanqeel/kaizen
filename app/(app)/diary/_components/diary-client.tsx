'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  EmptyState, FormGrid, Input, PageHeader, Select, Textarea, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';

interface DiaryEntry {
  id: string;
  date: string;
  sectionId: string;
  section: string;
  subject: string | null;
  subjectId: string | null;
  teacher: string;
  taughtToday: string | null;
  classwork: string | null;
  homework: string | null;
  note: string | null;
  mine: boolean;
}

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

const emptyForm = { subjectId: '', taughtToday: '', classwork: '', homework: '', note: '' };

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function DiaryClient({
  sections, subjects, canWrite, today,
}: {
  sections: Array<{ id: string; label: string; writable: boolean }>;
  subjects: Array<{ id: string; label: string }>;
  canWrite: boolean;
  today: string;
}) {
  const confirm = useConfirm();
  const [date, setDate] = useState(today);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const section = sections.find((s) => s.id === sectionId);
  const writable = !!section?.writable;

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    const r = await api(`/api/diary?sectionId=${sectionId}&date=${date}`, 'GET');
    setLoading(false);
    if (r.ok) {
      const list = r.data.entries as DiaryEntry[];
      setEntries(list);
      const mine = list.find((e) => e.mine);
      setForm(mine ? {
        subjectId: mine.subjectId ?? '',
        taughtToday: mine.taughtToday ?? '',
        classwork: mine.classwork ?? '',
        homework: mine.homework ?? '',
        note: mine.note ?? '',
      } : emptyForm);
    }
  }, [sectionId, date]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const r = await api('/api/diary', 'POST', {
      sectionId, date,
      subjectId: form.subjectId || null,
      taughtToday: form.taughtToday || null,
      classwork: form.classwork || null,
      homework: form.homework || null,
      note: form.note || null,
    });
    setSaving(false);
    if (r.ok) {
      setMsg({ ok: true, text: 'Diary saved.' });
      void load();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not save') });
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: 'Delete diary entry?', message: 'This removes the entry for everyone.', confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/diary?id=${id}`, 'DELETE');
    if (r.ok) void load();
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not delete') });
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Class Diary"
        subtitle="What was taught today, classwork and homework — written by teachers, visible to students, parents and management."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        <Select
          label="Class / section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          options={sections.map((s) => ({ value: s.id, label: s.label }))}
          placeholder={sections.length === 0 ? 'No classes available' : 'Select class'}
          className="min-w-[220px]"
        />
      </div>

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {writable && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Write diary — {section?.label} · {fmtDate(date)}</CardTitle></CardHeader>
          <CardContent>
            <FormGrid>
              <Select label="Subject (optional)" value={form.subjectId} onChange={set('subjectId')} options={subjects.map((s) => ({ value: s.id, label: s.label }))} placeholder="General / all subjects" />
            </FormGrid>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Textarea label="Taught today" rows={3} value={form.taughtToday} onChange={set('taughtToday')} placeholder="e.g. Chapter 4: Fractions — addition and subtraction" maxLength={2000} />
              <Textarea label="Classwork" rows={3} value={form.classwork} onChange={set('classwork')} placeholder="e.g. Exercise 4.2, Q1–Q5 solved in class" maxLength={2000} />
              <Textarea label="Homework" rows={3} value={form.homework} onChange={set('homework')} placeholder="e.g. Exercise 4.2, Q6–Q10 — due tomorrow" maxLength={2000} />
              <Textarea label="Note for parents" rows={3} value={form.note} onChange={set('note')} placeholder="e.g. Test on Friday — please revise chapter 4" maxLength={2000} />
            </div>
            <Button className="mt-4" onClick={save} disabled={saving}>
              <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save diary entry'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Entries — {fmtDate(date)}
        </h2>
        {loading ? (
          <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading…</p></CardContent></Card>
        ) : entries.length === 0 ? (
          <EmptyState icon="book-open" title="No diary entries yet" guidance={writable ? 'Use the form above to write the first entry for this class and day.' : 'The teacher has not posted the diary for this day yet.'} />
        ) : (
          entries.map((e) => (
            <Card key={e.id}>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.subject ? <Badge variant="info">{e.subject}</Badge> : <Badge variant="neutral">General</Badge>}
                    <span className="text-sm text-slate-500 dark:text-slate-400">by {e.teacher}</span>
                  </div>
                  {e.mine && canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => remove(e.id)} aria-label="Delete entry">
                      <Icon name="x" size={16} />
                    </Button>
                  )}
                </div>
                <dl className="mt-3 space-y-3">
                  {([['Taught today', e.taughtToday], ['Classwork', e.classwork], ['Homework', e.homework], ['Note', e.note]] as const)
                    .filter(([, v]) => v)
                    .map(([label, v]) => (
                      <div key={label}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm">{v}</dd>
                      </div>
                    ))}
                </dl>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
