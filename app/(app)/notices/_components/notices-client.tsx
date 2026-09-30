'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, Dialog, EmptyState, Input, PageHeader, Select, Textarea, useConfirm } from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDateTime } from '@/lib/format';
import { safeJson } from '@/lib/api-client';
import type { AnnouncementAudience, AnnouncementPriority } from '@prisma/client';

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  gradeId: string | null;
  createdBy: string;
  createdAt: string;
}

interface GradeOption {
  id: string;
  name: string;
}

const AUDIENCES: { value: AnnouncementAudience; label: string }[] = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'PARENTS', label: 'Parents' },
  { value: 'TEACHERS', label: 'Teachers' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'GRADES', label: 'Specific grade' },
];

function audienceLabel(a: AnnouncementAudience): string {
  return a === 'ALL' ? 'Everyone' : a === 'PARENTS' ? 'Parents' : a === 'TEACHERS' ? 'Teachers' : a === 'STAFF' ? 'Staff' : 'Grades';
}

export function NoticesClient({
  initial,
  grades,
  canManage,
}: {
  initial: NoticeItem[];
  grades: GradeOption[];
  canManage: boolean;
}) {
  const confirm = useConfirm();
  const [items, setItems] = useState<NoticeItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NoticeItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dialog form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('NORMAL');
  const [audience, setAudience] = useState<AnnouncementAudience>('PARENTS');
  const [gradeId, setGradeId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notices', { cache: 'no-store' });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not load notices.');
      setItems(Array.isArray(data.notices) ? data.notices : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notices.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setPriority('NORMAL');
    setAudience('PARENTS');
    setGradeId(grades[0]?.id ?? '');
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (n: NoticeItem) => {
    setEditing(n);
    setTitle(n.title);
    setBody(n.body);
    setPriority(n.priority);
    setAudience(n.audience);
    setGradeId(n.gradeId ?? grades[0]?.id ?? '');
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setFormError('Title and message are both required.');
      return;
    }
    if (audience === 'GRADES' && !gradeId) {
      setFormError('Pick a grade for the grade audience.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editing ? `/api/comms/announcements/${editing.id}` : '/api/comms/announcements';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          priority,
          ...(editing ? {} : { audience, ...(audience === 'GRADES' ? { gradeId } : {}) }),
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not save the notice.');
      setDialogOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save the notice.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n: NoticeItem) => {
    if (
      !(await confirm({
        title: 'Delete notice?',
        message: `“${n.title}” will be removed from the notice board.`,
        confirmLabel: 'Delete',
      }))
    )
      return;
    const res = await fetch(`/api/comms/announcements/${n.id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else setError('Could not delete the notice. Please try again.');
  };

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Announcements from the school office — circulars, holidays, exam news and events."
        actions={
          canManage ? (
            <Button onClick={openAdd}>
              <Icon name="plus" size={16} /> Add notice
            </Button>
          ) : undefined
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title="No notices yet"
          guidance={
            canManage
              ? 'Use “Add notice” to publish the first announcement.'
              : 'When the school office publishes a notice for you, it will appear here.'
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((n) => (
            <Card key={n.id} className={n.priority === 'URGENT' ? 'border-amber-300 dark:border-amber-500/40' : undefined}>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {n.priority === 'URGENT' && <Badge variant="pending">Urgent</Badge>}
                  <Badge variant="neutral">{audienceLabel(n.audience)}</Badge>
                  <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                    {pktDateTime(n.createdAt)}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-semibold">{n.title}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Icon name="megaphone" size={14} /> {n.createdBy}
                  </p>
                  {canManage && (
                    <span className="ml-auto flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(n)}>
                        <Icon name="pencil" size={14} /> Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => remove(n)}>
                        <Icon name="trash" size={14} /> Delete
                      </Button>
                    </span>
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
        title={editing ? 'Edit notice' : 'Add notice'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish notice'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {formError}
            </p>
          )}
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Parent-Teacher Meeting on Friday" />
          <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Write the announcement…" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              options={[
                { value: 'NORMAL', label: 'Normal' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
            />
            <Select
              label="Audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
              options={AUDIENCES.map((a) => ({ value: a.value, label: a.label }))}
              disabled={!!editing}
            />
          </div>
          {!editing && audience === 'GRADES' && (
            <Select
              label="Grade"
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              options={grades.map((g) => ({ value: g.id, label: g.name }))}
              placeholder="Select grade"
            />
          )}
          {!editing && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Publishing also sends an in-app notification to every recipient.
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
