'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState,
  FormGrid, Input, Select, Table, TBody, TD, TH, THead, Tabs, TabPanel, TRow, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate } from '@/lib/format';
import { gradeBand } from '@/lib/exams';

/* ---------------------------------- types --------------------------------- */

export interface TermLite { id: string; name: string; startDate: string; endDate: string; }
export interface SubjectLite { id: string; name: string; code: string; }
export interface GradeLite { id: string; name: string; level: number; }

interface ScheduleLite {
  id: string; termId: string; term: string; subjectId: string; subject: string;
  gradeId: string; grade: string; date: string; startTime: string;
  totalMarks: number; resultCount: number; deletable: boolean;
}

interface EntryStudent { id: string; name: string; admissionNo: string; section: string; }
interface EntryResult { studentId: string; obtainedMarks: number; remarks: string | null; }
interface EntryData {
  schedule: { id: string; subject: string; grade: string; term: string; totalMarks: number };
  students: EntryStudent[];
  results: EntryResult[];
}

interface ReportRow {
  subject: string; obtained: number | null; total: number;
  pct: number | null; grade: string | null; remarks: string | null;
}
interface ReportData {
  student: { name: string; admissionNo: string; grade: string; section: string };
  term: { name: string; session: string };
  school: { name: string; address: string | null; phone: string | null } | null;
  rows: ReportRow[];
  enteredCount: number; totalSubjects: number;
  overall: { pct: number; grade: string; totalObtained: number; totalMarks: number } | null;
}

interface RepStudent { id: string; name: string; admissionNo: string; grade: string; section: string; }

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, data };
}

const BANDS = ['A+', 'A', 'B', 'C', 'D', 'F'];
const BAND_TONE: Record<string, string> = {
  'A+': 'bg-emerald-500', A: 'bg-emerald-400', B: 'bg-lime-400',
  C: 'bg-amber-400', D: 'bg-orange-400', F: 'bg-rose-500',
};

/* --------------------------------- component ------------------------------- */

export function ExamsClient({
  canManage, manageableGradeIds, initialTerms, subjects, grades,
}: {
  canManage: boolean;
  manageableGradeIds: string[] | null;
  initialTerms: TermLite[];
  subjects: SubjectLite[];
  grades: GradeLite[];
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState('terms');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string | null, isError: boolean) => {
    if (isError) { setError(msg); setNotice(null); }
    else { setNotice(msg); setError(null); }
  };

  const gradeOptions = useMemo(
    () => grades.filter((g) => !manageableGradeIds || manageableGradeIds.includes(g.id)),
    [grades, manageableGradeIds],
  );

  /* ------------------------------- terms tab ------------------------------- */

  const [terms, setTerms] = useState<TermLite[]>(initialTerms);
  const [newTerm, setNewTerm] = useState({ name: '', startDate: '', endDate: '' });

  const refreshTerms = useCallback(async () => {
    const r = await api('/api/exams/terms', 'GET');
    if (r.ok) setTerms((r.data.terms as Array<Record<string, unknown>>).map((t) => ({
      id: String(t.id), name: String(t.name),
      startDate: String(t.startDate).slice(0, 10), endDate: String(t.endDate).slice(0, 10),
    })));
  }, []);

  const addTerm = async () => {
    flash(null, false);
    const r = await api('/api/exams/terms', 'POST', newTerm);
    if (!r.ok) { flash(String(r.data.error ?? 'Could not create term'), true); return; }
    setNewTerm({ name: '', startDate: '', endDate: '' });
    await refreshTerms();
    flash('Exam term created.', false);
  };

  const deleteTerm = async (t: TermLite) => {
    if (!(await confirm({ title: 'Delete exam term', message: `Delete "${t.name}"? Only possible when it has no scheduled exams.`, confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/exams/terms/${t.id}`, 'DELETE');
    if (!r.ok) { flash(String(r.data.error ?? 'Could not delete term'), true); return; }
    await refreshTerms();
    flash(`Term "${t.name}" deleted.`, false);
  };

  /* ------------------------------ schedule tab ----------------------------- */

  const [schedules, setSchedules] = useState<ScheduleLite[]>([]);
  const [schedTermFilter, setSchedTermFilter] = useState('');
  const [newSched, setNewSched] = useState({ examTermId: '', subjectId: '', gradeId: '', date: '', startTime: '', totalMarks: '100' });

  const refreshSchedules = useCallback(async (termId: string) => {
    const r = await api(`/api/exams/schedules${termId ? `?termId=${termId}` : ''}`, 'GET');
    if (r.ok) {
      setSchedules(((r.data.schedules ?? []) as Array<Record<string, unknown>>).map((s) => ({
        id: String(s.id), termId: String(s.termId), term: String(s.term),
        subjectId: String(s.subjectId), subject: String(s.subject),
        gradeId: String(s.gradeId), grade: String(s.grade),
        date: String(s.date), startTime: String(s.startTime), totalMarks: Number(s.totalMarks),
        resultCount: Number(s.resultCount), deletable: Boolean(s.deletable),
      })));
    }
  }, []);

  useEffect(() => { void refreshSchedules(schedTermFilter); }, [schedTermFilter, refreshSchedules]);

  const addSchedule = async () => {
    flash(null, false);
    const r = await api('/api/exams/schedules', 'POST', { ...newSched, totalMarks: Number(newSched.totalMarks) });
    if (!r.ok) { flash(String(r.data.error ?? 'Could not schedule exam'), true); return; }
    setNewSched({ examTermId: '', subjectId: '', gradeId: '', date: '', startTime: '', totalMarks: '100' });
    await refreshSchedules(schedTermFilter);
    flash('Exam scheduled.', false);
  };

  const deleteSchedule = async (s: ScheduleLite) => {
    if (!(await confirm({ title: 'Delete scheduled exam', message: `Delete ${s.subject} (${s.grade}) on ${pktDate(s.date)}? Only possible when no results are entered.`, confirmLabel: 'Delete' }))) return;
    const r = await api(`/api/exams/schedules/${s.id}`, 'DELETE');
    if (!r.ok) { flash(String(r.data.error ?? 'Could not delete schedule'), true); return; }
    await refreshSchedules(schedTermFilter);
    flash('Scheduled exam deleted.', false);
  };

  const schedulesByTerm = useMemo(() => {
    const map = new Map<string, { term: string; items: ScheduleLite[] }>();
    for (const s of schedules) {
      const g = map.get(s.termId) ?? { term: s.term, items: [] };
      g.items.push(s);
      map.set(s.termId, g);
    }
    return [...map.entries()];
  }, [schedules]);

  /* ------------------------------ results tab ------------------------------ */

  const [resultsView, setResultsView] = useState<'entry' | 'report'>('entry');
  const [entryTermId, setEntryTermId] = useState('');
  const [entrySchedules, setEntrySchedules] = useState<ScheduleLite[]>([]);
  const [entryScheduleId, setEntryScheduleId] = useState('');
  const [entry, setEntry] = useState<EntryData | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entryTermId) { setEntrySchedules([]); return; }
    void (async () => {
      const r = await api(`/api/exams/schedules?termId=${entryTermId}`, 'GET');
      if (r.ok) setEntrySchedules((r.data.schedules as ScheduleLite[]).map((s) => ({ ...s })));
    })();
  }, [entryTermId]);

  const loadEntry = useCallback(async (scheduleId: string) => {
    setEntryScheduleId(scheduleId);
    if (!scheduleId) { setEntry(null); return; }
    setEntryLoading(true);
    const r = await api(`/api/exams/results?scheduleId=${scheduleId}`, 'GET');
    setEntryLoading(false);
    if (!r.ok) { flash(String(r.data.error ?? 'Could not load result grid'), true); setEntry(null); return; }
    const data = r.data as unknown as EntryData;
    setEntry(data);
    const m: Record<string, string> = {};
    const rem: Record<string, string> = {};
    for (const res of data.results) {
      m[res.studentId] = String(res.obtainedMarks);
      if (res.remarks) rem[res.studentId] = res.remarks;
    }
    setMarks(m);
    setRemarks(rem);
    setRowErrors({});
  }, []);

  const saveResults = async () => {
    if (!entry) return;
    flash(null, false);
    const total = entry.schedule.totalMarks;
    const errs: Record<string, string> = {};
    const rows: Array<{ studentId: string; obtainedMarks: number; remarks?: string }> = [];
    for (const st of entry.students) {
      const raw = (marks[st.id] ?? '').trim();
      if (raw === '') continue; // untouched rows are not saved
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > total) {
        errs[st.id] = `Must be a whole number 0–${total}`;
        continue;
      }
      rows.push({ studentId: st.id, obtainedMarks: n, remarks: (remarks[st.id] ?? '').trim() || undefined });
    }
    setRowErrors(errs);
    if (Object.keys(errs).length > 0) {
      flash('Fix the highlighted rows — nothing was saved.', true);
      return;
    }
    if (rows.length === 0) { flash('No marks entered — nothing to save.', true); return; }
    setSaving(true);
    const r = await api('/api/exams/results', 'POST', { scheduleId: entry.schedule.id, rows });
    setSaving(false);
    if (!r.ok) {
      const serverErrs = (r.data.errors as Array<{ studentId: string; error: string }> | undefined) ?? [];
      const map: Record<string, string> = {};
      for (const e of serverErrs) map[e.studentId] = e.error;
      setRowErrors(map);
      flash(String(r.data.error ?? 'Could not save results'), true);
      return;
    }
    flash(`Saved ${String(r.data.saved)} result(s).`, false);
    await loadEntry(entry.schedule.id);
  };

  // Analytics: grade distribution + toppers from entered results.
  const distribution = useMemo(() => {
    if (!entry) return null;
    const counts: Record<string, number> = Object.fromEntries(BANDS.map((b) => [b, 0]));
    for (const res of entry.results) {
      const pct = entry.schedule.totalMarks > 0 ? (res.obtainedMarks / entry.schedule.totalMarks) * 100 : 0;
      counts[gradeBand(pct)] += 1;
    }
    return counts;
  }, [entry]);

  const toppers = useMemo(() => {
    if (!entry) return [];
    const nameOf = new Map(entry.students.map((s) => [s.id, s]));
    return entry.results
      .slice()
      .sort((a, b) => b.obtainedMarks - a.obtainedMarks)
      .slice(0, 5)
      .map((r, i) => ({ rank: i + 1, student: nameOf.get(r.studentId), marks: r.obtainedMarks }));
  }, [entry]);

  const exportCsv = () => {
    if (!entry) return;
    const resById = new Map(entry.results.map((r) => [r.studentId, r]));
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ['Admission No', 'Student', 'Section', 'Subject', 'Term', 'Obtained', 'Total', 'Grade', 'Remarks'].map(esc).join(','),
      ...entry.students.map((s) => {
        const r = resById.get(s.id);
        const pct = r ? (r.obtainedMarks / entry.schedule.totalMarks) * 100 : null;
        return [
          esc(s.admissionNo), esc(s.name), esc(s.section),
          esc(entry.schedule.subject), esc(entry.schedule.term),
          r ? r.obtainedMarks : '', entry.schedule.totalMarks,
          pct === null ? '' : gradeBand(pct),
          esc(r?.remarks ?? ''),
        ].join(',');
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `results-${entry.schedule.subject}-${entry.schedule.grade}-${entry.schedule.term}.csv`.replace(/\s+/g, '-');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  /* ------------------------------ report card ------------------------------ */

  const [repGradeId, setRepGradeId] = useState('');
  const [repStudents, setRepStudents] = useState<RepStudent[]>([]);
  const [repStudentId, setRepStudentId] = useState('');
  const [repTermId, setRepTermId] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    setRepStudents([]);
    setRepStudentId('');
    setReport(null);
    if (!repGradeId && manageableGradeIds === null) {
      // No grade filter and unrestricted: load a capped list via grade-less call is not supported;
      // require a grade selection for admins to keep the picker honest.
      return;
    }
    void (async () => {
      const r = await api(`/api/exams/students${repGradeId ? `?gradeId=${repGradeId}` : ''}`, 'GET');
      if (r.ok) setRepStudents(r.data.students as RepStudent[]);
    })();
  }, [repGradeId, manageableGradeIds]);

  const loadReport = async () => {
    if (!repStudentId || !repTermId) return;
    setReportLoading(true);
    const r = await api(`/api/exams/report-card?studentId=${repStudentId}&termId=${repTermId}`, 'GET');
    setReportLoading(false);
    if (!r.ok) { flash(String(r.data.error ?? 'Could not load report card'), true); setReport(null); return; }
    setReport(r.data as unknown as ReportData);
  };

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

      <div className="no-print">
        <Tabs
          tabs={[
            { id: 'terms', label: 'Terms', icon: 'calendar-days' },
            { id: 'schedule', label: 'Schedule', icon: 'clock' },
            { id: 'results', label: 'Results', icon: 'award' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Exams sections"
        />
      </div>

      {/* ── Terms ── */}
      <TabPanel id="terms" active={tab === 'terms'} className="mt-6">
        <Card>
          <CardHeader><CardTitle>Exam terms</CardTitle></CardHeader>
          <CardContent>
            {terms.length === 0 ? (
              <EmptyState icon="calendar-days" title="No exam terms yet" guidance="Create your first exam term (e.g. First Term) to start scheduling papers." />
            ) : (
              <Table>
                <THead><TRow><TH>Term</TH><TH>Starts</TH><TH>Ends</TH>{canManage && <TH><span className="sr-only">Actions</span></TH>}</TRow></THead>
                <TBody>
                  {terms.map((t) => (
                    <TRow key={t.id}>
                      <TD className="font-medium">{t.name}</TD>
                      <TD className="tnum">{pktDate(t.startDate)}</TD>
                      <TD className="tnum">{pktDate(t.endDate)}</TD>
                      {canManage && (
                        <TD className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => deleteTerm(t)} aria-label={`Delete term ${t.name}`}>
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
                <Input label="Term name" required value={newTerm.name} onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })} placeholder="e.g. Second Term" className="min-w-[180px] flex-1" maxLength={60} />
                <Input label="Start date" required type="date" value={newTerm.startDate} onChange={(e) => setNewTerm({ ...newTerm, startDate: e.target.value })} />
                <Input label="End date" required type="date" value={newTerm.endDate} onChange={(e) => setNewTerm({ ...newTerm, endDate: e.target.value })} />
                <Button onClick={addTerm} disabled={!newTerm.name.trim() || !newTerm.startDate || !newTerm.endDate}>
                  <Icon name="plus" size={16} /> Add term
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── Schedule ── */}
      <TabPanel id="schedule" active={tab === 'schedule'} className="mt-6 space-y-6">
        {canManage && (
          <Card className="no-print">
            <CardHeader><CardTitle>Schedule a paper</CardTitle></CardHeader>
            <CardContent>
              <FormGrid>
                <Select label="Term" required value={newSched.examTermId} onChange={(e) => setNewSched({ ...newSched, examTermId: e.target.value })} placeholder="Select term" options={terms.map((t) => ({ value: t.id, label: t.name }))} />
                <Select label="Subject" required value={newSched.subjectId} onChange={(e) => setNewSched({ ...newSched, subjectId: e.target.value })} placeholder="Select subject" options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} />
                <Select label="Grade" required value={newSched.gradeId} onChange={(e) => setNewSched({ ...newSched, gradeId: e.target.value })} placeholder="Select grade" options={gradeOptions.map((g) => ({ value: g.id, label: g.name }))} />
                <Input label="Date" required type="date" value={newSched.date} onChange={(e) => setNewSched({ ...newSched, date: e.target.value })} />
                <Input label="Start time" required type="time" value={newSched.startTime} onChange={(e) => setNewSched({ ...newSched, startTime: e.target.value })} />
                <Input label="Total marks" required type="number" min={1} max={1000} value={newSched.totalMarks} onChange={(e) => setNewSched({ ...newSched, totalMarks: e.target.value })} />
              </FormGrid>
              <Button
                className="mt-3"
                onClick={addSchedule}
                disabled={!newSched.examTermId || !newSched.subjectId || !newSched.gradeId || !newSched.date || !newSched.startTime}
              >
                <Icon name="plus" size={16} /> Schedule paper
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Date sheet</CardTitle>
              <div className="no-print flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Filter by term"
                  className="min-w-[180px]"
                  value={schedTermFilter}
                  onChange={(e) => setSchedTermFilter(e.target.value)}
                  options={[{ value: '', label: 'All terms' }, ...terms.map((t) => ({ value: t.id, label: t.name }))]}
                />
                <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={schedules.length === 0}>
                  <Icon name="printer" size={16} /> Print date sheet
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <EmptyState icon="clock" title="Nothing scheduled yet" guidance="Scheduled papers appear here grouped by exam term. Use the form above to schedule the first paper." />
            ) : (
              <div className="space-y-6">
                {schedulesByTerm.map(([termId, group]) => (
                  <div key={termId}>
                    <h3 className="mb-2 text-sm font-bold text-slate-900 uppercase tracking-wide dark:text-white">{group.term}</h3>
                    <Table>
                      <THead><TRow><TH>Date</TH><TH>Subject</TH><TH>Grade</TH><TH>Start</TH><TH>Marks</TH><TH>Results</TH>{canManage && <TH className="no-print"><span className="sr-only">Actions</span></TH>}</TRow></THead>
                      <TBody>
                        {group.items.map((s) => (
                          <TRow key={s.id}>
                            <TD className="tnum font-medium">{pktDate(s.date)}</TD>
                            <TD>{s.subject}</TD>
                            <TD>{s.grade}</TD>
                            <TD className="tnum">{s.startTime}</TD>
                            <TD className="tnum">{s.totalMarks}</TD>
                            <TD className="tnum">{s.resultCount > 0 ? s.resultCount : '—'}</TD>
                            {canManage && (
                              <TD className="no-print text-right">
                                <Button variant="ghost" size="sm" onClick={() => deleteSchedule(s)} aria-label={`Delete ${s.subject} schedule`}>
                                  <Icon name="x" size={16} />
                                </Button>
                              </TD>
                            )}
                          </TRow>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── Results ── */}
      <TabPanel id="results" active={tab === 'results'} className="mt-6 space-y-6">
        <div className="no-print flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(['entry', 'report'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setResultsView(v)}
              aria-pressed={resultsView === v}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${resultsView === v ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
            >
              <Icon name={v === 'entry' ? 'clipboard-check' : 'id-card'} size={16} />
              {v === 'entry' ? 'Result entry' : 'Report card'}
            </button>
          ))}
        </div>

        {resultsView === 'entry' ? (
          <>
            {canManage ? (
              <Card className="no-print">
                <CardHeader><CardTitle>Pick a paper</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                  <Select label="Term" className="min-w-[180px]" value={entryTermId} onChange={(e) => { setEntryTermId(e.target.value); setEntryScheduleId(''); setEntry(null); }} placeholder="Select term" options={terms.map((t) => ({ value: t.id, label: t.name }))} />
                  <Select label="Paper" className="min-w-[260px] flex-1" value={entryScheduleId} onChange={(e) => loadEntry(e.target.value)} placeholder={entryTermId ? 'Select paper' : 'Select a term first'} options={entrySchedules.map((s) => ({ value: s.id, label: `${s.subject} · ${s.grade} · ${pktDate(s.date)} (${s.totalMarks} marks)` }))} />
                </CardContent>
              </Card>
            ) : (
              <EmptyState icon="clipboard-check" title="Result entry is restricted" guidance="Entering results needs the exams.manage permission (teachers, principal, admin)." />
            )}

            {canManage && entryLoading && <p className="py-8 text-center text-sm text-slate-500">Loading grid…</p>}

            {canManage && entry && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle>
                        {entry.schedule.subject} · {entry.schedule.grade} · {entry.schedule.term}
                        <span className="tnum ml-2 text-sm font-normal text-slate-500">({entry.schedule.totalMarks} marks)</span>
                      </CardTitle>
                      <div className="no-print flex gap-2">
                        <Button variant="secondary" size="sm" onClick={exportCsv}>
                          <Icon name="download" size={16} /> CSV
                        </Button>
                        <Button size="sm" onClick={saveResults} loading={saving}>
                          <Icon name="check" size={16} /> Save all
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {entry.students.length === 0 ? (
                      <EmptyState icon="users" title="No students in scope" guidance="No students of this grade are visible to your account." />
                    ) : (
                      <Table>
                        <THead><TRow><TH>Student</TH><TH>Section</TH><TH>Obtained / {entry.schedule.totalMarks}</TH><TH>Remarks</TH></TRow></THead>
                        <TBody>
                          {entry.students.map((st) => (
                            <TRow key={st.id}>
                              <TD className="font-medium">{st.name}<span className="block text-xs font-normal text-slate-400">{st.admissionNo}</span></TD>
                              <TD>{st.section}</TD>
                              <TD>
                                <input
                                  type="number"
                                  min={0}
                                  max={entry.schedule.totalMarks}
                                  value={marks[st.id] ?? ''}
                                  onChange={(e) => setMarks({ ...marks, [st.id]: e.target.value })}
                                  aria-label={`Obtained marks for ${st.name}`}
                                  aria-invalid={rowErrors[st.id] ? true : undefined}
                                  className={`tnum min-h-[44px] w-28 rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${rowErrors[st.id] ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'}`}
                                />
                                {rowErrors[st.id] && <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{rowErrors[st.id]}</p>}
                              </TD>
                              <TD>
                                <input
                                  type="text"
                                  value={remarks[st.id] ?? ''}
                                  onChange={(e) => setRemarks({ ...remarks, [st.id]: e.target.value })}
                                  aria-label={`Remarks for ${st.name}`}
                                  placeholder="Optional"
                                  maxLength={200}
                                  className="min-h-[44px] w-full min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </TD>
                            </TRow>
                          ))}
                        </TBody>
                      </Table>
                    )}
                    <p className="no-print mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Rows left blank are skipped — existing saved marks are kept. Marks must be whole numbers from 0 to {entry.schedule.totalMarks}.
                    </p>
                  </CardContent>
                </Card>

                {distribution && entry.results.length > 0 && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle>Grade distribution</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {BANDS.map((b) => {
                          const n = distribution[b];
                          const pctW = entry.results.length > 0 ? (n / entry.results.length) * 100 : 0;
                          return (
                            <div key={b} className="flex items-center gap-3">
                              <span className="tnum w-8 text-sm font-bold text-slate-700 dark:text-slate-200">{b}</span>
                              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className={`h-full rounded-full ${BAND_TONE[b]}`} style={{ width: `${pctW}%` }} />
                              </div>
                              <span className="tnum w-16 text-right text-sm text-slate-500">{n} ({Math.round(pctW)}%)</span>
                            </div>
                          );
                        })}
                        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">{entry.results.length} of {entry.students.length} students entered.</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle>Top performers</CardTitle></CardHeader>
                      <CardContent>
                        {toppers.length === 0 ? (
                          <p className="text-sm text-slate-500">No results entered yet.</p>
                        ) : (
                          <ol className="divide-y divide-slate-200 dark:divide-slate-800">
                            {toppers.map((t) => (
                              <li key={t.student?.id ?? t.rank} className="flex items-center gap-3 py-2.5">
                                <span className="tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{t.rank}</span>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">{t.student?.name ?? '—'}</span>
                                <span className="tnum text-sm font-bold text-slate-700 dark:text-slate-200">{t.marks}<span className="font-normal text-slate-400">/{entry.schedule.totalMarks}</span></span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* ── report card view ── */
          <>
            <Card className="no-print">
              <CardHeader><CardTitle>Report card</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <Select label="Grade" className="min-w-[160px]" value={repGradeId} onChange={(e) => setRepGradeId(e.target.value)} placeholder="Select grade" options={gradeOptions.map((g) => ({ value: g.id, label: g.name }))} />
                <Select label="Student" className="min-w-[220px] flex-1" value={repStudentId} onChange={(e) => setRepStudentId(e.target.value)} placeholder={repStudents.length ? 'Select student' : 'Select a grade first'} options={repStudents.map((s) => ({ value: s.id, label: `${s.name} (${s.grade}-${s.section})` }))} />
                <Select label="Term" className="min-w-[180px]" value={repTermId} onChange={(e) => setRepTermId(e.target.value)} placeholder="Select term" options={terms.map((t) => ({ value: t.id, label: t.name }))} />
                <Button onClick={loadReport} disabled={!repStudentId || !repTermId} loading={reportLoading}>
                  <Icon name="eye" size={16} /> View
                </Button>
              </CardContent>
            </Card>

            {report && (
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-6 text-center">
                    {report.school && (
                      <>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{report.school.name}</h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {[report.school.address, report.school.phone].filter(Boolean).join(' · ')}
                        </p>
                      </>
                    )}
                    <p className="mt-3 text-sm font-bold tracking-wide text-brand-700 uppercase dark:text-brand-300">
                      Report Card — {report.term.name} ({report.term.session})
                    </p>
                    <div className="tnum mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <span><strong className="text-slate-900 dark:text-white">{report.student.name}</strong></span>
                      <span>{report.student.admissionNo}</span>
                      <span>{report.student.grade} - {report.student.section}</span>
                    </div>
                  </div>

                  {report.rows.length === 0 ? (
                    <EmptyState icon="award" title="No papers scheduled" guidance={`No exam papers were scheduled for ${report.student.grade} in ${report.term.name}.`} />
                  ) : report.enteredCount === 0 ? (
                    <EmptyState icon="award" title="No results recorded for this term yet" guidance="Papers are scheduled but teachers have not entered any marks for this student." />
                  ) : (
                    <>
                      <Table>
                        <THead><TRow><TH>Subject</TH><TH>Obtained</TH><TH>Total</TH><TH>%</TH><TH>Grade</TH><TH>Remarks</TH></TRow></THead>
                        <TBody>
                          {report.rows.map((r) => (
                            <TRow key={r.subject}>
                              <TD className="font-medium">{r.subject}</TD>
                              <TD className="tnum">{r.obtained === null ? '—' : r.obtained}</TD>
                              <TD className="tnum">{r.total}</TD>
                              <TD className="tnum">{r.pct === null ? '—' : `${r.pct}%`}</TD>
                              <TD>{r.grade === null ? <Badge variant="neutral">Not entered</Badge> : <Badge variant={r.grade === 'F' ? 'absent' : 'info'}>{r.grade}</Badge>}</TD>
                              <TD className="max-w-[200px] truncate">{r.remarks ?? '—'}</TD>
                            </TRow>
                          ))}
                          {report.overall && (
                            <TRow className="bg-slate-50 dark:bg-slate-800/60">
                              <TD className="font-bold">Overall</TD>
                              <TD className="tnum font-bold">{report.overall.totalObtained}</TD>
                              <TD className="tnum font-bold">{report.overall.totalMarks}</TD>
                              <TD className="tnum font-bold">{report.overall.pct}%</TD>
                              <TD><Badge variant={report.overall.grade === 'F' ? 'absent' : 'present'}>{report.overall.grade}</Badge></TD>
                              <TD className="text-xs text-slate-500">{report.enteredCount} of {report.totalSubjects} papers entered</TD>
                            </TRow>
                          )}
                        </TBody>
                      </Table>
                      <div className="no-print mt-4 flex justify-end">
                        <Button variant="secondary" onClick={() => window.print()}>
                          <Icon name="printer" size={16} /> Print report card
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </TabPanel>
    </div>
  );
}
