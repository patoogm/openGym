# Athlete Desktop — Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a full workout comfortable on a ≥1000px screen: the current exercise in the centre, a session rail on the right (clock, progress, exercise outline with jump, rest/work timer, finish/discard), and a two-zone start chooser — without changing mobile.

**Architecture:** A pure helper `lib/sessionOutline.js` turns the active workout into outline rows (Vitest). `RestTimer` gains an `inline` mode used by the new `SessionRail`; the docked sidebar timer steps aside on `/workout` at ≥1000px. `Workout.jsx` keeps all logic and renders the same `body` in two frames: the existing `.narrow` column on mobile, `.wdesk` (main + rail) on desktop. `ExerciseBlock` gets a wrapper so CSS can place media beside the set table when the main column is wide (container query). All styling in `index.css`.

**Tech Stack:** React 19, React Router 7, Zustand, plain CSS (container queries), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (sub-project 2, "Workout"). Builds on `docs/superpowers/plans/2026-10-09-athlete-desktop-foundations-shell.md` (merged).

**Deviation from the spec:** the inline-style cleanup of `Workout.jsx` is **not** done here. The ~20 inline styles are all inside the shared `body` that mobile renders unchanged, so converting them is pure refactor risk on the most critical screen with no desktop benefit; it moves to the QA/cleanup plan (sub-project 8).

## Global Constraints

- Breakpoint **1000px** (`useIsDesktop`, `@media (min-width:1000px)`); below it nothing changes. Mobile Workout markup order and spacing stay identical.
- **No new dependencies.** No emoji as icons. No native `<select>`/checkbox/range.
- Visual changes go through tokens and classes in `index.css`; **no new inline `style={{}}`** except one dynamic width on the progress bar (the existing `.wprog i` pattern).
- Do not touch `lib/` logic other than adding `sessionOutline.js`, nor `store/`, `api/`. Workout logic (`toggle`, `setField`, `addSet`, supersets, timed sets, progression, heartbeat, wake lock) is **not modified**.
- Dark and light both work; all 8 accents; `--on-acc` untouched. `prefers-reduced-motion` and `:focus-visible` respected; icon-only buttons need `aria-label`.
- Every visible string goes through `t('English source')`. **No new keys** in this plan (reuses `Exercises`, `{0} sets`, `Finish workout`, `Finish workout early · {0} exercises`, `Discard`, `Freestyle workout — add your first exercise.`); `node scripts/check-locales.mjs` must still pass.
- Do not open `lib/exercises-data.js`, `lib/body-paths.js`, `instr/*`, `names/*`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Superset on desktop**: `.exblock.compact` blocks stay stacked inside `.ss-card`; the rail groups the superset as one row; clicking it sets `cur` to the unit's first index and `unitOf` still resolves the whole unit.
2. **Timed exercise**: pressing ▶ shows the **work** timer inline in the rail (not the docked one); Done logs the held time; Cancel clears it.
3. **Freestyle with zero exercises**: the rail renders with an empty outline and the hint, no crash; adding an exercise fills the outline.
4. **Resize mid-session**: desktop → mobile swaps the inline timer for the floating one (and back) with the timer still running; `body.resting` is set only while the *docked/floating* instance is visible.
5. **Exercises without media or with cardio/bodyweight columns** (custom exercises have no gif): no empty grid column, set table still fits.
6. **Long names / German** in the 300px rail: wrap, never overflow; the current row stays visible when the outline scrolls.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/lib/sessionOutline.js` | Create | Pure: active workout → outline rows (sections, units, status, set counts) |
| `frontend/src/lib/sessionOutline.test.js` | Create | Vitest |
| `frontend/src/components/Elapsed.jsx` | Create | The elapsed clock, moved out of `Workout.jsx` so the rail can use it |
| `frontend/src/components/RestTimer.jsx` | Modify | `inline` prop; docked instance hides on `/workout` desktop; `body.resting` only for visible docked/floating |
| `frontend/src/components/SessionRail.jsx` | Create | The right-hand rail |
| `frontend/src/views/Workout.jsx` | Modify | `ExerciseBlock` wrapper; shared `body`; mobile frame vs desktop frame; chooser wrappers |
| `frontend/src/index.css` | Modify | `.timer-inline`, `.wdesk/.wrail/.wout*`, `.exblock*`, `.wchoose` areas |
| `CLAUDE.md` | Modify | Document the desktop Workout |

---

### Task 1: `sessionOutline` (pure logic)

**Files:**
- Create: `frontend/src/lib/sessionOutline.js`
- Test: `frontend/src/lib/sessionOutline.test.js`

**Interfaces:**
- Consumes: `supersetUnits(items)` from `./history.js` (groups consecutive entries sharing `sg` into arrays of indices).
- Produces (used by Task 3): `sessionOutline(A): Row[]` where
  - `Row = { type:'section', key:string, label:string }`
  - `| { type:'unit', key:string, first:number, items:Array<{idx:number,id:string,done:number,total:number}>, superset:boolean, done:number, total:number, status:'current'|'done'|'pending' }`
  - `A` is the active workout `{ cur:number, entries:Array<{id, sg?, section?, sets:Array<{done?:boolean}>}> }`; `null`/empty → `[]`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/sessionOutline.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { sessionOutline } from './sessionOutline.js'

const E = (id, done, total, extra = {}) => ({ id, sets: Array.from({ length: total }, (_, i) => ({ done: i < done })), ...extra })

describe('sessionOutline', () => {
  it('is empty for no workout, no entries (freestyle) or a missing list', () => {
    expect(sessionOutline(null)).toEqual([])
    expect(sessionOutline(undefined)).toEqual([])
    expect(sessionOutline({ cur: 0, entries: [] })).toEqual([])
    expect(sessionOutline({ cur: 0 })).toEqual([])
  })

  it('one row per exercise with set counts and a status', () => {
    const rows = sessionOutline({ cur: 1, entries: [E('a', 3, 3), E('b', 1, 4), E('c', 0, 3)] })
    expect(rows.map(r => [r.type, r.first, r.done, r.total, r.status])).toEqual([
      ['unit', 0, 3, 3, 'done'],
      ['unit', 1, 1, 4, 'current'],
      ['unit', 2, 0, 3, 'pending']
    ])
    expect(rows[1].items).toEqual([{ idx: 1, id: 'b', done: 1, total: 4 }])
    expect(rows[1].superset).toBe(false)
  })

  it('a finished exercise that is also the current one reads as current', () => {
    const rows = sessionOutline({ cur: 0, entries: [E('a', 3, 3), E('b', 0, 3)] })
    expect(rows[0].status).toBe('current')
  })

  it('an exercise with no sets is pending, never done', () => {
    const rows = sessionOutline({ cur: 1, entries: [E('a', 0, 0), E('b', 0, 2)] })
    expect(rows[0].status).toBe('pending')
    expect(rows[0].total).toBe(0)
  })

  it('groups a superset into one row whose status follows any member being current', () => {
    const rows = sessionOutline({ cur: 2, entries: [
      E('a', 2, 2),
      E('b', 1, 3, { sg: 's1' }),
      E('c', 0, 3, { sg: 's1' }),
      E('d', 0, 2)
    ] })
    expect(rows).toHaveLength(3)
    expect(rows[1].superset).toBe(true)
    expect(rows[1].first).toBe(1)
    expect(rows[1].items.map(i => i.idx)).toEqual([1, 2])
    expect(rows[1].done).toBe(1)
    expect(rows[1].total).toBe(6)
    expect(rows[1].status).toBe('current')
  })

  it('emits a section header only when the section changes', () => {
    const rows = sessionOutline({ cur: 0, entries: [
      E('a', 0, 1, { section: 'Warm-up' }),
      E('b', 0, 1, { section: 'Warm-up' }),
      E('c', 0, 1, { section: 'Main' }),
      E('d', 0, 1, { section: null }),
      E('e', 0, 1, { section: 'Main' })
    ] })
    expect(rows.map(r => r.type === 'section' ? 'S:' + r.label : 'U' + r.first)).toEqual(
      ['S:Warm-up', 'U0', 'U1', 'S:Main', 'U2', 'U3', 'S:Main', 'U4'])
  })

  it('clamps a cursor that points past the end or below zero', () => {
    const past = sessionOutline({ cur: 99, entries: [E('a', 0, 1), E('b', 0, 1)] })
    expect(past.map(r => r.status)).toEqual(['pending', 'current'])
    const neg = sessionOutline({ cur: -3, entries: [E('a', 0, 1), E('b', 0, 1)] })
    expect(neg.map(r => r.status)).toEqual(['current', 'pending'])
  })

  it('keys are unique across rows', () => {
    const rows = sessionOutline({ cur: 0, entries: [E('a', 0, 1, { section: 'X' }), E('b', 0, 1, { section: 'Y' })] })
    expect(new Set(rows.map(r => r.key)).size).toBe(rows.length)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/lib/sessionOutline.test.js`
Expected: FAIL — cannot resolve `./sessionOutline.js`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/sessionOutline.js`:

```js
// Pure outline of an active workout for the desktop session rail: the exercises (a superset is
// one row), the section headers between them, how many sets of each are done and which one
// the cursor is on. Names are not resolved here — rows carry exercise ids so this stays free of
// i18n and the exercise database.
import { supersetUnits } from './history.js'

export function sessionOutline(A) {
  const entries = (A && A.entries) || []
  if (!entries.length) return []
  const cur = Math.min(Math.max(A.cur || 0, 0), entries.length - 1)
  const rows = []
  let lastSection = null
  supersetUnits(entries).forEach(unit => {
    const section = entries[unit[0]].section || null
    if (section && section !== lastSection) rows.push({ type: 'section', key: 's' + unit[0], label: section })
    lastSection = section
    const items = unit.map(idx => {
      const e = entries[idx]
      return { idx, id: e.id, done: e.sets.filter(s => s.done).length, total: e.sets.length }
    })
    const done = items.reduce((n, i) => n + i.done, 0)
    const total = items.reduce((n, i) => n + i.total, 0)
    const status = unit.includes(cur) ? 'current' : total > 0 && done === total ? 'done' : 'pending'
    rows.push({ type: 'unit', key: 'u' + unit[0], first: unit[0], items, superset: unit.length > 1, done, total, status })
  })
  return rows
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/sessionOutline.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add docs/superpowers/plans/2026-10-09-athlete-desktop-workout.md frontend/src/lib/sessionOutline.js frontend/src/lib/sessionOutline.test.js
git commit -m "feat(workout): pure session outline for the desktop rail, plus plan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Elapsed` extraction and inline `RestTimer`

**Files:**
- Create: `frontend/src/components/Elapsed.jsx`
- Modify: `frontend/src/components/RestTimer.jsx`
- Modify: `frontend/src/views/Workout.jsx` (only the `Elapsed` function and the React import)
- Modify: `frontend/src/index.css` (append the `.timer-inline` block)

**Interfaces:**
- Consumes: `useUI` (`timer`, `work`, `addRest`, `stopRest`, `finishWorkEarly`, `stopWork`), `useStore` (`S.active`), `useIsDesktop`, `useLocation`.
- Produces: `<Elapsed start={ms} />`; `<RestTimer inline />` renders `.timer-inline` markup (no `id="timer"`, never touches `body.resting`); the default global `<RestTimer />` returns `null` while `desktop && S.active && pathname === '/workout'`.

- [ ] **Step 1: Create `Elapsed.jsx` (verbatim move)**

`frontend/src/components/Elapsed.jsx`:

```jsx
import { useEffect, useState } from 'react'

// Elapsed clock, isolated so the workout tree doesn't re-render every second.
export default function Elapsed({ start }) {
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => { const s = Math.floor((Date.now() - start) / 1000); setT(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')) }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [start])
  return <span>{t}</span>
}
```

- [ ] **Step 2: Use it from `Workout.jsx`**

In `frontend/src/views/Workout.jsx`:
- Change `import { useEffect, useState } from 'react'` to `import { useEffect } from 'react'`.
- Add `import Elapsed from '../components/Elapsed.jsx'` next to the other component imports (after `import Media from '../components/Media.jsx'`).
- Delete the whole block that starts at the comment `/* ---------- elapsed clock (isolated so the workout tree doesn't re-render every second) ---------- */` and ends with the closing `}` of `function Elapsed({ start }) { ... }` (the `<span>{t}</span>` return).

- [ ] **Step 3: Rewrite `RestTimer.jsx`**

Replace the file with:

```jsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

// One bar, two meanings: the rest countdown between sets, and the work countdown during a
// timed set (issue #16). They are mutually exclusive by construction — startWork() stops any
// running rest — so the bar can never have to show both, and a work set gets its own colour
// plus a "Done" that logs the time actually held.
//
// Two placements: the global one (floating above the tab bar on mobile, docked in the sidebar
// on desktop) and `inline`, rendered by the desktop session rail. On the Workout screen at
// ≥1000px the rail shows the timer, so the global one steps aside.
export default function RestTimer({ inline }) {
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const { addRest, stopRest, finishWorkEarly, stopWork } = useUI()
  const desktop = useIsDesktop()
  const { pathname } = useLocation()
  const training = useStore(s => !!s.S.active)
  const on = work || timer
  const hidden = !inline && desktop && training && pathname === '/workout'
  const shown = !!on && !hidden && !inline
  // The bar is fixed above the tab bar and floats over whatever is beneath it — during a
  // rest that was the next set's row. Extra bottom padding lets the page scroll clear.
  // Only the visible global instance owns this class; the inline one is part of the layout.
  useEffect(() => {
    if (inline) return undefined
    document.body.classList.toggle('resting', shown)
    return () => document.body.classList.remove('resting')
  }, [shown, inline])
  if (!on || hidden) return null
  const pct = (on.left / on.total) * 100
  const id = inline ? undefined : 'timer'
  const cls = v => (inline ? 'timer-inline ' + v : v)

  if (work) return (
    <div id={id} className={cls('working')}>
      <div className="t">{clock(work.left)}</div>
      <div className="grow">
        {work.label && <div className="lbl">{work.label}</div>}
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
      </div>
      <Button size="sm" onClick={stopWork}>{t('Cancel')}</Button>
      <Button size="sm" variant="primary" icon="check" onClick={finishWorkEarly}>{t('Done')}</Button>
    </div>
  )
  // Three controls plus the clock don't fit one line on a phone — at 360px the bar is left
  // with about 30px and stops saying anything. So the rest variant stacks: clock and bar
  // read at a glance, controls get their own row. −15 and +15 sit together in number-line
  // order; Skip is pushed to the far edge, away from the button you tap to buy more time.
  return (
    <div id={id} className={cls('rest')}>
      <div className="head">
        <div className="t">{clock(timer.left)}</div>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
      </div>
      <div className="acts">
        <Button size="sm" icon="minus" onClick={() => addRest(-15)}>15s</Button>
        <Button size="sm" icon="plus" onClick={() => addRest(15)}>15s</Button>
        <Button size="sm" variant="primary" className="skip" onClick={stopRest}>{t('Skip')}</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Append the `.timer-inline` styles to `index.css`**

Append at the end of `frontend/src/index.css` (these mirror the `#timer` inner rules so the rail copy looks the same without touching the mobile rules):

```css

/* ------------------------------------------------------ inline timer (rail) --- */
/* The session rail's copy of the rest/work timer. Same inner markup as #timer, but a normal
   block in the layout instead of a fixed bar. Mirrors the `#timer …` rules above. */
.timer-inline{
  background:var(--surface);border-radius:var(--r-lg);padding:12px 14px;
  display:flex;align-items:center;gap:12px;
}
.timer-inline .t{font-size:26px;font-weight:600;letter-spacing:-.026em;font-variant-numeric:tabular-nums;min-width:66px}
.timer-inline .bar{flex:1;height:4px;background:var(--surface-3);border-radius:99px;overflow:hidden}
.timer-inline .bar i{display:block;height:100%;background:var(--acc);transition:width 1s linear}
.timer-inline.rest{flex-direction:column;align-items:stretch;gap:10px}
.timer-inline.rest .head{display:flex;align-items:center;gap:12px}
.timer-inline.rest .acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.timer-inline.rest .acts .btn{padding-top:11px;padding-bottom:11px}   /* sweaty hands, mid-set */
.timer-inline.rest .acts .skip{flex:1 1 100%;margin-left:0}
.timer-inline.working{border:var(--hair) solid var(--acc);flex-wrap:wrap}
.timer-inline.working .t{color:var(--acc)}
.timer-inline.working .grow{flex:1 1 100%;order:3;min-width:0}
.timer-inline.working .lbl{
  font-size:12px;color:var(--label-2);margin-bottom:5px;text-transform:capitalize;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
```

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build succeeds; all suites pass (including the 8 new). Then confirm `useState` is no longer referenced in `Workout.jsx`: `grep -n "useState" frontend/src/views/Workout.jsx` → no output.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/components/Elapsed.jsx frontend/src/components/RestTimer.jsx frontend/src/views/Workout.jsx frontend/src/index.css
git commit -m "feat(workout): inline rest timer and shared Elapsed clock

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `SessionRail` component and styles

**Files:**
- Create: `frontend/src/components/SessionRail.jsx`
- Modify: `frontend/src/index.css` (append the workout-desktop block)

**Interfaces:**
- Consumes: `sessionOutline` (Task 1), `Elapsed` and `RestTimer inline` (Task 2), `exOr` from `../lib/exercises.js`, `nameFor` from `../lib/i18n.js`.
- Produces: `<SessionRail A done total onJump onFinish onDiscard />` where `A` is `S.active`, `done`/`total` are set counts, `onJump(idx:number)`, `onFinish()`, `onDiscard()`.

- [ ] **Step 1: Create the component**

`frontend/src/components/SessionRail.jsx`:

```jsx
import { t, nameFor } from '../lib/i18n.js'
import { exOr } from '../lib/exercises.js'
import { sessionOutline } from '../lib/sessionOutline.js'
import Icon from './Icon.jsx'
import Elapsed from './Elapsed.jsx'
import RestTimer from './RestTimer.jsx'
import { Button } from './ui.jsx'

// Desktop-only right rail of the Workout screen: where you are in the session, a way to jump
// to any exercise, the rest/work timer, and finish/discard.
export default function SessionRail({ A, done, total, onJump, onFinish, onDiscard }) {
  const rows = sessionOutline(A)
  const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
  const allDone = A.entries.length > 0 && exDone === A.entries.length
  const pct = total ? Math.round(done / total * 100) : 0

  return <aside className="wrail" aria-label={t('Exercises')}>
    <div className="wrail-hd">
      <div className="wrail-name">{A.name}</div>
      <div className="wrail-sub"><Elapsed start={A.start} /> · {t('{0} sets', done + '/' + total)}</div>
      <div className="wprog"><i style={{ width: pct + '%' }} /></div>
    </div>
    <div className="wout">
      {!rows.length && <div className="small dim">{t('Freestyle workout — add your first exercise.')}</div>}
      {rows.map(r => r.type === 'section'
        ? <div key={r.key} className="wsection">{r.label}</div>
        : <button key={r.key} type="button" className={'wout-i ' + r.status}
          aria-current={r.status === 'current' ? 'step' : undefined} onClick={() => onJump(r.first)}>
          <span className="wout-ic"><Icon name={r.status === 'done' ? 'check' : r.status === 'current' ? 'play' : 'dot'} /></span>
          <span className="wout-names">{r.items.map(it => <span key={it.idx} className="cap1">{nameFor(exOr(it.id))}</span>)}</span>
          {r.superset && <Icon name="link" className="wout-ss" />}
          <span className="wout-n">{r.done}/{r.total}</span>
        </button>)}
    </div>
    <div className="wrail-ft">
      <RestTimer inline />
      <button type="button" className={allDone ? 'btn primary' : 'btn ghost dim'} onClick={onFinish}>
        {allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
      </button>
      <Button variant="ghost" className="dim" onClick={onDiscard}>{t('Discard')}</Button>
    </div>
  </aside>
}
```

- [ ] **Step 2: Append the workout-desktop styles**

Append at the end of `frontend/src/index.css`:

```css

/* ------------------------------------------------- workout desktop (≥1000px) --- */
/* ExerciseBlock wraps media + body so desktop can put them side by side. Below 1000px these
   wrappers are plain blocks and the markup flows exactly as before. */
.exblock,.exbody{display:block}
.wmain{container-type:inline-size;min-width:0}
@media (min-width:1000px){
  .wdesk{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:var(--sp-6);align-items:start}
  .wrail{
    position:sticky;top:var(--sp-5);max-height:calc(100vh - 2 * var(--sp-5));
    display:flex;flex-direction:column;gap:var(--sp-4);
    padding:var(--sp-4);background:var(--surface);border-radius:var(--r-card);
  }
  .wrail-name{font-size:17px;font-weight:600;letter-spacing:-.02em;overflow-wrap:anywhere}
  .wrail-sub{font-size:15px;color:var(--label-2);margin:2px 0 var(--sp-3)}
  .wrail-hd .wprog{margin-bottom:0}
  /* the outline scrolls on its own so the timer and Finish stay in view */
  .wout{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
  .wout .wsection{padding:var(--sp-2) var(--sp-2) 2px;margin:0}
  .wout-i{
    display:flex;align-items:center;gap:var(--sp-2);width:100%;min-height:44px;padding:var(--sp-2);
    border-radius:var(--r);text-align:left;color:var(--label-2);
    transition:background var(--fast),color var(--fast);
  }
  .wout-i:hover{background:var(--surface-2)}
  .wout-i.current{background:var(--surface-2);color:var(--label);box-shadow:inset 3px 0 0 var(--acc)}
  .wout-i.done{color:var(--label-3)}
  .wout-ic{width:20px;font-size:16px;flex:none;display:flex;justify-content:center}
  .wout-i.current .wout-ic,.wout-i.done .wout-ic{color:var(--acc)}
  .wout-names{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:15px;overflow-wrap:anywhere}
  .wout-ss{font-size:14px;color:var(--acc);flex:none}
  .wout-n{font-size:13px;font-variant-numeric:tabular-nums;flex:none}
  .wrail-ft{display:flex;flex-direction:column;gap:var(--sp-2)}
  .wrail-ft .timer-inline{background:var(--surface-2)}
  /* 44px touch targets for the set steppers (tablet/laptop touch) */
  .wmain .setrow .stp button{height:44px}
}
/* media beside the set table once the main column has room (≈1440px viewport and up) */
@container (min-width:760px){
  .exblock.has-media:not(.compact){display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:var(--sp-5);align-items:start}
  .exblock.has-media:not(.compact) .exmedia{margin-bottom:0}
  .exblock.has-media:not(.compact) .exmedia:not(.mini) img{height:300px}
}
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: succeeds (the component is not mounted yet; Task 4 does that).

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/components/SessionRail.jsx frontend/src/index.css
git commit -m "feat(workout): session rail component and desktop styles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Restructure `Workout.jsx` for the two frames and the chooser

**Files:**
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/index.css` (chooser areas)

**Interfaces:**
- Consumes: `SessionRail` (Task 3), `useIsDesktop` (`../lib/useIsDesktop.js`), existing `confirmSheet`, `finishWorkout`, `exercisePicker`, `exConfigSheet`, `nextPrescription`, `applyPrescription`, `buildSets`.
- Produces: desktop frame `.wdesk` > `.wmain` + `SessionRail`; mobile frame unchanged; `.wchoose` chooser.

- [ ] **Step 1: `ExerciseBlock` wrapper**

In `frontend/src/views/Workout.jsx`, inside `ExerciseBlock`:

1. Replace

```jsx
  return <>
    <Media ex={ex} key={entry.id} compact={compact} minimizable />
```
with
```jsx
  return <div className={'exblock' + (compact ? ' compact' : '') + (ex.gif ? ' has-media' : '')}>
    <Media ex={ex} key={entry.id} compact={compact} minimizable />
    <div className="exbody">
```
2. Replace the end of the function

```jsx
      </div>
    </div>
  </>
}

/* ---------- active workout ---------- */
```
with
```jsx
      </div>
    </div>
    </div>
  </div>
}

/* ---------- active workout ---------- */
```
(The first `</div>` closes the "Remove set / Add set" row, the second the `card`, the third `.exbody`, the fourth `.exblock`.) Re-indent the lines between `<div className="exbody">` and its closing tag by two spaces so the file stays tidy.

- [ ] **Step 2: Imports and the `desktop` flag**

Add after the existing component imports:

```jsx
import SessionRail from '../components/SessionRail.jsx'
import { useIsDesktop } from '../lib/useIsDesktop.js'
```

In `ActiveWorkout`, change

```jsx
function ActiveWorkout() {
  const nav = useNavigate()
```
to
```jsx
function ActiveWorkout() {
  const nav = useNavigate()
  const desktop = useIsDesktop()
```

- [ ] **Step 3: Replace the render tail of `ActiveWorkout`**

Replace everything from the line `  return <div className="narrow">` (the one directly after the heartbeat `useEffect`, followed by `<div className="hdr">`) up to, **not including**, `export default function Workout() {` with:

```jsx
  const discard = () => confirmSheet({ title: t('Discard workout?'), message: t('The sets you logged in this session will be lost.'), confirmText: t('Discard'), danger: true, onConfirm: () => { update(s => { s.active = null }); stopRest(); nav('/home') } })
  const jump = idx => update(s => { s.active.cur = idx })
  const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
  const allDone = A.entries.length > 0 && exDone === A.entries.length

  // The exercise area is the same in both frames; only what surrounds it differs.
  const body = <>
    {A.entries.length ? <>
      {A.entries[cur]?.section && <div className="wsection">{A.entries[cur].section}</div>}
      <div className="muted small" style={{ marginBottom: 6 }}>{isSuperset ? t('Superset {0} / {1}', unitIdx + 1, units.length) : t('Exercise {0} / {1}', unitIdx + 1, units.length)}</div>
      {isSuperset ? (
        <div className="ss-card">
          <div className="ss-hd"><Icon name="link" />{t('Superset · do these back-to-back, rest after both')}</div>
          {unit.map((idx, k) => <div key={idx} className="ss-ex">
            {k > 0 && <div className="ss-amp">+</div>}
            <ExerciseBlock entryIdx={idx} compact
              onToggle={i => toggle(idx, i)} onField={(i, f, v) => setField(idx, i, f, v)} onAddSet={() => addSet(idx)} onRemoveSet={() => removeSet(idx)} onStartTimed={i => startTimed(idx, i)} />
          </div>)}
        </div>
      ) : (
        <ExerciseBlock entryIdx={cur} onToggle={i => toggle(cur, i)} onField={(i, f, v) => setField(cur, i, f, v)} onAddSet={() => addSet(cur)} onRemoveSet={() => removeSet(cur)} onStartTimed={i => startTimed(cur, i)} />
      )}
    </> : <div className="empty"><div className="ico"><Icon name="shuffle" /></div>{t('Freestyle workout — add your first exercise.')}</div>}

    <div style={{ height: 12 }} />
    <div className="row">
      <Button icon="chevronLeft" disabled={unitIdx <= 0} onClick={() => update(s => { s.active.cur = units[unitIdx - 1][0] })}>{t('Prev')}</Button>
      <Button trailingIcon="chevronRight" disabled={unitIdx < 0 || unitIdx >= units.length - 1} onClick={() => update(s => { s.active.cur = units[unitIdx + 1][0] })}>{t('Next')}</Button>
    </div>
    <div style={{ height: 10 }} />
    <Button onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => update(s => {
      const full = { ...cfg, id: ex.id }
      const plan = nextPrescription(s, full, s.routines.find(r => r.id === s.active.routineId))
      s.active.entries.push({ id: ex.id, target: { ...cfg }, plan, sets: applyPrescription(buildSets(s, full), plan) })
      s.active.cur = s.active.entries.length - 1
    }), null, S.routines.find(r => r.id === A.routineId)))} icon="plus">{t('Add exercise')}</Button>
  </>

  if (desktop) return <div className="wdesk">
    <div className="wmain">{body}</div>
    <SessionRail A={A} done={done} total={total} onJump={jump} onFinish={finishWorkout} onDiscard={discard} />
  </div>

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Discard')} onClick={discard}><Icon name="xmark" /></button>
      <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600 }}>{A.name}</div><div className="sub"><Elapsed start={A.start} /> · {t('{0} sets', done + '/' + total)}</div></div>
      <button className="iconbtn" style={{ color: 'var(--acc)' }} aria-label={t('Finish')} onClick={finishWorkout}><Icon name="check" /></button>
    </div>
    <div className="wprog"><i style={{ width: (total ? done / total * 100 : 0) + '%' }} /></div>
    {body}
    <div style={{ height: 10 }} />
    <button className={allDone ? 'btn primary' : 'btn ghost dim'} onClick={finishWorkout}>
      {allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
    </button>
    <div style={{ height: 40 }} />
  </div>
}

```

(The mobile output is the same DOM as before: header, progress bar, section label, counter, exercise, spacer 12, Prev/Next, spacer 10, Add exercise, spacer 10, finish button, spacer 40.)

- [ ] **Step 4: Chooser wrappers**

Replace the whole `StartChooser` function (from `function StartChooser() {` to its closing `}`) with the version below. Only the `wchoose` / `wc-hero` / `wc-side` / `wc-free` classes and wrapper divs are new; mobile order stays hero → others → freestyle.

```jsx
function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const todayR = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const others = S.routines.filter(r => r !== todayR)
  return <div className="narrow wchoose">
    <div className="hdr"><div><h1>{t('Start workout')}</h1><div className="sub">{t(DAYN[new Date().getDay()])} — {todayR ? t('today is {0}', todayR.name) : t('rest day, but no one’s stopping you')}</div></div></div>
    {todayR && <div className="card wc-hero" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="accent">{t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}</h2>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><div className="big">{todayR.name}</div><div className="muted small">{exCount(countEx(todayR.ex))}</div></div>
        <span className="lrow-i" style={{ width: 38, height: 38, borderRadius: 9, fontSize: 22 }}><Icon name={glyphOf(todayR.emoji)} /></span>
      </div>
      <Button variant="primary" icon="play" onClick={() => startFlow(todayR.id)}>{t('Start {0}', todayR.name)}</Button>
    </div>}
    {others.length > 0 && <div className="wc-side"><h4 className="sec">{t('Other routines')}</h4>
      <div className="list">{others.map(r => <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
        <span className="tag acc">{t('Start')}</span></div>)}</div></div>}
    <div className="wc-free">
      <div style={{ height: 14 }} />
      <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>
      {!S.routines.length && <><div style={{ height: 10 }} /><Button variant="primary" onClick={() => nav('/plan')}>{t('Build a plan first')}</Button></>}
    </div>
  </div>
}
```

- [ ] **Step 5: Chooser grid CSS**

Append to `index.css`:

```css

/* start chooser: today's routine and Freestyle on the left, the other routines on the right */
@media (min-width:1000px){
  .narrow.wchoose{
    max-width:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    grid-template-areas:"hdr hdr" "hero side" "free side";grid-template-rows:auto auto 1fr;
    column-gap:var(--sp-6);align-items:start;
  }
  .wchoose>.hdr{grid-area:hdr}
  .wchoose>.wc-hero{grid-area:hero}
  .wchoose>.wc-side{grid-area:side}
  .wchoose>.wc-free{grid-area:free}
  .wchoose .wc-side h4.sec{margin-top:0}
}
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build succeeds; all tests pass. `grep -n "function Elapsed\|useState" frontend/src/views/Workout.jsx` → no output.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/views/Workout.jsx frontend/src/index.css
git commit -m "feat(workout): desktop frame with session rail and two-zone chooser

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Browser verification and fixes

**Files:**
- Modify (only if a defect is found): `frontend/src/index.css`, `frontend/src/views/Workout.jsx`, `frontend/src/components/SessionRail.jsx`

**Interfaces:**
- Consumes: the running app. Produces: confirmation of every Review Focus item.

- [ ] **Step 1: Start the app and seed a rich session**

Run `npm run dev` in the background from the repo root. With Playwright at 1440×900: open `http://localhost:5173/#/home`, choose "Continuar sin cuenta", press "Cargar plan inicial (PPL)". Then patch the saved state so Leg Day (today's routine on a Friday; otherwise use whichever routine is today's) has a superset, a section marker is not required, and a timed exercise:

```js
// run in the page (browser_evaluate), then reload
const k = 'gym_state_v1'; const s = JSON.parse(localStorage.getItem(k))
const r = s.routines.find(x => /Leg|Pierna/i.test(x.name)) || s.routines[0]
r.ex[0].sg = 'ss1'; r.ex[1].sg = 'ss1'          // exercises 1+2 become a superset
r.ex[2].mode = 'time'; r.ex[2].sec = 45         // exercise 3 becomes a timed hold
localStorage.setItem(k, JSON.stringify(s)); location.reload()
```
Start the workout from the sidebar ("Empezar" → "Empezar sin pesarse").

- [ ] **Step 2: Desktop layout (1440 and 1280)**

At **1440×900**: the session shows three zones — sidebar, main (exercise 1/…, here a superset card with two compact blocks), and the rail (300px). The rail lists the superset as one row with the link icon and `0/…`, the timed exercise and the rest pending; the clock is running and the progress bar is empty. Click the 3rd outline row: the main area switches to that exercise and the row gets the accent bar and `aria-current="step"`. Click the superset row again and confirm both members render. At **1280×800**: the main column is narrower (≈640px); for a non-superset exercise with media the media stacks above the set table (container query not yet active), nothing overflows horizontally. At 1440 a non-superset exercise with media shows media on the left and the set table on the right. Take a screenshot at each width and read it.

- [ ] **Step 3: Timers**

Tick a set so a rest starts: the **inline** timer appears at the bottom of the rail (clock, bar, `−15s +15s`, full-width Skip) and the sidebar dock is **not** shown (no second timer anywhere). Confirm `document.body.classList.contains('resting')` is `false` while the rail timer shows. Go to a timed exercise, press ▶: the inline **working** timer appears (clock, label, bar, Cancel/Done) and fits the rail; Done logs the held time and starts the rest. Navigate to Stats via the sidebar mid-session: the **docked** sidebar timer appears there (with `body.resting` true) and the page content has no large bottom padding.

- [ ] **Step 4: Edge cases**

- Freestyle: discard, then start "Freestyle workout" from the chooser: the rail renders with the hint and an empty outline; add an exercise via "Add exercise": it appears in the outline.
- Chooser: with no workout running, `#/workout` at 1440 shows today's hero + Freestyle on the left and "Other routines" on the right; at 390 the order is hero → others → Freestyle as before.
- Custom exercise without media (create one in Exercises): in the workout it renders as a plain block (no empty grid column).
- Long names: temporarily set a very long label in the rail via `browser_evaluate` and confirm it wraps within the 300px rail (no horizontal scroll) and the scrolled outline keeps Finish/Discard visible.

- [ ] **Step 5: Resize mid-session and mobile (Review Focus 4)**

With a rest running at 1440, resize to **390×844**: the floating timer is above the tab bar, the layout is the original mobile Workout (header with ✕ / name / ✓, progress bar, exercise, Prev/Next, Add exercise, Finish) — compare against `assets/screenshots/workout.png` for structure — and `body.resting` is true. Resize back to 1440: the workout is intact and the inline rail timer is back. Switch dark/light and accents `lime`, `sky`, `orange`: the current row, accent bar, and primary Finish stay legible.

- [ ] **Step 6: Finish flow**

Complete all sets (or use "Finish workout early"), finish: the completion sheet appears, the workout is saved, and the sidebar button goes back to "Empezar". Stop the dev server (`TaskStop`) and remove any screenshots/`.playwright-mcp` created in the repo.

- [ ] **Step 7: Commit any fixes**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add -A frontend/src
git diff --cached --quiet || git commit -m "fix(workout): desktop polish from visual QA

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Expected: no commit if nothing needed changing. Record each defect and its fix as a ledger `Ruling:`.)

---

### Task 6: Documentation and close-out

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the desktop Workout in `CLAUDE.md`**

- §4 `components/` list: add `SessionRail` (rail derecha del Workout en desktop), `Elapsed`; under `lib/` add `sessionOutline.js` (esquema de la sesión activa para el rail, + test).
- §5.4 table, row "Workout": append `, desktop: \`.wdesk\` > \`.wmain\` + \`.wrail\` (\`.wout\`, \`.wout-i\`), \`.exblock\`/\`.exbody\`, \`.timer-inline\`, \`.wchoose\``.
- §6 Workout row, Contenido column: append ` Desktop ≥1000px: ejercicio actual + rail de sesión (reloj, progreso, esquema con salto, timer inline, terminar/descartar).`

- [ ] **Step 2: Full verification**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym/frontend
npm test
node scripts/check-locales.mjs
npm run build
```
Expected: tests pass; `N locales, M keys each — in sync.`; build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add CLAUDE.md
git commit -m "docs: desktop Workout (session rail) in CLAUDE.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand off**

Leave `feat/athlete-workout-desktop` unmerged and ask the user whether to merge it (and push with the `patoogm` token) before starting plan 3 (Home).

---

## Self-review notes

- **Spec coverage:** three zones (Task 4 `.wdesk`), `SessionRail` with clock/progress/outline/jump/inline timer/finish/discard (Tasks 1–3), `StartChooser` hero + grid (Task 4 steps 4–5), media beside set table when wide (Task 3 container query), 44px steppers (Task 3), `sessionOutline` helper with Vitest (Task 1), docs (Task 6). Inline-style cleanup is the one documented deviation.
- **Type consistency:** `sessionOutline` row shape (`first`, `items`, `status`, `superset`, `done`, `total`) matches what `SessionRail` reads; `onJump(r.first)` feeds `jump(idx)` which sets `S.active.cur`; `RestTimer inline` prop matches its single use; `exDone/allDone` are computed in both `ActiveWorkout` and `SessionRail` from the same expressions the mobile finish button used.
- **Known interim state:** `Workout.jsx` is the only screen changed; every other screen keeps its Plan-1 layout until its own plan.
