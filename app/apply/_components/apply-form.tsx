'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Textarea } from '@/components/ui';
import { Icon } from '@/components/icons';
import { safeJson } from '@/lib/api-client';

interface ApplyFormProps {
  schoolName: string;
  grades: Array<{ id: string; name: string }>;
}

export function ApplyForm({ schoolName, grades }: ApplyFormProps) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !gradeId || !parentName.trim() || !parentPhone.trim()) {
      setError('Please fill in your name, grade, parent name and parent phone.');
      return;
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(parentPhone.trim())) {
      setError('Parent phone number looks invalid.');
      return;
    }
    if (dob) {
      const parsed = new Date(dob);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() >= Date.now()) {
        setError('Date of birth must be a valid past date.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admissions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          dob: dob || undefined,
          gender: gender || undefined,
          gradeId,
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
          address: address.trim() || undefined,
          website,
        }),
      });
      const data = await safeJson(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Submission failed. Please try again.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Icon name="check" size={28} />
          </span>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Application received</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Thank you{schoolName ? ` for applying to ${schoolName}` : ''}. The school office will
            contact you on the parent phone number once your application is reviewed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Admission Application</CardTitle>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {schoolName ? `Apply for admission to ${schoolName}.` : 'Apply for admission.'}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
          <div>
            <label htmlFor="apply-name" className="mb-1 block text-sm font-medium">
              Student name *
            </label>
            <Input
              id="apply-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Full name of the applicant"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <div>
              <label htmlFor="apply-dob" className="mb-1 block text-sm font-medium">
                Date of birth
              </label>
              <Input
                id="apply-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <Select
                id="apply-gender"
                label="Gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="Select"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
            </div>
          </div>

          <div>
            <Select
              id="apply-grade"
              label="Grade *"
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              required
              placeholder="Select grade"
              options={grades.map((g) => ({ value: g.id, label: g.name }))}
            />
          </div>

          <div>
            <label htmlFor="apply-parent-name" className="mb-1 block text-sm font-medium">
              Parent / guardian name *
            </label>
            <Input
              id="apply-parent-name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
              placeholder="Full name"
            />
          </div>

          <div>
            <label htmlFor="apply-parent-phone" className="mb-1 block text-sm font-medium">
              Parent phone *
            </label>
            <Input
              id="apply-parent-phone"
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="03xx xxxxxxx"
            />
          </div>

          <div>
            <label htmlFor="apply-address" className="mb-1 block text-sm font-medium">
              Address
            </label>
            <Textarea
              id="apply-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Home address (optional)"
            />
          </div>

          {/* Honeypot: invisible to humans, filled by bots. NOT type=hidden. */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
          >
            <label>
              Website
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <Button type="submit" loading={submitting} className="mt-1">
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
