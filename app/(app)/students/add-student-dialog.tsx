'use client';

import { useState } from 'react';
import { Button, Dialog, Input, Select, Textarea } from '@/components/ui';
import { Icon } from '@/components/icons';
import { safeJson } from '@/lib/api-client';

interface GradeOption {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
}

interface Props {
  grades: GradeOption[];
  shifts: Array<{ id: string; name: string }>;
  sessions: Array<{ id: string; name: string }>;
  onDone: () => void;
}

export function AddStudentDialog({ grades, shifts, sessions, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? '');
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bForm, setBForm] = useState('');
  const [address, setAddress] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const sections = grades.find((g) => g.id === gradeId)?.sections ?? [];

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 500 * 1024) {
      setError('Photo must be under 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setName(''); setGradeId(''); setSectionId(''); setDob(''); setGender('');
    setBForm(''); setAddress(''); setAdmissionNo(''); setParentName('');
    setParentPhone(''); setPhotoPreview(null); setError(null);
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError('Student name is required.'); return; }
    if (!gradeId || !sectionId) { setError('Grade and section are required.'); return; }
    if (!shiftId || !sessionId) { setError('Shift and session are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          gradeId, sectionId, shiftId, sessionId,
          dob: dob || undefined,
          gender: gender || undefined,
          bForm: bForm.trim() || undefined,
          address: address.trim() || undefined,
          admissionNo: admissionNo.trim() || undefined,
          parentName: parentName.trim() || undefined,
          parentPhone: parentPhone.trim() || undefined,
          photoUrl: photoPreview || undefined,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to add student.');
      reset();
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Icon name="plus" size={16} /> Add Student
      </Button>
      <Dialog
        open={open}
        onClose={() => { setOpen(false); setError(null); }}
        title="Admit New Student"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Admit Student'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Photo <span className="font-normal text-slate-400">(optional, shown on ID card)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Student photo preview" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="user" size={28} className="text-slate-300" />
                )}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Icon name="plus" size={16} /> Choose photo
                </span>
                <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
              </label>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="text-sm text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <Input label="Full name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Raza" />
          <Input label="Admission no (auto if blank)" value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="KZN-25-0001" />
          <Select
            label="Grade *"
            value={gradeId}
            onChange={(e) => { setGradeId(e.target.value); setSectionId(''); }}
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            placeholder="Select grade"
          />
          <Select
            label="Section *"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            options={sections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))}
            placeholder={gradeId ? 'Select section' : 'Pick a grade first'}
          />
          <Select
            label="Shift *"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            options={shifts.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="Session *"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Input label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          <Select
            label="Gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
            placeholder="Select"
          />
          <Input label="B-Form / CNIC" value={bForm} onChange={(e) => setBForm(e.target.value)} placeholder="e.g. 12345-6789012-3" />
          <Input label="Parent name" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="e.g. Muhammad Ali" />
          <Input label="Parent phone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="e.g. 0300-1234567" inputMode="tel" />
          <div className="sm:col-span-2">
            <Textarea label="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Home address" />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
