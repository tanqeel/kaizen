# Kaizen School Management System — Build Brief

Source of requirements: mind map "Kaizen School Management System" (attached image, 2026-09-28),
plus the MASTER PRODUCT BUILD DIRECTIVE. This file is the contract for implementation.

## 1. Analysis of the mind map

### Modules (10 top-level)
1. Dual-Tier Attendance Architecture — gate check-in layer + per-period lecture register + conflict detection + safety rules
2. Parent Portal & Child Safety — live at-school status, arrival/dismissal telemetry, subject journey timeline
3. RBAC — 6 personas (Super Admin, Principal, Teacher, Staff, Parent, Student), dynamic sidebar, one-click demo login, multi-persona switcher
4. Executive Dashboard Metrics — real-time aggregations, attendance breakdown, operational alerts
5. Role-Aware AI Assistant — role-scoped intents, DB tool execution, Gemini BYOK, rule-based local fallback, server-side permission checks, conversation tracking
6. Biometric Attendance Simulator — ZKTeco hardware emulation (IP config, heartbeat), fingerprint/face/RFID simulation
7. Academics & Timetable Matrix — grades 1–5, sections A–C, subject allocations, weekly period timetable, exams & report cards
8. Finance & Fee Ledger — monthly vouchers, paid/pending/overdue, cash/bank/Kuickpay-1Link/JazzCash/Easypaisa, PKR/CNIC/PKT localization
9. Communication & Notice Board — targeted announcements (normal/urgent), arrival/departure + absence notifications
10. PWA — manifest, service worker, standalone install, demo admin (clean-state reset), SQLite/Prisma

### Resolved ambiguities
- "Student Statistics" under personas = a limited student-facing view (own stats only), not a 7th role.
- SQLite vs PostgreSQL: use **SQLite via Prisma** with `DATABASE_URL` env — one-line switch to Postgres later. Mind map explicitly says SQLite/Prisma for demo admin.
- ZKTeco "hardware emulation": the mind map itself says emulation/simulation — a faithful simulator (terminal config, heartbeat, scan simulations that write real gate check-ins) IS the feature.
- Gemini: bring-your-own-key (stored server-side env or settings), rule-based engine is the default. Same pattern as the Speak Fluently app.

### The product's core differentiator
Dual-tier attendance: biometric gate check-in (Tier 1) cross-checked against per-period lecture registers (Tier 2).
Conflict engine flags "gate-present but lecture-absent" for leadership resolution. Safety rules: PENDING ≠ ABSENT —
parents are never sent false absence panics.

## 2. Architecture & stack

- **Next.js 16.3.6 (App Router, `experimental.authInterrupts`) + TypeScript + React 19** — simplest full-stack that covers SSR pages, API routes, PWA.
- **Tailwind CSS v4** (CSS-based config) + hand-rolled shadcn-style primitives (button, card, input, table, badge, dialog, tabs). No heavy component lib.
- **Prisma 6 + SQLite** (`DATABASE_URL="file:./dev.db"`). Migrations via `prisma migrate`.
- **Auth: DB-backed sessions.** `Session(token, userId, expiresAt)` table; httpOnly cookie; scrypt password hashing via node:crypto. Demo login: `POST /api/auth/demo {persona}` seeds a session. Persona switcher re-issues session (demo mode).
- **Authorization: server-side `requireRole()`** in a shared lib; route middleware guards pages; sidebar built dynamically from role permissions; every data query scoped by role.
- **Mutations:** Server Actions or Route Handlers (route handlers preferred for clarity: `/api/...`).
- **PWA:** `/manifest.webmanifest`, hand-rolled `/sw.js` (app-shell cache-first, API network-first), offline fallback page, install prompt.
- **AI assistant:** server-side intent engine. A deterministic rule-based core answers ALL data queries (attendance, fees, schedules — never hallucinated). Generative "intelligence" (study aid, summaries, open questions) goes through a pluggable free-model provider layer — first working provider in priority order wins: `OLLAMA_BASE_URL` (local open-source models, e.g. Llama 3.1) → Pollinations (free public gateway serving open-source models — GPT-OSS 20B — **no API key needed, active out of the box**) → `HF_TOKEN` (Hugging Face free inference, open models) → `GEMINI_API_KEY` (Gemini free tier) → honest rule-based fallback. Priority overridable via `AI_PROVIDER_ORDER`. All AI DB reads go through the same permission layer.
- **Timezone:** Asia/Karachi everywhere. Currency: `Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR'})`. CNIC format `#####-#######-#` validated on input.

## 3. Data model (Prisma — implement ALL of these)

```
School(id, name, logoUrl?, address, phone, email, timezone default 'Asia/Karachi')
AcademicSession(id, schoolId, name '2025-26', term 'Fall'|'Spring', startDate, endDate, isCurrent)
Shift(id, schoolId, name 'Morning'|'Evening')
User(id, name, email unique, passwordHash, role SUPER_ADMIN|PRINCIPAL|TEACHER|STAFF|PARENT|STUDENT, phone?, cnic?, isActive, createdAt)
SessionToken(id, token unique, userId, expiresAt, isDemo)
Teacher(id, userId? unique, employeeId unique, phone, cnic?, hireDate, salaryMonthly, isActive)
StaffMember(id, userId? unique, employeeId unique, designation, phone, cnic?, hireDate, salaryMonthly, isActive)
Parent(id, userId? unique, name, phone, cnic?, address?)
Student(id, admissionNo unique, name, dob?, gender?, bForm?, gradeId, sectionId, shiftId, sessionId, address?, photoUrl?, isActive)
StudentParent(studentId, parentId, relation)  // composite @@id
Grade(id, schoolId, level Int 1-5, name 'Grade 1')
Section(id, gradeId, name 'A'|'B'|'C', room?, classTeacherId?)
Subject(id, schoolId, name, code)  // English, Mathematics, Science, Urdu, Computer, Islamiat
SubjectAllocation(id, subjectId, gradeId, teacherId, periodsPerWeek)
TimetableSlot(id, sectionId, dayOfWeek 0-6, periodNo, subjectId, teacherId, room?, startTime 'HH:MM', endTime 'HH:MM')
ExamTerm(id, sessionId, name 'First Term'|'Second Term'|'Annual', startDate, endDate)
ExamSchedule(id, examTermId, subjectId, gradeId, date, startTime, totalMarks)
ExamResult(id, examScheduleId, studentId, obtainedMarks, remarks?, @@unique([examScheduleId, studentId]))
GateCheckIn(id, studentId, date 'YYYY-MM-DD', checkInTime DateTime, method FINGERPRINT|FACE|RFID|MANUAL, terminalId?, createdById?)
GateCheckOut(id, studentId, date, checkOutTime DateTime, method, terminalId?)
PeriodAttendance(id, sectionId, subjectId, date, periodNo, studentId, status PRESENT|ABSENT|PENDING, markedById, markedAt, @@unique([sectionId, subjectId, date, periodNo, studentId]))
AttendanceConflict(id, date, studentId, type GATE_PRESENT_LECTURE_ABSENT, status OPEN|RESOLVED|DISMISSED, note?, resolvedById?, resolvedAt?)
FeeHead(id, schoolId, name, defaultAmount, gradeId?)
FeeVoucher(id, studentId, sessionId, month 1-12, year, dueDate, totalAmount, discountAmount default 0, fineAmount default 0, status UNPAID|PARTIAL|PAID|OVERDUE, issuedAt, @@unique([studentId, month, year]))
FeeVoucherLine(id, voucherId, feeHeadId, amount)
Payment(id, voucherId, amount, method CASH|BANK_TRANSFER|KUICKPAY_1LINK|JAZZCASH|EASYPAISA, reference?, receivedById?, paidAt)
ExpenseHead(id, schoolId, name)
PaymentSource(id, schoolId, name 'Cash'|'Bank')
Expense(id, schoolId, date, headId, sourceId, amount, description?, addedById?)
Budget(id, schoolId, sessionId, headId, plannedAmount, @@unique([schoolId, sessionId, headId]))
Announcement(id, schoolId, title, body, priority NORMAL|URGENT, audience ALL|PARENTS|STAFF|TEACHERS|GRADES, gradeId?, createdById, createdAt)
NotificationLog(id, userId?, studentId?, type ARRIVAL|DEPARTURE|LECTURE_ABSENCE|FEE_REMINDER|ANNOUNCEMENT, channel SMS|WHATSAPP|IN_APP, message, status SENT|FAILED, sentAt)
SmsTemplate(id, schoolId, name, body)
BiometricTerminal(id, schoolId, name 'Main Gate', ipAddress, port default 4370, status ONLINE|OFFLINE, lastHeartbeat?)
AiConversation(id, userId, title, createdAt)
AiMessage(id, conversationId, role USER|ASSISTANT, content, toolsUsed?, createdAt)
AiUsageLog(id, userId, query, intent, provider, latencyMs, createdAt)
```

## 4. Seed data (demo school "Kaizen Model School")
- 1 current session 2025-26 Fall; shifts Morning/Evening
- Grades 1–5, sections A–C (A,B for grades 4–5 to vary), 6 subjects
- 10 teachers, 4 staff, demo users for all 6 personas (password `demo1234`)
- ~72 students (4–6 per section), each linked to 1 parent user
- Timetable: Mon–Fri, 6 periods/day per section, mapped to subjects/teachers/rooms
- 1 exam term "First Term" with schedules + results for Grade 5-A only (so report cards have data; other grades show honest empty states)
- Fee vouchers for current month: mix of PAID / PARTIAL / UNPAID / OVERDUE; several payments across methods
- Gate check-ins for "today" for ~80% of students (seed relative to run date); period attendance for today's elapsed periods; 2–3 open conflicts
- 3 announcements (1 urgent), notification log entries, 2 expense heads with expenses, 1 budget
- 1 biometric terminal ONLINE with recent heartbeat
- `npm run seed` resets + reseeds (demo admin "Restore Clean State" calls the same path)

## 5. Module specs + acceptance criteria

### 5.1 Auth, RBAC, navigation
- `/login`: one-click demo login cards for 6 personas + email/password form (real scrypt check).
- Header: school name, session/shift switcher (admin), persona switcher (demo sessions), theme toggle, logout.
- Sidebar: dynamic per role. Super Admin/Principal see all; Teacher: dashboard, attendance (period register), academics (timetable), exams (entry), communication, assistant; Staff: dashboard, finance, communication, assistant; Parent: portal, assistant; Student: statistics, assistant.
- Middleware + `requireRole()` on every page/API. Unauthorized → 403 page, never data leak.

### 5.2 Executive dashboard (`/dashboard`)
- Cards: enrolled students, active teachers, operational staff, sections (real-time Prisma counts).
- Attendance breakdown: today's present/absent counts + percentage progress bar (from gate check-ins + period data).
- Operational alerts: pending lecture submissions (sections with no period attendance for elapsed periods today), open attendance conflicts, overdue vouchers count + total outstanding PKR.
- Charts: 7-day attendance trend (CSS/SVG bars, no chart lib needed — or tiny custom SVG).

### 5.3 Dual-tier attendance (`/attendance`)
Tabs: **Gate Check-In** | **Period Register** | **Conflicts**.
- Gate: today's check-in list (search student, method badge, time), manual check-in form, check-out column.
- Period Register: pick section → today's timetable periods → per-student PRESENT/ABSENT/PENDING radio grid → submit. Pending submissions counted on dashboard.
- Conflicts: auto-generated when gate=present but any period=absent same day; list with student, date, details; actions: Resolve (note), Dismiss. Generation runs on period-attendance submit + a "Re-run detection" button.
- Safety rules enforced in code: PENDING never counts as absent; absence notifications only after all periods submitted or 30 min after last period.

### 5.4 Parent portal (`/portal`, PARENT role default landing)
- Live campus status card: AT SCHOOL / NOT AT SCHOOL (from today's gate data) with exact arrival time.
- Dismissal checkout status.
- Subject journey timeline: today's periods as badges (subject, time, status present/absent/pending).
- Child selector (if multiple children), fee vouchers + pay-status, exam results summary.
- Notification preferences note (arrival/departure/absence alerts go to NotificationLog).

### 5.5 Academics (`/academics`)
- Tabs: Structure (grades/sections/subjects CRUD), Allocations (subject→grade→teacher), Timetable (matrix grid: days × periods per section with subject/teacher/room; edit slot).
- Validation: no teacher double-booked same period (warn, allow override with confirm).

### 5.6 Exams & report cards (`/exams`)
- Exam terms CRUD, exam schedule builder (term + subject + grade + date + total marks).
- Result entry grid: schedule → students × obtained marks (validate ≤ total marks), remarks.
- Report card view per student per term: subject marks, percentage, grade (from grading bands), teacher remarks, print-friendly.
- Automated grade calc: A+ ≥90, A ≥80, B ≥70, C ≥60, D ≥50, F <50.

### 5.7 Finance (`/finance`)
Tabs: **Vouchers** | **Payments** | **Expenses** | **Budgets** | **P&L**.
- Vouchers: generate monthly vouchers for a grade/section (from fee heads), list with status pills (paid/partial/unpaid/overdue), voucher detail with lines.
- Record payment: amount, method (Cash/Bank/Kuickpay-1Link/JazzCash/Easypaisa), reference; auto-updates voucher status; PKR formatting.
- Expenses: add/list by head + source; budgets: planned vs actual per head; P&L: monthly income (payments) vs expenses.
- Overdue: voucher past dueDate + unpaid → OVERDUE (computed, not stored).

### 5.8 Communication (`/communication`)
- Announcements: compose (title, body, priority, audience), list with urgent highlighting.
- Notification log: filterable table of all sent notifications.
- SMS templates: CRUD.

### 5.9 Biometric simulator (`/biometric`)
- Terminal list: name, IP:port config (editable), ONLINE/OFFLINE, last heartbeat, "Send heartbeat" button.
- Simulator panel: pick student → simulate Fingerprint / Face / RFID → writes a real GateCheckIn with method + timestamp, shows success animation.
- Note in UI: "Simulation mode — for ZKTeco hardware integration, configure terminal IP."

### 5.10 AI assistant (`/assistant`)
- Chat UI with conversation list, role-aware greeting.
- Server-side intent engine (rule-based, default): intents —
  - parent: `my_child_attendance_today`, `my_child_arrival_time`, `my_child_fee_balance`, `my_child_results`
  - principal/super_admin: `school_attendance_summary`, `open_conflicts`, `fee_collection_month`, `pending_submissions`
  - teacher: `my_schedule_today`, `my_class_absentees`
  - student: `study_help <topic>` (safe revision aid, no records involved), `my_attendance`
  - all: `help` (lists what I can do for your role)
- **STRICT RULE: never invent attendance/marks/fee records.** If no record exists, say so plainly. Every answer derived from a real Prisma query scoped to the requester's role.
- Intelligence providers (free, pluggable — first working provider in priority order wins; override with `AI_PROVIDER_ORDER`). Used ONLY for generative intents (`study_help`, summary prose, unmatched general questions). Data intents ALWAYS use the rule-based DB engine:
  1. **Ollama (local open-source):** if `OLLAMA_BASE_URL` set, chat a local model (`OLLAMA_MODEL`, default `llama3.1:8b`). Fully free and private, no key needed.
  2. **Pollinations (free open-source, no key):** free public gateway serving open-source models (`POLLINATIONS_MODEL`, default `openai-fast` = GPT-OSS 20B). Active out of the box; disable with `POLLINATIONS_DISABLED=1`.
  3. **Hugging Face (hosted open-source):** if `HF_TOKEN` set, Inference API with `HF_MODEL` (default `Qwen/Qwen2.5-7B-Instruct`). Free-tier token.
  4. **Gemini (free tier):** if `GEMINI_API_KEY` set, Gemini 2.x.
  5. **Rule-based fallback:** template answers + capability guidance; never pretends to be generative AI.
- Generative system prompt includes role + school context + "answer only from provided context; never invent attendance/marks/fee records".
- Log every exchange to AiConversation/AiMessage/AiUsageLog (latency, usedGemini).

### 5.11 PWA + demo admin
- `/manifest.webmanifest` (name, icons, display standalone, theme_color), `/sw.js` (cache-first for pages/assets, network-first for `/api/*`), `/offline` fallback.
- Icons: generate `icon-192.png` / `icon-512.png` (simple SVG → PNG via script or checked-in files).
- `/admin`: user list, "Restore demo state" (drops + reseeds; confirm dialog), AI provider status indicator (which providers are configured, which is active).

## 6. Design direction
Professional school-ERP SaaS, NOT the claymorphism/kids style from the skill dataset (overridden by product judgment):
- Light-first with dark mode toggle (CSS variables, both themes real and tested).
- Primary indigo `#4F46E5`, slate neutrals, status colors: present=emerald, absent=rose, pending=amber, overdue=red.
- Font: Inter (next/font/google) + system fallback. Tabular numerals for data.
- Density: compact data tables, KPI cards with sparklines/progress bars, sticky table headers, mobile: sidebar → bottom nav or drawer, tables → card lists.
- No emojis as icons — inline SVG icon set (hand-rolled, lucide-style paths). Touch targets ≥44px. `prefers-reduced-motion` respected. Focus-visible states everywhere.
- Design tokens persisted at `design-system/kaizen-school-management-system/MASTER.md` (reference; this brief overrides style/typography).

## 7. Non-negotiables
- No fake functionality: every button does something real against the DB. No hardcoded demo responses disguised as features.
- No invented records anywhere (AI, reports, dashboards). Empty states are honest.
- Server-side permission checks on every data access; role scoping in AI answers.
- Pakistan localization: PKR formatting, Asia/Karachi dates, CNIC validation.
- TypeScript strict, no `any` leaks; `npm run build` clean.

## 8. Build waves
1. Scaffold + Prisma schema + seed + auth/RBAC + sidebar/header + PWA shell
2. Dashboard + dual-tier attendance + conflicts
3. Parent portal + academics/timetable + exams/report cards
4. Finance + communication + biometric simulator
5. AI assistant + admin/demo tools + polish + full test pass

## 9. Test plan (every wave)
- `npx tsc --noEmit` and `npm run build` green
- Seed runs clean; demo login works for all 6 personas
- curl smoke tests: login → session cookie → GET /api/dashboard/summary, POST period attendance → conflict appears, POST payment → voucher status updates, AI /api/assistant/chat answers from DB
- Page fetch checks: no 500s on main routes per role; 403 for disallowed roles
- PWA: manifest + sw.js served, offline page works
