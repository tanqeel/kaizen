'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, Dialog, EmptyState, Input,
  PageHeader, Select, Textarea, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate } from '@/lib/format';

type MaterialType = 'NOTE' | 'WORKSHEET' | 'PAST_PAPER' | 'VIDEO_LINK' | 'AUDIO_LINK';

interface Material {
  id: string;
  title: string;
  description: string | null;
  type: MaterialType;
  fileUrl: string | null;
  createdAt: string;
  subject: { id: string; name: string; code: string };
  grade: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  teacher: string;
  teacherId: string;
  mine: boolean;
}

interface Option { id: string; label: string; }
interface GradeOption { id: string; name: string; sections: Array<{ id: string; name: string }>; }

const TYPE_META: Record<MaterialType, { label: string; icon: 'book-open' | 'clipboard-check' | 'receipt-text' | 'eye' | 'bell' }> = {
  NOTE: { label: 'Note', icon: 'book-open' },
  WORKSHEET: { label: 'Worksheet', icon: 'clipboard-check' },
  PAST_PAPER: { label: 'Past paper', icon: 'receipt-text' },
  VIDEO_LINK: { label: 'Video link', icon: 'eye' },
  AUDIO_LINK: { label: 'Audio link', icon: 'bell' },
};
const TYPE_OPTIONS: Array<{ value: string; label: string }> = (Object.keys(TYPE_META) as MaterialType[])
  .map((t) => ({ value: t, label: TYPE_META[t].label }));

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
  type: 'NOTE' as MaterialType,
  subjectId: '',
  gradeId: '',
  sectionId: '',
  description: '',
  fileUrl: '',
};

export function MaterialsClient({
  subjects, grades, taughtSubjectIds, canUpload, isAdmin,
}: {
  subjects: Option[];
  grades: GradeOption[];
  /** null = may upload for any subject (principal/admin); [] = teaches nothing */
  taughtSubjectIds: string[] | null;
  canUpload: boolean;
  isAdmin: boolean;
}) {
  const confirm = useConfirm();
  const [subjectId, setSubjectId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const uploadAllowed = canUpload && (taughtSubjectIds === null || taughtSubjectIds.length > 0);
  const uploadSubjects = taughtSubjectIds === null
    ? subjects
    : subjects.filter((s) => taughtSubjectIds.includes(s.id));

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (subjectId) p.set('subjectId', subjectId);
    if (gradeId) p.set('gradeId', gradeId);
    if (type) p.set('type', type);
    if (qDebounced) p.set('q', qDebounced);
    const r = await api(`/api/materials${p.toString() ? `?${p.toString()}` : ''}`, 'GET');
    setLoading(false);
    if (r.ok) setMaterials((r.data.materials ?? []) as Material[]);
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not load materials') });
  }, [subjectId, gradeId, type, qDebounced]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    if (!(await confirm({
      title: 'Delete this material?',
      message: 'This removes the material for everyone. This cannot be undone.',
      confirmLabel: 'Delete',
    }))) return;
    const r = await api(`/api/materials/${id}`, 'DELETE');
    if (r.ok) void load();
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not delete') });
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'gradeId') next.sectionId = '';
      return next;
    });
  };

  const formSections = grades.find((g) => g.id === form.gradeId)?.sections ?? [];
  const fileUrlInvalid = form.fileUrl.trim() !== '' && !/^https?:\/\//.test(form.fileUrl.trim());
  const canSave = form.title.trim() !== '' && form.subjectId !== '' && !fileUrlInvalid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    const r = await api('/api/materials', 'POST', {
      title: form.title.trim(),
      type: form.type,
      subjectId: form.subjectId,
      gradeId: form.gradeId || null,
      sectionId: form.sectionId || null,
      description: form.description.trim() || null,
      fileUrl: form.fileUrl.trim() || null,
    });
    setSaving(false);
    if (r.ok) {
      setDialogOpen(false);
      setForm(emptyForm);
      void load();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not upload material') });
    }
  };

  const audience = (m: Material) =>
    m.grade ? `${m.grade.name}${m.section ? ` · Section ${m.section.name}` : ' · All sections'}` : 'All grades';

  return (
    <div>
      <PageHeader
        title="Study Material"
        subtitle="Notes, worksheets, past papers and video/audio links shared by teachers."
        actions={uploadAllowed ? (
          <Button onClick={() => { setMsg(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Icon name="plus" size={16} /> Upload material
          </Button>
        ) : undefined}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          options={[{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: s.id, label: s.label }))]}
        />
        <Select
          label="Grade"
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          options={[{ value: '', label: 'All grades' }, ...grades.map((g) => ({ value: g.id, label: g.name }))]}
        />
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
        />
        <Input
          label="Search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or description…"
        />
      </div>

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading materials…</p></CardContent></Card>
      ) : materials.length === 0 ? (
        <EmptyState
          icon="book-open"
          title="No study materials found"
          guidance={uploadAllowed
            ? 'Share the first note, worksheet, past paper or video/audio link for your classes.'
            : 'Nothing matches these filters. Teachers share notes, worksheets and links here.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="info">
                    <Icon name={TYPE_META[m.type].icon} size={14} /> {TYPE_META[m.type].label}
                  </Badge>
                  {(m.mine || isAdmin) && (
                    <Button variant="ghost" size="sm" onClick={() => remove(m.id)} aria-label={`Delete ${m.title}`}>
                      <Icon name="x" size={16} />
                    </Button>
                  )}
                </div>
                <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{m.title}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {m.subject.name} ({m.subject.code}) · {audience(m)}
                </p>
                {m.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{m.description}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    by {m.teacher} · {pktDate(m.createdAt)}
                  </span>
                  {m.fileUrl && (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Icon name="eye" size={16} /> Open link
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Upload study material"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>
              <Icon name="check" size={16} /> {saving ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. Chapter 4 — Fractions: key formulas"
            maxLength={200}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              value={form.type}
              onChange={set('type')}
              options={TYPE_OPTIONS}
              required
            />
            <Select
              label="Subject"
              value={form.subjectId}
              onChange={set('subjectId')}
              options={uploadSubjects.map((s) => ({ value: s.id, label: s.label }))}
              placeholder={uploadSubjects.length === 0 ? 'No subjects assigned to you' : 'Select subject'}
              required
              disabled={uploadSubjects.length === 0}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Grade (optional)"
              value={form.gradeId}
              onChange={set('gradeId')}
              options={[{ value: '', label: 'All grades' }, ...grades.map((g) => ({ value: g.id, label: g.name }))]}
            />
            <Select
              label="Section (optional)"
              value={form.sectionId}
              onChange={set('sectionId')}
              options={[{ value: '', label: 'All sections' }, ...formSections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))]}
              disabled={!form.gradeId}
              hint={!form.gradeId ? 'Choose a grade first' : undefined}
            />
          </div>
          <Input
            label="Link (optional)"
            value={form.fileUrl}
            onChange={set('fileUrl')}
            placeholder="https://… (note PDF, video, audio)"
            inputMode="url"
            error={fileUrlInvalid ? 'Must start with http:// or https://' : undefined}
          />
          <Textarea
            label="Description (optional)"
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="Short note about what this material covers"
            maxLength={2000}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Links only in this version — no file storage yet. Pick a grade so students and parents
            can see it; leaving grade blank keeps it visible to staff only.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
