# KAIZEN — Full Execution Plan (2026-09-29)

Built from: all Tanqeel's chats/instructions + the 8 print-design image + live-app review.
Rule: plan → execute step-by-step → cross-verify each item until done.

## A. Registration & real-app conversion (user's #1 complaint)

- [x] A1. Diagnose Kaizen AI empty-500 ("Unexpected end of JSON input") — root cause: `aiMessage.createMany` / `aiUsageLog.create` crash after conversation was already created (missing prod tables). Fix: best-effort persistence + top-level JSON error handler in POST.
- [ ] A2. Build public `/register` page (no auth): form for PARENT / STUDENT / TEACHER / STAFF self-registration → POST /api/register → PENDING request. Styled like /apply.
- [ ] A3. Login page: REMOVE "One-click demo login" personas + "Demo password for all personas" text. ADD "New here? Create account →" link to /register. Update tagline ("explore with a one-click demo login").
- [ ] A4. Header: REMOVE PersonaSwitcher + "Demo" badge (real app has no persona switching).
- [ ] A5. DELETE `/api/auth/demo` route (demo login API must not exist in a real app).
- [ ] A6. Remove DEMO_LOGINS / DEMO_PASSWORD_HINT from lib/format.ts; remove isDemo plumbing in lib/auth.ts + layout (keep only if harmless — verify no other refs).
- [ ] A7. Verify: /register renders, submits, creates PENDING RegistrationRequest; admin /registrations shows it; approve → activation link; login works. Demo login returns 404.

## B. Role access leaks (expenses visible to teacher/staff/parent)

- [ ] B1. Audit lib/rbac.ts MATRIX: expenses/finance pages must be SUPER_ADMIN + PRINCIPAL only (STAFF keeps fee vouchers? — user said expenses admin-only; fees: office staff need voucher generation per earlier spec; decide: STAFF keeps fees.manage, loses expenses).
- [ ] B2. Payroll: only own slip for TEACHER/STAFF; run/manage for SUPER_ADMIN/PRINCIPAL.
- [ ] B3. Verify each role's nav: teacher/staff/parent see NO Expenses, NO school-wide data; student/parent see only own/linked data.
- [ ] B4. Cross-verify via API: teacher token → GET /api/expenses = 403; parent token → 403.

## C. Print document design system (from user's image)

One shared component: `components/print/DocumentShell.tsx` — navy (#1b2a5e) + gold (#c9a227) theme, shield logo, "KAIZEN School Management System / Empowering Education | Building Brighter Futures", school building watermark, footer signatures. All 8 docs use it:

- [ ] C1. Student ID Card — photo, Name/Father/Class/Section/Roll No/Student ID/Session, QR, Principal sign, "Discipline | Knowledge | Growth".
- [ ] C2. Admission Form — Form No KZN-AF-YYYY-###, 3 sections (Student info / Contact / Documents checklist), signature+date.
- [ ] C3. Fee Voucher — Voucher No, student block, line-items table, total, amount-in-words, payment method checkboxes, Received By + Accounts Officer.
- [ ] C4. Exam Admit Card — Annual Examination banner, student block + photo + QR, subject/date/time/room table, instructions, Controller of Examinations.
- [ ] C5. Date Sheet — class banner, date/day/subject/time table, instructions.
- [ ] C6. Result Card — student block + photo, subject/total/obtained/grade table, total %, grade, position, remarks, Principal sign.
- [ ] C7. Class Time Table — session/class/section banner, Time × Mon–Fri grid, notes, Class Teacher sign.
- [ ] C8. Staff Salary Slip — month banner, employee block, Earnings | Deductions tables, Net Salary, amount-in-words, Accounts Officer.
- [ ] C9. Wire print buttons: student profile → ID card; admissions → admission form; fees → challan/voucher; exams → admit card + date sheet + result card; timetable page → print; payroll → salary slip. Each print view = own route with print CSS.

## D. Cross-verification (after push + Vercel deploy)

- [ ] D1. Confirm Vercel deployed the new commit (check deployment status).
- [ ] D2. AI chat: ask school stats as superadmin → real answer, no JSON error.
- [ ] D3. /register → submit → approve → activate → login (full loop).
- [ ] D4. Login page: no demo UI; /api/auth/demo → 404.
- [ ] D5. Role leak test: teacher/staff/parent tokens vs /api/expenses, /api/payroll.
- [ ] D6. Print docs: open each of the 8, verify layout matches image design.
- [ ] D7. Real-browser QA pass (login → key flows per role).

## Notes / constraints carried forward
- Additive DB changes only; never reset/reseed production.
- PENDING ≠ ABSENT; attendance invariants hold.
- Dates: PKT, YYYY-MM-DD for date-only.
- npx tsc --noEmit after TS changes.
- No "done" claim until D1–D7 pass.
