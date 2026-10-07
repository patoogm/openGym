# Coach Desktop Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the coach area a real desktop layout (≥1000px): fixed sidebar + wide panel, master–detail for students and routines, inline assignment — mobile unchanged.

**Architecture:** A nested layout route `CoachShell` wraps all `/coach/*` routes. It is the single owner of `listStudents()` + 15s polling and shares `{students, reload}` through the router outlet context. At ≥1000px it renders a sidebar next to the outlet; below that it renders only the outlet (the existing tab bar stays). `Coach.jsx` and `CoachRoutines.jsx` render list + detail side by side on desktop and list-or-detail on mobile. `CoachStudent.jsx` is replaced by the `StudentDetail` component.

**Tech Stack:** React 19, React Router 7 (HashRouter), Zustand, plain CSS in `frontend/src/index.css`, Vitest (pure logic only — vitest runs in the node environment, no jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-coach-desktop-panel-design.md`

## Global Constraints

- All visual change goes through tokens/classes in `frontend/src/index.css`; **no new inline `style={{…}}`** in new/changed code.
- Dark and light must both work (tokens only); `--on-acc` untouched.
- Do not add dependencies. No native controls (`<select>`, checkbox, range). No emoji as icons.
- Coach copy is Spanish-literal (no `t()` keys, no locale changes). Shared components still receive `t`.
- Do not touch `api/`, `frontend/src/store/`, `frontend/src/lib/coachApi.js`, or non-coach screens.
- Do not open/edit the giant generated files (`exercises-data.js`, `body-paths.js`, `instr/*`, `names/*`).
- Mobile (<1000px) behaviour stays as today. Breakpoint is exactly `min-width:1000px`.
- Hit targets ≥44px; icon-only buttons have `aria-label`; respect `prefers-reduced-motion` and `:focus-visible`.
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- All paths below are relative to the repo root `C:\Users\patog\orca\workspaces\openGym\main`. Run `cd frontend && npm test` from the repo root.

## Review Focus

- Window resized across 1000px while on `/coach/alumno/:id` or `/coach/rutinas/:id/editar`: content stays, no redirect loop (only `/coach/rutinas/:id` on mobile redirects to `/editar`).
- Stale link: `/coach/alumno/<unknown>` → toast + redirect to `/coach`; `/coach/rutinas/<unknown>` → redirect to `/coach/rutinas`.
- Student rows from older API responses without `assignedRoutineIds` must not crash eligibility (covered by tests in Task 1).
- The 15s poll replaces the `students` array while the coach has boxes ticked in the assign panel: ticks survive (keyed by id) and ids that stop being eligible are dropped from the submit.
- Zero students / zero routines / zero activity show their empty states; very long student and routine names wrap (no overflow of the 340px list).

---

### Task 1: Pure helpers + tests

**Files:**
- Modify: `frontend/src/lib/coachShell.js` (append)
- Test: `frontend/src/lib/coachShell.test.js` (append)

**Interfaces:**
- Produces (all exported from `lib/coachShell.js`):
  - `routinePath(id: string): string` → `'/coach/rutinas/' + id`
  - `routineEditPath(id: string): string` → `'/coach/rutinas/' + id + '/editar'`
  - `eligibleStudents(students: Row[]|null, routineId: string): Row[]`
  - `eligibleRoutines(routines: Routine[]|null, student: Row|undefined): Routine[]`
  - `attentionTexts(row: Row, today: string): string[]`
  - `assignRoutines(assignFn, studentId: string, routines: Routine[]): Promise<{okIds: string[], failed: {id,name,message}[]}>` (ids are **routine** ids)
  - `assignRoutinesSummary({okIds, failed}): string`

- [ ] **Step 1: Write the failing tests** — append to `frontend/src/lib/coachShell.test.js`, and add this import line right after the existing `import … from './coachShell.js'` block:

```js
import {
  routinePath, routineEditPath, eligibleStudents, eligibleRoutines,
  attentionTexts, assignRoutines, assignRoutinesSummary
} from './coachShell.js'
```

```js
describe('desktop routes', () => {
  it('builds routine summary and editor paths', () => {
    expect(routinePath('r1')).toBe('/coach/rutinas/r1')
    expect(routineEditPath('r1')).toBe('/coach/rutinas/r1/editar')
  })
  it('keeps the editor under the Rutinas tab', () => {
    expect(activeCoachTab('/coach/rutinas/r1/editar')).toBe('rutinas')
    expect(isCoachPath('/coach/rutinas/r1/editar')).toBe(true)
  })
})

describe('assign eligibility', () => {
  const students = [
    { id: 's1', name: 'Ana', assignedRoutineIds: ['r1'] },
    { id: 's2', name: 'Luis', assignedRoutineIds: [] },
    { id: 's3', name: 'Old' }               // older API rows had no assignedRoutineIds
  ]
  it('eligibleStudents drops students who already have the routine', () => {
    expect(eligibleStudents(students, 'r1').map(s => s.id)).toEqual(['s2', 's3'])
    expect(eligibleStudents(students, 'r9').map(s => s.id)).toEqual(['s1', 's2', 's3'])
  })
  it('eligibleStudents tolerates a null list', () => {
    expect(eligibleStudents(null, 'r1')).toEqual([])
  })
  it('eligibleRoutines drops routines the student already has', () => {
    const routines = [{ id: 'r1' }, { id: 'r2' }]
    expect(eligibleRoutines(routines, students[0]).map(r => r.id)).toEqual(['r2'])
    expect(eligibleRoutines(routines, students[2]).map(r => r.id)).toEqual(['r1', 'r2'])
    expect(eligibleRoutines(routines, undefined).map(r => r.id)).toEqual(['r1', 'r2'])
    expect(eligibleRoutines(null, students[0])).toEqual([])
  })
})

describe('attentionTexts', () => {
  const base = { live: null, assignmentCount: 1, pendingRequests: 0, lastWorkout: '2026-10-01' }
  it('returns one text per reason, in the banner wording', () => {
    expect(attentionTexts({ ...base, pendingRequests: 1 }, TODAY)).toEqual(['1 pedido de cambio', 'sin entrenar (hace 6 d)'])
    expect(attentionTexts({ ...base, pendingRequests: 3, lastWorkout: '2026-10-06' }, TODAY)).toEqual(['3 pedidos de cambio'])
    expect(attentionTexts({ ...base, lastWorkout: null }, TODAY)).toEqual(['sin entrenos todavía'])
  })
  it('is empty when nothing needs attention', () => {
    expect(attentionTexts({ ...base, lastWorkout: '2026-10-06' }, TODAY)).toEqual([])
  })
})

describe('assignRoutines (student → routines)', () => {
  it('calls assignFn(studentId, routineId) once per routine and reports routine ids', async () => {
    const fn = vi.fn().mockResolvedValue({})
    const res = await assignRoutines(fn, 's1', [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }])
    expect(fn).toHaveBeenCalledWith('s1', 'r1')
    expect(fn).toHaveBeenCalledWith('s1', 'r2')
    expect(res).toEqual({ okIds: ['r1', 'r2'], failed: [] })
  })
  it('keeps going when one fails', async () => {
    const fn = vi.fn().mockImplementation((s, r) => r === 'r2' ? Promise.reject(new Error('boom')) : Promise.resolve({}))
    const res = await assignRoutines(fn, 's1', [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }])
    expect(res.okIds).toEqual(['r1'])
    expect(res.failed).toEqual([{ id: 'r2', name: 'B', message: 'boom' }])
  })
  it('assignRoutinesSummary words singular, plural and partial failure', () => {
    expect(assignRoutinesSummary({ okIds: ['r1'], failed: [] })).toBe('Rutina asignada')
    expect(assignRoutinesSummary({ okIds: ['r1', 'r2'], failed: [] })).toBe('2 rutinas asignadas')
    expect(assignRoutinesSummary({ okIds: ['r1'], failed: [{ id: 'r2', name: 'B', message: 'boom' }] }))
      .toBe('1 de 2 asignadas; falló B: boom')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/lib/coachShell.test.js`
Expected: FAIL — `routinePath is not a function` (or similar import errors).

- [ ] **Step 3: Implement** — append to `frontend/src/lib/coachShell.js`:

```js
export const routinePath = id => '/coach/rutinas/' + id
export const routineEditPath = id => '/coach/rutinas/' + id + '/editar'

// Students who can still receive `routineId` (older API rows may lack assignedRoutineIds).
export const eligibleStudents = (students, routineId) =>
  (students || []).filter(s => !(s.assignedRoutineIds || []).includes(routineId))

// Routines `student` does not have yet.
export const eligibleRoutines = (routines, student) => {
  const has = (student && student.assignedRoutineIds) || []
  return (routines || []).filter(r => !has.includes(r.id))
}

// Same wording as the "Requiere atención" banner, one string per reason.
export function attentionTexts(row, today) {
  return attentionReasons(row, today).map(r => r === 'request'
    ? row.pendingRequests + (row.pendingRequests === 1 ? ' pedido de cambio' : ' pedidos de cambio')
    : row.lastWorkout ? 'sin entrenar (' + lastLabel(row, today) + ')' : 'sin entrenos todavía')
}

// One student, many routines. Reuses assignMany by swapping roles, so okIds/failed carry ROUTINE ids.
export const assignRoutines = (assignFn, studentId, routines) =>
  assignMany((routineId, sid) => assignFn(sid, routineId), studentId, routines)

export function assignRoutinesSummary({ okIds, failed }) {
  if (!failed.length) return okIds.length === 1 ? 'Rutina asignada' : okIds.length + ' rutinas asignadas'
  const total = okIds.length + failed.length
  return okIds.length + ' de ' + total + ' asignadas; falló ' + failed.map(f => f.name).join(', ') + ': ' + failed[0].message
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run src/lib/coachShell.test.js`
Expected: PASS (all previous tests + new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/coachShell.js frontend/src/lib/coachShell.test.js
git commit -m "feat(coach): pure helpers for desktop routes and inline assignment

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shell — hook, CSS, sidebar, layout route, App wiring

**Files:**
- Create: `frontend/src/lib/useIsDesktop.js`
- Create: `frontend/src/lib/useCoachData.js`
- Create: `frontend/src/components/CoachSidebar.jsx`
- Create: `frontend/src/views/CoachShell.jsx`
- Modify: `frontend/src/App.jsx` (imports, `Shell` hooks, `#app` div, `<Routes>` coach block)
- Modify: `frontend/src/components/TabBar.jsx` (hide on desktop coach)
- Modify: `frontend/src/index.css` (append a new commented section)

**Interfaces:**
- Consumes: `COACH_TABS`, `activeCoachTab`, `attentionReasons`, `isCoachPath` from Task 1's file; `listStudents` from `lib/coachApi.js`.
- Produces:
  - `useIsDesktop(): boolean`
  - `useCoachData(): { students: Row[]|null, reload: () => Promise<void> }` (outlet context)
  - CSS classes: `.cshell .cside .cside-i(.on) .cside-foot .cmain .cgrid .cmaster .cdetail .ccols .hdr>.grow .item.sel .act-dot`

After this task the desktop shows the sidebar around the **existing** views (they still fetch for themselves); later tasks migrate them.

- [ ] **Step 1: Create `frontend/src/lib/useIsDesktop.js`**

```js
import { useEffect, useState } from 'react'

const QUERY = '(min-width:1000px)'
const read = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches

// True at the same breakpoint index.css uses for the desktop layout.
export function useIsDesktop() {
  const [match, setMatch] = useState(read)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(QUERY)
    const on = e => setMatch(e.matches)
    setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return match
}
```

- [ ] **Step 2: Create `frontend/src/lib/useCoachData.js`**

```js
import { useOutletContext } from 'react-router-dom'

// Students + reload, owned by CoachShell (the only place that polls).
export const useCoachData = () => useOutletContext()
```

- [ ] **Step 3: Create `frontend/src/components/CoachSidebar.jsx`**

```jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { COACH_TABS, activeCoachTab, attentionReasons } from '../lib/coachShell.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Desktop navigation for the coach area (replaces the floating tab bar at ≥1000px).
export default function CoachSidebar({ students }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const training = useStore(s => !!s.S.active)
  const active = activeCoachTab(pathname)
  const today = todayISO()
  const rows = students || []
  const attn = rows.filter(s => attentionReasons(s, today).length).length
  const live = rows.filter(s => s.live).length

  return <nav className="cside" aria-label="Panel del coach">
    <div className="brand">openGym <span className="muted t-foot">coach</span></div>
    {COACH_TABS.map(tab => <button key={tab.k} type="button"
      className={'cside-i' + (active === tab.k ? ' on' : '')}
      aria-current={active === tab.k ? 'page' : undefined} onClick={() => nav(tab.to)}>
      <Icon name={tab.icon} /><span className="grow">{tab.label}</span>
      {tab.k === 'alumnos' && live > 0 && <span className="tag acc" aria-label={live + ' entrenando ahora'}><Icon name="dot" />{live}</span>}
      {tab.k === 'alumnos' && attn > 0 && <span className="tag warn" aria-label={attn + ' requieren atención'}>{attn}</span>}
    </button>)}
    <Button variant="primary" icon="plus" onClick={() => nav('/coach/rutinas')}>Asignar rutina</Button>
    <div className="cside-foot">
      <button type="button" className="cside-i" onClick={() => nav('/home')}
        aria-label={training ? 'Yo, entrenamiento en curso' : undefined}>
        <Icon name="dumbbell" /><span className="grow">Yo</span>{training && <i className="act-dot" aria-hidden="true" />}
      </button>
    </div>
  </nav>
}
```

- [ ] **Step 4: Create `frontend/src/views/CoachShell.jsx`**

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { listStudents } from '../lib/coachApi.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import CoachSidebar from '../components/CoachSidebar.jsx'

// Layout route for /coach/*. Owns the student list (one fetch + 15s poll for every coach screen)
// and, at ≥1000px, the sidebar. Below that it is just the outlet; the tab bar stays.
export default function CoachShell() {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const desktop = useIsDesktop()
  const { pathname } = useLocation()
  const [students, setStudents] = useState(null)
  const loaded = useRef(false)

  // toast only if the first load fails; later poll failures (offline / expired session) stay silent
  const reload = useCallback(() => listStudents()
    .then(r => { loaded.current = true; setStudents(r.students || []) })
    .catch(e => { if (!loaded.current) toast(e.message || 'Error') }), [toast])

  // poll every 15s so "entrenando ahora" stays live without a manual refresh
  useEffect(() => {
    if (!user?.coach) return
    reload()
    const iv = setInterval(reload, 15000)
    return () => clearInterval(iv)
  }, [user?.coach, reload])

  // keyed on the route so a screen that throws is contained and the sidebar stays a way out
  const body = <ErrorBoundary key={pathname}><Outlet context={{ students, reload }} /></ErrorBoundary>
  if (!desktop) return body
  return <div className="cshell">
    <CoachSidebar students={students} />
    <main className="cmain">{body}</main>
  </div>
}
```

- [ ] **Step 5: Wire `App.jsx`**

Add imports next to the other coach imports:

```jsx
import CoachShell from './views/CoachShell.jsx'
import { useIsDesktop } from './lib/useIsDesktop.js'
```
Change `import { homePathFor } from './lib/coachShell.js'` to `import { homePathFor, isCoachPath } from './lib/coachShell.js'`.

In `Shell()`, directly after `const langV = useLang()` add:

```jsx
  const desktop = useIsDesktop()
```

Directly after `const coachOnly = …` add:

```jsx
  // On desktop the coach area is one persistent shell: a stable key keeps it (and its student
  // polling) mounted while navigating between coach screens. Elsewhere #app re-keys per route.
  const coachDesk = desktop && !!user?.coach && isCoachPath(loc.pathname)
```

Replace the `<div id="app" className="vfade" key={loc.pathname}>` line with:

```jsx
      <div id="app" className={'vfade' + (coachDesk ? ' cdesk' : '')} key={coachDesk ? 'coach-desktop' : loc.pathname}>
```

Replace the five coach `<Route …>` lines (`/coach`, `/coach/rutinas`, `/coach/rutinas/:id`, `/coach/actividad`, `/coach/alumno/:id`) with:

```jsx
              <Route element={coachOnly(<CoachShell />)}>
                <Route path="/coach" element={<Coach />} />
                <Route path="/coach/alumno/:id" element={<CoachStudent />} />
                <Route path="/coach/rutinas" element={<CoachRoutines />} />
                <Route path="/coach/rutinas/:id" element={<RoutineEdit />} />
                <Route path="/coach/actividad" element={<CoachActivity />} />
              </Route>
```
(Elements stay the current views for now; Tasks 3 and 5 swap them. `coachOnly` is a function returning an element, so it works as a layout-route `element`.)

- [ ] **Step 6: Hide the tab bar on desktop coach** — in `components/TabBar.jsx` add `import { useIsDesktop } from '../lib/useIsDesktop.js'`, add `const desktop = useIsDesktop()` as the first line after `const isGuest = …` (before the early `return null`), and right after `const activeCoach = activeCoachTab(loc.pathname)` add:

```jsx
  if (coachMode && desktop) return null   // CoachSidebar replaces the bar
```

- [ ] **Step 7: Append the CSS** to the end of `frontend/src/index.css`:

```css
/* -------------------------------------------------- coach desktop shell --- */
:root{--side-w:240px;--list-w:340px}
.hdr>.grow{flex:1;min-width:0}
.hdr>.grow h1{margin:0}
.act-dot{width:8px;height:8px;border-radius:50%;background:var(--orange);flex:none}
@media (min-width:1000px){
  #app.cdesk{max-width:none;margin:0;padding:0}
  .cshell{display:grid;grid-template-columns:var(--side-w) minmax(0,1fr);min-height:100vh}
  .cside{
    position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:2px;
    padding:22px 12px calc(16px + var(--sab));background:var(--bg-el);
    border-right:var(--hair) solid var(--sep);overflow-y:auto;
  }
  .cside .brand{font-size:17px;font-weight:600;padding:0 10px 16px}
  .cside-i{
    display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 10px;
    border-radius:var(--r);color:var(--label-2);font-size:16px;text-align:left;
    transition:background var(--fast),color var(--fast);
  }
  .cside-i .icn{font-size:20px;flex:none}
  .cside-i .grow{flex:1;min-width:0}
  .cside-i:hover{background:var(--surface)}
  .cside-i.on{background:var(--surface-2);color:var(--label)}
  .cside .btn.primary{margin-top:14px}
  .cside-foot{margin-top:auto;padding-top:8px;border-top:var(--hair) solid var(--sep)}
  .cmain{min-width:0}
  .cmain>.narrow{max-width:720px;margin:0 auto;padding:22px 28px calc(40px + var(--sab))}
  .cgrid{display:grid;grid-template-columns:var(--list-w) minmax(0,1fr);align-items:start;min-height:100vh}
  .cmaster{
    position:sticky;top:0;height:100vh;overflow-y:auto;padding:22px 14px calc(24px + var(--sab));
    border-right:var(--hair) solid var(--sep);
  }
  .cdetail{padding:22px 28px calc(40px + var(--sab));min-width:0}
  #app .cmaster .list,#app .cdetail .list{display:flex;flex-direction:column}
  .cmaster .item.sel{background:var(--surface-2);box-shadow:inset 3px 0 0 var(--acc)}
  .cmaster .tag.warn{margin:4px 0 0}
  .cdetail .tiles{grid-template-columns:repeat(3,1fr)}
  .ccols{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
  .ccols>*{min-width:0}
}
@media (prefers-reduced-motion:reduce){.cside-i{transition:none}}
```
(If `prefers-reduced-motion` is already handled globally in `index.css` with a catch-all rule, drop that last block — check with `grep -n "prefers-reduced-motion" frontend/src/index.css`.)

- [ ] **Step 8: Verify build + tests**

Run: `cd frontend && npm test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 9: Visual check (shell only)** — start `cd frontend && npm run dev` in the background. Coach screens need a coach session, so mock the API in Playwright (scratchpad script, not committed): route `**/api/me` → `{user:{id:'c1',name:'Coach',coach:true}}`; `**/api/data` → `{state:null}`; `**/api/coaching/students` → `{students:[…]}` using rows shaped like `studentRows` in `api/coaching.js:55` (fields: `id,name,lastWorkout,workoutDates,plannedWeekdays,recent,assignedRoutineIds,live,assignmentCount,pendingRequests`); `**/api/coaching/student?*` → a detail with `user,workouts,assigned,requests,bodyweight,unit,lastSync`. Open `http://localhost:5173/#/coach` at 1280×800. Expected: sidebar on the left, existing Alumnos screen to its right, no floating tab bar. At 390×800: tab bar and layout exactly as before. Keep the mock script — Tasks 3–6 reuse it.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/useIsDesktop.js frontend/src/lib/useCoachData.js frontend/src/components/CoachSidebar.jsx frontend/src/views/CoachShell.jsx frontend/src/App.jsx frontend/src/components/TabBar.jsx frontend/src/index.css
git commit -m "feat(coach): desktop shell with fixed sidebar and shared student data

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Alumnos master–detail

**Files:**
- Create: `frontend/src/components/StudentList.jsx`
- Create: `frontend/src/components/StudentDetail.jsx`
- Modify: `frontend/src/views/Coach.jsx` (rewrite)
- Modify: `frontend/src/App.jsx` (coach routes; remove `CoachStudent` import)
- Delete: `frontend/src/views/CoachStudent.jsx`

**Interfaces:**
- Consumes: `useCoachData()`, `useIsDesktop()`, `attentionReasons`, `attentionTexts`, `sortStudents`, `weekSummary`, `lastLabel` (Tasks 1–2).
- Produces:
  - `<StudentList students selectedId onOpen onInvite compact />` — `compact` (desktop) shows attention as a `.tag.warn` per row instead of the banner list.
  - `<StudentDetail id students onChanged />` — loads `getStudent(id)`; `onChanged()` is called after any mutation so the shell can `reload()`.

- [ ] **Step 1: Create `frontend/src/components/StudentList.jsx`**

```jsx
import { useState } from 'react'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { SearchField } from './ui.jsx'
import { TrainingNow } from './ProgressViews.jsx'
import WeekMini from './WeekMini.jsx'
import { attentionReasons, attentionTexts, sortStudents, weekSummary, lastLabel } from '../lib/coachShell.js'

// Student list for the coach. Copy is Spanish-literal; shared components get `t`.
const SEARCH_FROM = 8

export default function StudentList({ students, selectedId = null, onOpen, onInvite, compact = false }) {
  const [q, setQ] = useState('')
  const today = todayISO()
  const all = students || []
  const sorted = sortStudents(all, today)
  const attn = sorted.filter(s => attentionReasons(s, today).length)
  const list = q.trim() ? sorted.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted

  return <>
    <div className="hdr">
      <div className="grow"><h1>Alumnos</h1>
        <div className="sub">{students ? all.length + (all.length === 1 ? ' alumno' : ' alumnos') : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={onInvite} aria-label="Invitar alumno"><Icon name="plus" /></button>
    </div>

    <TrainingNow users={all} onOpen={onOpen} t={t} />

    {!compact && attn.length > 0 && <>
      <h4 className="sec">Requiere atención</h4>
      {attn.map(s => <div key={s.id} className="attn" onClick={() => onOpen(s.id)}>
        <Icon name="bell" />
        <span className="grow">{s.name}: {attentionTexts(s, today).join(' · ')}</span>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </>}

    {!compact && <h4 className="sec">Esta semana</h4>}
    {all.length >= SEARCH_FROM && <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Buscar alumno" />}
    <div className="list">
      {list.map(s => {
        const { done, planned } = weekSummary(s, today)
        const texts = compact ? attentionTexts(s, today) : []
        return <div key={s.id} className={'item' + (s.id === selectedId ? ' sel' : '')} onClick={() => onOpen(s.id)}>
          <div className="grow">
            <div className="tt">{s.live && <Icon name="dot" className="live-dot" />}{s.name}
              {!compact && s.pendingRequests > 0 && <span className="tag warn">{s.pendingRequests}</span>}</div>
            <div className="ss">{s.live ? 'entrenando ahora · ' + s.live.name
              : (planned ? done + '/' + planned + ' esta semana' : done + ' esta semana') + ' · último: ' + lastLabel(s, today)}</div>
            {texts.length > 0 && <div><span className="tag warn">{texts.join(' · ')}</span></div>}
            <WeekMini row={s} today={today} />
          </div>
          {!compact && <Icon name="chevronRight" className="chev" />}
        </div>
      })}
      {students && !all.length && <div className="empty">Todavía no tenés alumnos. Tocá + para generar un código de invitación y compartilo.</div>}
      {students && all.length > 0 && !list.length && <div className="empty small">Nadie coincide con “{q}”.</div>}
    </div>
  </>
}
```

- [ ] **Step 2: Create `frontend/src/components/StudentDetail.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import Icon from './Icon.jsx'
import LineChart from './LineChart.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button } from './ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { StatTiles, WorkoutHistory, rel } from './ProgressViews.jsx'
import { openAssignSheet } from './AssignSheet.jsx'
import { getStudent, unassignRoutine, resolveRequest } from '../lib/coachApi.js'
import { weekSummary } from '../lib/coachShell.js'

// Student detail for the coach. Copy is Spanish-literal; shared components get `t`.
// `onChanged` runs after any mutation so the shell can refresh the student list too.
export default function StudentDetail({ id, onChanged }) {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const desktop = useIsDesktop()
  const [d, setD] = useState(null)

  useEffect(() => {
    let live = true   // a slow response for the previous student must not overwrite this one
    setD(null)
    getStudent(id).then(r => { if (live) setD(r) })
      .catch(e => { if (live) { toast(e.message || 'Error'); nav('/coach') } })
    return () => { live = false }
  }, [id])

  const reloadSelf = () => getStudent(id).then(setD).catch(e => toast(e.message || 'Error'))
  const changed = () => { reloadSelf(); if (onChanged) onChanged() }

  if (!d) return <div className="muted small">Cargando…</div>

  const pending = (d.requests || []).filter(r => !r.resolvedAt)
  const dates = [...new Set(d.workouts.map(w => w.d))]
  const { done } = weekSummary({ workoutDates: dates, plannedWeekdays: [] }, todayISO())
  const bw = (d.bodyweight || []).slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w ?? b.kg, d: b.d }))

  const routines = <>
    <div className="row between"><h4 className="sec">Rutinas asignadas</h4>
      <Button size="sm" variant="primary" icon="plus" onClick={() => openAssignSheet({ studentId: id, onDone: changed })}>Asignar</Button></div>
    {d.assigned.length ? <div className="list">{d.assigned.map(a => <div key={a.assignmentId} className="item">
      <span className="lrow-i"><Icon name={glyphOf(a.emoji)} /></span>
      <div className="grow"><div className="tt">{a.name}</div><div className="ss">{a.count} ej.</div></div>
      <button className="iconbtn danger" aria-label={'Quitar ' + a.name}
        onClick={() => confirmSheet({ title: 'Quitar “' + a.name + '”?', confirmText: 'Quitar', danger: true,
          onConfirm: () => unassignRoutine(a.assignmentId).then(changed).catch(e => toast(e.message)) })}>
        <Icon name="trash" /></button>
    </div>)}</div> : <div className="empty small">Sin rutinas asignadas.</div>}

    {pending.length > 0 && <>
      <h4 className="sec">Pedidos de ajuste</h4>
      {pending.map(q => <div key={q.id} className="card">
        <div className="small">{q.note}</div>
        <div className="row between">
          <span className="dim t-cap">{fmtDate(String(q.createdAt).slice(0, 10))}</span>
          <Button size="sm" variant="tinted" onClick={() => resolveRequest(q.id).then(changed).catch(e => toast(e.message))}>Marcar resuelto</Button>
        </div>
      </div>)}
    </>}
  </>

  const progress = <>
    {bw.length > 1 && <>
      <h4 className="sec">Peso corporal</h4>
      <div className="card"><div className="chart"><LineChart points={bw} h={140} unit={d.unit} /></div></div>
    </>}
    <h4 className="sec">Historial</h4>
    <WorkoutHistory workouts={d.workouts} unit={d.unit} t={t} />
  </>

  return <div>
    <div className="hdr">
      {!desktop && <button className="iconbtn" onClick={() => nav('/coach')} aria-label="Volver a alumnos"><Icon name="chevronLeft" /></button>}
      <div className="grow"><h1 className="capitalize">{d.user.name}</h1>
        <div className="sub">última sincronización: {rel(d.lastSync, t)}</div></div>
    </div>

    <StatTiles tiles={[
      { label: 'Esta semana', value: done },
      { label: 'Entrenos', value: d.workouts.length },
      { label: 'Pedidos', value: pending.length, accent: pending.length > 0 }
    ]} />

    {desktop
      ? <div className="ccols"><div>{routines}</div><div>{progress}</div></div>
      : <>{routines}{progress}</>}
  </div>
}
```
Note: the original mobile header had `marginLeft: 8` on the title next to the back button; if the title now touches the back button, add `.hdr>.iconbtn+.grow{margin-left:8px}` to the CSS section from Task 2 (outside the media query).

- [ ] **Step 3: Rewrite `frontend/src/views/Coach.jsx`**

```jsx
import { useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { useCoachData } from '../lib/useCoachData.js'
import Icon from '../components/Icon.jsx'
import InvitesCard from '../components/InvitesCard.jsx'
import StudentList from '../components/StudentList.jsx'
import StudentDetail from '../components/StudentDetail.jsx'

// Alumnos. Mobile: the list, or one student's detail when the URL has an id (as before).
// Desktop: list on the left, selected student's detail on the right.
export default function Coach() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const openSheet = useUI(s => s.openSheet)
  const { students, reload } = useCoachData()
  const open = sid => nav('/coach/alumno/' + sid)
  const invite = () => openSheet(() => <><h3>Invitaciones</h3><InvitesCard t={t} heading={null} /></>)
  const detail = id ? <StudentDetail key={id} id={id} onChanged={reload} /> : null

  if (!desktop) return <div className="narrow">
    {detail || <StudentList students={students} onOpen={open} onInvite={invite} />}
  </div>

  return <div className="cgrid">
    <section className="cmaster" aria-label="Alumnos">
      <StudentList compact students={students} selectedId={id} onOpen={open} onInvite={invite} />
    </section>
    <section className="cdetail">
      {detail || <div className="empty"><div className="ico"><Icon name="person" /></div>Elegí un alumno para ver su progreso.</div>}
    </section>
  </div>
}
```

- [ ] **Step 4: Routes** — in `App.jsx` remove `import CoachStudent from './views/CoachStudent.jsx'` and change the student route to `<Route path="/coach/alumno/:id" element={<Coach />} />`. Then `git rm frontend/src/views/CoachStudent.jsx`.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm test && npm run build`
Expected: pass / build OK.
Visual (Playwright mock from Task 2): at 1280×800 `#/coach` → list left, "Elegí un alumno…" right; click a student → URL becomes `#/coach/alumno/<id>`, list stays (no flicker/refetch of the list), detail renders with tiles and two columns; attention students show an orange tag with the reason. At 390×800: list-only; tapping opens detail with a back button. Toggle light theme (`document.documentElement.dataset.theme='light'`) and one other accent (`dataset.accent='violet'`).

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(coach): master-detail Alumnos on desktop via StudentList/StudentDetail

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Inline AssignPanel

**Files:**
- Create: `frontend/src/components/AssignPanel.jsx`
- Modify: `frontend/src/components/StudentDetail.jsx` (desktop uses the panel; mobile keeps the sheet)
- Modify: `frontend/src/views/Coach.jsx` (pass `students` to `StudentDetail`)

**Interfaces:**
- Consumes: `assignMany`, `assignSummary`, `assignRoutines`, `assignRoutinesSummary`, `eligibleStudents`, `eligibleRoutines` (Task 1); `assignRoutine` from `coachApi`.
- Produces: `<AssignPanel routineId | studentId students onDone />` — exactly one of `routineId` (pick students) or `studentId` (pick routines). `onDone()` fires when at least one assignment succeeded.

- [ ] **Step 1: Create `frontend/src/components/AssignPanel.jsx`**

```jsx
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { nav } from '../lib/nav.js'
import Icon from './Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, Check } from './ui.jsx'
import { assignRoutine } from '../lib/coachApi.js'
import {
  assignMany, assignSummary, assignRoutines, assignRoutinesSummary, eligibleStudents, eligibleRoutines
} from '../lib/coachShell.js'

// Inline assignment (desktop). By routine: tick students. By student: tick routines.
// Selection is a Set of ids, so it survives the shell's 15s refresh of `students`.
export default function AssignPanel({ routineId = null, studentId = null, students, onDone }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [sel, setSel] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const byRoutine = !!routineId
  const mine = (S.routines || []).filter(r => !r.coachAssigned)
  const student = (students || []).find(s => s.id === studentId)
  const all = byRoutine ? (students || []) : mine
  const eligible = byRoutine ? eligibleStudents(students, routineId) : eligibleRoutines(mine, student)
  const eligibleIds = new Set(eligible.map(x => x.id))
  const chosen = eligible.filter(x => sel.has(x.id))   // ids that stopped being eligible drop out here
  const allOn = eligible.length > 0 && eligible.every(x => sel.has(x.id))
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(allOn ? new Set() : new Set(eligible.map(x => x.id)))

  const confirm = async () => {
    setBusy(true)
    const res = byRoutine
      ? await assignMany(assignRoutine, routineId, chosen)
      : await assignRoutines(assignRoutine, studentId, chosen)
    setBusy(false)
    toast((byRoutine ? assignSummary : assignRoutinesSummary)(res))
    if (res.okIds.length && onDone) onDone()
    setSel(new Set(res.failed.map(f => f.id)))   // keep only the failures ticked so a retry is one tap
  }

  // The Check button's click bubbles to the row's onClick, which does the toggle,
  // so Check's own onChange is a no-op (otherwise it would toggle twice).
  const noop = () => {}

  if (byRoutine && !students) return <div className="muted small">Cargando…</div>
  if (byRoutine && !students.length) return <>
    <div className="empty small">Todavía no tenés alumnos. Invitá a alguien desde Alumnos.</div>
    <Button variant="primary" onClick={() => nav('/coach')}>Ir a Alumnos</Button>
  </>
  if (!byRoutine && !mine.length) return <>
    <div className="empty small">Todavía no tenés rutinas para asignar.</div>
    <Button variant="primary" icon="plus" onClick={() => nav('/coach/rutinas')}>Crear rutina</Button>
  </>

  return <>
    {eligible.length > 1 && <div className="item" onClick={toggleAll}>
      <div className="grow"><div className="tt">Todos</div></div>
      <Check checked={allOn} onChange={noop} />
    </div>}
    <div className="list">
      {all.map(x => {
        const off = !eligibleIds.has(x.id)
        return <div key={x.id} className={'item' + (off ? ' off' : '')} onClick={() => !off && toggle(x.id)}>
          {!byRoutine && <span className="lrow-i"><Icon name={glyphOf(x.emoji)} /></span>}
          <div className="grow"><div className="tt">{x.name}</div>{off && <div className="ss">{byRoutine ? 'ya la tiene' : 'ya la tiene asignada'}</div>}</div>
          <Check checked={off || sel.has(x.id)} onChange={noop} />
        </div>
      })}
    </div>
    <Button variant="primary" disabled={!chosen.length || busy} onClick={confirm}>
      {chosen.length ? 'Asignar a ' + chosen.length : 'Elegí al menos uno'}
    </Button>
  </>
}
```
(In by-student mode the button reads "Asignar a N" too; if that reads oddly for routines, change the label to `byRoutine ? 'Asignar a ' + chosen.length : 'Asignar ' + chosen.length + (chosen.length === 1 ? ' rutina' : ' rutinas')`.) Apply that refinement now:

```jsx
      {chosen.length
        ? (byRoutine ? 'Asignar a ' + chosen.length : 'Asignar ' + chosen.length + (chosen.length === 1 ? ' rutina' : ' rutinas'))
        : 'Elegí al menos uno'}
```

- [ ] **Step 2: Use it in `StudentDetail.jsx`** — add `import AssignPanel from './AssignPanel.jsx'`, change the signature to `StudentDetail({ id, students, onChanged })`, and replace the `<div className="row between">…</div>` header block at the top of `routines` with:

```jsx
    <div className="row between"><h4 className="sec">Rutinas asignadas</h4>
      {!desktop && <Button size="sm" variant="primary" icon="plus" onClick={() => openAssignSheet({ studentId: id, onDone: changed })}>Asignar</Button>}</div>
```
and, right after the `{pending.length > 0 && <>…</>}` block inside `routines`, add:

```jsx
    {desktop && <>
      <h4 className="sec">Asignar rutinas</h4>
      <AssignPanel studentId={id} students={students} onDone={changed} />
    </>}
```

- [ ] **Step 3: Pass `students`** — in `Coach.jsx` change the detail line to `<StudentDetail key={id} id={id} students={students} onChanged={reload} />`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test && npm run build`
Visual (mock): on `#/coach/alumno/<id>` at 1280px the left column shows "Asignar rutinas" with the coach's routines (those already assigned are dimmed "ya la tiene asignada"); ticking enables "Asignar N rutinas"; "Todos" ticks all eligible. With the mock `POST /api/coaching/assign` returning `{}` a toast appears and the shell list refetches. At 390px the old "Asignar" button + sheet still works.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AssignPanel.jsx frontend/src/components/StudentDetail.jsx frontend/src/views/Coach.jsx
git commit -m "feat(coach): inline assign panel in the student detail (desktop)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rutinas master–detail + editor path

**Files:**
- Create: `frontend/src/components/RoutinePanel.jsx`
- Modify: `frontend/src/views/CoachRoutines.jsx` (rewrite)
- Modify: `frontend/src/views/RoutineEdit.jsx` (`back` path on desktop)
- Modify: `frontend/src/App.jsx` (routes)

**Interfaces:**
- Consumes: `routinePath`, `routineEditPath` (Task 1), `useCoachData`, `useIsDesktop`, `AssignPanel` (Task 4).
- Produces: routes `/coach/rutinas/:id` (summary on desktop, redirect to the editor on mobile) and `/coach/rutinas/:id/editar` (the existing `RoutineEdit`). `<RoutinePanel r students onChanged />`.

- [ ] **Step 1: Create `frontend/src/components/RoutinePanel.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { glyphOf } from '../lib/glyphs.js'
import { routineEditPath } from '../lib/coachShell.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import AssignPanel from './AssignPanel.jsx'

// Desktop summary of one of the coach's routines: who has it, edit, and inline assignment.
export default function RoutinePanel({ r, students, onChanged }) {
  const nav = useNavigate()
  const have = (students || []).filter(s => (s.assignedRoutineIds || []).includes(r.id))
  return <div>
    <div className="hdr">
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow"><h1>{r.name}</h1><div className="sub">{exCount(countEx(r.ex))}</div></div>
      <Button size="sm" variant="tinted" icon="pencil" onClick={() => nav(routineEditPath(r.id))}>Editar</Button>
    </div>

    <h4 className="sec">Asignada a</h4>
    {have.length ? <div className="list">{have.map(s => <div key={s.id} className="item" onClick={() => nav('/coach/alumno/' + s.id)}>
      <div className="grow"><div className="tt">{s.name}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>)}</div> : <div className="empty small">Todavía no está asignada a nadie.</div>}

    <h4 className="sec">Asignar</h4>
    <AssignPanel routineId={r.id} students={students} onDone={onChanged} />
  </div>
}
```

- [ ] **Step 2: Rewrite `frontend/src/views/CoachRoutines.jsx`**

```jsx
import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { useCoachData } from '../lib/useCoachData.js'
import { routinePath, routineEditPath } from '../lib/coachShell.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { openAssignSheet } from '../components/AssignSheet.jsx'
import RoutinePanel from '../components/RoutinePanel.jsx'

// The coach's own templates (the same S.routines the athlete Plan edits).
// Mobile: list; a row opens the editor and "assign" is one tap away (sheet).
// Desktop: list on the left, selected routine's summary + inline assignment on the right.
export default function CoachRoutines() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { students, reload } = useCoachData()
  const mine = S.routines.filter(r => !r.coachAssigned)
  const selected = mine.find(r => r.id === id)

  useEffect(() => { if (id && !selected) nav('/coach/rutinas', { replace: true }) }, [id, !!selected])
  if (id && !desktop) return <Navigate to={routineEditPath(id)} replace />   // mobile has no summary screen

  const add = () => {
    const r = { id: uid(), name: 'Nueva rutina', emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav(routineEditPath(r.id))
  }

  const head = <div className="hdr">
    <div className="grow"><h1>Rutinas</h1><div className="sub">Tus plantillas para asignar</div></div>
    <Button size="sm" variant="tinted" icon="plus" onClick={add}>Nueva</Button>
  </div>

  const list = mine.length ? <div className="list">{mine.map(r => <div key={r.id} className={'item' + (r.id === id ? ' sel' : '')}>
    <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
    <div className="grow" onClick={() => nav(desktop ? routinePath(r.id) : routineEditPath(r.id))}>
      <div className="tt">{r.name}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
    {!desktop && <Button size="xs" variant="tinted" onClick={() => openAssignSheet({ routineId: r.id })}>Asignar</Button>}
  </div>)}</div>
    : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>Todavía no tenés rutinas.<br />Creá una y asignala a tus alumnos.</div>

  if (!desktop) return <div className="narrow">{head}{list}</div>

  return <div className="cgrid">
    <section className="cmaster" aria-label="Rutinas">{head}{list}</section>
    <section className="cdetail">
      {selected
        ? <RoutinePanel key={selected.id} r={selected} students={students} onChanged={reload} />
        : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>Elegí una rutina para ver a quién se la asignaste o asignarla.</div>}
    </section>
  </div>
}
```

- [ ] **Step 3: Routes** — in `App.jsx` replace the routines routes inside the `CoachShell` group with:

```jsx
                <Route path="/coach/rutinas" element={<CoachRoutines />} />
                <Route path="/coach/rutinas/:id" element={<CoachRoutines />} />
                <Route path="/coach/rutinas/:id/editar" element={<RoutineEdit />} />
```

- [ ] **Step 4: `RoutineEdit.jsx` back path** — add `import { useIsDesktop } from '../lib/useIsDesktop.js'` and `import { routinePath } from '../lib/coachShell.js'` (merge into an existing coachShell import if there is one), then in the component replace the `const back = …` line with (the `useIsDesktop()` call goes right above it, before any conditional return):

```jsx
  const desktop = useIsDesktop()
  const back = inCoach ? (desktop ? routinePath(id) : '/coach/rutinas') : '/plan'
```

- [ ] **Step 5: Verify**

Run: `cd frontend && npm test && npm run build`
Visual (mock; also mock `S.routines` by seeding `localStorage` state or `GET /api/data` → `{state:{routines:[{id:'r1',name:'Torso A',emoji:'dumbbell',ex:[…]}], …}}` — read `lib/starter.js`/`DEF` in `store/useStore.js` for the minimum shape): desktop `#/coach/rutinas` → list + "Elegí una rutina…"; click a routine → `#/coach/rutinas/r1`, panel shows "Asignada a", "Editar", inline assign; "Editar" → `#/coach/rutinas/r1/editar` inside the shell with the sidebar, back arrow returns to the summary. `#/coach/rutinas/nope` → redirects to `#/coach/rutinas`. At 390px: tapping a row opens the editor at `.../editar`; loading `#/coach/rutinas/r1` redirects to `.../r1/editar`. Resize 1280→390 while on `.../editar`: stays on the editor.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(coach): master-detail Rutinas with inline assignment; editor moves to /editar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Actividad on shared data, docs, full verification

**Files:**
- Modify: `frontend/src/views/CoachActivity.jsx`
- Modify: `CLAUDE.md` (§4 structure, §6 inventory)
- Modify: `docs/superpowers/specs/2026-10-07-coach-desktop-panel-design.md` ("Yo" default)

**Interfaces:**
- Consumes: `useCoachData()`, `activityFeed` (existing).

- [ ] **Step 1: Rewrite `CoachActivity.jsx`** to read the shell's students (no own fetch):

```jsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtDate } from '../lib/format.js'
import { activityFeed } from '../lib/coachShell.js'
import { useCoachData } from '../lib/useCoachData.js'
import Icon from '../components/Icon.jsx'

// Who trained, newest day first. Workouts carry a date but no clock time, so days are the finest grain.
export default function CoachActivity() {
  const nav = useNavigate()
  const { students } = useCoachData()
  const feed = useMemo(() => (students ? activityFeed(students) : null), [students])
  return <div className="narrow">
    <div className="hdr"><div className="grow"><h1>Actividad</h1><div className="sub">Lo último que entrenaron tus alumnos</div></div></div>
    {!feed ? <div className="muted small">Cargando…</div>
      : !feed.length ? <div className="empty"><div className="ico"><Icon name="history" /></div>Todavía no hay entrenos para mostrar.</div>
      : feed.map(g => <div key={g.d}>
        <div className="feed-day">{fmtDate(g.d, true)}</div>
        <div className="list">{g.items.map((i, n) => <div key={i.studentId + g.d + i.workout + n} className="item" onClick={() => nav('/coach/alumno/' + i.studentId)}>
          <div className="grow"><div className="tt">{i.name}</div><div className="ss">terminó {i.workout || 'un entreno'}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>)}</div>
      </div>)}
  </div>
}
```
On desktop `.narrow` renders inside `.cmain` (Task 2 CSS gives it 720px + padding); its `.list` is one column via the existing `.narrow .list` rule.

- [ ] **Step 2: Fix the spec's "Yo" default** — in `docs/superpowers/specs/2026-10-07-coach-desktop-panel-design.md` change `"Yo" links to \`/settings\`` to `"Yo" links to \`/home\` (the coach's own training, same as the mobile tab) and shows the orange dot while a workout is active`.

- [ ] **Step 3: Update `CLAUDE.md`** — §4: add `CoachShell`, `CoachSidebar`, `StudentList`, `StudentDetail`, `AssignPanel`, `RoutinePanel`, `useIsDesktop`, `useCoachData` to the structure list. §6: replace the `/coach/alumno/:id` row's file with `components/StudentDetail.jsx (via views/Coach.jsx)`, add the `/coach/rutinas/:id/editar` route, and add a one-line note: "≥1000px el área coach usa sidebar fija + master–detalle (`CoachShell`); mobile sin cambios. Clases `.cshell/.cside/.cgrid/.cmaster/.cdetail` en `index.css`."

- [ ] **Step 4: Full verification**

Run: `cd frontend && npm test && node scripts/check-locales.mjs && npm run build`
Expected: tests pass, locales check passes (no keys added), build OK.

Playwright (mock harness from Task 2) — checklist, screenshots into the scratchpad directory:
1. 1280×800 and 1440×900, dark: Alumnos (empty detail), Alumnos (student selected), Rutinas (routine selected), Actividad. Light theme + accents `violet` and `gold` on one screen each.
2. Long names: set a student name to ~60 chars and a routine name to ~60 chars → wrap inside the 340px list, no horizontal overflow.
3. Empty states: `students: []` (Alumnos, assign panel) and no routines.
4. 390×800: Alumnos list → detail → back; Rutinas list → editor; tab bar visible with the coach tabs; no sidebar.
5. Resize 1280 → 390 → 1280 while on `#/coach/alumno/<id>`: same student stays selected.
6. Poll: with the assign panel open and two students ticked, trigger a refetch (wait 15s, or call the mock with a changed array) — ticks stay.
7. Non-coach user (mock `/api/me` without `coach:true`): `#/coach` redirects to `#/home`; normal tab bar.
8. Full workout flow as an athlete at desktop width (start → log sets → timer → finish) still works — the shell must not affect `/workout`.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src CLAUDE.md docs/superpowers/specs/2026-10-07-coach-desktop-panel-design.md
git commit -m "feat(coach): Actividad on shared data; docs for the desktop panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Update memory** — edit `C:\Users\patog\.claude\projects\C--Users-patog-Desktop-my-projects-openGym\memory\opengym-coach-desktop-panel.md` to say the desktop panel was implemented (date, branch, spec + plan paths) and what remains out of scope (embedded routine editor, keyboard shortcuts, table view); keep the `MEMORY.md` pointer line in sync.
