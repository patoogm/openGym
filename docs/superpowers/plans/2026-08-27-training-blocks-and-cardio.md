# Training Blocks & Interval Cardio — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give openGym periodized training via self-contained "blocks" (create, edit, activate manually) plus an interval-cardio model, without breaking any existing screen.

**Architecture:** Approach A from the spec — "blocks as snapshots". `S.program` holds an ordered list of blocks; each block carries its own `routines[]` + weekday `week` map. Activating a block deep-clones its routines (fresh ids) into the live `S.routines`/`S.week`, so Home/Plan/Workout/RoutineEdit keep working unchanged. Interval cardio is an optional `intervals` object on a cardio exercise config; logged effort still reduces to minutes for the existing chart. This plan delivers a usable manual-periodization app; Plan 2 adds the LLM agent that generates blocks.

**Tech Stack:** React 19 + Vite 8, Zustand store, `vitest` (tests colocated as `src/**/*.test.js`), no CSS framework (hand-rolled classes in `index.css`), `react-router-dom` HashRouter.

**Spec:** `docs/superpowers/specs/2026-08-27-agent-training-blocks-design.md`

## Global Constraints

- **Additive/optional state only.** Every new `S` field must be absent-safe: `Object.assign(clone(DEF), state)` in `store/useStore.js` is the only merge, and old profiles/backups/plan files must load unchanged. (Established openGym rule — see comments in `store/useStore.js` and `lib/history.js`.)
- **No new runtime dependencies** in this plan (Plan 2 adds `@anthropic-ai/sdk` in `api/` only).
- **Weekday integers match `S.week`:** `0`=Sunday … `6`=Saturday. Display order is Mon-first `[1,2,3,4,5,6,0]` (see `lib/plan-share.js` `WEEK_ORDER`, `views/Plan.jsx`).
- **IDs:** use `uid()` from `lib/format.js` (`Date.now().toString(36) + Math.random().toString(36).slice(2,7)`).
- **i18n:** every user-facing string goes through `t()` from `lib/i18n.js`. New English keys need no dictionary entry (the key *is* the English text); do not add other-language files in this plan.
- **Tests:** pure logic (`lib/*.js`) is TDD with real assertions. React views follow the repo pattern (no unit tests for views) but every UI task ends with a scripted manual verification against the locally-running app (API on :3000, vite on :5173, media on :8888).
- **Commits:** one per task minimum, conventional-commit style (`feat:`, `test:`, `refactor:`), end message with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.

---

## File Structure

**New files:**
- `frontend/src/lib/blocks.js` — pure block operations: `materializeBlock`, `snapshotActiveBlock`, `activeBlock`, `newManualBlock`. No React, no store.
- `frontend/src/lib/blocks.test.js` — tests for the above.
- `frontend/src/lib/cardio.js` — `minutesJogged(intervals, roundsDone)` + `intervalSummary(intervals)`. Ported from `gimnastic/src/domain/cardio.ts`.
- `frontend/src/lib/cardio.test.js` — tests, ported from `gimnastic/src/domain/cardio.test.ts`.
- `frontend/src/lib/digest.js` — `buildHistoryDigest(S, sinceISO)` → array of session digests (consumed by Plan 2; pure, testable now).
- `frontend/src/lib/digest.test.js` — tests.
- `frontend/src/views/Profile.jsx` — training-profile form over `S.profile`.
- `frontend/src/views/Program.jsx` — blocks list, create/activate/finish, links to preview.
- `frontend/src/components/BlockPreview.jsx` — renders a block (routines + week + cardio + rationale) with Accept / Discard actions; reused by Plan 2.

**Modified files:**
- `frontend/src/store/useStore.js` — `DEF` gains `profile: {}` and `program: { blocks: [], activeId: null }`.
- `frontend/src/sheets.jsx` — `ExConfigForm` (~line 487–600): add interval toggle + fields; `onSave` (~line 512) persists `intervals`.
- `frontend/src/views/Workout.jsx` — cardio entry (~line 56–125, 176–200): render interval breakdown + round counter; log minutes via `minutesJogged`.
- `frontend/src/lib/plan-share.js` — `cleanEx` / `parsePlan`: pass `intervals`, `repsMin`, `repsMax` through.
- `frontend/src/lib/plan-share.test.js` — **new** (no test file exists yet); covers the passthrough.
- `frontend/src/App.jsx` — add `/profile` and `/program` routes.
- `frontend/src/views/Settings.jsx` — add rows linking to Profile and Program.
- `frontend/src/views/Home.jsx` — first-run "set up training" card.

---

## Task 1: Store — `DEF` fields for profile & program

**Files:**
- Modify: `frontend/src/store/useStore.js:9-19` (the `DEF` object)
- Test: `frontend/src/store/useStore.test.js` (new)

**Interfaces:**
- Produces: `DEF.profile` (`{}`), `DEF.program` (`{ blocks: [], activeId: null }`). Every consumer reads `S.program.blocks` / `S.program.activeId` / `S.profile` and must tolerate `{}`/empty.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/store/useStore.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { DEF } from './useStore.js'

describe('DEF', () => {
  it('has an empty training profile', () => {
    expect(DEF.profile).toEqual({})
  })

  it('has an empty program with no active block', () => {
    expect(DEF.program).toEqual({ blocks: [], activeId: null })
  })

  it('merging an old state (no profile/program) onto DEF fills them in', () => {
    const old = { routines: [{ id: 'r1', name: 'A', ex: [] }], week: { 1: 'r1' } }
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), old)
    expect(merged.program).toEqual({ blocks: [], activeId: null })
    expect(merged.profile).toEqual({})
    expect(merged.routines).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/store/useStore.test.js`
Expected: FAIL — `DEF.profile` / `DEF.program` are `undefined`.

- [ ] **Step 3: Add the fields**

In `frontend/src/store/useStore.js`, inside `DEF` (after the `reminder: {...}, effort: null` line), add:

```js
  reminder: { on: false, time: '08:00', tz: null }, effort: null,
  // Training profile for the block generator (Plan 2). Free-form until then.
  profile: {},
  // Periodized program: an ordered list of self-contained blocks. The active block's
  // routines are materialized into `routines`/`week` above, so every existing screen
  // keeps working. See lib/blocks.js.
  program: { blocks: [], activeId: null }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/store/useStore.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `cd frontend && npx vitest run`
Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/useStore.js frontend/src/store/useStore.test.js
git commit -m "feat: add profile and program fields to store DEF"
```

---

## Task 2: `lib/cardio.js` — interval cardio math

**Files:**
- Create: `frontend/src/lib/cardio.js`
- Test: `frontend/src/lib/cardio.test.js`
- Reference: `gimnastic/src/domain/cardio.ts` and `gimnastic/src/domain/cardio.test.ts` (sibling repo; port, don't import)

**Interfaces:**
- Produces:
  - `minutesJogged(intervals, roundsDone) → number` — `intervals` is `{ warmupMin, rounds, workMin, restMin, cooldownMin }` or `null`. Returns minutes actually jogged: `round1dp(roundsDone * workMin)`. If `intervals` is `null`/absent, returns `roundsDone` unchanged (caller passes the entered minutes there for steady-state).
  - `intervalSummary(intervals) → string` — e.g. `"5′ warm-up · 8 × (1′ / 1.5′) · 5′ cool-down"`. Returns `''` for `null`.
  - `plannedRounds(intervals) → number` — `intervals?.rounds || 0`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/cardio.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { minutesJogged, intervalSummary, plannedRounds } from './cardio.js'

const iv = { warmupMin: 5, rounds: 8, workMin: 1, restMin: 1.5, cooldownMin: 5 }

describe('minutesJogged', () => {
  it('multiplies rounds done by the work minutes of each round', () => {
    expect(minutesJogged(iv, 8)).toBe(8)
    expect(minutesJogged({ ...iv, rounds: 6, workMin: 2 }, 6)).toBe(12)
  })

  it('counts only the rounds actually done, not the prescribed ones', () => {
    expect(minutesJogged(iv, 5)).toBe(5)
  })

  it('allows going past the prescribed rounds', () => {
    expect(minutesJogged(iv, 10)).toBe(10)
  })

  it('returns 0 when no round was done', () => {
    expect(minutesJogged(iv, 0)).toBe(0)
  })

  it('rounds to one decimal to avoid float drift', () => {
    expect(minutesJogged({ ...iv, workMin: 1.5 }, 3)).toBe(4.5)
  })

  it('with no intervals, returns the value unchanged (steady-state minutes)', () => {
    expect(minutesJogged(null, 22)).toBe(22)
    expect(minutesJogged(undefined, 20)).toBe(20)
  })
})

describe('intervalSummary', () => {
  it('describes warm-up, rounds and cool-down', () => {
    expect(intervalSummary(iv)).toBe('5′ warm-up · 8 × (1′ / 1.5′) · 5′ cool-down')
  })

  it('omits warm-up / cool-down when zero', () => {
    expect(intervalSummary({ warmupMin: 0, rounds: 4, workMin: 3, restMin: 1.5, cooldownMin: 0 }))
      .toBe('4 × (3′ / 1.5′)')
  })

  it('returns empty string for null', () => {
    expect(intervalSummary(null)).toBe('')
  })
})

describe('plannedRounds', () => {
  it('reads the prescribed round count', () => {
    expect(plannedRounds(iv)).toBe(8)
    expect(plannedRounds(null)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/cardio.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/cardio.js`:

```js
// Interval cardio math. Ported from gimnastic/src/domain/cardio.ts.
//
// What gets logged for the running chart is always MINUTES actually jogged, never
// rounds: 6 rounds of 2 min is more running than 8 rounds of 1 min, and storing
// "6" vs "8" would draw a dip where there was progress. Steady-state weeks already
// enter minutes, so those pass straight through.

const round1dp = n => Math.round(n * 10) / 10
const min = n => `${round1dp(n)}′`

export function minutesJogged(intervals, roundsOrMinutes) {
  if (!intervals) return roundsOrMinutes
  return round1dp((roundsOrMinutes || 0) * (intervals.workMin || 0))
}

export function plannedRounds(intervals) {
  return (intervals && intervals.rounds) || 0
}

export function intervalSummary(intervals) {
  if (!intervals) return ''
  const { warmupMin = 0, rounds = 0, workMin = 0, restMin = 0, cooldownMin = 0 } = intervals
  const parts = []
  if (warmupMin > 0) parts.push(`${min(warmupMin)} warm-up`)
  parts.push(`${rounds} × (${min(workMin)} / ${min(restMin)})`)
  if (cooldownMin > 0) parts.push(`${min(cooldownMin)} cool-down`)
  return parts.join(' · ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/cardio.test.js`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/cardio.js frontend/src/lib/cardio.test.js
git commit -m "feat: add interval cardio math (minutesJogged, intervalSummary)"
```

---

## Task 3: `lib/blocks.js` — materialize / snapshot / helpers

**Files:**
- Create: `frontend/src/lib/blocks.js`
- Test: `frontend/src/lib/blocks.test.js`
- Reference: `frontend/src/lib/plan-share.js:109-138` (`mergePlan` — the existing clone-with-fresh-ids + week-remap pattern)

**Interfaces:**
- Consumes: `uid` from `lib/format.js`; `todayISO` from `lib/format.js`.
- Produces (all pure; the mutating ones take a draft state `s` and are meant to be called inside `store.update`):
  - `newManualBlock({ name, weeks }) → Block` — `{ id, name, weeks, source: 'manual', createdAt, startedAt: null, completedAt: null, rationale: '', routines: [], week: {} }`
  - `activeBlock(S) → Block | null` — `S.program.blocks.find(b => b.id === S.program.activeId) ?? null`
  - `materializeBlock(s, blockId)` — clones `s.program.blocks[blockId].routines` with fresh ids into `s.routines`, remaps its `week` into `s.week`, deletes stale `s.dayPlan` entries, sets `s.program.activeId = blockId` and the block's `startedAt`. Returns nothing.
  - `snapshotActiveBlock(s)` — copies the live `s.routines` (deep) and `s.week` back into the active block record. No-op if no active block. Returns nothing.
  - `finishActiveBlock(s)` — `snapshotActiveBlock(s)` then sets the active block's `completedAt = todayISO()` and `s.program.activeId = null`. Returns nothing.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/blocks.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { newManualBlock, activeBlock, materializeBlock, snapshotActiveBlock, finishActiveBlock } from './blocks.js'

const baseState = () => ({
  routines: [], week: {}, dayPlan: {},
  program: { blocks: [], activeId: null }
})

const blockWith = (over = {}) => ({
  ...newManualBlock({ name: 'Mes 1', weeks: 4 }),
  id: 'blk1',
  routines: [
    { id: 'br1', name: 'Lunes', emoji: '', ex: [{ id: '0043', sets: 3, reps: 10 }] },
    { id: 'br2', name: 'Jueves', emoji: '', ex: [{ id: '0025', sets: 3, reps: 8 }] }
  ],
  week: { 1: 'br1', 4: 'br2' },
  ...over
})

describe('newManualBlock', () => {
  it('creates a manual block with empty routines and a fresh id', () => {
    const b = newManualBlock({ name: 'Bloque A', weeks: 3 })
    expect(b.name).toBe('Bloque A')
    expect(b.weeks).toBe(3)
    expect(b.source).toBe('manual')
    expect(b.routines).toEqual([])
    expect(b.week).toEqual({})
    expect(b.startedAt).toBeNull()
    expect(b.id).toMatch(/\w+/)
  })
})

describe('materializeBlock', () => {
  it('clones the block routines into s.routines with fresh ids', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    expect(s.routines).toHaveLength(2)
    expect(s.routines.map(r => r.id)).not.toContain('br1')
    expect(s.routines[0].name).toBe('Lunes')
    expect(s.routines[0].ex[0].id).toBe('0043')
  })

  it('remaps the week schedule onto the new routine ids', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    const lunesId = s.routines.find(r => r.name === 'Lunes').id
    const juevesId = s.routines.find(r => r.name === 'Jueves').id
    expect(s.week).toEqual({ 1: lunesId, 4: juevesId })
  })

  it('drops dayPlan overrides that pointed at replaced routines', () => {
    const s = baseState()
    s.routines = [{ id: 'old', name: 'Old', ex: [] }]
    s.dayPlan = { '2026-08-01': 'old', '2026-08-02': 'rest' }
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    expect(s.dayPlan).toEqual({ '2026-08-02': 'rest' })
  })

  it('sets activeId and the block startedAt', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    expect(s.program.activeId).toBe('blk1')
    expect(s.program.blocks[0].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does not mutate the stored block routines (deep clone)', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    s.routines[0].ex[0].sets = 99
    expect(s.program.blocks[0].routines[0].ex[0].sets).toBe(3)
  })
})

describe('activeBlock', () => {
  it('returns the block matching program.activeId', () => {
    const S = baseState()
    S.program.blocks = [blockWith()]
    S.program.activeId = 'blk1'
    expect(activeBlock(S).id).toBe('blk1')
  })
  it('returns null when nothing is active', () => {
    expect(activeBlock(baseState())).toBeNull()
  })
})

describe('snapshotActiveBlock', () => {
  it('copies live routines and week back into the active block', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    s.routines[0].ex.push({ id: '9999', sets: 2, reps: 15 })
    snapshotActiveBlock(s)
    const stored = s.program.blocks[0]
    expect(stored.routines[0].ex).toHaveLength(2)
    expect(stored.week).toEqual(s.week)
  })
  it('is a no-op with no active block', () => {
    const s = baseState()
    expect(() => snapshotActiveBlock(s)).not.toThrow()
  })
})

describe('finishActiveBlock', () => {
  it('snapshots, stamps completedAt, and clears activeId', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    finishActiveBlock(s)
    expect(s.program.blocks[0].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(s.program.activeId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/blocks.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/blocks.js`:

```js
// Periodized program: blocks as snapshots (see docs/superpowers/specs/2026-08-27-agent-training-blocks-design.md §3.2).
//
// A block owns its own routines + weekday schedule. Activating a block clones those
// routines into the live S.routines/S.week (fresh ids), so Home/Plan/Workout/RoutineEdit
// keep operating on ordinary routine objects and need no changes. Workout history is keyed
// by exerciseId, so swapping routines never orphans a logged set.

import { uid, todayISO } from './format.js'

const deepClone = o => JSON.parse(JSON.stringify(o))

export function newManualBlock({ name, weeks }) {
  return {
    id: uid(),
    name: name || 'New block',
    weeks: Math.max(1, Math.round(weeks) || 4),
    source: 'manual',
    createdAt: todayISO(),
    startedAt: null,
    completedAt: null,
    rationale: '',
    routines: [],
    week: {}
  }
}

export function activeBlock(S) {
  const p = S.program
  if (!p || !p.activeId) return null
  return (p.blocks || []).find(b => b.id === p.activeId) || null
}

export function materializeBlock(s, blockId) {
  const block = (s.program.blocks || []).find(b => b.id === blockId)
  if (!block) return

  const idMap = {}
  const cloned = (block.routines || []).map(r => {
    const nid = uid()
    idMap[r.id] = nid
    return { ...deepClone(r), id: nid }
  })

  s.routines = cloned

  const week = {}
  Object.entries(block.week || {}).forEach(([d, oldId]) => {
    if (idMap[oldId]) week[d] = idMap[oldId]
  })
  s.week = week

  // dayPlan holds per-date overrides pointing at routine ids (or the string 'rest').
  // Keep 'rest' and any id that still exists; drop the rest.
  const live = new Set(cloned.map(r => r.id))
  Object.keys(s.dayPlan || {}).forEach(k => {
    const v = s.dayPlan[k]
    if (v !== 'rest' && !live.has(v)) delete s.dayPlan[k]
  })

  s.program.activeId = blockId
  if (!block.startedAt) block.startedAt = todayISO()
}

export function snapshotActiveBlock(s) {
  const block = activeBlock(s)
  if (!block) return
  block.routines = deepClone(s.routines || [])
  block.week = deepClone(s.week || {})
}

export function finishActiveBlock(s) {
  const block = activeBlock(s)
  if (!block) return
  snapshotActiveBlock(s)
  block.completedAt = todayISO()
  s.program.activeId = null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/blocks.test.js`
Expected: PASS (all groups).

- [ ] **Step 5: Run the full suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/blocks.js frontend/src/lib/blocks.test.js
git commit -m "feat: add block materialize/snapshot helpers"
```

---

## Task 4: `lib/digest.js` — training-history digest

**Files:**
- Create: `frontend/src/lib/digest.js`
- Test: `frontend/src/lib/digest.test.js`
- Reference: `frontend/src/lib/history.js` (`modeOf`), `frontend/src/lib/exercises.js` (`exOr` — id→exercise), and the workout shape in `frontend/src/lib/demoSeed.js` (search for `workouts` / `w.d` / `w.ex`)

**Interfaces:**
- Consumes: `exOr` from `lib/exercises.js`; `modeOf` from `lib/history.js`.
- Produces: `buildHistoryDigest(S, sinceISO) → SessionDigest[]`, newest last, at most 20 sessions. `SessionDigest = { date, routine, exercises: ExDigest[] }`. `ExDigest` is either `{ name, sets: [{ weight?, reps?, sec?, rpe? }] }` for strength/timed, or `{ name, cardioMin }` for cardio. `sinceISO` may be `null` (⇒ all history).

- [ ] **Step 1: Inspect the real workout shape**

Run: `cd frontend && grep -n "workouts\|w\.d\|w\.ex\|\.sets\|rpe\|rir" src/lib/demoSeed.js | head -40`
Read enough of `src/lib/demoSeed.js` and `src/lib/history.js` to confirm the persisted workout keys (expected: `w.d` = ISO date, `w.r` = routine name or id, `w.ex` = `[{ id, sets: [{ w, r, sec, rpe, rir, done }] }]`). **Adjust the field names in Steps 2–3 to match what you find** — this step exists because the plan author inferred the shape from `lib/plan-share.js` and `lib/history.js`, not from a workout fixture.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/lib/digest.test.js` (using the field names confirmed in Step 1; the version below assumes `w.d` / `w.r` / `w.ex[].id` / `w.ex[].sets[]` with `w`/`r`/`sec`/`rpe`/`min`):

```js
import { describe, it, expect } from 'vitest'
import { buildHistoryDigest } from './digest.js'

const S = {
  customEx: [],
  workouts: [
    { d: '2026-07-01', r: 'Lunes', ex: [
      { id: '0043', sets: [{ w: 40, r: 12, rpe: 7, done: true }, { w: 40, r: 11, rpe: 8, done: true }] }
    ]},
    { d: '2026-08-05', r: 'Lunes', ex: [
      { id: '0043', sets: [{ w: 45, r: 10, rpe: 8, done: true }] },
      { id: 'treadmill', sets: [{ min: 22, done: true }] }
    ]}
  ]
}

describe('buildHistoryDigest', () => {
  it('returns one entry per workout, oldest first', () => {
    const d = buildHistoryDigest(S, null)
    expect(d.map(s => s.date)).toEqual(['2026-07-01', '2026-08-05'])
  })

  it('resolves exercise ids to names', () => {
    const d = buildHistoryDigest(S, null)
    expect(d[0].exercises[0].name).toMatch(/squat/i) // 0043 = barbell full squat
  })

  it('summarizes strength sets as weight/reps/rpe', () => {
    const d = buildHistoryDigest(S, null)
    expect(d[0].exercises[0].sets).toEqual([
      { weight: 40, reps: 12, rpe: 7 },
      { weight: 40, reps: 11, rpe: 8 }
    ])
  })

  it('summarizes cardio as a single cardioMin figure', () => {
    const d = buildHistoryDigest(S, null)
    const tm = d[1].exercises.find(e => e.cardioMin != null)
    expect(tm.cardioMin).toBe(22)
  })

  it('filters by sinceISO (inclusive)', () => {
    const d = buildHistoryDigest(S, '2026-08-01')
    expect(d).toHaveLength(1)
    expect(d[0].date).toBe('2026-08-05')
  })

  it('caps at 20 sessions, keeping the most recent', () => {
    const many = { customEx: [], workouts: Array.from({ length: 30 }, (_, i) => ({
      d: `2026-01-${String(i + 1).padStart(2, '0')}`, r: 'X',
      ex: [{ id: '0043', sets: [{ w: 20, r: 10, done: true }] }]
    })) }
    const d = buildHistoryDigest(many, null)
    expect(d).toHaveLength(20)
    expect(d[19].date).toBe('2026-01-30')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/digest.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/lib/digest.js` (align field reads with Step 1 findings):

```js
// Training-history digest sent to the block generator (Plan 2). Pure and testable now.
//
// The agent reasons in exercise NAMES, not ids — its output is re-mapped to ids by the
// backend validator. Cardio collapses to one "minutes" figure; strength keeps per-set
// weight / reps / effort.

import { exOr } from './exercises.js'
import { modeOf } from './history.js'

const MAX_SESSIONS = 20

export function buildHistoryDigest(S, sinceISO) {
  const custom = S.customEx || []
  const resolve = id => {
    const c = custom.find(x => x.id === id)
    return c ? c.n : exOr(id).n
  }

  let workouts = (S.workouts || []).filter(w => !sinceISO || w.d >= sinceISO)
  workouts = workouts.slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  if (workouts.length > MAX_SESSIONS) workouts = workouts.slice(-MAX_SESSIONS)

  return workouts.map(w => ({
    date: w.d,
    routine: typeof w.r === 'string' ? w.r : '',
    exercises: (w.ex || []).map(e => {
      const name = resolve(e.id)
      const mode = modeOf({ ...(e.target || {}), id: e.id })
      const done = (e.sets || []).filter(s => s.done !== false)
      if (mode === 'cardio') {
        const cardioMin = done.reduce((n, s) => n + (s.min || 0), 0)
        return { name, cardioMin }
      }
      const sets = done.map(s => {
        const out = {}
        if (s.w != null) out.weight = s.w
        if (s.r != null) out.reps = s.r
        if (s.sec != null) out.sec = s.sec
        if (s.rpe != null) out.rpe = s.rpe
        return out
      })
      return { name, sets }
    })
  }))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/digest.test.js`
Expected: PASS. If field names differ from Step 1, fix `digest.js` reads and the fixture together, then re-run.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/digest.js frontend/src/lib/digest.test.js
git commit -m "feat: add training-history digest builder"
```

---

## Task 5: `plan-share.js` — carry `intervals` / `repsMin` / `repsMax`

**Files:**
- Modify: `frontend/src/lib/plan-share.js:19-49` (`cleanEx`) and `:74-100` (`parsePlan`)
- Test: `frontend/src/lib/plan-share.test.js` (new — no test file exists for this module)

**Interfaces:**
- Consumes: existing `buildPlanBundle`, `parsePlan`, `mergePlan` exports (unchanged signatures).
- Produces: exported plan objects now include `intervals` on cardio exercises and `repsMin`/`repsMax` where set; `parsePlan` preserves them.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/plan-share.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildPlanBundle, parsePlan } from './plan-share.js'

const stateWith = ex => ({
  unit: 'kg', customEx: [], week: { 1: 'r1' },
  routines: [{ id: 'r1', name: 'Day 1', emoji: '', ex }]
})

describe('plan bundle round-trip', () => {
  it('keeps interval cardio config through export → import', () => {
    const intervals = { warmupMin: 5, rounds: 8, workMin: 1, restMin: 1.5, cooldownMin: 5 }
    const bundle = buildPlanBundle(stateWith([
      { id: 'treadmill', sets: 1, mode: 'cardio', min: 30, speed: 8, intervals }
    ]), 'Test')
    const parsed = parsePlan(JSON.stringify(bundle))
    const ex = parsed.routines[0].ex[0]
    expect(ex.intervals).toEqual(intervals)
  })

  it('keeps repsMin / repsMax for double progression', () => {
    const bundle = buildPlanBundle(stateWith([
      { id: '0043', sets: 3, reps: 12, repsMin: 8, repsMax: 12, prog: 'double' }
    ]), 'Test')
    const ex = parsePlan(JSON.stringify(bundle)).routines[0].ex[0]
    expect(ex.repsMin).toBe(8)
    expect(ex.repsMax).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/plan-share.test.js`
Expected: FAIL — `ex.intervals` is `undefined` (`cleanEx` drops unknown keys). `repsMin`/`repsMax` may already pass (they are already handled at `plan-share.js:46-47`) — that assertion guards against regression.

- [ ] **Step 3: Add `intervals` to `cleanEx`**

In `frontend/src/lib/plan-share.js`, inside `cleanEx`, in the `mode === 'cardio'` branch (currently lines ~22-25):

```js
  if (mode === 'cardio') {
    if (e.min != null) o.min = e.min
    if (e.speed != null) o.speed = e.speed
    if (e.intervals) o.intervals = { ...e.intervals }
  } else if (mode === 'time') {
```

`parsePlan` copies each exercise with `...r.ex` filters that keep every key already on the object, and `mergePlan` spreads `{ ...e, id: ... }`, so once `cleanEx` emits `intervals` no further change is needed for import. Verify by reading `parsePlan` (lines ~82-89) and `mergePlan` (lines ~120-130) — if either enumerates an explicit key allowlist, add `intervals` there too.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/plan-share.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/plan-share.js frontend/src/lib/plan-share.test.js
git commit -m "feat: carry interval cardio config in shared plans"
```

---

## Task 6: Exercise config sheet — interval cardio fields

**Files:**
- Modify: `frontend/src/sheets.jsx` — `ExConfigForm` component (~line 487–600) and its `save()` (~line 499–525)
- Reference: read `frontend/src/sheets.jsx:487-600` fully before editing; note `Stepper` usage (`components/Stepper.jsx`), the `Row` toggle component, and how `onSave(cfg)` shapes the persisted object.

**Interfaces:**
- Consumes: `intervalSummary` from `lib/cardio.js`.
- Produces: a cardio exercise config may now carry `intervals: { warmupMin, rounds, workMin, restMin, cooldownMin }`. When the "Intervals" toggle is off, `intervals` is omitted (steady-state `min`/`speed` as today).

- [ ] **Step 1: Read the current cardio branch**

Run: `cd frontend && sed -n '485,600p' src/sheets.jsx`
Confirm: the cardio branch renders three `Stepper`s (Intervals=`sets`, Minutes=`min`, Speed=`speed`) at ~line 539-542, and `save()` at ~line 512 does `onSave({ sets, min, speed })` for cardio.

- [ ] **Step 2: Add the interval toggle + fields to the cardio branch**

Replace the cardio `<>...</>` fragment in the `.row.cfgrow` block (~line 539-542) with:

```jsx
      {cardio ? <>
        <Stepper label={t('Sets')} value={c.sets} step={1} decimal={false} onChange={v => setC(x => ({ ...x, sets: v }))} />
        {!c.intervals && <Stepper label={t('Minutes')} value={c.min} step={1} decimal={false} onChange={v => setC(x => ({ ...x, min: v }))} />}
        {!c.intervals && <Stepper label={t('Speed (km/h)')} value={c.speed} step={0.5} onChange={v => setC(x => ({ ...x, speed: v }))} />}
      </> : mode === 'time' ? <>
```

Then, immediately after that `.row.cfgrow` `</div>` (before the `{mode === 'time' && ...}` line ~555), add an interval editor:

```jsx
    {cardio && <div className="sect-b" style={{ marginBottom: 12 }}>
      <Row icon="figureRun" iconTint="var(--blue)" title={t('Interval training')}
        toggle value={!!c.intervals}
        onChange={on => setC(x => on
          ? { ...x, intervals: x.intervals || { warmupMin: 5, rounds: 8, workMin: 1, restMin: 1.5, cooldownMin: 5 } }
          : { ...x, intervals: undefined })} />
    </div>}
    {cardio && c.intervals && <>
      <div className="row cfgrow" style={{ marginBottom: 10 }}>
        <Stepper label={t('Warm-up (min)')} value={c.intervals.warmupMin} step={1} decimal={false}
          onChange={v => setC(x => ({ ...x, intervals: { ...x.intervals, warmupMin: v } }))} />
        <Stepper label={t('Rounds')} value={c.intervals.rounds} step={1} decimal={false}
          onChange={v => setC(x => ({ ...x, intervals: { ...x.intervals, rounds: v } }))} />
      </div>
      <div className="row cfgrow" style={{ marginBottom: 10 }}>
        <Stepper label={t('Work (min)')} value={c.intervals.workMin} step={0.5}
          onChange={v => setC(x => ({ ...x, intervals: { ...x.intervals, workMin: v } }))} />
        <Stepper label={t('Rest (min)')} value={c.intervals.restMin} step={0.5}
          onChange={v => setC(x => ({ ...x, intervals: { ...x.intervals, restMin: v } }))} />
        <Stepper label={t('Cool-down (min)')} value={c.intervals.cooldownMin} step={1} decimal={false}
          onChange={v => setC(x => ({ ...x, intervals: { ...x.intervals, cooldownMin: v } }))} />
      </div>
      <div className="small dim" style={{ marginBottom: 18 }}>{intervalSummary(c.intervals)}</div>
    </>}
```

If `Row` does not support a `toggle` prop, use the same toggle pattern already used in this file for "Reps per side" (~line 564) — match whatever that row does.

- [ ] **Step 3: Persist `intervals` in `save()`**

In `save()`, change the cardio line (~512) from:

```js
    if (cardio) onSave({ sets, min: Math.max(1, Math.round(c.min) || 20), speed: Math.max(0, c.speed || 8) })
```

to:

```js
    if (cardio) {
      const base = { sets, min: Math.max(1, Math.round(c.min) || 20), speed: Math.max(0, c.speed || 8) }
      if (c.intervals) {
        const iv = c.intervals
        base.intervals = {
          warmupMin: Math.max(0, Math.round(iv.warmupMin) || 0),
          rounds: Math.max(1, Math.round(iv.rounds) || 1),
          workMin: Math.max(0.5, iv.workMin || 1),
          restMin: Math.max(0, iv.restMin || 0),
          cooldownMin: Math.max(0, Math.round(iv.cooldownMin) || 0)
        }
      }
      onSave(base)
    }
```

- [ ] **Step 4: Add the import**

At the top of `frontend/src/sheets.jsx`, add to the existing imports:

```js
import { intervalSummary } from './lib/cardio.js'
```

- [ ] **Step 5: Build check**

Run: `cd frontend && npx vitest run && npm run build`
Expected: tests PASS, build succeeds (catches JSX/import errors).

- [ ] **Step 6: Manual verification**

Start the app (API :3000, vite :5173, media :8888). In the browser:
1. Plan → a routine → Add exercise → pick "treadmill" (or any `cardio` exercise).
2. In the config sheet, toggle **Interval training** on. Confirm 5 steppers appear and the summary line reads `5′ warm-up · 8 × (1′ / 1.5′) · 5′ cool-down`.
3. Set rounds to 6, work to 2. Summary updates to `6 × (2′ / 1.5′)`.
4. Save. Reopen the exercise — the interval config persisted.
5. Toggle it off, save, reopen — back to Minutes/Speed, no `intervals`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/sheets.jsx
git commit -m "feat: interval cardio config in the exercise sheet"
```

---

## Task 7: Workout view — render & log interval cardio

**Files:**
- Modify: `frontend/src/views/Workout.jsx` — cardio exercise block (~line 56–125) and the set-append / logging path (~line 176–235)
- Reference: read `frontend/src/views/Workout.jsx:56-235`; the cardio column config is at ~line 82-85 (`col1 = { f: 'min' }`, `col2 = { f: 'speed' }`), set append at ~180.

**Interfaces:**
- Consumes: `intervalSummary`, `minutesJogged`, `plannedRounds` from `lib/cardio.js`.
- Produces: no state-shape change — a cardio set still persists `{ min, speed?, done }`. When the target has `intervals`, `min` is computed from a rounds count the user enters, via `minutesJogged`.

- [ ] **Step 1: Read the cardio rendering path**

Run: `cd frontend && sed -n '56,130p' src/views/Workout.jsx && echo '---' && sed -n '175,240p' src/views/Workout.jsx`
Identify: where `cardio` is true, what `col1`/`col2` drive, and how a set value is written back (`entry.sets[i].min = ...`).

- [ ] **Step 2: Add the interval breakdown line**

In the cardio branch of the exercise block (near the `{cardio && <span className="tag acc">...Cardio</span>}` at ~line 118), add below that tag row, when `entry.target?.intervals` is set:

```jsx
      {cardio && entry.target?.intervals && (
        <div className="small dim" style={{ margin: '2px 0 10px' }}>
          {intervalSummary(entry.target.intervals)}
        </div>
      )}
```

- [ ] **Step 3: Swap the "Duration (min)" column for a "Rounds" column when intervals are set**

Where `col1` is defined for cardio (~line 82):

```js
  const iv = cardio ? (entry.target && entry.target.intervals) : null
  const col1 = cardio
    ? (iv
        ? { f: 'rounds', step: 1, dec: false, hd: t('Rounds done'), placeholder: plannedRounds(iv) }
        : { f: 'min', step: 1, dec: false, hd: t('Duration (min)') })
    : /* ...existing non-cardio col1... */
  const col2 = cardio && !iv ? { f: 'speed', step: 0.5, dec: true, hd: t('Speed (km/h)') } : (cardio ? null : /* existing */)
```

Adjust to the file's actual ternary structure — the intent: with intervals, show one stepper ("Rounds done", defaulting to the prescribed count) and hide speed.

- [ ] **Step 4: Convert rounds → minutes on write**

Where a cardio set value is committed (the `onChange` that sets `entry.sets[i].min`, ~line 100-115 or in the set-append at ~180): when `iv` is set, the stepper edits a transient `rounds` value and the stored `min` is `minutesJogged(iv, rounds)`. Concretely, store both on the set so the stepper has a value to show:

```js
// on change of the rounds stepper for set i:
update(S => {
  const set = <path to set>
  set.rounds = v
  set.min = minutesJogged(iv, v)
})
```

And in the set-append path (~line 180) for a cardio entry with intervals:

```js
if (m === 'cardio') {
  const t = e.target || {}
  if (t.intervals) e.sets.push({ rounds: plannedRounds(t.intervals), min: minutesJogged(t.intervals, plannedRounds(t.intervals)), done: false })
  else e.sets.push({ min: l ? l.min : (t.min || 20), speed: l ? l.speed : (t.speed || 8), done: false })
}
```

- [ ] **Step 5: Add the import**

Top of `frontend/src/views/Workout.jsx`:

```js
import { intervalSummary, minutesJogged, plannedRounds } from '../lib/cardio.js'
```

- [ ] **Step 6: Build check**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS + build OK.

- [ ] **Step 7: Manual verification**

1. Add the interval-cardio treadmill exercise (from Task 6) to today's routine; assign the routine to today in Plan.
2. Home → Start workout → advance to the cardio exercise.
3. Confirm the breakdown line shows, and the first input is **Rounds done** pre-filled with 8 (or your prescribed count), no speed field.
4. Set rounds to 6, mark the set done.
5. Finish the workout. Stats → Running chart: the point for today reads **6 minutes** (6 rounds × 1 min work), not 6 rounds and not 22.
6. Add a second, steady-state cardio exercise (no intervals) elsewhere — confirm it still shows Duration + Speed and logs minutes as entered.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/Workout.jsx
git commit -m "feat: log interval cardio as rounds, store minutes jogged"
```

---

## Task 8: `views/Profile.jsx` — training profile form

**Files:**
- Create: `frontend/src/views/Profile.jsx`
- Modify: `frontend/src/App.jsx:70-79` (add route), `frontend/src/views/Settings.jsx` (add a link row)
- Reference: `frontend/src/views/Settings.jsx` for the page/section markup idiom (`.hdr`, `.sect-b`, `SelectRow`, `Row`, `Stepper` from `components/ui.jsx` / `components/Stepper.jsx`); `frontend/src/views/RoutineEdit.jsx` for `useStore` + `update` usage.

**Interfaces:**
- Consumes: `S.profile`, `store.update`.
- Produces: writes the `S.profile` shape from spec §3.1 (`goal`, `daysPerWeek`, `sessionMin`, `level`, `equipment[]`, `limitations`, `cardio`, `notes`).

- [ ] **Step 1: Write the component**

Create `frontend/src/views/Profile.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { SelectRow, Row } from '../components/ui.jsx'
import Stepper from '../components/Stepper.jsx'

const GOALS = ['general', 'strength', 'hypertrophy', 'return', 'endurance']
const LEVELS = ['beginner', 'intermediate', 'advanced']
const CARDIO = ['none', 'light', 'moderate', 'priority']
const EQUIPMENT = ['dumbbell', 'barbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'bands']

export default function Profile() {
  const nav = useNavigate()
  const p = useStore(s => s.S.profile) || {}
  const update = useStore(s => s.update)
  const set = (k, v) => update(s => { s.profile = { ...s.profile, [k]: v } })
  const toggleEq = eq => update(s => {
    const cur = new Set(s.profile.equipment || [])
    cur.has(eq) ? cur.delete(eq) : cur.add(eq)
    s.profile = { ...s.profile, equipment: [...cur] }
  })

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}><h1>{t('Training profile')}</h1></div>
    </div>
    <div className="small dim" style={{ margin: '0 2px 16px' }}>
      {t('Used to generate your training blocks. You can change it any time.')}
    </div>

    <div className="sect-b" style={{ marginBottom: 16 }}>
      <SelectRow icon="target" title={t('Goal')} sheetTitle={t('Goal')} value={p.goal || 'general'}
        onChange={v => set('goal', v)} options={GOALS.map(g => ({ value: g, label: t(g) }))} />
      <SelectRow icon="gauge" title={t('Experience')} sheetTitle={t('Experience')} value={p.level || 'beginner'}
        onChange={v => set('level', v)} options={LEVELS.map(l => ({ value: l, label: t(l) }))} />
      <SelectRow icon="figureRun" title={t('Cardio emphasis')} sheetTitle={t('Cardio emphasis')} value={p.cardio || 'light'}
        onChange={v => set('cardio', v)} options={CARDIO.map(c => ({ value: c, label: t(c) }))} />
    </div>

    <div className="row cfgrow" style={{ marginBottom: 18 }}>
      <Stepper label={t('Days per week')} value={p.daysPerWeek || 3} step={1} decimal={false}
        onChange={v => set('daysPerWeek', Math.max(2, Math.min(6, v)))} />
      <Stepper label={t('Minutes per session')} value={p.sessionMin || 60} step={5} decimal={false}
        onChange={v => set('sessionMin', Math.max(20, v))} />
    </div>

    <h4 className="sec">{t('Equipment')}</h4>
    <div className="mchips" style={{ marginBottom: 18 }}>
      {EQUIPMENT.map(eq => {
        const on = (p.equipment || []).includes(eq)
        return <button key={eq} className={'mchip' + (on ? ' on' : '')} onClick={() => toggleEq(eq)}>{t(eq)}</button>
      })}
    </div>

    <h4 className="sec">{t('Injuries / limitations')}</h4>
    <textarea className="input" rows={3} defaultValue={p.limitations || ''}
      placeholder={t('e.g. right knee ACL reconstruction, no current restrictions')}
      onBlur={e => set('limitations', e.target.value.trim())} style={{ marginBottom: 16, width: '100%' }} />

    <h4 className="sec">{t('Extra notes for the coach')}</h4>
    <textarea className="input" rows={3} defaultValue={p.notes || ''}
      placeholder={t('Exercises you dislike, gym constraints, anything else')}
      onBlur={e => set('notes', e.target.value.trim())} style={{ marginBottom: 16, width: '100%' }} />
  </div>
}
```

If `SelectRow`/`Row`/`Stepper` props differ from the above, match their real signatures (check `components/ui.jsx`). If `.mchip.on` has no styling, add a minimal rule to `index.css` (`.mchip.on { background: var(--accent); color: #fff; }`).

- [ ] **Step 2: Wire the route**

In `frontend/src/App.jsx`, add the import near the other view imports:

```js
import Profile from './views/Profile.jsx'
```

and inside `<Routes>` (after the `/settings` route):

```jsx
              <Route path="/profile" element={<Profile />} />
```

- [ ] **Step 3: Link from Settings**

In `frontend/src/views/Settings.jsx`, add a row (match the file's existing row idiom — likely a `Row` with `onClick={() => nav('/profile')}` and a chevron). Place it near the top, e.g. above the units/theme section:

```jsx
      <Row icon="target" title={t('Training profile')} onClick={() => nav('/profile')} chevron />
```

- [ ] **Step 4: Build check**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS + build OK.

- [ ] **Step 5: Manual verification**

1. Settings → Training profile opens.
2. Set goal = return, days = 3, minutes = 65, level = beginner, cardio = moderate, equipment = dumbbell + machine + bodyweight, limitations = "rodilla derecha operada de LCA".
3. Navigate away to Home and back → all values persisted.
4. Sign out and back in (or reload) → values still there (synced through `PUT /api/data`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Profile.jsx frontend/src/App.jsx frontend/src/views/Settings.jsx frontend/src/index.css
git commit -m "feat: training profile screen"
```

---

## Task 9: `components/BlockPreview.jsx` — render a block

**Files:**
- Create: `frontend/src/components/BlockPreview.jsx`
- Reference: `frontend/src/lib/plan-share.js:145-197` (`scheme`, `units`, `routineHTML`, `weekHTML` — the exact rendering logic for an exercise line and a week table; reuse the *logic*, render as JSX not HTML string); `frontend/src/lib/exercises.js` (`EXIDX`, `exOr`); `frontend/src/lib/cardio.js` (`intervalSummary`).

**Interfaces:**
- Consumes: `exOr` from `lib/exercises.js`; `intervalSummary` from `lib/cardio.js`; `DAYN` from `lib/format.js`.
- Produces: `<BlockPreview block={Block} onAccept={fn} onDiscard={fn} droppedCount={number} />` — pure presentational; parent owns actions. Exported default.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/BlockPreview.jsx`:

```jsx
import { exOr } from '../lib/exercises.js'
import { intervalSummary } from '../lib/cardio.js'
import { DAYN } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function exScheme(e) {
  if (e.mode === 'cardio' || exOr(e.id).bp === 'cardio') {
    if (e.intervals) return intervalSummary(e.intervals)
    return `${e.min || 20} min${e.speed ? ` @ ${e.speed} km/h` : ''}`
  }
  if (e.mode === 'time') return `${e.sets || 1} × ${e.sec || 45}s`
  const reps = e.repsMin && e.repsMax && e.repsMin !== e.repsMax ? `${e.repsMin}–${e.repsMax}` : (e.reps ?? 10)
  return `${e.sets || 1} × ${reps}${e.weight ? ` · ${e.weight} kg` : ''}`
}

export default function BlockPreview({ block, onAccept, onDiscard, droppedCount = 0 }) {
  const byId = Object.fromEntries((block.routines || []).map(r => [r.id, r]))
  return <div className="narrow">
    <h2>{block.name}</h2>
    <div className="small dim" style={{ marginBottom: 12 }}>
      {t('{0} weeks', block.weeks)}{block.source === 'agent' ? ` · ${t('generated')}` : ''}
    </div>
    {block.rationale && <div className="card" style={{ marginBottom: 14 }}>
      <p style={{ margin: 0 }}>{block.rationale}</p>
    </div>}
    {droppedCount > 0 && <div className="card warn" style={{ marginBottom: 14 }}>
      <Icon name="triangleExclam" /> {t('{0} suggested exercises are not in the library and were removed — review before accepting.', droppedCount)}
    </div>}

    <h4 className="sec">{t('Week schedule')}</h4>
    <div className="list" style={{ marginBottom: 16 }}>
      {WEEK_ORDER.map(d => {
        const r = byId[block.week?.[d]]
        return <div key={d} className="item">
          <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
          {r ? <span className="tag acc">{r.name}</span> : <span className="tag">{t('Rest')}</span>}
        </div>
      })}
    </div>

    {(block.routines || []).map(r => <div key={r.id} className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ textTransform: 'capitalize' }}>{r.name}</h2>
      <div className="list">
        {r.ex.map((e, i) => <div key={i} className="item">
          <div className="grow"><div className="tt capitalize">{exOr(e.id).n}</div></div>
          <div className="ss" style={{ whiteSpace: 'nowrap' }}>{exScheme(e)}</div>
        </div>)}
      </div>
    </div>)}

    <div className="row" style={{ gap: 10, marginTop: 12 }}>
      {onAccept && <Button variant="primary" icon="check" onClick={onAccept}>{t('Accept block')}</Button>}
      {onDiscard && <Button variant="danger" onClick={onDiscard}>{t('Discard')}</Button>}
    </div>
  </div>
}
```

If `.card.warn` has no styling, add to `index.css`: `.card.warn { border-color: var(--orange); }`.

- [ ] **Step 2: Build check**

Run: `cd frontend && npm run build`
Expected: build OK (no test — presentational, exercised via Task 10's manual steps).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BlockPreview.jsx frontend/src/index.css
git commit -m "feat: block preview component"
```

---

## Task 10: `views/Program.jsx` — blocks list, manual create, activate, finish

**Files:**
- Create: `frontend/src/views/Program.jsx`
- Modify: `frontend/src/App.jsx` (route), `frontend/src/views/Settings.jsx` (link row), `frontend/src/components/TabBar.jsx` **only if** adding a tab is trivial — otherwise reach Program from Settings + the Home card (Task 11). Prefer Settings link + Home card; do not restructure the tab bar in this plan.
- Reference: `frontend/src/views/Plan.jsx` (list/section markup, `addRoutine` pattern), `frontend/src/lib/blocks.js` (Task 3), `frontend/src/sheets.jsx` (`confirmSheet`, and any `promptSheet`/text-input sheet — search for one; if none exists, use a simple inline name state).

**Interfaces:**
- Consumes: `newManualBlock`, `activeBlock`, `materializeBlock`, `snapshotActiveBlock`, `finishActiveBlock` from `lib/blocks.js`; `BlockPreview` from `components/BlockPreview.jsx`.
- Produces: route `#/program`. This is the surface Plan 2 hangs the "Generate block" button on (leave a clearly-marked spot).

- [ ] **Step 1: Write the component**

Create `frontend/src/views/Program.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { newManualBlock, activeBlock, materializeBlock, finishActiveBlock } from '../lib/blocks.js'
import BlockPreview from '../components/BlockPreview.jsx'

export default function Program() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [previewId, setPreviewId] = useState(null)

  const blocks = S.program?.blocks || []
  const current = activeBlock(S)
  const preview = blocks.find(b => b.id === previewId)

  const addBlock = () => {
    const b = newManualBlock({ name: t('New block'), weeks: 4 })
    update(s => { s.program.blocks.push(b) })
  }

  const activate = id => update(s => {
    // snapshot the outgoing block's live edits first
    if (s.program.activeId && s.program.activeId !== id) {
      const out = s.program.blocks.find(x => x.id === s.program.activeId)
      if (out) { out.routines = JSON.parse(JSON.stringify(s.routines)); out.week = JSON.parse(JSON.stringify(s.week)) }
    }
    materializeBlock(s, id)
  })

  const finish = () => confirmSheet({
    title: t('Finish current block?'),
    message: t('It moves to your history. Your routines stay until you activate another block.'),
    confirmText: t('Finish'),
    onConfirm: () => update(s => finishActiveBlock(s))
  })

  if (preview) return <>
    <div className="hdr">
      <button className="iconbtn" onClick={() => setPreviewId(null)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}><h1>{t('Block preview')}</h1></div>
    </div>
    <BlockPreview block={preview} />
    <div className="narrow row" style={{ gap: 10 }}>
      {S.program.activeId !== preview.id && <Button variant="primary" icon="play" onClick={() => { activate(preview.id); setPreviewId(null); nav('/plan') }}>{t('Activate this block')}</Button>}
      <Button variant="tinted" icon="pencil" onClick={() => { if (S.program.activeId !== preview.id) activate(preview.id); nav('/plan') }}>{t('Edit routines')}</Button>
    </div>
  </>

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}><h1>{t('Program')}</h1><div className="sub">{t('Your training blocks')}</div></div>
    </div>

    {/* Plan 2 mounts the "Generate block" button here. */}

    {current && <div className="card" style={{ marginBottom: 16 }}>
      <div className="small dim">{t('Current block')}</div>
      <h2 style={{ margin: '2px 0 8px' }}>{current.name}</h2>
      <div className="small dim">{t('{0} weeks', current.weeks)}{current.startedAt ? ` · ${t('since')} ${current.startedAt}` : ''}</div>
      <div className="row" style={{ gap: 10, marginTop: 10 }}>
        <Button size="sm" variant="tinted" onClick={() => setPreviewId(current.id)}>{t('View')}</Button>
        <Button size="sm" variant="tinted" onClick={() => nav('/plan')}>{t('Edit routines')}</Button>
        <Button size="sm" variant="danger" onClick={finish}>{t('Finish block')}</Button>
      </div>
    </div>}

    <div className="row between" style={{ marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('All blocks')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={addBlock}>{t('New')}</Button>
    </div>

    {blocks.length ? <div className="list">
      {blocks.map(b => {
        const state = b.id === S.program.activeId ? t('active') : b.completedAt ? t('completed') : t('draft')
        return <div key={b.id} className="item" onClick={() => setPreviewId(b.id)}>
          <div className="grow"><div className="tt">{b.name}</div><div className="ss">{t('{0} weeks', b.weeks)} · {state}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
    </div> : <div className="empty"><div className="ico"><Icon name="calendar" /></div>{t('No blocks yet.')}<br />{t('Create one, or set up your profile to generate one.')}</div>}
  </div>
}
```

Reconcile every `Button`/`Icon` name and `confirmSheet` signature with the real ones. If there is no `pencil`/`play`/`calendar` glyph, pick an existing one from `lib/glyphs.js` / `components/Icon.jsx`.

- [ ] **Step 2: Wire route + Settings link**

`frontend/src/App.jsx`:

```js
import Program from './views/Program.jsx'
```
```jsx
              <Route path="/program" element={<Program />} />
```

`frontend/src/views/Settings.jsx` — next to the Training profile row from Task 8:

```jsx
      <Row icon="calendar" title={t('Program')} onClick={() => nav('/program')} chevron />
```

- [ ] **Step 3: Build check**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS + build OK.

- [ ] **Step 4: Manual verification — the full block lifecycle**

1. Settings → Program. Empty state shows.
2. "New" → a "New block" draft appears in the list.
3. Tap it → BlockPreview (empty routines). Back.
4. Tap it → "Activate this block" → lands on Plan. `S.routines` is now empty (the block had none) — expected.
5. In Plan, add two routines with a few exercises, assign them to weekdays.
6. Back to Program → "Finish block" → confirm. Block now shows "completed". `program.activeId` is null; routines still visible in Plan.
7. "New" again → activate the new one. Add a routine. Go back to Program, tap the *completed* block → its preview still shows the two routines you built in step 5 (snapshot survived). The active block's edits did not leak into it.
8. Reload the app → all blocks, their routines, and active state persist.
9. Regression: with a completed/active program, Home / Plan / Workout / Stats all still work exactly as before.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Program.jsx frontend/src/App.jsx frontend/src/views/Settings.jsx
git commit -m "feat: program screen with manual training blocks"
```

---

## Task 11: Home first-run card

**Files:**
- Modify: `frontend/src/views/Home.jsx` (top of the returned JSX, ~after the header)
- Reference: read `frontend/src/views/Home.jsx` for the existing card/empty-state idiom.

**Interfaces:**
- Consumes: `S.profile`, `S.program`, `activeBlock` from `lib/blocks.js`.
- Produces: a dismissible-by-progress prompt; no new persisted state (it hides once a profile exists or a block is active).

- [ ] **Step 1: Add the card**

In `frontend/src/views/Home.jsx`, add near the top of the main content (inside the existing wrapper, before the "today" section):

```jsx
{(() => {
  const hasProfile = Object.keys(S.profile || {}).length > 0
  const hasProgram = !!(S.program?.blocks || []).length
  if (hasProfile && hasProgram) return null
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>{t('Set up your training')}</h2>
      <p className="small dim" style={{ marginTop: 4 }}>
        {hasProfile
          ? t('Create your first training block.')
          : t('Tell us your goal and constraints to build a periodized plan.')}
      </p>
      <Button size="sm" variant="primary" onClick={() => nav(hasProfile ? '/program' : '/profile')}>
        {hasProfile ? t('Go to Program') : t('Set up profile')}
      </Button>
    </div>
  )
})()}
```

Ensure `Button` and `nav` (`useNavigate`) are imported in `Home.jsx` (add if missing).

- [ ] **Step 2: Build check**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS + build OK.

- [ ] **Step 3: Manual verification**

1. Fresh profile (clear `S.profile` via Settings or a new account): Home shows "Set up your training" → "Set up profile".
2. Fill the profile → Home card now says "Create your first training block" → "Go to Program".
3. Create + activate a block → card disappears.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "feat: home card prompting training setup"
```

---

## Task 12: Full regression pass & docs

**Files:**
- Modify: `README.md` (a short "Periodized programs" paragraph), `docs/superpowers/specs/2026-08-27-agent-training-blocks-design.md` (mark Plan 1 sections done — optional)

- [ ] **Step 1: Run the whole test suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS. Record the count.

- [ ] **Step 2: Production build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings beyond the pre-existing chunk-size ones.

- [ ] **Step 3: Manual regression script (local app)**

With API + vite + media running and a signed-in account that has **no** program:
1. Load starter plan (Plan screen) → train a session → check it off → Stats updates. (Existing flow, must be untouched.)
2. Plan share → export → re-import into the same account → routines merge as before.
3. Now create a block, activate it, train a session, finish it, start another.
4. Export the plan again → confirm the file still validates and re-imports (blocks are not in the share format; the materialized routines are).
5. Sign out everywhere → sign back in → program + blocks + profile all restored from the server.
6. Toggle to a mobile-style reload (DevTools) — no crash from the new state fields.

- [ ] **Step 4: Write the README paragraph**

Add under an appropriate section in `README.md`:

```markdown
### Periodized programs

Beyond the single repeating weekly schedule, openGym supports **training blocks**:
self-contained multi-week routines you can create, edit, and activate from
**Settings → Program**. Activating a block replaces your current routines and
weekly schedule with that block's; your workout history is preserved (it's keyed
by exercise, not routine). Blocks you finish are kept read-only for reference.
Set your goal and constraints in **Settings → Training profile**.
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-08-27-agent-training-blocks-design.md
git commit -m "docs: periodized programs section"
```

---

## Self-Review

**Spec coverage (Plan 1 portion):**

| Spec section | Task |
|---|---|
| §3.1 `S.profile` | Task 1 (field), Task 8 (form) |
| §3.2 `S.program` / blocks / materialization / history survival / editing active block | Task 1 (field), Task 3 (logic), Task 10 (UI + activate-snapshots-outgoing) |
| §3.3 interval cardio (model, rendering, logging, share passthrough) | Task 2 (math), Task 6 (config), Task 7 (workout), Task 5 (share) |
| §3.4 routine/exercise shape unchanged | respected throughout; `repsMin/Max` passthrough in Task 5 |
| §4 curated catalog | **Plan 2** (not needed for manual blocks) |
| §5 backend route + provider adapters | **Plan 2** |
| §5.2 `SessionDigest` | Task 4 (`buildHistoryDigest`) — built now, consumed in Plan 2 |
| §6.1 Profile screen | Task 8 |
| §6.2 Program screen (manual half) | Task 10 |
| §6.3 BlockPreview | Task 9 |
| §6.4 `lib/agent.js` helpers | split: block ops → `lib/blocks.js` (Task 3), digest → `lib/digest.js` (Task 4); the `generateBlock` API wrapper is Plan 2 |
| §6.5 feature flag (`GET /api/config` `agent`) | **Plan 2** |
| §7 compatibility | Task 1 (DEF merge test), Task 12 (regression) |
| §8 testing | per-task tests + Task 12 |
| First-run card (§6.1) | Task 11 |

**Deferred to Plan 2 (agent):** curated catalog + build script, `api/plan/*`, `api/llm/*`, `POST /api/plan/generate`, `GET /api/config` flag, the `generateBlock` client wrapper, and wiring the "Generate block" / "Generate next block" buttons into `views/Program.jsx` at the marked spot.

**Naming consistency check:** `materializeBlock`, `snapshotActiveBlock`, `activeBlock`, `finishActiveBlock`, `newManualBlock` — used identically in Tasks 3, 10. `minutesJogged`, `intervalSummary`, `plannedRounds` — Tasks 2, 6, 7, 9. `buildHistoryDigest` — Task 4 only in this plan. `S.program.blocks` / `S.program.activeId` / `S.profile` — Tasks 1, 3, 8, 10, 11.

**Placeholder scan:** Task 4 Step 1 and several UI tasks say "reconcile with the real signature" — this is deliberate: the plan author could not see `components/ui.jsx`, `components/Stepper.jsx`, `views/Settings.jsx`, or a workout fixture. Each such instruction names the exact file to check and what to look for, and every task still ships full code to adapt, not a blank. Not treated as a plan failure, but the executor must do that reconciliation before the build check in each task.

**Known risk:** Task 7 (Workout interval logging) is the most invasive edit — `Workout.jsx` is large and its cardio column logic is terse. If the ternary restructure in Step 3 proves too tangled, the fallback is to keep the `min` stepper for interval cardio too (user enters minutes directly) and only add the `intervalSummary` breakdown line (Step 2) + the append default (Step 4) — losing the rounds-counter convenience but keeping the model correct. Note this to the reviewer if taken.
