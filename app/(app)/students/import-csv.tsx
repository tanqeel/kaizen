'use client';

import { useRef, useState } from 'react';
import { Badge, Button, Dialog } from '@/components/ui';
import { Icon } from '@/components/icons';

interface Preview {
  name: string;
  admissionNo: string;
  gender: string | null;
  dob: string | null;
  phone: string | null;
  grade: string;
  section: string;
  parentName: string | null;
  parentPhone: string | null;
}

interface RowResult {
  row: number;
  errors: string[];
  preview: Preview;
}

interface DryRunResult {
  valid: number;
  invalid: number;
  rows: RowResult[];
}

interface CommitResult {
  created: number;
  skipped: Array<{ row: number; errors: string[] }>;
}

const SAMPLE_CSV = [
  'name,admissionNo,gender,dob,phone,grade,section,parentName,parentPhone',
  'Ahmed Raza,KZN-2026-0001,Male,2015-03-12,,Grade 1,A,Bilal Raza,03007654321',
  'Fatima Noor,KZN-2026-0002,Female,2014-11-02,,Grade 1,A,,',
].join('\n');

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'students-import-sample.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** "Import CSV" button + dialog for the students directory. */
export function StudentImportCsv({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dry, setDry] = useState<DryRunResult | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);

  const reset = () => {
    setFileName('');
    setCsv(null);
    setError(null);
    setDry(null);
    setDone(null);
    setBusy(false);
    setCommitting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pickFile = async (f: File | undefined) => {
    setError(null);
    setDry(null);
    setDone(null);
    if (!f) {
      setCsv(null);
      setFileName('');
      return;
    }
    if (f.size > 500 * 1024) {
      setError('File is too large (max 500 KB)');
      return;
    }
    const text = await f.text();
    setCsv(text);
    setFileName(f.name);
  };

  const post = async (dryRun: boolean) => {
    const res = await fetch('/api/students/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, dryRun }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
    return data;
  };

  const runDryRun = async () => {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      const data = await post(true);
      setDry({ valid: data.valid ?? 0, invalid: data.invalid ?? 0, rows: data.rows ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!csv) return;
    setCommitting(true);
    setError(null);
    try {
      const data = await post(false);
      setDone({ created: data.created ?? 0, skipped: data.skipped ?? [] });
      setDry(null);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  const footer = done ? (
    <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Close</Button>
  ) : dry ? (
    <>
      <Button variant="secondary" onClick={() => setDry(null)}>Back</Button>
      <Button onClick={commit} loading={committing} disabled={dry.valid === 0}>
        <Icon name="check" size={18} /> Import {dry.valid} valid row{dry.valid === 1 ? '' : 's'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
      <Button onClick={runDryRun} loading={busy} disabled={!csv}>
        <Icon name="clipboard-check" size={18} /> Validate
      </Button>
    </>
  );

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        onClick={() => { reset(); setOpen(true); }}
      >
        <Icon name="plus" size={18} /> Import CSV
      </Button>
      <Dialog
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Import students from CSV"
        size="lg"
        footer={footer}
      >
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        {done ? (
          <div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <Icon name="check" size={20} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Created {done.created} student{done.created === 1 ? '' : 's'}
                {done.skipped.length > 0 && ` · ${done.skipped.length} skipped`}
              </p>
            </div>
            {done.skipped.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Skipped rows</p>
                <ul className="space-y-2">
                  {done.skipped.map((s) => (
                    <li key={s.row} className="rounded-lg bg-rose-50 px-3 py-2 text-sm dark:bg-rose-500/10">
                      <span className="font-semibold text-rose-800 dark:text-rose-200">Row {s.row}: </span>
                      <span className="text-rose-700 dark:text-rose-300">{s.errors.join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : dry ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="present">{dry.valid} valid</Badge>
              <Badge variant="absent">{dry.invalid} invalid</Badge>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only fully valid rows will be imported. Nothing has been saved yet.
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="thead-sticky">
                  <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                    <th scope="col" className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Row</th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Name</th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Adm. no</th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Class</th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Parent</th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {dry.rows.map((r) => (
                    <tr
                      key={r.row}
                      className={
                        r.errors.length > 0
                          ? 'border-b border-slate-200 bg-rose-50 last:border-0 dark:border-slate-800 dark:bg-rose-500/10'
                          : 'border-b border-slate-200 last:border-0 dark:border-slate-800'
                      }
                    >
                      <td className="tnum px-3 py-2 text-slate-500 dark:text-slate-400">{r.row}</td>
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{r.preview.name || '—'}</td>
                      <td className="tnum px-3 py-2 text-slate-700 dark:text-slate-200">{r.preview.admissionNo || '—'}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {r.preview.grade && r.preview.section ? `${r.preview.grade} · Sec ${r.preview.section}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {r.preview.parentName || r.preview.parentPhone
                          ? `${r.preview.parentName ?? '—'}${r.preview.parentPhone ? ` · ${r.preview.parentPhone}` : ''}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {r.errors.length > 0 ? (
                          <ul className="list-disc space-y-0.5 pl-4 text-xs text-rose-700 dark:text-rose-300">
                            {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        ) : (
                          <Badge variant="present">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="import-csv-file" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                CSV file
              </label>
              <input
                ref={fileRef}
                id="import-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => pickFile(e.target.files?.[0])}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700"
              />
              {fileName && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selected: {fileName}</p>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Expected columns</p>
              <p className="tnum text-xs leading-relaxed">
                <span className="font-semibold">name, admissionNo</span> (required) · gender · dob (YYYY-MM-DD) ·{' '}
                <span className="font-semibold">grade, section</span> (required, must match existing grade/section names) · parentName · parentPhone
              </p>
              <p className="mt-2 text-xs">
                Blank optional fields are left blank. Rows with any error are skipped, not guessed.{' '}
                Note: the <span className="tnum">phone</span> column is not stored (student records have no phone field) — put contact numbers in parentPhone.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadSample}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              <Icon name="download" size={16} /> Download sample CSV
            </button>
          </div>
        )}
      </Dialog>
    </>
  );
}
