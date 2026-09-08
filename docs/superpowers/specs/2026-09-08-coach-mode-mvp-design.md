# Coach mode (MVP) — design

**Date:** 2026-09-08
**Status:** approved, ready for implementation plan
**Base app:** openGym fork (this repo)

---

## 1. Context & goal

Today openGym is a single-tenant, self-hosted app: passkey auth, one `db.json`
(`users` / `creds` / `subs` / `invites`), and one `state-<uid>.json` per user
holding the entire client blob (routines, workouts, bodyweight, settings). The
client is the source of truth — it `PUT`s the whole blob and the server does
last-write-wins by `_ts`. An admin dashboard (`ADMIN_UIDS`, `/api/admin/*`,
`/admin`) already gives a read-only operator view of every user plus account
disable and invite management.

**Goal:** a first, thin, usable **coach mode** — the repo owner acts as a coach
for 2–3 real students on their own instance. A coach assigns routines to a
student and follows that student's progress; the student trains those routines
and can ask the coach for adjustments. The full multi-coach SaaS is explicitly
out of scope for this MVP; this slice validates the coach↔student flow first.

### Locked decisions (from brainstorming, 2026-09-08)

| Decision | Choice |
|---|---|
| Product vision | Multi-coach SaaS eventually; **this spec is the thin MVP only** — owner-as-coach, no payments, no multi-coach isolation beyond per-`coachId` checks. |
| Core activity | Assigning/programming routines **and** following progress, both central. |
| Routine delivery | **Approach A** — assignments are a server-side collection separate from the student blob; the client merges assigned routines in read-only. (Approach B, coach writes the student blob, breaks last-write-wins — rejected. Approach C, routines as first-class server objects, is the real-SaaS path — deferred.) |
| Assignment storage | Assignment stores **only `routineId`**, pointing at a routine in the coach's own state file. The server resolves it to the current routine body at read time. No snapshots, no "push update", no bidirectional merge. |
| Who is coach | New `coach: true` flag on the user, set via `.env` `COACH_UIDS=<id>,…` (same pattern as `ADMIN_UIDS`). |
| Student→coach link | Coach generates an invite code (existing `invites[]` system); redeeming it sets `student.coachId = invite.createdBy` when the creator is a coach. Requires `INVITE_ONLY=1` on the instance. |
| Coach per student | Exactly one. No change-of-coach flow — edit `db.json` by hand if needed. |
| Assigned routine — student rights | **Read-only.** Student executes it, cannot edit. "Pedir ajuste" sends a free-text note to the coach; the coach edits the routine in their own normal editor. |
| Coach dashboard | New `/coach` route, guard `user?.coach`; reuses the `Admin.jsx` progress components, scoped to *my* students. No account-disable (admin-only power). |

### Non-goals (this MVP)

- Multiple coaches on one instance with real tenant isolation, coach sign-up/onboarding, billing.
- Linking a student who already has an account (invite-code path only).
- Changing a student's coach in-app.
- Student editing an assigned routine, or any bidirectional/shared editing.
- Routines as first-class server objects; migrating routines out of the blob.
- Any change to the blob sync model, the workout-history shape, or the periodized `program.blocks` system.
- A coach-facing routine builder distinct from the existing `RoutineEdit` editor.

---

## 2. Data model (server, `db.json`)

Additive only. Absent fields read as before.

```
users[]           + coachId?: string        // on the student; the coach's user id

assignments[]     { id, coachId, studentId, routineId, createdAt }
changeRequests[]  { id, assignmentId, studentId, note, createdAt, resolvedAt?: string }
```

- `db.assignments` / `db.changeRequests` default to `[]` on load (same guard style as `db.subs`, `db.invites`).
- An `assignment` never holds the routine body — only `routineId`, resolved against `state-<coachId>.json` at read time.
- `isCoach(user)` = `!!user && (user.coach === true || COACH_UIDS.includes(user.id))`, mirroring `isAdmin`.
- `COACH_UIDS` parsed from `process.env.COACH_UIDS` exactly like `ADMIN_UIDS`.

### New module: `api/coaching.js`

`server.js` runs its HTTP listener on import, so it is not unit-testable in
process. All coach logic that can be pure lives in a new `api/coaching.js`
(ESM, no dependencies), imported by `server.js`. It exports:

```
isCoach(user, coachUids)                         -> boolean
coachIdForInvite(invite, users, coachUids)       -> string | undefined
resolveAssigned(db, studentId, readState, users) -> [{ ...routine, coachAssigned, assignmentId, coachName }]
studentRows(db, coachId, readState, livePresence, subs)   -> [{ id, name, workouts, ... }]
studentDetail(db, coachId, studentId, readState)         -> { user, workouts, bodyweight, assigned, requests } | null
pruneOrphanAssignments(db, readState)            -> mutates db.assignments, returns removed count
```

`server.js` keeps only the thin HTTP wiring (parse request, call a `coaching.js`
function, `json(res, …)`), `requireCoach` (needs `readSession`), the DB writes
(`saveDb`), and `sendPush`.

---

## 3. Student→coach linking

Reuses the existing invite system (`invites[]`, each with `createdBy`).

- **Requirement:** the instance runs with `INVITE_ONLY=1`. Documented as a precondition of coach mode (README / deploy notes).
- The coach generates codes from the coach dashboard. **Chosen surface:** the existing invite endpoints (`GET /api/admin/invites`, `POST /api/admin/invites/new`, `POST /api/admin/invites/revoke`) get their guard relaxed from `requireAdmin` to "admin **or** coach"; when the caller is a coach (not admin), the list is filtered to `invite.createdBy === caller.id` and revoke is limited to their own codes. Admins keep the full view.
- In `POST /api/register/verify`, at the point where the invite is currently burned (`invite.usedBy = user.id`, `user.invitedBy = invite.code`), add:
  ```
  const creator = db.users.find(u => u.id === invite.createdBy)
  if (creator && isCoach(creator)) user.coachId = creator.id
  ```
- One coach per student: `coachId` is a single value; redemption only ever sets it once (a fresh user).

---

## 4. Routine assignment & delivery

### 4.1 Coach side

- Coach builds routines with the existing `RoutineEdit` editor in their own account (`S.routines`) — no new builder.
- Coach dashboard → student detail → **"Asignar rutina"**: lists the coach's own `S.routines`; selecting one or more creates one `assignment` per `(routineId, studentId)` pair.
- **Unassign** deletes the `assignment` row.
- Editing an assigned routine = the coach opens it in their normal editor and saves; the change reaches the student on their next pull automatically (server resolves the body live).

### 4.2 Student side

- New endpoint `GET /api/coaching/assigned`: for each `assignment` with `studentId === session user`, read `state-<coachId>.json`, find the routine by `routineId`, and return `{ ...routine, coachAssigned: true, assignmentId, coachName }`. Assignments whose routine no longer exists in the coach's state are **omitted** from the response (and MAY be pruned from `db.assignments` opportunistically).
- **Merge/strip helpers:** pure functions in a new `frontend/src/lib/coaching.js` (`mergeAssigned`, `stripAssigned`, `isAssigned` — signatures in §6).
- **Store integration (`useStore.js`):**
  - `boot()` and every `pullState()` also call `/api/coaching/assigned`; on success the result is merged with `mergeAssigned(S.routines, assigned)` before `persist`.
  - Assigned routines live **in memory** in `S.routines`, each carrying `coachAssigned: true`.
  - Both the `localStorage` write and the `pushState()` PUT body use `stripAssigned(...)` — assigned routines exist only in the live in-memory `S`, never in the persisted blob on either side. So last-write-wins never touches them and a stale copy can't linger in `localStorage`.
  - A `/api/coaching/assigned` failure (offline, or the user isn't a student) leaves `S.routines` as-is — assigned routines are simply absent that session.
  - localStorage may keep them (harmless, refreshed each pull); only the server PUT must exclude them.
- **Every existing consumer works unchanged** because the assigned routine sits in `S.routines` keyed by `id` (the coach's routine id): Plan list, Home "today", `startFlow(id)`, weekly schedule `S.week`, history. If the student schedules an assigned routine on a weekday, that `S.week` reference *is* student data and persists in the blob; the routine body does not.
- **UI:**
  - Plan list + `RoutineEdit`: a routine with `coachAssigned` shows a "de tu coach" tag.
  - `RoutineEdit` for a `coachAssigned` routine is **read-only** (no save, edit affordances hidden/disabled).
  - A **"Pedir ajuste"** action (in `RoutineEdit` and/or the Plan row) opens a sheet with a textarea → `POST /api/coaching/change-request { assignmentId, note }`.

### 4.3 Edge cases

- Coach deletes the source routine → student stops seeing it (see 4.2). No error surfaced to the student.
- Student had it scheduled in `S.week` → the day resolves to "no routine" (existing behavior for a dangling id).
- Coach un-flags as coach (`COACH_UIDS` change) → `/api/coaching/*` 403s; `/api/coaching/assigned` for their students returns nothing. Acceptable for MVP.

---

## 5. Coach dashboard & change requests

### 5.1 Route & guard

- New route `/coach` in `App.jsx`, rendered only when `user?.coach` (same pattern as `/admin` → `user?.admin`), otherwise `<Navigate to="/home" replace />`.
- `GET /api/me` must include `coach: isCoach(user)` alongside the existing `admin` field, and every place that returns `{ user: { id, name, admin } }` (register/verify, login/verify) adds `coach`.
- Settings view: a "Coach dashboard" link next to the existing "Admin dashboard" link, shown when `user?.coach`.

### 5.2 Server guard & endpoints

`requireCoach(req, res)` — resolves the session user, 403 unless `isCoach`. Mirrors `requireAdmin`.

| Endpoint | Purpose |
|---|---|
| `GET /api/coaching/students` | One row per user with `coachId === me`: `{ id, name, workouts, lastWorkout, lastSync, live, assignments: n, pendingRequests: n }`. Reuses `readState` + `livePresence` like `/api/admin/users`. |
| `GET /api/coaching/student?id=` | Drill-down for one of *my* students (404 if not mine): profile, workout history, bodyweight, routines summary (same shape as `/api/admin/user`) **plus** `assigned: [{ assignmentId, routineId, name, emoji, count }]` and `requests: [{ id, note, createdAt, resolvedAt }]`. |
| `POST /api/coaching/assign` `{ studentId, routineId }` | Creates an `assignment` (student must be mine; routine must exist in my state). Idempotent per pair. |
| `POST /api/coaching/unassign` `{ assignmentId }` | Deletes it (must be mine). |
| `POST /api/coaching/change-request` `{ assignmentId, note }` | **Student-authed** (not `requireCoach`): the caller must be `assignment.studentId`. Creates a `changeRequest`; fires `sendPush(assignment.coachId, …)` if the coach has a subscription. |
| `POST /api/coaching/change-request/resolve` `{ id }` | `requireCoach`, must own the underlying assignment. Sets `resolvedAt`. |

All coach endpoints check ownership by `coachId` server-side, not just in the UI. A coach never sees another coach's students, assignments, or requests.

### 5.3 Shared UI components

`Admin.jsx` currently inlines the progress views (`UserDetail`, the user list rows, "Training now", tiles). Extract the reusable pieces into a shared module (e.g. `components/ProgressViews.jsx` / `frontend/src/lib/` helpers `rel`, `dur`) so both `Admin.jsx` and the new `Coach.jsx` consume them. `Admin.jsx` keeps its extra powers (account disable, global invite management); `Coach.jsx` adds:

- Student list scoped to my students, each row linking to a detail sheet.
- Detail sheet: progress (shared) + **assigned routines** (with unassign) + **"Asignar rutina"** picker (coach's own `S.routines`) + **pending change requests** (note, date, "marcar resuelto").
- No account-disable button.

### 5.4 Notifications

`POST /api/coaching/change-request` triggers `sendPush(coachId, { title: 'Pedido de ajuste', body: '<student> — <first line of note>' , … })` via the existing `web-push` infra. If the coach has no push subscription, the request still shows as a badge/count in the dashboard (`pendingRequests`).

---

## 6. Testing

### Backend (`node --test` — the api has no test setup today)

The api package currently has no tests and no runner. This feature adds one:
`"test": "node --test"` in `api/package.json`, using built-in `node:test` +
`node:assert` (no new dependency).

**Primary: unit tests of `api/coaching.js`** (`api/coaching.test.js`, in-process
import — `server.js` is never loaded). `readState` / `livePresence` are passed in
as plain function args, so tests hand them stubs backed by fixture objects.

- `isCoach(user, coachUids)`: false for undefined/plain user; true for `user.coach === true`; true when `coachUids` includes the id.
- `coachIdForInvite(invite, users, coachUids)`: returns the creator id when the creator is a coach; `undefined` for a non-coach creator, a missing creator, or a null invite.
- `resolveAssigned`: returns one entry per assignment for the student, each with the routine body from the (stubbed) coach state, `coachAssigned: true`, `assignmentId`, `coachName`; **omits** an assignment whose `routineId` is absent from the coach state; ignores assignments for other students.
- `studentRows`: only users with `coachId === coachId` arg; counts `assignments` and unresolved `changeRequests` per student; reads `workouts` / `lastSync` / `live` from stubs.
- `studentDetail`: `null` when the student's `coachId` ≠ the arg (isolation); otherwise history + bodyweight + `assigned` + `requests`.
- `pruneOrphanAssignments`: drops assignments whose routine no longer exists; leaves valid ones; returns the count removed.

**Secondary: HTTP integration tests** (`api/routes.test.js`) for the wiring that
unit tests can't reach. A helper (`api/test-helpers.js`) spawns `server.js` as a
child process with a throwaway `DATA_DIR`, a free `PORT`, and per-case env
(`ADMIN_UIDS` / `COACH_UIDS` / `INVITE_ONLY`); fixtures (`secret`, `db.json` with
seeded `users`, `state-<uid>.json`) are written to `DATA_DIR` before boot;
session cookies are minted in-test by re-deriving `sign()` (HMAC-SHA256 over
`<uid>:<exp>:0` with the known secret).

- `requireCoach`: 401 no cookie, 403 signed-in non-coach, 200 for a coach.
- `POST /api/coaching/assign` / `unassign`: row created / removed in `db.json`; 400 for a student that isn't mine; 400 for a `routineId` absent from my state; assigning the same pair twice leaves one row.
- `GET /api/coaching/assigned` as a student: body resolved from the coach's `state-<coachId>.json`.
- `GET /api/coaching/student` isolation: coach B gets 404 for coach A's student.
- `POST /api/coaching/change-request`: 403 when caller isn't `assignment.studentId`; on success a `changeRequest` row exists; `/resolve` sets `resolvedAt` and 403s a non-owning coach.
- `GET /api/me` returns `coach: true` for a `COACH_UIDS` user, `false` otherwise.

`POST /api/register/verify`'s `coachId` wiring is covered by the `coachIdForInvite`
unit tests plus a one-line assertion in code review that the verify handler calls
it (a full WebAuthn registration can't be driven from a test).

### Frontend

The merge/strip logic is pure and lives in a new `frontend/src/lib/coaching.js`,
tested in `frontend/src/lib/coaching.test.js` (vitest, matching the existing
`lib/*.test.js` style):

```
mergeAssigned(routines, assigned) -> routines with coachAssigned entries appended
                                     (assigned wins on id collision; input not mutated)
stripAssigned(routines)           -> routines.filter(r => !r.coachAssigned)
isAssigned(routine)               -> !!routine?.coachAssigned
```

- `mergeAssigned`: appends assigned routines flagged `coachAssigned`; if an assigned id equals a local id, the assigned one replaces it; original arrays not mutated; empty `assigned` returns an equivalent list.
- `stripAssigned`: removes every `coachAssigned` routine; leaves local ones (and their order) intact.
- Round-trip: `stripAssigned(mergeAssigned(local, assigned))` deep-equals `local`.

Store wiring is covered by extending `useStore.test.js` where it stays pure, and
otherwise verified in the manual pass:

- `pushState` builds its PUT body via `stripAssigned` — assert the body has no `coachAssigned` routine (mock `api`).
- An assigned routine scheduled in `S.week` keeps its id reference through a strip/merge cycle.
- `RoutineEdit` renders read-only for a `coachAssigned` routine (no save path) — manual pass.

### Manual (local instance, `npm run dev`, `INVITE_ONLY=1`)

1. Two profiles: coach (`COACH_UIDS`) + student registered via a coach-generated invite.
2. Coach assigns a routine → student sees it tagged "de tu coach", read-only, and can start a workout from it.
3. Student "Pedir ajuste" → coach sees the request (and a push if subscribed).
4. Coach edits the routine in their own editor → student sees the change after a reload/pull.
5. Coach marks the request resolved; coach dashboard shows the student's workout history / live status.

---

## 7. Open follow-ups (not this MVP)

- Multi-coach onboarding + real tenant isolation; move `coach` off `.env`.
- Approach C: routines as first-class server objects with owner + shared-with.
- Linking existing accounts to a coach.
- Per-workout coach feedback / comments; in-app messaging.
- Billing.
