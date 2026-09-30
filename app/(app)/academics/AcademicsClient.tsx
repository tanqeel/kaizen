'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState,
  FormGrid, Input, Select, Table, TBody, TD, TH, THead, Tabs, TabPanel, TRow, useConfirm,
  type TabItem,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { DAY_NAMES } from '@/lib/days';
import { safeJson } from '@/lib/api-client';

/* ---------------------------------- types --------------------------------- */

export interface SectionLite {
  id: string; name: string; room: string | null; classTeacher: string | null;
  classTeacherId: string | null; studentCount: number; slotCount: number;
}
export interface GradeLite { id: string; level: number; name: string; sections: SectionLite[]; }
export interface SubjectLite { id: string; name: string; code: string; inUse: boolean; }
export interface AllocationLite {
  id: string; subjectId: string; subject: string; subjectCode: string;
  gradeId: string; grade: string; teacherId: string; teacher: string; periodsPerWeek: number;
}
export interface TeacherLite { id: string; name: string; }
export interface SlotLite {
  id: string; dayOfWeek: number; periodNo: number; subjectId: string;
  subject: string; subjectCode: string; teacherId: string; teacher: string;
  room: string | null; startTime: string; endTime: string;
}
export type PromoAction = 'promote' | 'graduate' | 'stay';
export interface PromoStudent {
  id: string; name: string; admissionNo: string;
  fromGrade: string; fromSection: string | null;
  toGrade: string | null; toSection: string | null;
  action: PromoAction;
}
export interface PromoPlan {
  currentSession: { id: string; name: string; term: string };
  gradeMap: { from: { id: string; name: string }; to: { id: string; name: string } | null }[];
  students: PromoStudent[];
  counts: { total: number; promote: number; graduate: number; stay: number };
}
export interface PromoResult { promoted: number; graduated: number; stayed: number; newSessionId: string; }

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

async function api(path: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await safeJson(res)) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }
  return { ok: res.ok, status: res.status, data };
}

/* --------------------------------- component ------------------------------- */

export function AcademicsClient({
  canManage, initialGrades, initialSubjects, initialAllocations, teachers, scopedSectionIds,
}: {
  canManage: boolean;
  initialGrades: GradeLite[];
  initialSubjects: SubjectLite[];
  initialAllocations: AllocationLite[];
  teachers: TeacherLite[];
  /** When set (student/parent), restrict views to these sections and hide management tabs. */
  scopedSectionIds?: string[] | null;
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState('structure');
  const [grades, setGrades] = useState(initialGrades);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [g, s, a] = await Promise.all([
      api('/api/academics/sections', 'GET'),
      api('/api/academics/subjects', 'GET'),
      api('/api/academics/allocations', 'GET'),
    ]);
    if (g.ok) {
      setGrades(((g.data.grades ?? []) as Array<Record<string, unknown>>).map((gr) => ({
        id: String(gr.id), level: Number(gr.level), name: String(gr.name),
        sections: ((gr.sections ?? []) as Array<Record<string, unknown>>).map((sec) => ({
          id: String(sec.id), name: String(sec.name), room: (sec.room as string | null) ?? null,
          classTeacher: (sec.classTeacher as string | null) ?? null,
          classTeacherId: (sec.classTeacherId as string | null) ?? null,
          studentCount: Number(sec.studentCount ?? 0), slotCount: Number(sec.slotCount ?? 0),
        })),
      })));
    }
    if (s.ok) {
      setSubjects(((s.data.subjects ?? []) as Array<Record<string, unknown>>).map((su) => ({
        id: String(su.id), name: String(su.name), code: String(su.code), inUse: !(su.deletable as boolean),
      })));
    }
    if (a.ok) {
      setAllocations(((a.data.allocations ?? []) as Array<Record<string, unknown>>).map((al) => ({
        id: String(al.id), subjectId: String(al.subjectId ?? ''), subject: String(al.subject),
        subjectCode: String(al.subjectCode), gradeId: String(al.gradeId ?? ''), grade: String(al.grade),
        teacherId: String(al.teacherId), teacher: String(al.teacher),
        periodsPerWeek: Number(al.periodsPerWeek),
      })));
    }
  }, []);

  const flash = (msg: string | null, isError: boolean) => {
    if (isError) { setError(msg); setNotice(null); }
    else { setNotice(msg); setError(null); }
  };

  /* ------------------------------ structure tab ---------------------------- */

  const [newSubject, setNewSubject] = useState({ name: '', code: '' });
  const [newSection, setNewSection] = useState({ gradeId: '', name: '', room: '', classTeacherId: '' });
  const [sectionGradeFilter, setSectionGradeFilter] = useState('');

  const addSubject = async () => {
    flash(null, false);
    const r = await api('/api/academics/subjects', 'POST', { name: newSubject.name, code: newSubject.code });
    if (!r.ok) { flash(String(r.data.error ?? 'Could not add subject'), true); return; }
    setNewSubject({ name: '', code: '' });
    await refresh();
    flash('Subject added.', false);
  };

  const deleteSubject = async (s: SubjectLite) => {
    if (!(await confirm({ title: 'Delete subject', message: `Delete "${s.name}" (${s.code})? This is only possible if nothing references it.`, confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/academics/subjects/${s.id}`, 'DELETE');
    if (!r.ok) { flash(String(r.data.error ?? 'Could not delete subject'), true); return; }
    await refresh();
    flash(`Subject "${s.name}" deleted.`, false);
  };

  const addSection = async () => {
    flash(null, false);
    const r = await api('/api/academics/sections', 'POST', {
      gradeId: newSection.gradeId || undefined,
      name: newSection.name,
      room: newSection.room || undefined,
      classTeacherId: newSection.classTeacherId || undefined,
    });
    if (!r.ok) { flash(String(r.data.error ?? 'Could not add section'), true); return; }
    setNewSection({ gradeId: '', name: '', room: '', classTeacherId: '' });
    await refresh();
    flash('Section added.', false);
  };

  const deleteSection = async (gradeName: string, s: SectionLite) => {
    if (!(await confirm({ title: 'Delete section', message: `Delete ${gradeName}-${s.name}? This is only possible when it has no students, timetable slots or attendance records.`, confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/academics/sections/${s.id}`, 'DELETE');
    if (!r.ok) { flash(String(r.data.error ?? 'Could not delete section'), true); return; }
    await refresh();
    flash(`Section ${gradeName}-${s.name} deleted.`, false);
  };

  const filteredGrades = useMemo(
    () => (sectionGradeFilter ? grades.filter((g) => g.id === sectionGradeFilter) : grades),
    [grades, sectionGradeFilter],
  );

  /* ----------------------------- allocations tab --------------------------- */

  const [newAlloc, setNewAlloc] = useState({ subjectId: '', gradeId: '', teacherId: '', periodsPerWeek: '5' });

  const addAllocation = async () => {
    flash(null, false);
    const r = await api('/api/academics/allocations', 'POST', {
      subjectId: newAlloc.subjectId || undefined,
      gradeId: newAlloc.gradeId || undefined,
      teacherId: newAlloc.teacherId || undefined,
      periodsPerWeek: Number(newAlloc.periodsPerWeek),
    });
    if (!r.ok) { flash(String(r.data.error ?? 'Could not add allocation'), true); return; }
    setNewAlloc({ subjectId: '', gradeId: '', teacherId: '', periodsPerWeek: '5' });
    await refresh();
    flash('Allocation added.', false);
  };

  const deleteAllocation = async (a: AllocationLite) => {
    if (!(await confirm({ title: 'Delete allocation', message: `Remove ${a.subject} (${a.grade}) from ${a.teacher}?`, confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/academics/allocations/${a.id}`, 'DELETE');
    if (!r.ok) { flash(String(r.data.error ?? 'Could not delete allocation'), true); return; }
    await refresh();
    flash('Allocation removed.', false);
  };

  /* ----------------------------- timetable tab ----------------------------- */

  const allSections = useMemo(
    () => grades.flatMap((g) => g.sections.map((s) => ({ ...s, gradeName: g.name }))),
    [grades],
  );
  const [ttSectionId, setTtSectionId] = useState('');
  const [slots, setSlots] = useState<SlotLite[]>([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [slotDialog, setSlotDialog] = useState<null | { slot: SlotLite | null; day: number; period: number }>(null);
  const [copyDialog, setCopyDialog] = useState(false);
  const [copyTargetId, setCopyTargetId] = useState('');

  const loadTimetable = useCallback(async (sectionId: string) => {
    if (!sectionId) { setSlots([]); return; }
    setTtLoading(true);
    const r = await api(`/api/academics/timetable?sectionId=${sectionId}`, 'GET');
    setTtLoading(false);
    if (r.ok) {
      setSlots(((r.data.slots ?? []) as Array<Record<string, unknown>>).map((sl) => ({
        id: String(sl.id), dayOfWeek: Number(sl.dayOfWeek), periodNo: Number(sl.periodNo),
        subjectId: String(sl.subjectId), subject: String(sl.subject), subjectCode: String(sl.subjectCode),
        teacherId: String(sl.teacherId), teacher: String(sl.teacher),
        room: (sl.room as string | null) ?? null,
        startTime: String(sl.startTime), endTime: String(sl.endTime),
      })));
    }
  }, []);

  const pickSection = (id: string) => {
    setTtSectionId(id);
    setCopyTargetId('');
    void loadTimetable(id);
  };

  // Scoped viewers (student/parent) land directly on their own section timetable.
  const ttOptions = scopedSectionIds ? allSections.filter((s) => scopedSectionIds.includes(s.id)) : allSections;
  useEffect(() => {
    if (scopedSectionIds && scopedSectionIds.length > 0) {
      pickSection(scopedSectionIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxPeriod = Math.max(6, ...slots.map((s) => s.periodNo));
  const slotAt = (day: number, period: number) => slots.find((s) => s.dayOfWeek === day && s.periodNo === period);

  // Slot dialog form state
  const [slotForm, setSlotForm] = useState({ subjectId: '', teacherId: '', room: '', startTime: '', endTime: '', dayOfWeek: 1, periodNo: 1 });
  const openSlotDialog = (slot: SlotLite | null, day: number, period: number) => {
    setSlotForm(slot
      ? { subjectId: slot.subjectId, teacherId: slot.teacherId, room: slot.room ?? '', startTime: slot.startTime, endTime: slot.endTime, dayOfWeek: slot.dayOfWeek, periodNo: slot.periodNo }
      : { subjectId: '', teacherId: '', room: '', startTime: '08:00', endTime: '08:50', dayOfWeek: day, periodNo: period });
    setSlotDialog({ slot, day, period });
  };

  const saveSlot = async (override = false) => {
    if (!slotDialog || !ttSectionId) return;
    flash(null, false);
    const payload = { ...slotForm, override };
    const r = slotDialog.slot
      ? await api(`/api/academics/timetable/${slotDialog.slot.id}`, 'PUT', payload)
      : await api('/api/academics/timetable', 'POST', { ...payload, sectionId: ttSectionId });
    if (r.status === 409 && r.data.warning) {
      const ok = await confirm({
        title: 'Teacher already booked',
        message: `${String(r.data.warning)} Override and save anyway?`,
        confirmLabel: 'Override',
      });
      if (ok) { await saveSlot(true); }
      return;
    }
    if (!r.ok) { flash(String(r.data.error ?? r.data.warning ?? 'Could not save slot'), true); return; }
    setSlotDialog(null);
    await loadTimetable(ttSectionId);
    flash(r.data.overridden ? 'Slot saved with double-booking override.' : 'Slot saved.', false);
  };

  const deleteSlot = async (slot: SlotLite) => {
    if (!(await confirm({ title: 'Delete slot', message: `Delete Period ${slot.periodNo} on ${DAY_NAMES[slot.dayOfWeek]} (${slot.subject})?`, confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/academics/timetable/${slot.id}`, 'DELETE');
    if (!r.ok) { flash(String(r.data.error ?? 'Could not delete slot'), true); return; }
    await loadTimetable(ttSectionId);
    flash('Slot deleted.', false);
  };

  const copyWeek = async () => {
    if (!copyTargetId) return;
    const from = allSections.find((s) => s.id === ttSectionId);
    const to = allSections.find((s) => s.id === copyTargetId);
    if (!(await confirm({
      title: 'Copy timetable week',
      message: `Copy the full week (${slots.length} slots) from ${from?.gradeName}-${from?.name} to ${to?.gradeName}-${to?.name}? This REPLACES the target's existing timetable (${to?.slotCount ?? 0} slots). Teacher double-bookings are not re-checked for bulk copy.`,
      confirmLabel: 'Copy week',
    }))) return;
    const r = await api('/api/academics/timetable/copy', 'POST', { fromSectionId: ttSectionId, toSectionId: copyTargetId });
    if (!r.ok) { flash(String(r.data.error ?? 'Copy failed'), true); return; }
    setCopyDialog(false);
    setCopyTargetId('');
    await refresh();
    await loadTimetable(copyTargetId);
    setTtSectionId(copyTargetId);
    flash(`Copied ${String(r.data.copied)} slots to ${String(r.data.to)} (replaced ${String(r.data.replaced)}).`, false);
  };

  /* ---------------------------- promotion tab ---------------------------- */

  const [promoName, setPromoName] = useState('');
  const [promoPlan, setPromoPlan] = useState<PromoPlan | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoCommitting, setPromoCommitting] = useState(false);
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);

  const previewPlan = async () => {
    flash(null, false);
    setPromoPlan(null);
    setPromoResult(null);
    setPromoLoading(true);
    const r = await api('/api/academics/promote', 'GET');
    setPromoLoading(false);
    if (!r.ok) { flash(String(r.data.error ?? 'Could not compute the promotion plan'), true); return; }
    setPromoPlan(r.data as unknown as PromoPlan);
  };

  const commitPromotion = async () => {
    const name = promoName.trim();
    if (!promoPlan || !name) return;
    const c = promoPlan.counts;
    const ok = await confirm({
      title: 'Confirm session promotion',
      message:
        'This WRITES REAL DATA and cannot be undone automatically:\n\n' +
        `• ${c.promote} student${c.promote === 1 ? '' : 's'} promoted to the next grade\n` +
        `• ${c.graduate} student${c.graduate === 1 ? '' : 's'} in the final grade graduated (deactivated)\n` +
        `• ${c.stay} student${c.stay === 1 ? '' : 's'} left as-is\n\n` +
        `A new session "${name}" will become the current session and "${promoPlan.currentSession.name}" will be deactivated.\n\n` +
        'Press "Promote now" to proceed.',
      confirmLabel: 'Promote now',
    });
    if (!ok) return;
    flash(null, false);
    setPromoCommitting(true);
    const r = await api('/api/academics/promote', 'POST', { newSessionName: name, confirm: true });
    setPromoCommitting(false);
    if (!r.ok) { flash(String(r.data.error ?? 'Promotion failed'), true); return; }
    const res = r.data as unknown as PromoResult;
    setPromoResult(res);
    setPromoPlan(null);
    setPromoName('');
    await refresh();
    flash(`Promotion committed: ${res.promoted} promoted, ${res.graduated} graduated, ${res.stayed} stayed.`, false);
  };

  const actionBadge = (a: PromoAction) =>
    a === 'promote' ? <Badge variant="present">Promote</Badge>
    : a === 'graduate' ? <Badge variant="absent">Graduate</Badge>
    : <Badge variant="neutral">Stay</Badge>;

  /* --------------------------------- render -------------------------------- */

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <Icon name="alert-triangle" size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <Icon name="check" size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Tabs
        tabs={
          [
            { id: 'structure', label: 'Structure', icon: 'school' },
            { id: 'allocations', label: 'Allocations', icon: 'users' },
            { id: 'timetable', label: 'Timetable', icon: 'calendar-days' },
            // Promotion is a management workflow — never shown to scoped student/parent viewers.
            ...(scopedSectionIds
              ? []
              : ([{ id: 'promotion', label: 'Promotion', icon: 'refresh-cw' }] as TabItem[])),
          ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Academics sections"
      />

      {/* ── Structure ── */}
      <TabPanel id="structure" active={tab === 'structure'} className="mt-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Grades & sections</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <Select
                label="Filter by grade"
                className="min-w-[200px]"
                value={sectionGradeFilter}
                onChange={(e) => setSectionGradeFilter(e.target.value)}
                options={[{ value: '', label: 'All grades' }, ...grades.map((g) => ({ value: g.id, label: g.name }))]}
              />
            </div>
            <Table>
              <THead><TRow><TH>Grade</TH><TH>Sections</TH><TH>Students</TH></TRow></THead>
              <TBody>
                {filteredGrades.map((g) => (
                  <TRow key={g.id}>
                    <TD className="font-semibold">{g.name}</TD>
                    <TD>
                      <span className="flex flex-wrap gap-1.5">
                        {g.sections.length === 0 && <span className="text-slate-400">—</span>}
                        {g.sections.map((s) => (
                          <Badge key={s.id} variant="info">{s.name}{s.room ? ` · ${s.room}` : ''}</Badge>
                        ))}
                      </span>
                    </TD>
                    <TD className="tnum">{g.sections.reduce((n, s) => n + s.studentCount, 0)}</TD>
                  </TRow>
                ))}
              </TBody>
            </Table>

            {canManage && (
              <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Add section</h3>
                <FormGrid>
                  <Select label="Grade" required value={newSection.gradeId} onChange={(e) => setNewSection({ ...newSection, gradeId: e.target.value })} placeholder="Select grade" options={grades.map((g) => ({ value: g.id, label: g.name }))} />
                  <Input label="Section name" required value={newSection.name} onChange={(e) => setNewSection({ ...newSection, name: e.target.value })} placeholder="e.g. C" maxLength={4} />
                  <Input label="Room" value={newSection.room} onChange={(e) => setNewSection({ ...newSection, room: e.target.value })} placeholder="e.g. R-3C" maxLength={20} />
                  <Select label="Class teacher" value={newSection.classTeacherId} onChange={(e) => setNewSection({ ...newSection, classTeacherId: e.target.value })} placeholder="None" options={teachers.map((t) => ({ value: t.id, label: t.name }))} />
                </FormGrid>
                <Button className="mt-3" onClick={addSection} disabled={!newSection.gradeId || !newSection.name.trim()}>
                  <Icon name="plus" size={16} /> Add section
                </Button>

                <h3 className="mt-6 mb-3 text-sm font-semibold text-slate-900 dark:text-white">Delete a section</h3>
                <Table>
                  <THead><TRow><TH>Section</TH><TH>Room</TH><TH>Class teacher</TH><TH>Students</TH><TH><span className="sr-only">Actions</span></TH></TRow></THead>
                  <TBody>
                    {filteredGrades.flatMap((g) => g.sections.map((s) => (
                      <TRow key={s.id}>
                        <TD className="font-medium">{g.name}-{s.name}</TD>
                        <TD>{s.room ?? '—'}</TD>
                        <TD>{s.classTeacher ?? '—'}</TD>
                        <TD className="tnum">{s.studentCount}</TD>
                        <TD className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => deleteSection(g.name, s)} aria-label={`Delete section ${g.name}-${s.name}`}>
                            <Icon name="x" size={16} />
                          </Button>
                        </TD>
                      </TRow>
                    )))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subjects</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TRow><TH>Subject</TH><TH>Code</TH>{canManage && <TH><span className="sr-only">Actions</span></TH>}</TRow></THead>
              <TBody>
                {subjects.map((s) => (
                  <TRow key={s.id}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD><Badge variant="neutral">{s.code}</Badge></TD>
                    {canManage && (
                      <TD className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteSubject(s)} aria-label={`Delete subject ${s.name}`}>
                          <Icon name="x" size={16} />
                        </Button>
                      </TD>
                    )}
                  </TRow>
                ))}
              </TBody>
            </Table>
            {canManage && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Input label="Name" required value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="e.g. Art" className="min-w-[180px] flex-1" maxLength={60} />
                <Input label="Code" required value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })} placeholder="e.g. ART" className="w-32" maxLength={10} />
                <Button onClick={addSubject} disabled={!newSubject.name.trim() || !newSubject.code.trim()}>
                  <Icon name="plus" size={16} /> Add subject
                </Button>
              </div>
            )}
            {!canManage && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">You can view the structure. Managing it needs the academics.manage permission.</p>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── Allocations ── */}
      <TabPanel id="allocations" active={tab === 'allocations'} className="mt-6">
        <Card>
          <CardHeader><CardTitle>Subject allocations</CardTitle></CardHeader>
          <CardContent>
            {allocations.length === 0 ? (
              <EmptyState icon="users" title="No allocations yet" guidance="Assign each subject in every grade to a teacher to build the teaching roster." />
            ) : (
              <Table>
                <THead><TRow><TH>Subject</TH><TH>Grade</TH><TH>Teacher</TH><TH>Periods/week</TH>{canManage && <TH><span className="sr-only">Actions</span></TH>}</TRow></THead>
                <TBody>
                  {allocations.map((a) => (
                    <TRow key={a.id}>
                      <TD className="font-medium">{a.subject} <span className="text-xs text-slate-400">{a.subjectCode}</span></TD>
                      <TD>{a.grade}</TD>
                      <TD>{a.teacher}</TD>
                      <TD className="tnum">{a.periodsPerWeek}</TD>
                      {canManage && (
                        <TD className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => deleteAllocation(a)} aria-label={`Delete allocation ${a.subject} ${a.grade}`}>
                            <Icon name="x" size={16} />
                          </Button>
                        </TD>
                      )}
                    </TRow>
                  ))}
                </TBody>
              </Table>
            )}
            {canManage && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Select label="Subject" required className="min-w-[160px] flex-1" value={newAlloc.subjectId} onChange={(e) => setNewAlloc({ ...newAlloc, subjectId: e.target.value })} placeholder="Subject" options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} />
                <Select label="Grade" required className="min-w-[140px]" value={newAlloc.gradeId} onChange={(e) => setNewAlloc({ ...newAlloc, gradeId: e.target.value })} placeholder="Grade" options={grades.map((g) => ({ value: g.id, label: g.name }))} />
                <Select label="Teacher" required className="min-w-[180px] flex-1" value={newAlloc.teacherId} onChange={(e) => setNewAlloc({ ...newAlloc, teacherId: e.target.value })} placeholder="Teacher" options={teachers.map((t) => ({ value: t.id, label: t.name }))} />
                <Input label="Periods/week" required type="number" min={1} max={30} className="w-28" value={newAlloc.periodsPerWeek} onChange={(e) => setNewAlloc({ ...newAlloc, periodsPerWeek: e.target.value })} />
                <Button onClick={addAllocation} disabled={!newAlloc.subjectId || !newAlloc.gradeId || !newAlloc.teacherId}>
                  <Icon name="plus" size={16} /> Allocate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── Timetable ── */}
      <TabPanel id="timetable" active={tab === 'timetable'} className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Weekly timetable</CardTitle>
              {canManage && ttSectionId && (
                <Button variant="secondary" size="sm" onClick={() => setCopyDialog(true)}>
                  <Icon name="download" size={16} /> Copy week…
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Select
              label="Section"
              className="mb-4 max-w-xs"
              value={ttSectionId}
              onChange={(e) => pickSection(e.target.value)}
              placeholder="Select a section"
              options={ttOptions.map((s) => ({ value: s.id, label: `${s.gradeName} - ${s.name}` }))}
            />
            {!ttSectionId ? (
              <EmptyState icon="calendar-days" title="Pick a section" guidance="Choose a section above to see its Monday–Friday timetable grid." />
            ) : ttLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading timetable…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Period</th>
                      {WEEKDAYS.map((d) => (
                        <th key={d} className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{DAY_NAMES[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => (
                      <tr key={p} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="tnum px-2 py-1.5 align-top font-bold text-slate-500">{p}</td>
                        {WEEKDAYS.map((d) => {
                          const slot = slotAt(d, p);
                          return (
                            <td key={d} className="px-1 py-1.5 align-top">
                              {slot ? (
                                <button
                                  type="button"
                                  onClick={() => canManage && openSlotDialog(slot, d, p)}
                                  disabled={!canManage}
                                  className="flex min-h-[64px] w-full flex-col justify-center gap-0.5 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 text-left transition-colors hover:border-brand-400 disabled:cursor-default dark:border-brand-500/30 dark:bg-brand-500/10"
                                >
                                  <span className="text-xs font-bold text-brand-800 dark:text-brand-200">{slot.subjectCode}</span>
                                  <span className="truncate text-[11px] text-slate-600 dark:text-slate-300">{shortName(slot.teacher)}</span>
                                  <span className="tnum truncate text-[11px] text-slate-400">{slot.startTime}–{slot.endTime}{slot.room ? ` · ${slot.room}` : ''}</span>
                                </button>
                              ) : canManage ? (
                                <button
                                  type="button"
                                  onClick={() => openSlotDialog(null, d, p)}
                                  aria-label={`Add slot ${DAY_NAMES[d]} period ${p}`}
                                  className="flex min-h-[64px] w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:hover:border-brand-500"
                                >
                                  <Icon name="plus" size={16} />
                                </button>
                              ) : (
                                <span className="flex min-h-[64px] items-center justify-center rounded-lg bg-slate-50 text-slate-300 dark:bg-slate-800/50">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!canManage && ttSectionId && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">You can view the timetable. Editing needs the academics.manage permission.</p>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── Promotion ── */}
      <TabPanel id="promotion" active={tab === 'promotion'} className="mt-6">
        <Card>
          <CardHeader><CardTitle>Promote to new session</CardTitle></CardHeader>
          <CardContent>
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Icon name="alert-triangle" size={18} className="mt-0.5 shrink-0" />
              <span>
                Promotion moves every active student in the current session to the next grade (the section with the same name) and marks final-grade students as graduated.
                <strong> Confirming writes real data</strong> — always preview the plan first and double-check it.
              </span>
            </div>

            {!canManage ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Session promotion needs the academics.manage permission.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <Input
                    label="New session name"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    placeholder="e.g. 2026-27"
                    className="min-w-[200px] flex-1"
                    maxLength={20}
                  />
                  <Button onClick={previewPlan} disabled={promoLoading}>
                    <Icon name="eye" size={16} /> {promoLoading ? 'Computing…' : 'Preview plan'}
                  </Button>
                </div>

                {promoResult && (
                  <div role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0" />
                    <span>
                      Promotion committed — the new session is now current.
                      <strong> {promoResult.promoted}</strong> promoted,
                      <strong> {promoResult.graduated}</strong> graduated,
                      <strong> {promoResult.stayed}</strong> stayed.
                    </span>
                  </div>
                )}

                {promoPlan && (
                  <div className="mt-6 space-y-6">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                        Current session: {promoPlan.currentSession.name}
                        <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">→ new: {promoName.trim() || '—'}</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="info">{promoPlan.counts.total} students</Badge>
                        <Badge variant="present">{promoPlan.counts.promote} promote</Badge>
                        <Badge variant="absent">{promoPlan.counts.graduate} graduate</Badge>
                        <Badge variant="neutral">{promoPlan.counts.stay} stay</Badge>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Grade mapping</h3>
                      <div className="flex flex-wrap gap-2">
                        {promoPlan.gradeMap.map((gm) => (
                          <span key={gm.from.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                            {gm.from.name}
                            <span aria-hidden className="text-slate-400">→</span>
                            {gm.to ? gm.to.name : <span className="font-semibold text-rose-600 dark:text-rose-400">Graduate</span>}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Students</h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <THead><TRow><TH>Student</TH><TH>From</TH><TH>To</TH><TH>Action</TH></TRow></THead>
                          <TBody>
                            {promoPlan.students.map((s) => (
                              <TRow key={s.id}>
                                <TD className="font-medium">
                                  {s.name} <span className="font-normal text-xs text-slate-400">{s.admissionNo}</span>
                                </TD>
                                <TD>{s.fromGrade}{s.fromSection ? `-${s.fromSection}` : ''}</TD>
                                <TD>{s.toGrade ? `${s.toGrade}${s.toSection ? `-${s.toSection}` : ''}` : '—'}</TD>
                                <TD>{actionBadge(s.action)}</TD>
                              </TRow>
                            ))}
                          </TBody>
                        </Table>
                      </div>
                      {promoPlan.students.length === 0 && (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No active students in the current session.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-500/20">
                      <p className="flex-1 text-sm text-rose-800 dark:text-rose-200">
                        <strong>Irreversible:</strong> committing moves students, deactivates graduates and switches the current session. Make sure the plan above is correct.
                      </p>
                      <Button variant="danger" onClick={commitPromotion} disabled={promoCommitting || !promoName.trim()}>
                        <Icon name="refresh-cw" size={16} /> {promoCommitting ? 'Promoting…' : 'Confirm promotion'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── slot editor dialog ── */}
      <Dialog
        open={slotDialog !== null}
        onClose={() => setSlotDialog(null)}
        title={slotDialog?.slot ? `Edit slot — ${DAY_NAMES[slotDialog.slot.dayOfWeek]} P${slotDialog.slot.periodNo}` : `New slot — ${slotDialog ? DAY_NAMES[slotDialog.day] : ''} P${slotDialog?.period ?? ''}`}
        footer={
          <>
            {slotDialog?.slot && (
              <Button variant="danger" onClick={() => { setSlotDialog(null); void deleteSlot(slotDialog.slot!); }}>
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => setSlotDialog(null)}>Cancel</Button>
            <Button onClick={() => saveSlot(false)}>Save slot</Button>
          </>
        }
      >
        <FormGrid>
          <Select label="Day" value={String(slotForm.dayOfWeek)} onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: Number(e.target.value) })} options={WEEKDAYS.map((d) => ({ value: String(d), label: DAY_NAMES[d] }))} />
          <Select label="Period" value={String(slotForm.periodNo)} onChange={(e) => setSlotForm({ ...slotForm, periodNo: Number(e.target.value) })} options={Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Period ${i + 1}` }))} />
          <Select label="Subject" required value={slotForm.subjectId} onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })} placeholder="Select subject" options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} />
          <Select label="Teacher" required value={slotForm.teacherId} onChange={(e) => setSlotForm({ ...slotForm, teacherId: e.target.value })} placeholder="Select teacher" options={teachers.map((t) => ({ value: t.id, label: t.name }))} />
          <Input label="Room" value={slotForm.room} onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })} placeholder="e.g. R-5A" maxLength={20} />
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <Input label="Start" required type="time" value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} />
            <Input label="End" required type="time" value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} />
          </div>
        </FormGrid>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          If the teacher is already booked the same day and period in another section, you will be asked to confirm an override.
        </p>
      </Dialog>

      {/* ── copy week dialog ── */}
      <Dialog
        open={copyDialog}
        onClose={() => setCopyDialog(false)}
        title="Copy timetable week"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyDialog(false)}>Cancel</Button>
            <Button onClick={copyWeek} disabled={!copyTargetId}>Copy week</Button>
          </>
        }
      >
        <Select
          label="Copy to section"
          value={copyTargetId}
          onChange={(e) => setCopyTargetId(e.target.value)}
          placeholder="Select target section"
          options={allSections.filter((s) => s.id !== ttSectionId).map((s) => ({ value: s.id, label: `${s.gradeName} - ${s.name} (${s.slotCount} slots)` }))}
          hint="Replaces the target section's whole week with this section's timetable."
        />
      </Dialog>
    </div>
  );
}
