'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Input, EmptyState } from '@/components/ui';
import { safeJson } from '@/lib/api-client';

interface SearchHit {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
  parents: string;
}

/** Support-mode child picker for SUPER_ADMIN / PRINCIPAL. */
export function SupportPicker() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/portal/students?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = (await safeJson(res)) as { students: SearchHit[] };
        setHits(data.students);
      }
      setSearched(true);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-xl">
      <Input
        label="Find a child"
        placeholder="Type at least 2 letters of the name or admission no."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        hint="Searches active students by name or admission number."
      />
      {searched && hits.length === 0 && (
        <EmptyState
          icon="search"
          title="No students found"
          guidance={`Nothing matches "${q.trim()}". Check the spelling or admission number.`}
          className="mt-4"
        />
      )}
      {hits.length > 0 && (
        <ul className="mt-4 space-y-2">
          {hits.map((h) => (
            <li key={h.id}>
              <Link
                href={`/portal?studentId=${h.id}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {h.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {h.class} · {h.admissionNo}
                    {h.parents ? ` · Parent: ${h.parents}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-300">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
