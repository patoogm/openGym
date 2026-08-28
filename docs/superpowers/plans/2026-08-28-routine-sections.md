# Routine Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a routine's exercise list be organised into named, label-only sections that show in the editor, the workout screen, and the printed/shared plan.

**Architecture:** A section is a marker object `{ section: "Fuerza" }` interleaved in `routine.ex` (no `id`). `routine.ex` stays the single ordered source of truth; a new pure helper module (`lib/routine.js`) provides the filter/group functions, and every site that treats `routine.ex` as "a list of exercises" is routed through it.

**Tech Stack:** React 19 + Vite, Zustand store, Vitest (`npm test` in `frontend/`, jsdom via `// @vitest-environment jsdom` header). No runtime dependencies added.

**Spec:** `docs/superpowers/specs/2026-08-28-routine-sections-design.md`

## Global Constraints

- Every new field is **additive and optional**; a routine with no markers must behave exactly as today. No `DEF` change, no store migration.
- Section marker shape is exactly `{ section: <string> }` — no `id`, no other keys. Identity test: `e.section != null && e.id == null`.
- Section names are free text; empty/whitespace falls back to the localised `"New section"` (mirrors the `routine.name` rule in `RoutineEdit.jsx:45`).
- UI term is **"Sección"** (never "bloque" — that means a periodized `program.blocks` mesocycle).
- Deleting a section deletes the section **and all its exercises**, behind a destructive `confirmSheet`.
- `PLAN_FMT` in `lib/plan-share.js` is **not** bumped.
- Source strings are English; translations go in `frontend/src/locales/es.js`. Other locales fall back to English automatically.
- Follow existing code style: 2-space indent, no semicolons, single quotes, no default exports for lib helpers.
- Run tests from `frontend/`: `npx vitest run <path>`.
- Commit after each task with a `feat:` / `test:` / `chore:` prefixed message ending with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.

---

### Task 1: `lib/routine.js` helper module

**Files:**
- Create: `frontend/src/lib/routine.js`
- Test: `frontend/src/lib/routine.test.js`
- Test: `frontend/src/store/useStore.test.js` (add one compat test)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isSection(e) => boolean` — `e != null && e.section != null && e.id == null`
  - `exItems(list) => Ex[]` — `list` with markers removed; `list` may be `undefined`
  - `countEx(list) => number` — `exItems(list).length`
  - `sectionsOf(list) => Array<{ name: string | null, rows: Array<{ e, i }> }>` — `list` walked into groups; a new group starts at each marker; `name` is `null` for the leading group of exercises that precede the first marker; the leading `null` group is omitted when it has no rows; `i` is the index of `e` in the original `list`
  - `sectionAt(list, i) => string | null` — the `section` of the nearest marker at an index `< i`, or `null`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/routine.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { isSection, exItems, countEx, sectionsOf, sectionAt } from './routine.js'

const SEC = n => ({ section: n })
const EX = id => ({ id, sets: 3, reps: 10 })

describe('isSection', () => {
  it('is true for a marker and false for an exercise or junk', () => {
    expect(isSection(SEC('Fuerza'))).toBe(true)
    expect(isSection(EX('0025'))).toBe(false)
    expect(isSection({ section: 'x', id: '0025' })).toBe(false) // has an id → not a marker
    expect(isSection(null)).toBe(false)
    expect(isSection(undefined)).toBe(false)
  })
})

describe('exItems / countEx', () => {
  it('drops markers, keeps exercises, tolerates undefined', () => {
    const list = [SEC('A'), EX('1'), EX('2'), SEC('B'), EX('3')]
    expect(exItems(list).map(e => e.id)).toEqual(['1', '2', '3'])
    expect(countEx(list)).toBe(3)
    expect(exItems(undefined)).toEqual([])
    expect(countEx(undefined)).toBe(0)
    expect(countEx([SEC('A'), SEC('B')])).toBe(0)
  })
})

describe('sectionsOf', () => {
  it('returns a single null group when there are no markers', () => {
    const list = [EX('1'), EX('2')]
    const g = sectionsOf(list)
    expect(g).toHaveLength(1)
    expect(g[0].name).toBe(null)
    expect(g[0].rows.map(r => r.i)).toEqual([0, 1])
  })

  it('omits the leading null group when a marker is first', () => {
    const g = sectionsOf([SEC('Fuerza'), EX('1'), EX('2')])
    expect(g).toHaveLength(1)
    expect(g[0].name).toBe('Fuerza')
    expect(g[0].rows.map(r => r.e.id)).toEqual(['1', '2'])
  })

  it('keeps the leading null group when exercises precede the first marker', () => {
    const g = sectionsOf([EX('1'), SEC('Fuerza'), EX('2')])
    expect(g.map(x => x.name)).toEqual([null, 'Fuerza'])
    expect(g[0].rows.map(r => r.i)).toEqual([0])
    expect(g[1].rows.map(r => r.i)).toEqual([2])
  })

  it('represents consecutive markers as an empty group', () => {
    const g = sectionsOf([SEC('A'), SEC('B'), EX('1')])
    expect(g.map(x => x.name)).toEqual(['A', 'B'])
    expect(g[0].rows).toEqual([])
    expect(g[1].rows.map(r => r.e.id)).toEqual(['1'])
  })

  it('returns [] for an empty list', () => {
    expect(sectionsOf([])).toEqual([])
    expect(sectionsOf(undefined)).toEqual([])
  })
})

describe('sectionAt', () => {
  const list = [EX('0'), SEC('Fuerza'), EX('2'), EX('3'), SEC('Cardio'), EX('5')]
  it('finds the enclosing section name', () => {
    expect(sectionAt(list, 0)).toBe(null)
    expect(sectionAt(list, 2)).toBe('Fuerza')
    expect(sectionAt(list, 3)).toBe('Fuerza')
    expect(sectionAt(list, 5)).toBe('Cardio')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/routine.test.js`
Expected: FAIL — `Failed to resolve import "./routine.js"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/routine.js`:

```js
// Routine sections. A section is a marker entry interleaved in routine.ex with the
// shape { section: "<name>" } and no id — see docs/superpowers/specs/2026-08-28-routine-sections-design.md.
// routine.ex stays the ordered source of truth; these helpers let every consumer that
// wants "just the exercises" or "the groups" read past the markers.

export const isSection = e => e != null && e.section != null && e.id == null

export const exItems = list => (list || []).filter(e => !isSection(e))

export const countEx = list => exItems(list).length

// Walk the flat list into rendered groups, keeping the real index of every exercise.
// The leading group (name: null) holds exercises before the first marker; it is
// dropped when empty. Consecutive markers produce an empty group.
export function sectionsOf(list) {
  const src = list || []
  if (!src.length) return []
  const groups = [{ name: null, rows: [] }]
  src.forEach((e, i) => {
    if (isSection(e)) groups.push({ name: e.section, rows: [] })
    else groups[groups.length - 1].rows.push({ e, i })
  })
  if (groups[0].name === null && groups[0].rows.length === 0) groups.shift()
  return groups
}

// The section name the entry at index `i` belongs to (nearest preceding marker), or null.
export function sectionAt(list, i) {
  const src = list || []
  for (let j = Math.min(i, src.length) - 1; j >= 0; j--) {
    if (isSection(src[j])) return src[j].section
  }
  return null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/routine.test.js`
Expected: PASS (all groups).

- [ ] **Step 5: Add the store compatibility test**

In `frontend/src/store/useStore.test.js`, inside the existing `describe('DEF', …)` block, add:

```js
  it('a pre-sections routine is unchanged after merge onto DEF', () => {
    const old = { routines: [{ id: 'r1', name: 'A', ex: [{ id: '0025', sets: 3, reps: 8 }] }] }
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), old)
    expect(merged.routines[0].ex).toEqual([{ id: '0025', sets: 3, reps: 8 }])
  })
```

- [ ] **Step 6: Run the store test**

Run: `cd frontend && npx vitest run src/store/useStore.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/routine.js frontend/src/lib/routine.test.js frontend/src/store/useStore.test.js
git commit -m "feat: routine.js section helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Route the exercise-count and load consumers through `countEx` / `exItems`

**Files:**
- Modify: `frontend/src/views/Plan.jsx` (import line + line ~44)
- Modify: `frontend/src/views/Workout.jsx` (import + lines ~31, ~39)
- Modify: `frontend/src/components/TabBar.jsx` (import + line ~21)
- Modify: `frontend/src/sheets.jsx` (import + lines ~333, ~677, ~768, ~786, and `usageMap` ~408)
- Modify: `frontend/src/lib/muscles.js` (line ~115)
- Test: `frontend/src/lib/muscles.test.js` (create — none exists)

**Interfaces:**
- Consumes: `countEx`, `exItems` from `lib/routine.js` (Task 1).
- Produces: no new exports. `loadOfRoutine` keeps its signature `(routine) => LoadMap`.

- [ ] **Step 1: Write the failing test for `loadOfRoutine`**

Create `frontend/src/lib/muscles.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { loadOfRoutine } from './muscles.js'

describe('loadOfRoutine', () => {
  it('ignores section markers when summing planned load', () => {
    const withSections = loadOfRoutine({ ex: [
      { section: 'Fuerza' },
      { id: '0025', sets: 4 },
      { section: 'Accesorios' },
      { id: '0294', sets: 3 },
    ] })
    const flat = loadOfRoutine({ ex: [
      { id: '0025', sets: 4 },
      { id: '0294', sets: 3 },
    ] })
    expect(withSections).toEqual(flat)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/lib/muscles.test.js`
Expected: FAIL — the marker `{ section: 'Fuerza' }` becomes `{ id: undefined, sets: 1 }` and shifts the load map (or throws in `loadOf`).

- [ ] **Step 3: Fix `loadOfRoutine`**

In `frontend/src/lib/muscles.js`, add the import at the top (next to the other local imports):

```js
import { exItems } from './routine.js'
```

Change line ~115 from:

```js
export const loadOfRoutine = routine =>
  loadOf((routine?.ex || []).map(c => ({ id: c.id, sets: c.sets || 1 })))
```

to:

```js
export const loadOfRoutine = routine =>
  loadOf(exItems(routine?.ex).map(c => ({ id: c.id, sets: c.sets || 1 })))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/muscles.test.js`
Expected: PASS.

- [ ] **Step 5: Update `Plan.jsx`**

Import: change `import { DAYN, uid, exCount } from '../lib/format.js'` to keep that line and add below it:

```js
import { countEx } from '../lib/routine.js'
```

Line ~44: change `<div className="ss">{exCount(r.ex.length)}</div>` to `<div className="ss">{exCount(countEx(r.ex))}</div>`.

- [ ] **Step 6: Update `Workout.jsx`**

Add import near the other lib imports:

```js
import { countEx } from '../lib/routine.js'
```

Lines ~31 and ~39: change both `{exCount(todayR.ex.length)}` / `{exCount(r.ex.length)}` to wrap the arg in `countEx(...)`:
`{exCount(countEx(todayR.ex))}` and `{exCount(countEx(r.ex))}`.

- [ ] **Step 7: Update `TabBar.jsx`**

Add import:

```js
import { countEx } from '../lib/routine.js'
```

Line ~21: change `if (r && r.ex.length) { onStart(r.id); return }` to `if (r && countEx(r.ex)) { onStart(r.id); return }`.

- [ ] **Step 8: Update `sheets.jsx`**

Add `countEx, exItems` to the existing `lib/routine.js`… there is no such import yet — add:

```js
import { countEx, exItems, isSection, sectionAt } from './lib/routine.js'
```

(`isSection` / `sectionAt` are used in Task 3; import them all now.)

- Line ~333, ~768, ~786: change `{exCount(r.ex.length)}` → `{exCount(countEx(r.ex))}` (three occurrences; verify each is the routine-picker row and not something else).
- Line ~677: change `const hasRoutines = (st.routines || []).some(r => r.ex && r.ex.length)` → `const hasRoutines = (st.routines || []).some(r => countEx(r.ex) > 0)`.
- `usageMap` (~408): change `st.routines.forEach(r => r.ex.forEach(e => { u[e.id] = (u[e.id] || 0) + 1 }))` → `st.routines.forEach(r => exItems(r.ex).forEach(e => { u[e.id] = (u[e.id] || 0) + 1 }))`.

- [ ] **Step 9: Run the full suite to confirm no regression**

Run: `cd frontend && npx vitest run`
Expected: PASS (all files). The pre-existing tests exercise these call sites with marker-free data, so they stay green.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/views/Plan.jsx frontend/src/views/Workout.jsx frontend/src/components/TabBar.jsx frontend/src/sheets.jsx frontend/src/lib/muscles.js frontend/src/lib/muscles.test.js
git commit -m "feat: count exercises past section markers in routine.ex

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Skip markers when building a workout; show the section label while training

**Files:**
- Modify: `frontend/src/sheets.jsx` — `beginWorkout` (~871-886)
- Modify: `frontend/src/views/Workout.jsx` — render, near line ~281
- Modify: `frontend/src/index.css` — add `.wsection`
- Test: `frontend/src/sheets.jsx` has no test file; add `frontend/src/lib/workout-entries.test.js` by extracting nothing — instead test `beginWorkout` indirectly is hard. See Step 1 for the chosen approach.

**Interfaces:**
- Consumes: `isSection` from `lib/routine.js`.
- Produces: workout entries now carry an optional `section: string | null` field (`s.active.entries[n].section`). No signature change to `beginWorkout(routineId, bw)`.

- [ ] **Step 1: Write the failing test**

`beginWorkout` mutates the store and navigates, so test the marker-skipping + section-tagging logic as a pure function extracted from it. Create the helper first.

Create `frontend/src/lib/workout-entries.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { entryConfigs } from './routine.js'

describe('entryConfigs', () => {
  it('drops markers and tags each config with its section', () => {
    const list = [
      { section: 'Fuerza' },
      { id: '0025', sets: 4, sg: 'a' },
      { id: '0043', sets: 3, sg: 'a' },
      { section: 'Cardio' },
      { id: 'treadmill', sets: 1 },
      { id: '0294', sets: 3 },            // still Cardio
    ]
    const out = entryConfigs(list)
    expect(out.map(x => x.cfg.id)).toEqual(['0025', '0043', 'treadmill', '0294'])
    expect(out.map(x => x.section)).toEqual(['Fuerza', 'Fuerza', 'Cardio', 'Cardio'])
    expect(out[0].cfg.sg).toBe('a')       // config passed through untouched
  })

  it('leaves pre-marker exercises with a null section', () => {
    const out = entryConfigs([{ id: '0025', sets: 3 }, { section: 'X' }, { id: '0043', sets: 3 }])
    expect(out.map(x => x.section)).toEqual([null, 'X'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/lib/workout-entries.test.js`
Expected: FAIL — `entryConfigs` is not exported from `routine.js`.

- [ ] **Step 3: Add `entryConfigs` to `lib/routine.js`**

Append to `frontend/src/lib/routine.js`:

```js
// Flatten a routine's ex list to the exercise configs a workout is built from,
// each tagged with the section it sits in. Markers are consumed, not emitted.
export function entryConfigs(list) {
  const out = []
  let section = null
  ;(list || []).forEach(e => {
    if (isSection(e)) { section = e.section; return }
    out.push({ cfg: e, section })
  })
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/workout-entries.test.js`
Expected: PASS.

- [ ] **Step 5: Use it in `beginWorkout`**

In `frontend/src/sheets.jsx`, `beginWorkout` currently has:

```js
  const entries = (r ? r.ex : []).map(cfg => {
    const plan = nextPrescription(st, cfg, r)
    return { id: cfg.id, sg: cfg.sg, target: { ...cfg }, plan, sets: applyPrescription(buildSets(st, cfg), plan) }
  })
```

Replace with (the `entryConfigs` import was added in Task 2 Step 8 — if implementing out of order, add `entryConfigs` to that import from `./lib/routine.js`):

```js
  const entries = entryConfigs(r ? r.ex : []).map(({ cfg, section }) => {
    const plan = nextPrescription(st, cfg, r)
    return { id: cfg.id, sg: cfg.sg, section, target: { ...cfg }, plan, sets: applyPrescription(buildSets(st, cfg), plan) }
  })
```

- [ ] **Step 6: Add the workout section label**

In `frontend/src/views/Workout.jsx`, find the line (~281):

```jsx
      <div className="muted small" style={{ marginBottom: 6 }}>{isSuperset ? t('Superset {0} / {1}', unitIdx + 1, units.length) : t('Exercise {0} / {1}', unitIdx + 1, units.length)}</div>
```

Immediately **before** it, add:

```jsx
      {A.entries[cur]?.section && <div className="wsection">{A.entries[cur].section}</div>}
```

- [ ] **Step 7: Add the `.wsection` style**

In `frontend/src/index.css`, near the other workout classes (search for `.wprog`), add:

```css
.wsection{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--label-3);margin-bottom:4px}
```

- [ ] **Step 8: Run tests + build**

Run: `cd frontend && npx vitest run && npx vite build`
Expected: all tests PASS; build succeeds. Delete `frontend/dist` afterwards (`rm -rf frontend/dist`).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/routine.js frontend/src/lib/workout-entries.test.js frontend/src/sheets.jsx frontend/src/views/Workout.jsx frontend/src/index.css
git commit -m "feat: carry section labels into the workout screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Section headers, rename, add, and delete in the routine editor

**Files:**
- Modify: `frontend/src/views/RoutineEdit.jsx`
- Modify: `frontend/src/locales/es.js`

**Interfaces:**
- Consumes: `sectionsOf`, `isSection` from `lib/routine.js`; `confirmSheet` from `sheets.jsx` (already imported).
- Produces: no new exports. Writes `{ section }` markers into `s.routines[…].ex`.

This task has no automated test (the mutations are inline in JSX and the data helpers they lean on are covered by Task 1). It ends with a **manual smoke** in Step 7.

- [ ] **Step 1: Import the helpers**

In `frontend/src/views/RoutineEdit.jsx`, change:

```js
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
```

leave as-is, and add below the other lib imports:

```js
import { sectionsOf, isSection } from '../lib/routine.js'
```

- [ ] **Step 2: Render the list grouped by section**

Replace the current list block (`RoutineEdit.jsx:59-80`, from `{r.ex.length ? <div className="list">{r.ex.map((e, i) => {` through its closing `})}</div> : <div className="empty">…</div>}`) with a walk over `sectionsOf(r.ex)`. Keep every exercise row **keyed by its real index `i`** and keep passing `i` to `exConfigSheet`, `move`, `toggleLink`, and the `unitFirst`/`inSS` checks — those are unchanged.

```jsx
    {countEx(r.ex) || r.ex.some(isSection)
      ? <div className="list">
        {sectionsOf(r.ex).map((g, gi) => <div key={gi}>
          {/* section header — wired up in Step 3 */}
          {g.rows.map(({ e, i }) => {
            const ex = exOr(e.id)
            const linkedPrev = i > 0 && e.sg && r.ex[i - 1] && r.ex[i - 1].sg === e.sg
            return <div key={i}>
              {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
              <div className={'item' + (inSS.has(i) ? ' in-ss' : '')} onClick={() => {
                exConfigSheet(ex, e, cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }), () => edit(x => { x.splice(i, 1); cleanupSg(x) }), r)
              }}>
                <Thumb ex={ex} />
                <div className="grow"><div className="tt cap1">{nameFor(ex)}</div><div className="ss">{exLine(e, S.unit)}</div></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none', alignItems: 'center' }}>
                  {i > 0 && <button className={'iconbtn' + (linkedPrev ? ' on-ss' : '')} title={t('Superset with exercise above')} style={{ width: 32, height: 28, borderRadius: 8, fontSize: 15 }} onClick={ev => { ev.stopPropagation(); toggleLink(i) }}><Icon name="link" /></button>}
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="iconbtn" aria-label="Move up" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, -1) }}><Icon name="chevronUp" /></button>
                    <button className="iconbtn" aria-label="Move down" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, 1) }}><Icon name="chevronDown" /></button>
                  </div>
                </div>
              </div>
            </div>
          })}
        </div>)}
      </div>
      : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}
```

Add a small helper defined **inside the component** (above the `return`) to find a named section's marker index in `r.ex`:

```js
  // The index in r.ex of the marker that opens the gi-th named section (0-based over named groups).
  const sectionMarkerIndex = gi => {
    let seen = -1
    for (let k = 0; k < r.ex.length; k++) {
      if (isSection(r.ex[k]) && ++seen === gi) return k
    }
    return -1
  }
```

Add `countEx` to the routine.js import: `import { sectionsOf, isSection, countEx } from '../lib/routine.js'`.

- [ ] **Step 3: The `SectionHeader` sub-component**

Add inside `RoutineEdit.jsx`, above `export default function RoutineEdit()`:

```jsx
function SectionHeader({ idx, name, count, onRename, onMove, onDelete }) {
  return (
    <div className="sect-hdr">
      <input className="input sect-name" defaultValue={name}
        onChange={e => onRename(e.target.value)} />
      <button className="iconbtn" aria-label="Move section up" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={() => onMove(-1)}><Icon name="chevronUp" /></button>
      <button className="iconbtn" aria-label="Move section down" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={() => onMove(1)}><Icon name="chevronDown" /></button>
      <button className="iconbtn" aria-label="Delete section" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={onDelete}><Icon name="trash" /></button>
    </div>
  )
}
```

Wire the callbacks where `SectionHeader` is rendered:

```jsx
          {g.name !== null && (() => {
            const mi = sectionMarkerIndex(gi)
            return <SectionHeader idx={mi} name={g.name} count={g.rows.length}
              onRename={v => update(s => { s.routines.find(x => x.id === id).ex[mi].section = v.trim() || t('New section') })}
              onMove={dir => move(mi, dir)}
              onDelete={() => {
                if (g.rows.length === 0) {
                  edit(ex => { ex.splice(mi, 1) })
                  return
                }
                confirmSheet({
                  title: t('Delete section?'),
                  message: t('“{0}” and its {1} exercises will be removed. This can’t be undone.', g.name, g.rows.length),
                  confirmText: t('Delete'), danger: true,
                  onConfirm: () => edit(ex => { ex.splice(mi, g.rows.length + 1); cleanupSg(ex) })
                })
              }} />
          })()}
```

> Note: `g.rows` are always contiguous in `r.ex` and immediately follow the marker (that is how `sectionsOf` builds them), so `splice(mi, g.rows.length + 1)` removes exactly the marker and its exercises.

- [ ] **Step 4: The "Add section" button**

The current "Add exercise" button is at `RoutineEdit.jsx:97`. Directly below it (before the `<div style={{ height: 10 }} />` that precedes "Delete routine"), add:

```jsx
    <div style={{ height: 8 }} />
    <Button onClick={() => edit(ex => { ex.push({ section: t('New section') }) })} icon="plus">{t('Add section')}</Button>
```

- [ ] **Step 5: Styles**

In `frontend/src/index.css`, near the `.ss-label` rule (search for it), add:

```css
.sect-hdr{display:flex;align-items:center;gap:4px;margin:14px 2px 6px}
.sect-hdr .sect-name{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--label-2);padding:6px 8px;flex:1}
```

- [ ] **Step 6: Spanish strings**

In `frontend/src/locales/es.js`, add (place them near the other routine-editor strings — search for `'Add exercise'` or `'Delete routine'`):

```js
  'Add section': 'Añadir sección',
  'New section': 'Nueva sección',
  'Section': 'Sección',
  'Delete section?': '¿Borrar sección?',
  '“{0}” and its {1} exercises will be removed. This can’t be undone.': 'Se eliminarán «{0}» y sus {1} ejercicios. No se puede deshacer.',
```

- [ ] **Step 7: Manual smoke**

```bash
cd frontend && npx vitest run   # must stay green
npx vite --port 5199            # in the background; open http://localhost:5199
```

In a guest session:
1. Plan → New routine → open it.
2. "Añadir sección" → rename to "Fuerza". Add two exercises.
3. "Añadir sección" → "Cardio". Add one exercise.
4. Move an exercise from Cardio up past the "Cardio" header — it should join Fuerza.
5. Delete "Cardio" → confirm dialog names it and the exercise count → confirm → section and its exercise gone.
6. Plan screen shows the routine's exercise count = only real exercises.

Stop vite, `rm -rf frontend/dist`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/RoutineEdit.jsx frontend/src/locales/es.js frontend/src/index.css
git commit -m "feat: section headers in the routine editor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sections in the shared bundle and the printed plan

**Files:**
- Modify: `frontend/src/lib/plan-share.js` — `cleanEx` (~21), `buildPlanBundle` (~54-63), `parsePlan` (~84-102), `routineHTML` (~173-190), print CSS (~232)
- Test: `frontend/src/lib/plan-share.test.js` (extend)

**Interfaces:**
- Consumes: `isSection`, `exItems` from `lib/routine.js`, `sectionsOf`.
- Produces: no new exports. Bundle `routines[].ex` may now contain `{ section }` entries; `parsePlan(...).exerciseCount` counts real exercises only.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/lib/plan-share.test.js`, add a new `describe`:

```js
import { buildPlanBundle, parsePlan } from './plan-share.js'
// (planPrintHTML too, if not already imported)

describe('sections in a shared plan', () => {
  const S = {
    unit: 'kg',
    routines: [{
      id: 'r1', name: 'Full body', emoji: '',
      ex: [
        { section: 'Fuerza' },
        { id: '0025', sets: 4, reps: 6 },
        { section: 'Accesorios' },
        { id: '0294', sets: 3, reps: 12 },
      ],
    }],
    week: {}, customEx: [],
  }

  it('round-trips the markers in place and counts only real exercises', () => {
    const bundle = JSON.parse(JSON.stringify(buildPlanBundle(S, 'x')))
    const parsed = parsePlan(JSON.stringify(bundle))
    expect(parsed.routines[0].ex.map(e => e.section ?? e.id))
      .toEqual(['Fuerza', '0025', 'Accesorios', '0294'])
    expect(parsed.exerciseCount).toBe(2)
  })
})
```

If `planPrintHTML` is exported, also add:

```js
  it('prints a header per named section', () => {
    const { planPrintHTML } = require('./plan-share.js') // or import at top
    const html = planPrintHTML(S, 'owner')
    expect(html.indexOf('Fuerza')).toBeLessThan(html.indexOf('Accesorios'))
    expect(html).toContain('rt-section')
  })
```

(Use a top-of-file `import { planPrintHTML }` instead of `require` — shown inline only for clarity.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/lib/plan-share.test.js`
Expected: FAIL — markers get stripped by `cleanEx`/`parsePlan` and `exerciseCount` is 4 (or the round-trip array omits the markers).

- [ ] **Step 3: `cleanEx` passthrough**

In `frontend/src/lib/plan-share.js`, add the import at the top (next to the existing `./i18n.js` import):

```js
import { isSection, exItems } from './routine.js'
import { sectionsOf } from './routine.js'
```

(or combine into one line). At the very start of `function cleanEx(e) {`:

```js
function cleanEx(e) {
  if (isSection(e)) return { section: e.section }
  const o = { id: e.id, sets: e.sets }
  // …unchanged…
```

- [ ] **Step 4: `buildPlanBundle` counts**

`buildPlanBundle` currently:

```js
  const usedIds = new Set(routines.flatMap(r => r.ex.map(e => e.id)))
```

`r.ex` here is already `cleanEx`-mapped, so markers are `{ section }` with `e.id === undefined` — harmless in a Set, but tidy it:

```js
  const usedIds = new Set(routines.flatMap(r => exItems(r.ex).map(e => e.id)))
```

- [ ] **Step 5: `parsePlan` keeps markers**

Change the per-routine `ex` filter:

```js
    ex: r.ex.filter(e => {
      const ok = !!e && (known.has(e.id) || !!EXIDX[e.id])
      if (!ok) dropped++
      return ok
    })
```

to:

```js
    ex: r.ex.filter(e => {
      if (isSection(e)) return true
      const ok = !!e && (known.has(e.id) || !!EXIDX[e.id])
      if (!ok) dropped++
      return ok
    })
```

and the summary count:

```js
    exerciseCount: routines.reduce((n, r) => n + r.ex.length, 0),
```

to:

```js
    exerciseCount: routines.reduce((n, r) => n + exItems(r.ex).length, 0),
```

- [ ] **Step 6: `routineHTML` section headers**

Replace the body of `routineHTML(r, unit)`:

```js
function routineHTML(r, unit) {
  const groupHTML = rows => units(rows.map(x => x.e)).map(u => {
    const items = u.map(e => {
      const ex = EXIDX[e.id]
      const name = ex ? nameFor(ex) : t('Unknown exercise')
      const part = ex && ex.bp && ex.bp !== 'cardio' ? `<span class="part">${esc(t(ex.bp))}</span>` : ''
      return `<div class="ex"><div class="ex-n">${esc(name)}${part}</div><div class="ex-s">${esc(scheme(e, unit))}</div></div>`
    }).join('')
    return u.length > 1
      ? `<div class="ss"><div class="ss-tag">${esc(t('Superset'))}</div><div class="ss-items">${items}</div></div>`
      : items
  }).join('')

  const groups = sectionsOf(r.ex)
  const rows = groups.length
    ? groups.map(g =>
        (g.name !== null ? `<h3 class="rt-section">${esc(g.name)}</h3>` : '') + groupHTML(g.rows)
      ).join('')
    : ''
  const count = exCount(exItems(r.ex).length)
  return `<section class="routine">
    <div class="r-head"><h2>${esc(r.name)}</h2><span class="r-count">${esc(count)}</span></div>
    <div class="ex-list">${rows || `<div class="ex empty">${esc(t('No exercises yet.'))}</div>`}</div>
  </section>`
}
```

> `units(...)` in `history.js` groups by `sg` on adjacent items. Feeding it one section's exercises means a superset never spans a section boundary — which is correct.

- [ ] **Step 7: Print CSS**

In `planPrintHTML`'s `<style>` block, after the `.ss .ex:first-of-type` rule, add:

```css
  h3.rt-section { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #8a90a0; font-weight: 700; margin: 12px 0 4px; padding-top: 8px; border-top: 1px solid #eef0f4; }
  .ex-list > h3.rt-section:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
```

- [ ] **Step 8: Also fix `planPrintHTML`'s routine filter**

`planPrintHTML` has `const routines = (S.routines || []).filter(r => r.ex && r.ex.length)`. Change to `.filter(r => exItems(r.ex).length)` so a routine that is only an empty section isn't printed as a blank card. Add `exItems` to the import if not already present.

- [ ] **Step 9: Run the tests + full suite + build**

Run: `cd frontend && npx vitest run && npx vite build && rm -rf dist`
Expected: all PASS; build OK.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/plan-share.js frontend/src/lib/plan-share.test.js
git commit -m "feat: sections in the shared bundle and printed plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Regression guard for periodized blocks + full verification

**Files:**
- Test: `frontend/src/lib/blocks.test.js` (extend)
- Test: `frontend/src/lib/history.test.js` (extend — superset grouping across a marker)

**Interfaces:**
- Consumes: `materializeBlock` from `lib/blocks.js`, `supersetUnits` / `cleanupSg` from `lib/history.js` (all unchanged by this feature).
- Produces: nothing.

- [ ] **Step 1: Superset-across-marker regression test**

In `frontend/src/lib/history.test.js`, add:

```js
import { supersetUnits, cleanupSg } from './history.js'

describe('superset grouping with section markers', () => {
  it('a marker between two sg partners breaks the group', () => {
    const list = [
      { id: 'a', sg: 'g1' },
      { section: 'Cardio' },
      { id: 'b', sg: 'g1' },
    ]
    expect(supersetUnits(list)).toEqual([[0], [1], [2]])
  })

  it('cleanupSg strips an sg with no adjacent partner across a marker', () => {
    const list = [
      { id: 'a', sg: 'g1' },
      { section: 'X' },
      { id: 'b', sg: 'g1' },
    ]
    cleanupSg(list)
    expect(list[0].sg).toBeUndefined()
    expect(list[2].sg).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it to verify current behaviour already passes**

Run: `cd frontend && npx vitest run src/lib/history.test.js`
Expected: PASS immediately — the marker fails `prev.sg === e.sg` so it already breaks the group. (If it FAILS, `supersetUnits`/`cleanupSg` need a `!isSection` guard — add `import { isSection } from './routine.js'` and skip markers in both loops, then re-run.)

- [ ] **Step 3: `materializeBlock` keeps markers**

In `frontend/src/lib/blocks.test.js`, using the existing `blockWith` / `baseState` helpers, add:

```js
import { isSection } from './routine.js'

it('materializing a block keeps section markers and re-ids exercises', () => {
  const s = baseState()
  const block = blockWith({
    routines: [{
      id: 'br1', name: 'Lunes', emoji: '', ex: [
        { section: 'Fuerza' },
        { id: '0043', sets: 3, reps: 10 },
      ],
    }],
    week: { 1: 'br1' },
  })
  s.program.blocks = [block]
  materializeBlock(s, block)
  const ex = s.routines[0].ex
  expect(isSection(ex[0])).toBe(true)
  expect(ex[0].section).toBe('Fuerza')
  expect(ex[1].id).toBe('0043')
})
```

Check `blockWith`'s default `routines` — if the test needs `week`/`id` overrides to line up, mirror the existing passing tests in that file.

- [ ] **Step 4: Run it**

Run: `cd frontend && npx vitest run src/lib/blocks.test.js`
Expected: PASS. If `materializeBlock` throws on the marker (e.g. it assumes every `ex` entry has an `id`), add a guard there: markers pass through the clone untouched — `import { isSection } from './routine.js'` and `if (isSection(e)) return { ...e }` at the top of the per-exercise map. Re-run.

- [ ] **Step 5: Full verification**

```bash
cd frontend
npx vitest run                       # every test file green
npx vite build && rm -rf dist        # build clean
```

Then a manual end-to-end smoke (`npx vite --port 5199`):
- Build a routine with three sections (Fuerza / Cardio / Propiocepción), exercises in each.
- Start the workout: the section label shows above each exercise as you advance.
- Finish it: history logs normally, no phantom entries.
- Plan → tools → print/preview: section headers appear in order.
- Export backup → reset → import: sections come back in place.
- Stop vite, `rm -rf frontend/dist`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/history.test.js frontend/src/lib/blocks.test.js frontend/src/lib/blocks.js
git commit -m "test: regression guards for sections in blocks and supersets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Merge**

```bash
git checkout main && git merge --no-ff <feature-branch> -m "Merge routine sections"
```

(Only if working on a branch; otherwise the task commits are already on `main`.)

---

## Self-Review notes

- **Spec §3 model** → Task 1. **§4 helpers** → Task 1 (+ `entryConfigs` in Task 3). **§5 consumer table** → Tasks 2, 3, 5 (every row mapped). **§6 editor** → Task 4. **§7 workout** → Task 3. **§8 plan-share** → Task 5. **§9 i18n** → Task 4 Step 6. **§10 tests** → each task's test steps + Task 6. **§11 build order** → task order matches.
- One spec string is dropped as unused: `"“{0}” will be removed."` (the empty-section delete path in Task 4 Step 3 skips the confirm entirely). If a reviewer wants a confirm even for empty sections, add that string then.
- Type consistency: `countEx(list)`, `exItems(list)`, `sectionsOf(list) → [{name, rows:[{e,i}]}]`, `sectionAt(list,i)`, `entryConfigs(list) → [{cfg, section}]`, `isSection(e)` — used consistently across Tasks 2-6.
