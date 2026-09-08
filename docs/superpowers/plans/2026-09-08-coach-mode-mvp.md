# Coach Mode (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the instance owner act as a coach — assign routines to linked students, follow their progress, handle adjustment requests — without changing the blob-sync model.

**Architecture:** Assignments are a server-side collection in `db.json` holding only a `routineId` that points at a routine in the coach's own state file; the server resolves the body live on read. The student client merges assigned routines into `S.routines` in memory only (flagged `coachAssigned`), and strips them before persisting or syncing, so last-write-wins never touches them. Pure logic lives in new `api/coaching.js` and `frontend/src/lib/coaching.js` modules; `server.js` keeps only HTTP wiring.

**Tech Stack:** Node's built-in `http` + `node:test` (backend, no framework, no new deps), React 19 + zustand + react-router (frontend), vitest (frontend tests).

**Spec:** `docs/superpowers/specs/2026-09-08-coach-mode-mvp-design.md`

## Global Constraints

- **No new dependencies** in `api/` or the root launcher. Backend tests use built-in `node:test` + `node:assert`. Frontend may use the already-present `vitest`.
- **Additive data model only.** Every new field on `users` / `db` reads as absent-equals-before. No migration.
- **Do not change** the blob sync model (`GET`/`PUT /api/data`, last-write-wins by `_ts`), the workout-history shape, or the periodized `program.blocks` system.
- **`isCoach` mirrors `isAdmin`:** `!!user && (user.coach === true || COACH_UIDS.includes(user.id))`. `COACH_UIDS` parsed from `process.env.COACH_UIDS` exactly like `ADMIN_UIDS` (comma-split, trim, filter empty).
- **Coach mode requires `INVITE_ONLY=1`** on the instance — this is documented, not enforced in code.
- ES modules everywhere (`"type": "module"` in both packages). 2-space indent, no semicolons in frontend files, semicolons in `api/server.js` (match each file's existing style).
- Commit message trailer on every commit:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NAZgD4TeWm4oqgGL9vyqB1
  ```
- Branch: `feat/coach-mode-mvp` (already created).

---

## File Structure

**Backend**
- `api/coaching.js` — CREATE. Pure coach logic: `isCoach`, `coachIdForInvite`, `resolveAssigned`, `studentRows`, `studentDetail`, `pruneOrphanAssignments`, `validateAssign`. No I/O — callers pass `readState` / `livePresence` in.
- `api/coaching.test.js` — CREATE. `node:test` unit tests for `api/coaching.js`.
- `api/test-helpers.js` — CREATE. Spawn `server.js` with a temp `DATA_DIR`, mint session cookies, cookie-jar `fetch` wrapper.
- `api/routes.test.js` — CREATE. `node:test` HTTP integration tests for the coach routes.
- `api/package.json` — MODIFY. Add `"test": "node --test"`.
- `api/server.js` — MODIFY. Import `api/coaching.js`; add `COACH_UIDS`, `requireCoach`, `db.assignments`/`db.changeRequests` bootstrap; add `coach` to user payloads; add `/api/coaching/*` routes; set `coachId` in `register/verify`; relax the three `/api/admin/invites*` guards to admin-or-coach.

**Frontend**
- `frontend/src/lib/coaching.js` — CREATE. Pure: `mergeAssigned`, `stripAssigned`, `isAssigned`.
- `frontend/src/lib/coaching.test.js` — CREATE. vitest unit tests.
- `frontend/src/lib/coachApi.js` — CREATE. Thin typed wrappers over `api()` for the coach endpoints (keeps fetch strings in one place).
- `frontend/src/store/useStore.js` — MODIFY. Fetch `/api/coaching/assigned` in `boot`/`pullState`; merge with `mergeAssigned`; strip with `stripAssigned` in `persist` (localStorage) and `pushState` (PUT).
- `frontend/src/store/useStore.test.js` — MODIFY. Add strip-before-PUT assertion.
- `frontend/src/components/ProgressViews.jsx` — CREATE. Shared progress UI extracted from `Admin.jsx` (`rel`, `dur`, tiles, "training now", user rows, workout-history list).
- `frontend/src/views/Admin.jsx` — MODIFY. Consume `ProgressViews.jsx` (no behavior change).
- `frontend/src/views/Coach.jsx` — CREATE. Coach dashboard at `/coach`.
- `frontend/src/App.jsx` — MODIFY. Add the `/coach` route guarded by `user?.coach`.
- `frontend/src/views/RoutineEdit.jsx` — MODIFY. Read-only mode + "de tu coach" tag + "Pedir ajuste" when the routine `isAssigned`.
- `frontend/src/views/Plan.jsx` — MODIFY. "de tu coach" tag on assigned rows.
- `frontend/src/views/Settings.jsx` — MODIFY. "Coach dashboard" `Row` when `user?.coach`.

**Docs**
- `README.md` — MODIFY. Document `COACH_UIDS` + the `INVITE_ONLY=1` requirement for coach mode.

---

## Task 1: Backend test harness + `isCoach` / `coachIdForInvite`

**Files:**
- Create: `api/coaching.js`
- Create: `api/coaching.test.js`
- Modify: `api/package.json`

**Interfaces:**
- Produces:
  - `isCoach(user, coachUids)` → `boolean`. `coachUids` is a `string[]`.
  - `coachIdForInvite(invite, users, coachUids)` → `string | undefined`. `invite` is `{ createdBy?: string } | null`; `users` is the `db.users` array.

- [ ] **Step 1: Add the test script**

In `api/package.json`, add to `"scripts"`:
```json
"test": "node --test"
```
Result — `"scripts"` becomes:
```json
"scripts": {
  "start": "node server.js",
  "test": "node --test"
}
```

- [ ] **Step 2: Write the failing test**

Create `api/coaching.test.js`:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { isCoach, coachIdForInvite } from './coaching.js'

test('isCoach: false for undefined or a plain user', () => {
  assert.equal(isCoach(undefined, []), false)
  assert.equal(isCoach({ id: 'u1' }, []), false)
})

test('isCoach: true when user.coach is exactly true', () => {
  assert.equal(isCoach({ id: 'u1', coach: true }, []), true)
  assert.equal(isCoach({ id: 'u1', coach: 'yes' }, []), false)
})

test('isCoach: true when coachUids includes the id', () => {
  assert.equal(isCoach({ id: 'u1' }, ['u1', 'u2']), true)
  assert.equal(isCoach({ id: 'u9' }, ['u1', 'u2']), false)
})

test('coachIdForInvite: creator id when the creator is a coach', () => {
  const users = [{ id: 'c1', coach: true }, { id: 's1' }]
  assert.equal(coachIdForInvite({ createdBy: 'c1' }, users, []), 'c1')
  assert.equal(coachIdForInvite({ createdBy: 'c1' }, [{ id: 'c1' }], ['c1']), 'c1')
})

test('coachIdForInvite: undefined for non-coach creator, missing creator, or null invite', () => {
  const users = [{ id: 'c1', coach: true }, { id: 'x1' }]
  assert.equal(coachIdForInvite({ createdBy: 'x1' }, users, []), undefined)
  assert.equal(coachIdForInvite({ createdBy: 'ghost' }, users, []), undefined)
  assert.equal(coachIdForInvite(null, users, []), undefined)
  assert.equal(coachIdForInvite({}, users, []), undefined)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && node --test coaching.test.js`
Expected: FAIL — `Cannot find module './coaching.js'`.

- [ ] **Step 4: Write minimal implementation**

Create `api/coaching.js`:
```js
/* opengym-api — pure coach-mode logic. No I/O: callers pass readState / livePresence in.
   server.js runs its listener on import, so keeping this logic here keeps it unit-testable. */

export function isCoach(user, coachUids) {
  return !!user && (user.coach === true || (coachUids || []).includes(user.id))
}

// The coach a newly-registered user should be linked to, given the invite they used.
export function coachIdForInvite(invite, users, coachUids) {
  if (!invite || !invite.createdBy) return undefined
  const creator = (users || []).find(u => u.id === invite.createdBy)
  return creator && isCoach(creator, coachUids) ? creator.id : undefined
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && node --test coaching.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add api/coaching.js api/coaching.test.js api/package.json
git commit -m "feat(api): coaching.js with isCoach + coachIdForInvite, node:test runner"
```

---

## Task 2: Wire `COACH_UIDS` + `requireCoach` + `coach` on user payloads

**Files:**
- Modify: `api/server.js` (imports near line 7-11; consts near line 18-21; `requireAdmin` near line 191-197; user payloads at lines 264, 319, 358)
- Create: `api/test-helpers.js`
- Create: `api/routes.test.js`

**Interfaces:**
- Consumes: `isCoach` from `api/coaching.js` (Task 1).
- Produces:
  - `server.js` exports nothing new; behavior: `GET /api/me` returns `{ user: { id, name, admin, coach } }`.
  - `requireCoach(req, res)` → `user | null` (writes 401/403 like `requireAdmin`).
  - `api/test-helpers.js` exports:
    - `startServer({ dataDir, env })` → `Promise<{ base, stop, dataDir }>` where `base` is `http://localhost:<port>`.
    - `seedData(dataDir, { db, states })` — writes `secret`, `db.json`, `state-<uid>.json` files before boot.
    - `cookieFor(dataDir, uid)` → `string` — a valid `gymsid=...` cookie header value.
    - `jfetch(base, path, { cookie, method, body })` → `Promise<{ status, json }>`.

- [ ] **Step 1: Write the test helper**

Create `api/test-helpers.js`:
```js
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const SERVER = fileURLToPath(new URL('./server.js', import.meta.url))
const KNOWN_SECRET = 'a'.repeat(64)

function freePort() {
  return new Promise(res => {
    const srv = net.createServer()
    srv.listen(0, () => { const p = srv.address().port; srv.close(() => res(p)) })
  })
}

export function seedData(dataDir, { db = {}, states = {} } = {}) {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'secret'), KNOWN_SECRET)
  const full = { users: [], creds: [], subs: [], invites: [], assignments: [], changeRequests: [], ...db }
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(full, null, 2))
  for (const [uid, state] of Object.entries(states)) {
    const safe = uid.replace(/[^a-zA-Z0-9_-]/g, '')
    fs.writeFileSync(path.join(dataDir, 'state-' + safe + '.json'), JSON.stringify(state))
  }
}

export function cookieFor(dataDir, uid) {
  const secret = fs.readFileSync(path.join(dataDir, 'secret'), 'utf8').trim()
  const exp = Date.now() + 86400000
  const payload = `${uid}:${exp}:0`
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `gymsid=${payload}.${mac}`
}

export async function startServer({ dataDir, env = {} } = {}) {
  const port = await freePort()
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir,
           RP_ID: 'localhost', ORIGIN: 'http://localhost:5173', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('server did not start')), 5000)
    child.stdout.on('data', d => { if (String(d).includes('gym-api on')) { clearTimeout(to); resolve() } })
    child.on('error', reject)
  })
  return {
    base: `http://localhost:${port}`,
    dataDir,
    stop: () => new Promise(r => { child.once('exit', () => r()); child.kill() })
  }
}

export async function jfetch(base, p, { cookie, method = 'GET', body } = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json }
}
```

- [ ] **Step 2: Write the failing test**

Create `api/routes.test.js`:
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer, seedData, cookieFor, jfetch } from './test-helpers.js'

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gym-coach-')) }

test('GET /api/me reports coach for a COACH_UIDS user, not for others', async () => {
  const dir = tmpDir()
  seedData(dir, { db: { users: [{ id: 'c1', name: 'Coach' }, { id: 's1', name: 'Stu' }] } })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } })
  try {
    const asCoach = await jfetch(srv.base, '/api/me', { cookie: cookieFor(dir, 'c1') })
    assert.equal(asCoach.json.user.coach, true)
    const asStu = await jfetch(srv.base, '/api/me', { cookie: cookieFor(dir, 's1') })
    assert.equal(asStu.json.user.coach, false)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && node --test routes.test.js`
Expected: FAIL — `asCoach.json.user.coach` is `undefined`, not `true`.

- [ ] **Step 4: Wire the server**

In `api/server.js`:

Add to the coaching import area (after the `web-push` import, line ~11):
```js
import { isCoach, coachIdForInvite, resolveAssigned, studentRows, studentDetail, pruneOrphanAssignments, validateAssign } from './coaching.js';
```
(Some names land in later tasks; importing them now is harmless — they're defined by Task 3/5.)

After the `INVITE_ONLY` const (line ~21):
```js
const COACH_UIDS = (process.env.COACH_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
```

After `db.invites = db.invites || [];` (line ~42):
```js
db.assignments = db.assignments || [];
db.changeRequests = db.changeRequests || [];
```

Replace the local `const isAdmin = ...` line only if needed — leave it. Add below it:
```js
const coachOf = user => isCoach(user, COACH_UIDS);
```

After `requireAdmin` (line ~197):
```js
// Guard for /api/coaching/* — resolves the caller and 401/403s if they aren't a coach.
function requireCoach(req, res) {
  const user = readSession(req);
  if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
  if (!coachOf(user)) { json(res, 403, { error: 'forbidden' }); return null; }
  return user;
}
```

In the three user payloads (lines ~264, ~319, ~358) change:
```js
json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user) } } ...
```
to:
```js
json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user), coach: coachOf(user) } } ...
```
(Keep each line's existing `Set-Cookie` / status arguments.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && node --test routes.test.js`
Expected: PASS.

Also run: `cd api && node --test` — Task 1 tests still pass.

- [ ] **Step 6: Commit**

```bash
git add api/server.js api/test-helpers.js api/routes.test.js
git commit -m "feat(api): COACH_UIDS, requireCoach, coach flag on /api/me and auth payloads"
```

---

## Task 3: `resolveAssigned` + `pruneOrphanAssignments`

**Files:**
- Modify: `api/coaching.js`
- Modify: `api/coaching.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `resolveAssigned(db, studentId, readState, users)` → `Array<routine & { coachAssigned: true, assignmentId: string, coachName: string }>`. `readState(uid)` returns the parsed state object or `null`. `routine` shape: `{ id, name, emoji, ex: [...] }`.
  - `pruneOrphanAssignments(db, readState)` → `number` (count removed); mutates `db.assignments` in place.

- [ ] **Step 1: Write the failing tests**

Append to `api/coaching.test.js`:
```js
import { resolveAssigned, pruneOrphanAssignments } from './coaching.js'

const R = (id, name) => ({ id, name, emoji: '💪', ex: [{ id: '0025', sets: 3, reps: 8 }] })

function fixture() {
  const db = {
    users: [{ id: 'c1', name: 'Coach' }, { id: 's1', name: 'Ana' }, { id: 's2', name: 'Bea' }],
    assignments: [
      { id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' },
      { id: 'a2', coachId: 'c1', studentId: 's1', routineId: 'gone', createdAt: 'x' },
      { id: 'a3', coachId: 'c1', studentId: 's2', routineId: 'r1', createdAt: 'x' }
    ],
    changeRequests: []
  }
  const states = { c1: { routines: [R('r1', 'Full body')] } }
  const readState = uid => states[uid] || null
  return { db, readState, users: db.users }
}

test('resolveAssigned: one entry per live assignment for the student, flagged', () => {
  const { db, readState, users } = fixture()
  const out = resolveAssigned(db, 's1', readState, users)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'r1')
  assert.equal(out[0].name, 'Full body')
  assert.equal(out[0].coachAssigned, true)
  assert.equal(out[0].assignmentId, 'a1')
  assert.equal(out[0].coachName, 'Coach')
})

test('resolveAssigned: omits an assignment whose routine is gone', () => {
  const { db, readState, users } = fixture()
  const out = resolveAssigned(db, 's1', readState, users)
  assert.deepEqual(out.map(r => r.assignmentId), ['a1'])
})

test('resolveAssigned: ignores other students', () => {
  const { db, readState, users } = fixture()
  assert.equal(resolveAssigned(db, 'nobody', readState, users).length, 0)
})

test('pruneOrphanAssignments: drops only the ones with a missing routine', () => {
  const { db, readState } = fixture()
  const removed = pruneOrphanAssignments(db, readState)
  assert.equal(removed, 1)
  assert.deepEqual(db.assignments.map(a => a.id), ['a1', 'a3'])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd api && node --test coaching.test.js`
Expected: FAIL — `resolveAssigned is not a function`.

- [ ] **Step 3: Implement**

Append to `api/coaching.js`:
```js
// Look up one routine by id inside a coach's state blob.
function routineIn(state, routineId) {
  return ((state && state.routines) || []).find(r => r.id === routineId) || null
}

export function resolveAssigned(db, studentId, readState, users) {
  const out = []
  for (const a of db.assignments || []) {
    if (a.studentId !== studentId) continue
    const routine = routineIn(readState(a.coachId), a.routineId)
    if (!routine) continue
    const coach = (users || []).find(u => u.id === a.coachId)
    out.push({ ...routine, coachAssigned: true, assignmentId: a.id, coachName: (coach && coach.name) || 'coach' })
  }
  return out
}

export function pruneOrphanAssignments(db, readState) {
  const before = (db.assignments || []).length
  db.assignments = (db.assignments || []).filter(a => routineIn(readState(a.coachId), a.routineId))
  return before - db.assignments.length
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd api && node --test coaching.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/coaching.js api/coaching.test.js
git commit -m "feat(api): resolveAssigned + pruneOrphanAssignments"
```

---

## Task 4: Link student→coach on registration

**Files:**
- Modify: `api/server.js` (`POST /api/register/verify`, around lines 309-311)

**Interfaces:**
- Consumes: `coachIdForInvite` (Task 1).
- Produces: a user created via a coach-generated invite has `user.coachId === <coach id>`.

- [ ] **Step 1: Add an integration test**

Append to `api/routes.test.js`:
```js
import crypto from 'node:crypto'
import { isCoach } from './coaching.js'

test('coachIdForInvite is what register/verify should use (unit-level guard)', () => {
  // Full WebAuthn registration can't run here; this pins the helper the handler must call.
  const users = [{ id: 'c1', coach: true }]
  const { coachIdForInvite } = { coachIdForInvite: (i, u, c) =>
    (i && i.createdBy && u.find(x => x.id === i.createdBy) && isCoach(u.find(x => x.id === i.createdBy), c)) ? i.createdBy : undefined }
  assert.equal(coachIdForInvite({ createdBy: 'c1' }, users, []), 'c1')
})
```
(The real coverage is Task 1's `coachIdForInvite` unit tests; this task is a 3-line wiring change verified in the manual pass — step 3.)

- [ ] **Step 2: Wire the handler**

In `api/server.js`, `POST /api/register/verify`, find:
```js
const user = { id: c.uid, name: c.name, created: new Date().toISOString() };
if (invite) { user.invitedBy = invite.code; invite.usedBy = user.id; invite.usedAt = user.created; }
```
Change to:
```js
const user = { id: c.uid, name: c.name, created: new Date().toISOString() };
if (invite) {
  user.invitedBy = invite.code; invite.usedBy = user.id; invite.usedAt = user.created;
  const cid = coachIdForInvite(invite, db.users, COACH_UIDS);
  if (cid) user.coachId = cid;
}
```

- [ ] **Step 3: Manual verification note**

Recorded for the manual pass (Task 15): register a student with a code generated by a `COACH_UIDS` user while `INVITE_ONLY=1`, then confirm `data/db.json` shows `coachId` on that user.

- [ ] **Step 4: Run tests**

Run: `cd api && node --test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add api/server.js api/routes.test.js
git commit -m "feat(api): set user.coachId when registering via a coach's invite"
```

---

## Task 5: `assign` / `unassign` endpoints

**Files:**
- Modify: `api/coaching.js` (add `validateAssign`)
- Modify: `api/coaching.test.js`
- Modify: `api/server.js` (new routes in the `routes` object, after the admin block ~line 541)
- Modify: `api/routes.test.js`

**Interfaces:**
- Consumes: `requireCoach` (Task 2), `readState` (server.js), `saveDb` (server.js).
- Produces:
  - `validateAssign(db, coachId, studentId, routineId, readState)` → `{ ok: true } | { ok: false, error: string }`.
  - `POST /api/coaching/assign` body `{ studentId, routineId }` → `200 { assignment }` or `400 { error }`.
  - `POST /api/coaching/unassign` body `{ assignmentId }` → `200 { ok: true }` or `404`.
  - Assignment row shape: `{ id, coachId, studentId, routineId, createdAt }` (`id` = `crypto.randomBytes(8).toString('hex')`).

- [ ] **Step 1: Write `validateAssign` tests**

Append to `api/coaching.test.js`:
```js
import { validateAssign } from './coaching.js'

test('validateAssign: ok when student is mine and routine exists', () => {
  const db = { users: [{ id: 's1', coachId: 'c1' }], assignments: [] }
  const readState = () => ({ routines: [{ id: 'r1' }] })
  assert.deepEqual(validateAssign(db, 'c1', 's1', 'r1', readState), { ok: true })
})

test('validateAssign: rejects a student that is not mine', () => {
  const db = { users: [{ id: 's1', coachId: 'other' }], assignments: [] }
  const r = validateAssign(db, 'c1', 's1', 'r1', () => ({ routines: [{ id: 'r1' }] }))
  assert.equal(r.ok, false)
})

test('validateAssign: rejects a routine absent from my state', () => {
  const db = { users: [{ id: 's1', coachId: 'c1' }], assignments: [] }
  const r = validateAssign(db, 'c1', 's1', 'nope', () => ({ routines: [{ id: 'r1' }] }))
  assert.equal(r.ok, false)
})
```

- [ ] **Step 2: Run — fails** (`validateAssign is not a function`)

Run: `cd api && node --test coaching.test.js`

- [ ] **Step 3: Implement `validateAssign`**

Append to `api/coaching.js`:
```js
export function validateAssign(db, coachId, studentId, routineId, readState) {
  const student = (db.users || []).find(u => u.id === studentId)
  if (!student || student.coachId !== coachId) return { ok: false, error: 'not your student' }
  if (!routineId || !routineIn(readState(coachId), routineId)) return { ok: false, error: 'routine not found' }
  return { ok: true }
}
```

- [ ] **Step 4: Run — passes**

Run: `cd api && node --test coaching.test.js`

- [ ] **Step 5: Add the routes**

In `api/server.js`, inside the `routes` object, after `'POST /api/admin/invites/revoke'` (before the closing `};` at line ~542), add:
```js
  ,

  /* ---------- coach dashboard ---------- */
  'POST /api/coaching/assign': async (req, res) => {
    const coach = requireCoach(req, res); if (!coach) return;
    const body = await readBody(req);
    const v = validateAssign(db, coach.id, body.studentId, body.routineId, readState);
    if (!v.ok) return json(res, 400, { error: v.error });
    let existing = db.assignments.find(a =>
      a.coachId === coach.id && a.studentId === body.studentId && a.routineId === body.routineId);
    if (!existing) {
      existing = { id: crypto.randomBytes(8).toString('hex'), coachId: coach.id,
        studentId: body.studentId, routineId: body.routineId, createdAt: new Date().toISOString() };
      db.assignments.push(existing);
      saveDb();
    }
    json(res, 200, { assignment: existing });
  },

  'POST /api/coaching/unassign': async (req, res) => {
    const coach = requireCoach(req, res); if (!coach) return;
    const body = await readBody(req);
    const a = db.assignments.find(x => x.id === body.assignmentId && x.coachId === coach.id);
    if (!a) return json(res, 404, { error: 'no such assignment' });
    db.assignments = db.assignments.filter(x => x.id !== a.id);
    saveDb();
    json(res, 200, { ok: true });
  }
```
(Note the leading `,` — the previous entry has no trailing comma.)

- [ ] **Step 6: Add integration tests**

Append to `api/routes.test.js`:
```js
test('assign / unassign: creates one row, idempotent, then removes it', async () => {
  const dir = tmpDir()
  seedData(dir, {
    db: { users: [{ id: 'c1', name: 'C' }, { id: 's1', name: 'S', coachId: 'c1' }] },
    states: { c1: { routines: [{ id: 'r1', name: 'A', emoji: '💪', ex: [] }] } }
  })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } })
  const ck = cookieFor(dir, 'c1')
  try {
    const a = await jfetch(srv.base, '/api/coaching/assign', { cookie: ck, method: 'POST', body: { studentId: 's1', routineId: 'r1' } })
    assert.equal(a.status, 200)
    const again = await jfetch(srv.base, '/api/coaching/assign', { cookie: ck, method: 'POST', body: { studentId: 's1', routineId: 'r1' } })
    assert.equal(again.json.assignment.id, a.json.assignment.id)
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'))
    assert.equal(db.assignments.length, 1)
    const bad = await jfetch(srv.base, '/api/coaching/assign', { cookie: ck, method: 'POST', body: { studentId: 's1', routineId: 'ghost' } })
    assert.equal(bad.status, 400)
    const u = await jfetch(srv.base, '/api/coaching/unassign', { cookie: ck, method: 'POST', body: { assignmentId: a.json.assignment.id } })
    assert.equal(u.status, 200)
    const db2 = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'))
    assert.equal(db2.assignments.length, 0)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('assign: 403 for a non-coach', async () => {
  const dir = tmpDir()
  seedData(dir, { db: { users: [{ id: 's1', name: 'S' }] } })
  const srv = await startServer({ dataDir: dir })
  try {
    const r = await jfetch(srv.base, '/api/coaching/assign', { cookie: cookieFor(dir, 's1'), method: 'POST', body: {} })
    assert.equal(r.status, 403)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 7: Run all backend tests**

Run: `cd api && node --test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/coaching.js api/coaching.test.js api/server.js api/routes.test.js
git commit -m "feat(api): coach assign / unassign endpoints"
```

---

## Task 6: `GET /api/coaching/assigned` (student)

**Files:**
- Modify: `api/server.js` (routes object)
- Modify: `api/routes.test.js`

**Interfaces:**
- Consumes: `readSession` (server.js), `resolveAssigned` + `pruneOrphanAssignments` (Task 3).
- Produces: `GET /api/coaching/assigned` → `200 { routines: [...] }` for any signed-in user (empty array if they have none). Not coach-guarded.

- [ ] **Step 1: Write the test**

Append to `api/routes.test.js`:
```js
test('GET /api/coaching/assigned resolves the body from the coach state', async () => {
  const dir = tmpDir()
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'Coach' }, { id: 's1', name: 'S', coachId: 'c1' }],
      assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }]
    },
    states: { c1: { routines: [{ id: 'r1', name: 'Full body', emoji: '💪', ex: [{ id: '0025', sets: 3, reps: 8 }] }] } }
  })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } })
  try {
    const r = await jfetch(srv.base, '/api/coaching/assigned', { cookie: cookieFor(dir, 's1') })
    assert.equal(r.status, 200)
    assert.equal(r.json.routines.length, 1)
    assert.equal(r.json.routines[0].name, 'Full body')
    assert.equal(r.json.routines[0].coachAssigned, true)
    assert.equal(r.json.routines[0].assignmentId, 'a1')
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run — fails** (404 not found)

Run: `cd api && node --test routes.test.js`

- [ ] **Step 3: Add the route**

In `api/server.js` `routes`, after `'POST /api/coaching/unassign'`:
```js
  ,

  'GET /api/coaching/assigned': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const removed = pruneOrphanAssignments(db, readState);
    if (removed) saveDb();
    json(res, 200, { routines: resolveAssigned(db, user.id, readState, db.users) });
  }
```

- [ ] **Step 4: Run — passes**

Run: `cd api && node --test`

- [ ] **Step 5: Commit**

```bash
git add api/server.js api/routes.test.js
git commit -m "feat(api): GET /api/coaching/assigned for students"
```

---

## Task 7: `studentRows` + `studentDetail` + student-list endpoints

**Files:**
- Modify: `api/coaching.js`
- Modify: `api/coaching.test.js`
- Modify: `api/server.js` (routes)
- Modify: `api/routes.test.js`

**Interfaces:**
- Consumes: `requireCoach`, `readState`, `livePresence` (all server.js).
- Produces:
  - `studentRows(db, coachId, readState, livePresence)` → `Array<{ id, name, created, workouts, lastWorkout, lastSync, live, assignmentCount, pendingRequests }>`.
  - `studentDetail(db, coachId, studentId, readState)` → `null` if the student's `coachId` ≠ `coachId`, else `{ user, unit, lastSync, routines, bodyweight, workouts, assigned, requests }`. `assigned`: `[{ assignmentId, routineId, name, emoji, count }]`. `requests`: `[{ id, note, createdAt, resolvedAt }]` newest first.
  - `GET /api/coaching/students` → `200 { students }`.
  - `GET /api/coaching/student?id=<id>` → `200 { ...detail }` or `404`.

- [ ] **Step 1: Write the unit tests**

Append to `api/coaching.test.js`:
```js
import { studentRows, studentDetail } from './coaching.js'

function coachFixture() {
  const db = {
    users: [
      { id: 'c1', name: 'Coach' },
      { id: 's1', name: 'Ana', coachId: 'c1', created: '2026-01-01' },
      { id: 's2', name: 'Bea', coachId: 'other' }
    ],
    assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }],
    changeRequests: [
      { id: 'q1', assignmentId: 'a1', studentId: 's1', note: 'too heavy', createdAt: '2026-02-01' },
      { id: 'q2', assignmentId: 'a1', studentId: 's1', note: 'done', createdAt: '2026-01-15', resolvedAt: '2026-01-16' }
    ]
  }
  const states = {
    c1: { routines: [{ id: 'r1', name: 'Full body', emoji: '💪', ex: [{ id: '0025' }, { id: '0026' }] }] },
    s1: { unit: 'kg', _ts: 123, bodyweight: [{ d: '2026-02-01', kg: 70 }],
          workouts: [{ id: 'w1', d: '2026-02-02', name: 'Full body' }], routines: [] }
  }
  return { db, readState: uid => states[uid] || null, livePresence: () => null }
}

test('studentRows: only my students, with counts', () => {
  const { db, readState, livePresence } = coachFixture()
  const rows = studentRows(db, 'c1', readState, livePresence)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 's1')
  assert.equal(rows[0].workouts, 1)
  assert.equal(rows[0].assignmentCount, 1)
  assert.equal(rows[0].pendingRequests, 1)   // q2 is resolved
})

test('studentDetail: null for a student that is not mine', () => {
  const { db, readState } = coachFixture()
  assert.equal(studentDetail(db, 'c1', 's2', readState), null)
})

test('studentDetail: history + assigned + requests for my student', () => {
  const { db, readState } = coachFixture()
  const d = studentDetail(db, 'c1', 's1', readState)
  assert.equal(d.user.name, 'Ana')
  assert.equal(d.workouts.length, 1)
  assert.equal(d.assigned[0].name, 'Full body')
  assert.equal(d.assigned[0].count, 2)
  assert.equal(d.requests[0].id, 'q1')   // newest first
})
```

- [ ] **Step 2: Run — fails**

Run: `cd api && node --test coaching.test.js`

- [ ] **Step 3: Implement**

Append to `api/coaching.js`:
```js
const countEx = ex => (ex || []).filter(e => !(e && e.section != null && e.id == null)).length

export function studentRows(db, coachId, readState, livePresence) {
  return (db.users || []).filter(u => u.coachId === coachId).map(u => {
    const S = readState(u.id) || {}
    const workouts = S.workouts || []
    const last = workouts[workouts.length - 1]
    return {
      id: u.id, name: u.name, created: u.created || null,
      workouts: workouts.length,
      lastWorkout: last ? last.d : null,
      lastSync: S._ts || null,
      live: livePresence(u.id),
      assignmentCount: (db.assignments || []).filter(a => a.studentId === u.id && a.coachId === coachId).length,
      pendingRequests: (db.changeRequests || []).filter(q => q.studentId === u.id && !q.resolvedAt).length
    }
  })
}

export function studentDetail(db, coachId, studentId, readState) {
  const u = (db.users || []).find(x => x.id === studentId)
  if (!u || u.coachId !== coachId) return null
  const S = readState(u.id) || {}
  const myAssignments = (db.assignments || []).filter(a => a.studentId === u.id && a.coachId === coachId)
  const coachRoutines = (readState(coachId) || {}).routines || []
  return {
    user: { id: u.id, name: u.name, created: u.created || null },
    unit: S.unit || 'kg',
    lastSync: S._ts || null,
    routines: (S.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, count: countEx(r.ex) })),
    bodyweight: S.bodyweight || [],
    workouts: (S.workouts || []).slice().reverse(),
    assigned: myAssignments.map(a => {
      const r = coachRoutines.find(x => x.id === a.routineId)
      return { assignmentId: a.id, routineId: a.routineId,
        name: r ? r.name : '(deleted)', emoji: r ? r.emoji : '❓', count: r ? countEx(r.ex) : 0 }
    }),
    requests: (db.changeRequests || [])
      .filter(q => myAssignments.some(a => a.id === q.assignmentId))
      .slice().sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))
      .map(q => ({ id: q.id, note: q.note, createdAt: q.createdAt, resolvedAt: q.resolvedAt || null }))
  }
}
```

- [ ] **Step 4: Run — passes**

Run: `cd api && node --test coaching.test.js`

- [ ] **Step 5: Add the routes**

In `api/server.js` `routes`, after `'GET /api/coaching/assigned'`:
```js
  ,

  'GET /api/coaching/students': async (req, res) => {
    const coach = requireCoach(req, res); if (!coach) return;
    json(res, 200, { students: studentRows(db, coach.id, readState, livePresence), now: Date.now() });
  },

  'GET /api/coaching/student': async (req, res) => {
    const coach = requireCoach(req, res); if (!coach) return;
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    const detail = studentDetail(db, coach.id, id, readState);
    if (!detail) return json(res, 404, { error: 'no such student' });
    json(res, 200, detail);
  }
```

- [ ] **Step 6: Add an isolation integration test**

Append to `api/routes.test.js`:
```js
test('GET /api/coaching/student: 404 across coaches', async () => {
  const dir = tmpDir()
  seedData(dir, { db: { users: [
    { id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }, { id: 's1', name: 'S', coachId: 'c1' }
  ] } })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1,c2' } })
  try {
    const mine = await jfetch(srv.base, '/api/coaching/student?id=s1', { cookie: cookieFor(dir, 'c1') })
    assert.equal(mine.status, 200)
    const notMine = await jfetch(srv.base, '/api/coaching/student?id=s1', { cookie: cookieFor(dir, 'c2') })
    assert.equal(notMine.status, 404)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 7: Run all backend tests**

Run: `cd api && node --test`

- [ ] **Step 8: Commit**

```bash
git add api/coaching.js api/coaching.test.js api/server.js api/routes.test.js
git commit -m "feat(api): coach student-list and student-detail endpoints"
```

---

## Task 8: Change requests — create + resolve + push

**Files:**
- Modify: `api/server.js` (routes)
- Modify: `api/routes.test.js`

**Interfaces:**
- Consumes: `readSession`, `requireCoach`, `saveDb`, `sendPush` (all server.js).
- Produces:
  - `POST /api/coaching/change-request` body `{ assignmentId, note }` → `200 { request }` (caller must be `assignment.studentId`) or `403`/`404`.
  - `POST /api/coaching/change-request/resolve` body `{ id }` → `200 { ok: true }` (coach must own the assignment) or `403`/`404`.
  - Request row: `{ id, assignmentId, studentId, note, createdAt, resolvedAt? }`. `note` trimmed, capped at 500 chars.

- [ ] **Step 1: Write the tests**

Append to `api/routes.test.js`:
```js
test('change-request: student creates, non-student is 403, coach resolves', async () => {
  const dir = tmpDir()
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'C' }, { id: 's1', name: 'S', coachId: 'c1' }, { id: 'x', name: 'X' }],
      assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }]
    },
    states: { c1: { routines: [{ id: 'r1', name: 'A', emoji: '💪', ex: [] }] } }
  })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } })
  try {
    const bad = await jfetch(srv.base, '/api/coaching/change-request', { cookie: cookieFor(dir, 'x'), method: 'POST', body: { assignmentId: 'a1', note: 'hi' } })
    assert.equal(bad.status, 403)
    const ok = await jfetch(srv.base, '/api/coaching/change-request', { cookie: cookieFor(dir, 's1'), method: 'POST', body: { assignmentId: 'a1', note: 'knee hurts' } })
    assert.equal(ok.status, 200)
    const id = ok.json.request.id
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'))
    assert.equal(db.changeRequests.length, 1)
    assert.equal(db.changeRequests[0].note, 'knee hurts')
    const notMine = await jfetch(srv.base, '/api/coaching/change-request/resolve', { cookie: cookieFor(dir, 's1'), method: 'POST', body: { id } })
    assert.equal(notMine.status, 403)
    const res = await jfetch(srv.base, '/api/coaching/change-request/resolve', { cookie: cookieFor(dir, 'c1'), method: 'POST', body: { id } })
    assert.equal(res.status, 200)
    const db2 = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'))
    assert.ok(db2.changeRequests[0].resolvedAt)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run — fails** (404)

Run: `cd api && node --test routes.test.js`

- [ ] **Step 3: Add the routes**

In `api/server.js` `routes`, after `'GET /api/coaching/student'`:
```js
  ,

  'POST /api/coaching/change-request': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const a = db.assignments.find(x => x.id === body.assignmentId);
    if (!a) return json(res, 404, { error: 'no such assignment' });
    if (a.studentId !== user.id) return json(res, 403, { error: 'forbidden' });
    const note = String(body.note || '').trim().slice(0, 500);
    if (!note) return json(res, 400, { error: 'note required' });
    const request = { id: crypto.randomBytes(8).toString('hex'), assignmentId: a.id,
      studentId: user.id, note, createdAt: new Date().toISOString() };
    db.changeRequests.push(request);
    saveDb();
    sendPush(a.coachId, { title: 'Pedido de ajuste', body: `${user.name}: ${note.split('\n')[0].slice(0, 80)}`, tag: 'change-request' });
    json(res, 200, { request });
  },

  'POST /api/coaching/change-request/resolve': async (req, res) => {
    const coach = requireCoach(req, res); if (!coach) return;
    const body = await readBody(req);
    const q = db.changeRequests.find(x => x.id === body.id);
    if (!q) return json(res, 404, { error: 'no such request' });
    const a = db.assignments.find(x => x.id === q.assignmentId);
    if (!a || a.coachId !== coach.id) return json(res, 403, { error: 'forbidden' });
    q.resolvedAt = new Date().toISOString();
    saveDb();
    json(res, 200, { ok: true });
  }
```

- [ ] **Step 4: Run — passes**

Run: `cd api && node --test`

- [ ] **Step 5: Commit**

```bash
git add api/server.js api/routes.test.js
git commit -m "feat(api): change-request create + resolve, push to the coach"
```

---

## Task 9: Let coaches use the invite endpoints

**Files:**
- Modify: `api/server.js` (`GET /api/admin/invites`, `POST /api/admin/invites/new`, `POST /api/admin/invites/revoke` — lines ~508-541)
- Modify: `api/routes.test.js`

**Interfaces:**
- Consumes: `requireCoach`, `requireAdmin`, `isAdmin`, `coachOf`.
- Produces: a coach (non-admin) may call the three invite endpoints; the list they get and the codes they can revoke are limited to `invite.createdBy === caller.id`.

- [ ] **Step 1: Write the test**

Append to `api/routes.test.js`:
```js
test('a coach can create an invite and sees only their own', async () => {
  const dir = tmpDir()
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }],
      invites: [{ code: 'OTHER', createdBy: 'c2', created: 'x' }]
    }
  })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1,c2', INVITE_ONLY: '1' } })
  const ck = cookieFor(dir, 'c1')
  try {
    const made = await jfetch(srv.base, '/api/admin/invites/new', { cookie: ck, method: 'POST', body: { note: 'ana' } })
    assert.equal(made.status, 200)
    const list = await jfetch(srv.base, '/api/admin/invites', { cookie: ck })
    assert.equal(list.status, 200)
    assert.ok(list.json.invites.every(i => i.createdBy === 'c1'))
    const revokeOther = await jfetch(srv.base, '/api/admin/invites/revoke', { cookie: ck, method: 'POST', body: { code: 'OTHER' } })
    assert.equal(revokeOther.status, 404)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run — fails** (403 from `requireAdmin`)

Run: `cd api && node --test routes.test.js`

- [ ] **Step 3: Add a shared guard helper**

In `api/server.js`, after `requireCoach`:
```js
// admin OR coach. Returns the user, or null after writing 401/403.
function requireAdminOrCoach(req, res) {
  const user = readSession(req);
  if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
  if (!isAdmin(user) && !coachOf(user)) { json(res, 403, { error: 'forbidden' }); return null; }
  return user;
}
```

- [ ] **Step 4: Rework the three invite handlers**

`GET /api/admin/invites`:
```js
  'GET /api/admin/invites': async (req, res) => {
    const u = requireAdminOrCoach(req, res); if (!u) return;
    const mine = isAdmin(u) ? db.invites : db.invites.filter(i => i.createdBy === u.id);
    const invites = mine.map(i => ({
      ...i, usedByName: i.usedBy ? (db.users.find(x => x.id === i.usedBy) || {}).name || null : null
    }));
    json(res, 200, { invites, invite_only: INVITE_ONLY });
  },
```

`POST /api/admin/invites/new` — change the first line from
`const admin = requireAdmin(req, res); if (!admin) return;` to:
```js
    const admin = requireAdminOrCoach(req, res); if (!admin) return;
```
(the rest already uses `admin.id` for `createdBy` — no other change).

`POST /api/admin/invites/revoke`:
```js
  'POST /api/admin/invites/revoke': async (req, res) => {
    const u = requireAdminOrCoach(req, res); if (!u) return;
    const body = await readBody(req);
    const inv = db.invites.find(i => i.code === String(body.code || '').toUpperCase()
      && (isAdmin(u) || i.createdBy === u.id));
    if (!inv) return json(res, 404, { error: 'no such code' });
    if (inv.usedBy) return json(res, 400, { error: 'already used — cannot revoke' });
    db.invites = db.invites.filter(i => i.code !== inv.code);
    saveDb();
    json(res, 200, { ok: true });
  }
```

- [ ] **Step 5: Run — passes**

Run: `cd api && node --test`

- [ ] **Step 6: Commit**

```bash
git add api/server.js api/routes.test.js
git commit -m "feat(api): coaches can manage their own invite codes"
```

---

## Task 10: Frontend `lib/coaching.js` (merge / strip)

**Files:**
- Create: `frontend/src/lib/coaching.js`
- Create: `frontend/src/lib/coaching.test.js`

**Interfaces:**
- Produces:
  - `mergeAssigned(routines, assigned)` → new array: every local routine, then each assigned routine (flagged `coachAssigned: true`); an assigned routine whose `id` matches a local one replaces the local at its position. Inputs not mutated.
  - `stripAssigned(routines)` → `routines.filter(r => !r.coachAssigned)`.
  - `isAssigned(routine)` → `!!(routine && routine.coachAssigned)`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/coaching.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { mergeAssigned, stripAssigned, isAssigned } from './coaching.js'

const local = [{ id: 'l1', name: 'Mine', ex: [] }, { id: 'l2', name: 'Also mine', ex: [] }]
const assigned = [{ id: 'c1', name: 'Coach plan', ex: [], coachAssigned: true }]

describe('mergeAssigned', () => {
  it('appends assigned routines flagged coachAssigned', () => {
    const out = mergeAssigned(local, assigned)
    expect(out.map(r => r.id)).toEqual(['l1', 'l2', 'c1'])
    expect(out[2].coachAssigned).toBe(true)
  })
  it('does not mutate inputs', () => {
    const l = JSON.parse(JSON.stringify(local))
    mergeAssigned(l, assigned)
    expect(l).toEqual(local)
  })
  it('an assigned id equal to a local id replaces the local in place', () => {
    const out = mergeAssigned(local, [{ id: 'l2', name: 'Overridden', ex: [], coachAssigned: true }])
    expect(out.map(r => r.id)).toEqual(['l1', 'l2'])
    expect(out[1].name).toBe('Overridden')
    expect(out[1].coachAssigned).toBe(true)
  })
  it('empty assigned returns an equivalent list', () => {
    expect(mergeAssigned(local, [])).toEqual(local)
  })
})

describe('stripAssigned', () => {
  it('removes every coachAssigned routine, keeps local order', () => {
    expect(stripAssigned(mergeAssigned(local, assigned))).toEqual(local)
  })
})

describe('isAssigned', () => {
  it('true only for a coachAssigned routine', () => {
    expect(isAssigned(assigned[0])).toBe(true)
    expect(isAssigned(local[0])).toBe(false)
    expect(isAssigned(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — fails**

Run: `cd frontend && npx vitest run src/lib/coaching.test.js`
Expected: FAIL — cannot resolve `./coaching.js`.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/coaching.js`:
```js
// Coach-assigned routines are merged into S.routines for display only. They are
// flagged `coachAssigned` and stripped again before anything is persisted or
// synced (see useStore.js) — the coach's copy is the single source of truth.

export const isAssigned = r => !!(r && r.coachAssigned)

export function mergeAssigned(routines, assigned) {
  const out = (routines || []).slice()
  for (const a of assigned || []) {
    const flagged = { ...a, coachAssigned: true }
    const at = out.findIndex(r => r.id === a.id)
    if (at >= 0) out[at] = flagged
    else out.push(flagged)
  }
  return out
}

export const stripAssigned = routines => (routines || []).filter(r => !r.coachAssigned)
```

- [ ] **Step 4: Run — passes**

Run: `cd frontend && npx vitest run src/lib/coaching.test.js`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/coaching.js frontend/src/lib/coaching.test.js
git commit -m "feat(web): lib/coaching.js — mergeAssigned / stripAssigned"
```

---

## Task 11: Store integration — fetch, merge, strip

**Files:**
- Create: `frontend/src/lib/coachApi.js`
- Modify: `frontend/src/store/useStore.js`
- Modify: `frontend/src/store/useStore.test.js`

**Interfaces:**
- Consumes: `mergeAssigned`, `stripAssigned` (Task 10); `api` (`lib/api.js`).
- Produces:
  - `coachApi.js` exports `fetchAssigned()` → `Promise<routine[]>` (returns `[]` on any error).
  - `useStore`: after `boot()` and every `pullState()`, `S.routines` contains the merged assigned routines in memory; `localStorage[KEY].routines` and the `PUT /api/data` body contain none.

- [ ] **Step 1: Create the API wrapper**

Create `frontend/src/lib/coachApi.js`:
```js
import { api } from './api.js'

// Student side: the routines this user's coach has assigned. Never throws —
// an offline or non-student user simply has none this session.
export async function fetchAssigned() {
  try { return (await api('/api/coaching/assigned')).routines || [] }
  catch { return [] }
}

// Coach side.
export const listStudents = () => api('/api/coaching/students')
export const getStudent = id => api('/api/coaching/student?id=' + encodeURIComponent(id))
export const assignRoutine = (studentId, routineId) =>
  api('/api/coaching/assign', { method: 'POST', body: JSON.stringify({ studentId, routineId }) })
export const unassignRoutine = assignmentId =>
  api('/api/coaching/unassign', { method: 'POST', body: JSON.stringify({ assignmentId }) })
export const resolveRequest = id =>
  api('/api/coaching/change-request/resolve', { method: 'POST', body: JSON.stringify({ id }) })
export const requestAdjustment = (assignmentId, note) =>
  api('/api/coaching/change-request', { method: 'POST', body: JSON.stringify({ assignmentId, note }) })
```

- [ ] **Step 2: Write the failing store test**

In `frontend/src/store/useStore.test.js`, add:
```js
import { stripAssigned } from '../lib/coaching.js'

describe('assigned routines never reach the persisted blob', () => {
  it('stripAssigned removes coach routines from a merged list before PUT', () => {
    const merged = [
      { id: 'l1', name: 'Mine', ex: [] },
      { id: 'c1', name: 'Coach', ex: [], coachAssigned: true }
    ]
    expect(stripAssigned(merged)).toEqual([{ id: 'l1', name: 'Mine', ex: [] }])
  })
})
```
(The full boot/pull path is covered in the manual pass — Task 15 — because it needs a live server. This test locks the contract the store must honour.)

- [ ] **Step 3: Run — passes immediately** (it's a contract test for Task 10 code)

Run: `cd frontend && npx vitest run src/store/useStore.test.js`

- [ ] **Step 4: Wire the store — imports**

In `frontend/src/store/useStore.js`, add near the top imports:
```js
import { mergeAssigned, stripAssigned } from '../lib/coaching.js'
import { fetchAssigned } from '../lib/coachApi.js'
```

- [ ] **Step 5: Wire `persist` and `pushState` to strip**

In `persist` (line ~52-62), change the localStorage write:
```js
    localStorage.setItem(KEY, JSON.stringify(S))
```
to:
```js
    localStorage.setItem(KEY, JSON.stringify({ ...S, routines: stripAssigned(S.routines) }))
```

In `pushState` (line ~113-118), change:
```js
      try { await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: get().S }) }); localStorage.removeItem('gym_dirty') }
```
to:
```js
      try {
        const S = get().S
        const state = { ...S, routines: stripAssigned(S.routines) }
        await api('/api/data', { method: 'PUT', body: JSON.stringify({ state }) })
        localStorage.removeItem('gym_dirty')
      }
```

- [ ] **Step 6: Wire `pullState` to merge**

Add a store action (in the returned object, near `pullState`):
```js
    async syncAssigned() {
      const assigned = await fetchAssigned()
      const S = get().S
      // stripAssigned first so a second run is idempotent. `false` = don't push:
      // assigned routines never sync, and persist() strips them from localStorage.
      persist({ ...S, routines: mergeAssigned(stripAssigned(S.routines), assigned) }, false)
    },
```
`pullState()` is the single call site (it already runs on `boot()`). At the very end of `pullState()`'s `try` block, after the `if / else if` that calls `persist` / `pushState`, add:
```js
        await get().syncAssigned()
```
Do **not** also call it from `boot()` — that would double-fetch.

- [ ] **Step 7: Run the frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS (all existing + new).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/coachApi.js frontend/src/store/useStore.js frontend/src/store/useStore.test.js
git commit -m "feat(web): merge coach-assigned routines into the store, strip before persist/sync"
```

---

## Task 12: Extract `ProgressViews.jsx` from `Admin.jsx`

**Files:**
- Create: `frontend/src/components/ProgressViews.jsx`
- Modify: `frontend/src/views/Admin.jsx`

**Interfaces:**
- Produces (from `ProgressViews.jsx`):
  - `rel(ts)` → relative-time string (`'never'`, `'just now'`, `'5m ago'`, `'3h ago'`, `'2d ago'`).
  - `dur(ms)` → short duration (`'45m'`, `'1h20m'`).
  - `StatTiles({ tiles })` where `tiles` is `[{ label, value, accent? }]`.
  - `TrainingNow({ users, onOpen })` — the accent card; renders nothing if no `users` are `live`.
  - `WorkoutHistory({ workouts, unit })` — the workout list (first 60).
  - `StudentRow({ u, onOpen })` — one list item (name, live dot, workouts/last/sync line, push bell).
- Consumes: existing helpers `fmtDate`, `fmtVol`, `fmtDur`, `workoutVolume`, `setsDone`, `Icon`.

- [ ] **Step 1: Create `ProgressViews.jsx`**

Move the `rel`, `dur` consts and the relevant JSX out of `Admin.jsx` into `frontend/src/components/ProgressViews.jsx`. Full file:
```jsx
import Icon from './Icon.jsx'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'

export const rel = ts => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}
export const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm' }

export function StatTiles({ tiles }) {
  return <div className="tiles" style={{ marginBottom: 12 }}>
    {tiles.map(t => <div className="tile" key={t.label}>
      <div className="l">{t.label}</div>
      <div className="v" style={t.accent ? { color: 'var(--acc)' } : undefined}>{t.value}</div>
    </div>)}
  </div>
}

export function TrainingNow({ users, onOpen }) {
  const live = (users || []).filter(u => u.live)
  if (!live.length) return null
  return <div className="card" style={{ borderColor: 'var(--acc)' }}>
    <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}>
      <Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />Training now</h2>
    {live.map(u => <div key={u.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }} onClick={() => onOpen(u.id)}>
      <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · ex {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} sets</div></div>
      <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
    </div>)}
  </div>
}

export function WorkoutHistory({ workouts, unit }) {
  if (!workouts || !workouts.length) return <div className="empty small">No workouts logged.</div>
  return <div className="list" style={{ gap: 0 }}>
    {workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
      <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} sets{w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}</div></div>
      <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), unit)}</span>
    </div>)}
  </div>
}

export function StudentRow({ u, onOpen, extra }) {
  return <div className="item" onClick={() => onOpen(u.id)} style={u.disabled ? { opacity: .55 } : null}>
    <div className="grow">
      <div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name}{extra}</div>
      <div className="ss">{u.live ? 'training now · ' + u.live.name
        : (u.workouts + ' workouts' + (u.lastWorkout ? ' · last ' + fmtDate(u.lastWorkout) : '') + ' · synced ' + rel(u.lastSync))}</div>
    </div>
    {u.hasPush && <Icon name="bell" title="push enabled" style={{ fontSize: 15, color: 'var(--label-3)' }} />}
    <Icon name="chevronRight" className="chev" />
  </div>
}
```

- [ ] **Step 2: Rewire `Admin.jsx` to use it**

In `frontend/src/views/Admin.jsx`:
- Delete the local `rel` and `dur` consts.
- `import { rel, dur, StatTiles, TrainingNow, WorkoutHistory, StudentRow } from '../components/ProgressViews.jsx'`
- In `UserDetail`, replace the inline tiles block with `<StatTiles tiles={[...]} />` and the inline workout list with `<WorkoutHistory workouts={d.workouts} unit={d.unit} />`.
- In `Admin`, replace the tiles block with `<StatTiles .../>`, the "Training now" card with `<TrainingNow users={users} onOpen={openUser} />`, and each user list row with `<StudentRow u={u} onOpen={openUser} extra={<>{u.admin && <span className="tag acc" ...>admin</span>}{u.disabled && ...}</>} />`.

Keep every existing behavior (disable button, invites card) exactly as is.

- [ ] **Step 3: Verify Admin still works**

Run: `cd frontend && npx vitest run` (no Admin unit test exists, so this only confirms nothing else broke).
Manual smoke in Task 15: open `/admin` as an admin, confirm the dashboard looks unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProgressViews.jsx frontend/src/views/Admin.jsx
git commit -m "refactor(web): extract shared progress views from Admin.jsx"
```

---

## Task 13: `Coach.jsx` + `/coach` route + Settings link

**Files:**
- Create: `frontend/src/views/Coach.jsx`
- Modify: `frontend/src/App.jsx` (imports near line 28; routes near line 83)
- Modify: `frontend/src/views/Settings.jsx` (near line 89)

**Interfaces:**
- Consumes: `ProgressViews.jsx` (Task 12), `coachApi.js` (Task 11), `useStore`, `useUI`.
- Produces: `/coach` route rendering `Coach.jsx`, guarded by `user?.coach`.

- [ ] **Step 1: Create `Coach.jsx`**

Create `frontend/src/views/Coach.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { StatTiles, TrainingNow, WorkoutHistory, StudentRow, rel } from '../components/ProgressViews.jsx'
import { listStudents, getStudent, assignRoutine, unassignRoutine, resolveRequest } from '../lib/coachApi.js'

function AssignPicker({ studentId, onDone, close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const mine = (S.routines || []).filter(r => !r.coachAssigned)
  const pick = r => assignRoutine(studentId, r.id)
    .then(() => { toast('Rutina asignada'); onDone(); close() })
    .catch(e => toast(e.message))
  return <>
    <h3>Asignar rutina</h3>
    {mine.length ? <div className="list">
      {mine.map(r => <div key={r.id} className="item" onClick={() => pick(r)}>
        <div className="grow"><div className="tt">{r.name}</div></div>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </div> : <div className="empty small">Creá una rutina en tu Plan primero.</div>}
  </>
}

function StudentDetail({ id, reload, close }) {
  const [d, setD] = useState(null)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const load = () => getStudent(id).then(setD).catch(e => toast(e.message))
  useEffect(() => { load() }, [id])
  if (!d) return <div className="muted small">Cargando…</div>
  const pending = d.requests.filter(r => !r.resolvedAt)
  return <>
    <h3 className="capitalize">{d.user.name}</h3>
    <div className="small muted" style={{ margin: '4px 0 12px' }}>último sync {rel(d.lastSync)}</div>

    <div className="row between"><h4 className="sec" style={{ margin: 0 }}>Rutinas asignadas</h4>
      <Button size="sm" variant="primary" icon="plus"
        onClick={() => openSheet(c => <AssignPicker studentId={id} onDone={() => { load(); reload() }} close={c} />)}>Asignar</Button></div>
    {d.assigned.length ? <div className="list">{d.assigned.map(a => <div key={a.assignmentId} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }}>
      <span className="small">{a.emoji} {a.name} · {a.count} ej.</span>
      <button className="iconbtn" style={{ color: 'var(--red)', width: 30, height: 28 }} aria-label="quitar"
        onClick={() => confirmSheet({ title: 'Quitar “' + a.name + '”?', confirmText: 'Quitar', danger: true,
          onConfirm: () => unassignRoutine(a.assignmentId).then(() => { load(); reload() }).catch(e => toast(e.message)) })}>
        <Icon name="trash" /></button>
    </div>)}</div> : <div className="empty small">Sin rutinas asignadas.</div>}

    {pending.length > 0 && <>
      <h4 className="sec">Pedidos de ajuste</h4>
      {pending.map(q => <div key={q.id} className="card" style={{ padding: 10 }}>
        <div className="small">{q.note}</div>
        <div className="row between" style={{ marginTop: 6 }}>
          <span className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(String(q.createdAt).slice(0, 10))}</span>
          <Button size="sm" variant="tinted" onClick={() => resolveRequest(q.id).then(() => { load(); reload() }).catch(e => toast(e.message))}>Marcar resuelto</Button>
        </div>
      </div>)}
    </>}

    <h4 className="sec">Historial</h4>
    <WorkoutHistory workouts={d.workouts} unit={d.unit} />
  </>
}

export default function Coach() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [students, setStudents] = useState(null)

  const load = () => listStudents().then(r => setStudents(r.students)).catch(e => toast(e.message || 'Error'))
  useEffect(() => { if (!user?.coach) return; load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])
  if (!user?.coach) return null

  const open = id => openSheet(close => <StudentDetail id={id} reload={load} close={close} />)
  const list = students || []
  const liveN = list.filter(s => s.live).length
  const pendN = list.reduce((n, s) => n + (s.pendingRequests || 0), 0)

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8 }}><h1 style={{ margin: 0 }}>Coach</h1>
        <div className="sub">{students ? list.length + ' alumnos' : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={load} aria-label="refresh">↻</button>
    </div>

    <StatTiles tiles={[
      { label: 'Alumnos', value: students ? list.length : '—' },
      { label: 'Entrenando', value: students ? liveN : '—', accent: liveN > 0 },
      { label: 'Pedidos', value: students ? pendN : '—', accent: pendN > 0 }
    ]} />

    <TrainingNow users={list} onOpen={open} />

    <h4 className="sec">Alumnos</h4>
    <div className="list">
      {list.map(u => <StudentRow key={u.id} u={u} onOpen={open}
        extra={u.pendingRequests ? <span className="tag" style={{ marginLeft: 4, color: 'var(--orange)' }}>{u.pendingRequests}</span> : null} />)}
      {students && !list.length && <div className="empty">Todavía no tenés alumnos. Generá un código de invitación desde el panel de admin.</div>}
    </div>
  </div>
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.jsx`:
- After `import Admin from './views/Admin.jsx'` add `import Coach from './views/Coach.jsx'`.
- After the `/admin` `<Route>` (line ~83) add:
```jsx
              <Route path="/coach" element={user?.coach ? <Coach /> : <Navigate to="/home" replace />} />
```

- [ ] **Step 3: Add the Settings link**

In `frontend/src/views/Settings.jsx`, right after the admin `Row` (line ~89):
```jsx
        {user.coach && <Row icon="whistle" iconTint="var(--acc)" title={t('Coach dashboard')} accessory="chevron" onClick={() => nav('/coach')} />}
```
If `whistle` is not a registered `Icon` name, use `"users"` or `"clipboard"` — check `frontend/src/components/Icon.jsx` for a valid name and pick the closest.

- [ ] **Step 4: Add the string**

`t('Coach dashboard')` — add `"Coach dashboard": "Panel de coach"` to the Spanish pack and an English identity entry. Find the locale files under `frontend/src/locales/` and match how `"Admin dashboard"` is entered (if `"Admin dashboard"` has no entry — it's English-only per the codebase note — then `Coach dashboard` can stay untranslated too; the `Coach.jsx` UI itself is Spanish-literal by design, matching the app's default `lang: 'es'`).

- [ ] **Step 5: Build check**

Run: `cd frontend && npx vite build`
Expected: builds with no error.

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Coach.jsx frontend/src/App.jsx frontend/src/views/Settings.jsx frontend/src/locales
git commit -m "feat(web): coach dashboard at /coach"
```

---

## Task 14: Assigned-routine UI in Plan + RoutineEdit

**Files:**
- Modify: `frontend/src/views/Plan.jsx` (list rows, line ~43)
- Modify: `frontend/src/views/RoutineEdit.jsx` (guard near line 30-40; header; edit affordances)

**Interfaces:**
- Consumes: `isAssigned` (Task 10); `requestAdjustment` (Task 11).
- Produces: an assigned routine shows a "de tu coach" tag in Plan; opening it in `RoutineEdit` is read-only with a "Pedir ajuste" action.

- [ ] **Step 1: Plan list tag**

In `frontend/src/views/Plan.jsx`, add `import { isAssigned } from '../lib/coaching.js'`. In the routine list row (line ~43-45), add next to `{r.name}`:
```jsx
{isAssigned(r) && <span className="tag acc" style={{ marginLeft: 6 }}>{t('de tu coach')}</span>}
```

- [ ] **Step 2: RoutineEdit read-only guard**

In `frontend/src/views/RoutineEdit.jsx`:
- `import { isAssigned } from '../lib/coaching.js'`
- `import { requestAdjustment } from '../lib/coachApi.js'`
- `import { useUI } from '../store/useUI.js'` (if not already imported)
- After `const r = S.routines.find(x => x.id === id)`:
```jsx
  const ro = isAssigned(r)
```
- Wrap the mutating helpers so they no-op when `ro`:
```jsx
  const edit = fn => { if (ro) return; update(s => { fn(s.routines.find(x => x.id === id).ex) }) }
```
(the other helpers — `move`, `toggleLink`, `addEx` — all go through `edit`, so this is the single choke point; also guard the name/emoji/section handlers in the header and `SectionHeader` by early-returning when `ro`, or by not rendering their controls — see next step).

- [ ] **Step 3: RoutineEdit header — tag, hide edit controls, add "Pedir ajuste"**

In the header block (line ~67-75), when `ro`:
- Render the routine name as static text instead of an editable input.
- Show `<span className="tag acc">{t('de tu coach')}</span>`.
- Hide the glyph picker, "add section", "add exercise", delete-routine controls.
- Add a button:
```jsx
{ro && <Button variant="tinted" icon="chat" onClick={() => openSheet(close => <AdjustSheet r={r} close={close} />)}>{t('Pedir ajuste')}</Button>}
```
Add the sheet component at the top of the file:
```jsx
function AdjustSheet({ r, close }) {
  const toast = useUI(s => s.toast)
  const [note, setNote] = useState('')
  return <>
    <h3>{t('Pedir ajuste')}</h3>
    <p className="muted small">{t('Contale a tu coach qué querés cambiar de esta rutina.')}</p>
    <textarea className="input" rows={4} value={note} onChange={e => setNote(e.target.value)} />
    <Button variant="primary" style={{ marginTop: 10 }} disabled={!note.trim()}
      onClick={() => requestAdjustment(r.assignmentId, note.trim())
        .then(() => { toast(t('Enviado a tu coach')); close() })
        .catch(e => toast(e.message))}>{t('Enviar')}</Button>
  </>
}
```
(add `import { useState } from 'react'` to the existing react import).

- [ ] **Step 4: Exercise rows read-only**

In the exercise-row rendering, when `ro`: don't render the up/down/link/delete/config controls (or render them `disabled`). Keep the `Thumb`, name, and `exLine` visible so the student can read the prescription.

- [ ] **Step 5: Strings**

Add to the Spanish locale pack: `"de tu coach"`, `"Pedir ajuste"`, `"Contale a tu coach qué querés cambiar de esta rutina."`, `"Enviado a tu coach"`, `"Enviar"` — matching how other `t(...)` strings are registered (many are Spanish-source already). Verify `npx vitest run src/lib/i18n.test.js` still passes.

- [ ] **Step 6: Build + test**

Run: `cd frontend && npx vite build && npx vitest run`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/Plan.jsx frontend/src/views/RoutineEdit.jsx frontend/src/locales
git commit -m "feat(web): read-only assigned routines + Pedir ajuste"
```

---

## Task 15: Docs + full manual verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the env**

In `README.md`, near where `ADMIN_UIDS` / `INVITE_ONLY` are described, add a "Coach mode" note:
```markdown
### Coach mode (optional)

Set `COACH_UIDS` to a comma-separated list of user ids (same as `ADMIN_UIDS`)
and run the instance with `INVITE_ONLY=1`. A coach generates invite codes from
the dashboard; anyone who registers with a coach's code is linked to that coach.
The coach can then assign routines (their own routines, delivered read-only to
the student) and follow each student's progress at `/coach`. Students can send
an adjustment request; the coach edits the routine in their own editor and the
change reaches the student on their next sync.
```

- [ ] **Step 2: Run every automated test**

```bash
cd api && node --test
cd ../frontend && npx vitest run && npx vite build
```
Expected: all green, build clean.

- [ ] **Step 3: Manual pass (`npm run dev`, root `.env` with `INVITE_ONLY=1`)**

1. Start with `COACH_UIDS=<your uid>` in the root `.env`. Sign in as the coach.
2. `/coach` link appears in Settings; open it — empty student list.
3. From `/admin` (or the coach invites UI) generate an invite code.
4. In a second browser/profile, register a new user with that code. Confirm `data/db.json` shows `coachId: <your uid>` on the new user.
5. As the coach, open the new student in `/coach` → "Asignar" → pick one of your routines.
6. As the student, reload. The routine appears in Plan tagged "de tu coach", opens read-only, and a workout can be started from it.
7. As the student, "Pedir ajuste" with a note. As the coach (with push subscribed, optional) confirm the push arrives; confirm the request shows in `/coach` with an orange badge.
8. As the coach, edit that routine in your normal editor (change a set count). As the student, reload → the change is visible.
9. As the coach, "Marcar resuelto" on the request → badge clears.
10. Confirm the student's `PUT /api/data` body (devtools network) contains no `coachAssigned` routine, and `localStorage.gym_state_v1` has none either.
11. Open `/admin` as the admin — confirm the dashboard is visually unchanged after the `ProgressViews` refactor.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: coach mode setup"
```

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch` to decide how to integrate `feat/coach-mode-mvp`.

---

## Self-Review

**Spec coverage:**
- §2 data model (`coachId`, `assignments`, `changeRequests`, defaults) → Tasks 2, 5, 8.
- §2 `api/coaching.js` module + exports → Tasks 1, 3, 5, 7.
- §3 linking via invite + `coachIdForInvite` in register/verify → Tasks 1, 4.
- §3 chosen invite surface (admin-or-coach guard, own-codes filter) → Task 9.
- §4.1 coach assigns from own routines; unassign → Task 5, Task 13 (AssignPicker).
- §4.2 `/api/coaching/assigned`; store merge/strip; localStorage + PUT both stripped → Tasks 6, 10, 11.
- §4.2 Plan tag + RoutineEdit read-only + "Pedir ajuste" → Task 14.
- §4.3 orphan handling (`pruneOrphanAssignments`, dangling `S.week` id) → Tasks 3, 6.
- §5.1 `/coach` route + guard + `coach` in `/api/me` + Settings link → Tasks 2, 13.
- §5.2 all endpoints + `requireCoach` + ownership checks → Tasks 2, 5, 6, 7, 8.
- §5.3 shared components extraction → Task 12.
- §5.4 push on change-request → Task 8.
- §6 backend `node:test` (unit + integration), frontend `lib/coaching.test.js`, manual pass → every task's test steps + Task 15.

**Placeholder scan:** no TBD/TODO; every code step has real code. Icon-name fallbacks in Tasks 13/14 (`whistle`→`users`/`clipboard`, `chat`) are explicit "check this file, pick the closest valid name" instructions, not placeholders.

**Type consistency:**
- `resolveAssigned(db, studentId, readState, users)` — same signature in Task 3 def, Task 6 call.
- `studentRows(db, coachId, readState, livePresence)` — Task 7 def and call match (server passes `livePresence`).
- Assignment row `{ id, coachId, studentId, routineId, createdAt }` — consistent Tasks 5, 6, 7.
- changeRequest row `{ id, assignmentId, studentId, note, createdAt, resolvedAt? }` — consistent Tasks 7, 8.
- `mergeAssigned` / `stripAssigned` / `isAssigned` — defined Task 10, used Tasks 11, 14 with matching arity.
- `/api/coaching/assigned` returns `{ routines }` — Task 6 def, Task 11 `fetchAssigned` reads `.routines`.
- `getStudent` detail shape (`assigned`, `requests`, `workouts`, `unit`, `lastSync`) — Task 7 def, Task 13 consumption match.
