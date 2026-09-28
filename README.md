# Kaizen — School Management System

A complete, database-backed school ERP: dashboard, students, gate + lecture attendance (with conflict detection), parent portal, academics, exams, fees, finance, HR, biometric, communications, and a role-aware **Kaizen AI** assistant — for Super Admin, Principal, Teacher, Staff, Parent, and Student roles.

Built with **Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma · SQLite**.

## Quick start (fully functional in ~3 minutes)

```bash
npm install
cp .env.example .env        # optional — AI works out of the box with no keys
npx prisma db push
npx tsx prisma/seed.ts      # creates the demo school: 65 students, 82 users, fees, exams…
npm run dev                 # http://localhost:3000
```

Production:

```bash
npm run build
npm run start               # http://localhost:3000
```

## Demo logins (password: `demo1234`)

| Role         | Email                  |
| ------------ | ---------------------- |
| Super Admin  | superadmin@kaizen.pk   |
| Principal    | principal@kaizen.pk    |
| Teacher      | teacher1@kaizen.pk     |
| Staff        | staff1@kaizen.pk       |
| Parent       | parent1@kaizen.pk      |
| Student      | student1@kaizen.pk     |

## What’s inside

- **Dashboard** — role-scoped KPIs, charts, activity, pending approvals
- **Students** — admissions, profiles, documents, promotion
- **Attendance** — separate **gate** and **lecture** registers; automatic detection of *gate-present + lecture-absent* conflicts with resolution workflow
- **Parent portal** — child attendance, results, fee balance, live status (`AT SCHOOL` / `DISMISSED`)
- **Academics** — classes, sections, subjects, timetable, syllabus
- **Exams** — date sheets, marks entry, report cards (remarks derived from marks, never random)
- **Fees & Finance** — invoices, system-generated receipts (`RCP-…`), expenses, budgets
- **HR** — staff records, leave, payroll basics
- **Biometric** — device/event model for attendance hardware
- **Communications** — announcements, SMS/WhatsApp templates
- **Kaizen AI** — chat assistant with a strict rule: **it can never invent school records**. Data questions are answered by a deterministic engine running real database queries scoped to your role; only study help and general questions go to a generative model.
- **PWA** — installable, offline fallback page, light + dark themes, mobile-responsive

## Kaizen AI providers (free, pluggable)

Generative answers use the first *working* provider in this priority order — override with `AI_PROVIDER_ORDER`:

1. **Ollama** — local open-source models. Set `OLLAMA_BASE_URL` (e.g. `http://localhost:11434`); fully private, no key.
2. **Pollinations** — free public gateway serving open-source models (default `openai-fast` = GPT-OSS 20B). **No API key needed — works out of the box.** Change with `POLLINATIONS_MODEL`, disable with `POLLINATIONS_DISABLED=1`.
3. **Hugging Face** — hosted open-source models via free `HF_TOKEN` (`HF_MODEL`, default `Qwen/Qwen2.5-7B-Instruct`).
4. **Gemini** — free tier via `GEMINI_API_KEY`.
5. **Rule-based fallback** — always available; honest template guidance, never pretends to be AI.

See **Admin → AI providers** in the app for live status (which is configured, which is active).

## Project docs

- `BUILD-BRIEF.md` — full build specification
- `AGENTS.md` — contributor conventions
- `../feature-spec.md` — original feature specification (parent folder)

## Safety invariants

- Gate and lecture attendance are separate registers; `PENDING` is never `ABSENT`.
- Absence notifications wait for register submission.
- Full server-side RBAC on every page and API route.
- AI never invents attendance, marks, fees, or schedules.
