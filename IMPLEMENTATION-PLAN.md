# KAIZEN Privacy-First Architecture — Implementation Plan

**Vision:** Privacy-First, Role-Aware, Personalized, Self-Improving School Operating System.

**Core rule:** Every user sees only what belongs to them, is directly related to them, or is intentionally published as common school information.

---

## Phase 1: Identity Foundation ✅ BUILT (local, not pushed)

### Database schema
- [x] `AccountStatus` enum: PENDING, VERIFICATION_REQUIRED, APPROVED, ACTIVE, SUSPENDED, LOCKED, REJECTED, DEACTIVATED, GRADUATED, TRANSFERRED
- [x] `StaffType` enum: TEACHING, ACCOUNTANT, OFFICE, SECURITY, PEON, SANITARY, OTHER
- [x] `Role` enum: added ADMIN (Super Admin, Principal, Admin, Teacher, Staff, Parent, Student)
- [x] `User.kaizenId` — unique, collision-safe (KZN-STU-2026-XXXXXX format)
- [x] `User.status`, `User.forcePasswordReset`
- [x] `StaffMember.staffType`
- [x] `AuditLog` model (actor, action, target, result, detail, timestamp)
- [x] `RegistrationRequest` model (self-registration workflow)
- [x] `IntelligenceInsight` model (AI recommendations with human review)

### Identity utilities
- [x] `lib/kaizen-id.ts` — cryptographic KAIZEN ID generation with uniqueness check
- [x] `lib/audit.ts` — audit logging helper (never logs passwords/secrets)

---

## Phase 2: Registration & Lifecycle ✅ BUILT (local, not pushed)

### Self-registration flow
- [x] `POST /api/register` — public endpoint, creates PENDING request
- [x] `GET /api/registrations` — list requests (principal/admin)
- [x] `POST /api/registrations/[id]/decide` — approve/reject/request-correction
  - Approval creates User with unique KAIZEN ID
  - Temporary password hashed immediately (scrypt)
  - `forcePasswordReset: true` — user must set own password on first login
  - Temp password returned ONCE, never stored in plaintext
- [x] `/registrations` UI — review queue with approve/reject/correction actions

### Account lifecycle
- [x] `PATCH /api/users/[id]/status` — suspend/lock/deactivate/graduate/transfer
- [x] Login blocks SUSPENDED, LOCKED, DEACTIVATED, REJECTED accounts
- [x] Every status change audit-logged

### Password security
- [x] `POST /api/users/[id]/reset-password` — admin reset (never shows existing password)
- [x] Super Admin protection: only Super Admin can reset another Super Admin
- [x] Cannot reset own password via admin endpoint
- [x] All resets audit-logged, force password change on next login

---

## Phase 3: Authorization Hardening ✅ BUILT (local, not pushed)

- [x] `users.manage` permission added (Super Admin, Principal, Admin)
- [x] ADMIN role integrated into all permission matrices
- [x] ADMIN gets operational permissions (like Principal) but not `admin.manage`
- [x] Navigation automatically respects new permissions
- [x] Staff dashboard is now job-specific:
  - ACCOUNTANT → Finance workspace (fees, payroll)
  - OFFICE → Office workspace (admissions, notices)
  - SECURITY → Gate operations
  - All staff → My Attendance

---

## Phase 4: Audit System ✅ BUILT (local, not pushed)

- [x] `AuditLog` model with actor/action/target/result/detail
- [x] Audit events on: account creation, registration decisions, password resets, status changes, insight reviews
- [x] `/audit-log` viewer — principal/admin only, newest first
- [x] Never logs passwords, secrets, or tokens

---

## Phase 5: Intelligence Engine ✅ BUILT (local, not pushed)

### Architecture
- [x] `lib/intelligence.ts` — privacy-safe analyzers
  - Attendance trend detection (14-day vs previous 14-day)
  - Fee collection rate monitoring
  - Notification volume optimization
  - All aggregate/anonymized — no individual private records exposed
- [x] `GET /api/intelligence` — list insights
- [x] `POST /api/intelligence` — trigger analysis run
- [x] `PATCH /api/intelligence/[id]` — human review (REVIEWED/DISMISSED/IMPLEMENTED)
- [x] `/intelligence` dashboard — principal/admin only

### Insight structure
Each insight has: category, title, explanation, evidence, period, confidence, suggested action, review controls.

### Human-in-the-loop guarantees
- Insights NEVER auto-apply changes
- Every decision (review/dismiss/implement) is audit-logged
- "Why am I seeing this?" explanation on every insight
- No causation claims without evidence

---

## Phase 6: NOT YET BUILT (planned)

### Database migration
- [ ] Create non-destructive Prisma migration for all new schema
- [ ] Backfill existing users with unique KAIZEN IDs
- [ ] Set existing users to ACTIVE status
- [ ] **NEVER apply to production without explicit approval**

### Remaining authorization audits
- [ ] Audit every existing API route for resource-level scoping:
  - Student self vs other-student access
  - Parent-child relationship enforcement
  - Teacher assignment scoping (classes/subjects)
  - Fee/result/document access
  - Payroll/staff attendance isolation
- [ ] Common information layer definition (published announcements, events, calendar)

### Additional intelligence analyzers
- [ ] At-risk student detection (attendance + performance patterns)
- [ ] Teacher workload balance
- [ ] Permission hygiene suggestions
- [ ] Scheduled nightly analysis runs

### UI polish
- [ ] User management page (list users, KAIZEN IDs, status, reset password)
- [ ] Public registration page (`/apply` exists — wire to new API)
- [ ] Password change flow for `forcePasswordReset` users

---

## Security Invariants

1. **Server-side enforcement:** Every API checks permissions; UI hiding is not security.
2. **No IDOR:** Resource access checks ownership/assignment/relationship.
3. **No password exposure:** Passwords hashed with scrypt; never displayed, logged, or recoverable.
4. **Audit everything sensitive:** Account changes, role changes, password resets, admin actions.
5. **AI never acts autonomously:** Recommendations only; human approves every change.
6. **Minimum necessary data:** Intelligence engine uses aggregates, not individual records.

---

## Deployment Status

- **Local:** All phases 1-5 built, TypeScript passes, production build passes.
- **GitHub:** Pushed (261 files).
- **Vercel:** Auto-deploy triggered. Build command reverted to safe `prisma generate && next build`.
- **Database migration:** Production was built with `db push` (no migration history), so
  `prisma migrate deploy` fails with `db_schema_not_empty`. Solution: super-admin-only
  `POST /api/admin/migrate` endpoint applies the schema changes idempotently via
  `$executeRawUnsafe`. Run once after deploy, then remove the route.
- **Status:** Awaiting migration endpoint execution on production.
