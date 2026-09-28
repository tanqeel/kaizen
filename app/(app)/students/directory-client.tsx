'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, CardContent, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { StudentRow } from '@/app/api/students/route';

interface GradeOption {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
}

function gateBadge(status: StudentRow['gateToday']) {
  if (status === 'IN') return <Badge variant="present">In campus</Badge>;
  if (status === 'OUT') return <Badge variant="info">Checked out</Badge>;
  return <Badge variant="neutral">Not arrived</Badge>;
}

export function StudentDirectoryClient({ grades }: { grades: GradeOption[] }) {
  const [q, setQ] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleSections = useMemo(() => {
    if (!gradeId) return grades.flatMap((g) => g.sections.map((s) => ({ ...s, grade: g.name })));
    return grades.find((g) => g.id === gradeId)?.sections ?? [];
  }, [grades, gradeId]);

  const fetchRows = useCallback(async (params: { q: string; gradeId: string; sectionId: string }) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (params.q) sp.set('q', params.q);
      if (params.gradeId) sp.set('gradeId', params.gradeId);
      if (params.sectionId) sp.set('sectionId', params.sectionId);
      const res = await fetch(`/api/students?${sp.toString()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setRows(data.students ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load students');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchRows({ q, gradeId, sectionId }), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, gradeId, sectionId, fetchRows]);

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Search"
            placeholder="Name or admission no…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search students"
          />
          <Select
            label="Grade"
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setSectionId('');
            }}
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            placeholder="All grades"
          />
          <Select
            label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            options={visibleSections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))}
            placeholder="All sections"
          />
          <div className="flex items-end">
            <p className="tnum pb-3 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              {loading ? 'Loading…' : `${rows.length} student${rows.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="users"
              title="No students match"
              guidance="No active students match these filters. Try clearing the search or picking a different grade/section."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="thead-sticky">
                <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Adm. no</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Name</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Grade / Section</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Parent phone</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Today&apos;s gate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="tnum px-4 py-3 font-medium text-slate-900 dark:text-white">{r.admissionNo}</td>
                    <td className="px-4 py-3">
                      <Link href={`/students/${r.id}`} className="inline-block min-h-[44px] py-2 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {r.grade} · Sec {r.section}
                    </td>
                    <td className="px-4 py-3">
                      {r.parentPhone ? (
                        <a href={`tel:${r.parentPhone}`} className="tnum inline-flex min-h-[44px] items-center gap-1.5 text-brand-700 dark:text-brand-300">
                          <Icon name="phone" size={15} /> {r.parentPhone}
                        </a>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{gateBadge(r.gateToday)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
