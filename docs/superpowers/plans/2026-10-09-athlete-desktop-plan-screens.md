# Athlete Desktop — Plan, Routine Editor and Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Plan, the routine editor and Program real ≥1000px layouts — list + detail panes for Plan and Program, a two-column editor — without changing mobile.

**Architecture:** A small pure addition to `lib/athleteShell.js` (route helpers and a section key, Vitest). `Plan.jsx` and `Program.jsx` render the same pieces in two frames (the existing mobile structure, or a `.pane` with a sticky list and a detail panel), as `Home` and `Workout` already do. `RoutineEdit.jsx` builds its blocks as constants and places them in either the phone column or a two-column `.redit` grid. Routes mirror the coach: on desktop `/plan/r/:id` is the routine summary and the editor lives at `/plan/r/:id/editar`; on mobile `/plan/r/:id` redirects to the editor. The shell keys its content frame per *section* so selecting a routine does not remount the list.

**Tech Stack:** React 19, React Router 7, Zustand, plain CSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (sub-project 4: "Plan, RoutineEdit, Program"). Builds on the merged shell, Workout and Home.

**Scope note:** inline styles in `Plan.jsx`, `RoutineEdit.jsx` and `Program.jsx` stay as they are (their ad-hoc pixel values are not on the spacing scale and mobile must not move); they join the cleanup in sub-project 8 with `Workout.jsx` and `Home.jsx`. `BlockPreview` is reused untouched.

## Global Constraints

- Breakpoint **1000px** (`useIsDesktop`, `@media (min-width:1000px)`); below it nothing changes. Mobile navigation: Plan rows open the editor, back returns to `/plan`, a new routine lands in the editor.
- **No new dependencies.** No emoji as icons. No native form controls.
- Visual changes go through tokens and classes in `index.css`. No **new** inline `style={{}}` except where an existing element already carried one.
- Do not touch `lib/` logic other than `athleteShell.js`, nor `store/`, `api/`. Plan data operations (`update`, `dayAssignSheet`, `planToolsSheet`, `loadStarterPlan`, `exConfigSheet`, activation/finish of blocks) are not modified.
- Coach routes keep working: `/coach/rutinas/:id/editar` still renders `RoutineEdit` with its coach `back`.
- Dark and light both work; all 8 accents; `--on-acc` untouched. `prefers-reduced-motion` and `:focus-visible` respected; icon-only buttons keep their `aria-label`.
- Every visible string goes through `t()`. **No new keys** (all reused); `node scripts/check-locales.mjs` must still pass. Coach and Admin copy stays literal.
- Do not open `lib/exercises-data.js`, `lib/body-paths.js`, `instr/*`, `names/*`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mobile unchanged**: Plan rows go straight to the editor, `/plan/r/:id` on mobile redirects there with `replace`, back from the editor returns to `/plan`, creating a routine (Plan "New", Library "Plan" button) lands in the editor, Program's list → preview → activate flow is the same.
2. **Deleting the selected routine on desktop** (from the editor): back at `/plan` another routine is selected, no blank pane, no crash; with zero routines left the list shows its empty state and the detail pane is empty.
3. **Coach-assigned routines**: the summary shows the "from your coach" tag and "Request a change" (no Edit); `/plan/r/:id/editar` still shows the read-only `AssignedRoutineView`; a coach's own routines are unaffected.
4. **Selection does not remount the list**: clicking routines keeps the list's scroll position (section key), and an unknown `:id` (deleted routine, stale link) redirects to `/plan` on both frames.
5. **Content shapes**: routines with sections, supersets and no exercises render in the summary and the two-column editor; long routine and exercise names wrap; a routine with 30+ exercises scrolls the page, not the sticky list.
6. **Program**: no blocks (empty state), draft/active/completed blocks, a block with no routines, and the activate-with-confirm and adopt-current-plan paths behave exactly as before; on desktop the active block is selected by default.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/lib/athleteShell.js` | Modify | `planRoutinePath`, `planRoutineEditPath`, `athleteSectionKey` |
| `frontend/src/lib/athleteShell.test.js` | Modify | Tests for the above |
| `frontend/src/index.css` | Modify | `.pane*`, `.rsum`, `.redit` |
| `frontend/src/components/AdjustSheet.jsx` | Create | The "Request a change" sheet, moved out of `RoutineEdit.jsx` |
| `frontend/src/components/RoutineMuscles.jsx` | Create | The "What this session hits" card, shared by editor and summary |
| `frontend/src/components/RoutineSummary.jsx` | Create | Read-only summary of a routine for the Plan detail pane |
| `frontend/src/App.jsx` | Modify | Routes `/plan/r/:id` → Plan, `/plan/r/:id/editar` → editor; section key |
| `frontend/src/views/Plan.jsx` | Modify | Mobile frame unchanged; desktop `.pane` |
| `frontend/src/views/RoutineEdit.jsx` | Modify | Blocks as constants; desktop `.redit`; back target |
| `frontend/src/views/Program.jsx` | Modify | Mobile unchanged; desktop `.pane` |
| `frontend/src/sheets.jsx` | Modify | One navigation target (`/plan/r/…` → editor path) |
| `CLAUDE.md` | Modify | Document the new layouts and routes |

---

### Task 1: Route helpers and section key (pure, TDD)

**Files:**
- Modify: `frontend/src/lib/athleteShell.js`
- Test: `frontend/src/lib/athleteShell.test.js`

**Interfaces:**
- Consumes: `activeAthleteTab(pathname)` (same file).
- Produces (used by Tasks 3–7): `planRoutinePath(id): string` → `'/plan/r/' + id`; `planRoutineEditPath(id): string` → `'/plan/r/' + id + '/editar'`; `athleteSectionKey(pathname: string): string` — the key for the shell's content frame: the section for known paths (so moving inside a section does not remount), the raw pathname for unknown ones, plus `':editar'` for editor routes.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/lib/athleteShell.test.js` extend the import to
`import { ATHLETE_TABS, ATHLETE_MORE, activeAthleteTab, athleteFooter, showAthleteShell, planRoutinePath, planRoutineEditPath, athleteSectionKey } from './athleteShell.js'`
and append:

```js

describe('plan routes', () => {
  it('builds the summary and editor paths', () => {
    expect(planRoutinePath('r1')).toBe('/plan/r/r1')
    expect(planRoutineEditPath('r1')).toBe('/plan/r/r1/editar')
  })
  it('the editor path still belongs to the Plan tab', () => {
    expect(activeAthleteTab(planRoutineEditPath('r1'))).toBe('plan')
  })
})

describe('athleteSectionKey', () => {
  it('is stable while moving inside a section, so the list pane is not remounted', () => {
    expect(athleteSectionKey('/plan')).toBe('plan')
    expect(athleteSectionKey('/plan/r/a')).toBe('plan')
    expect(athleteSectionKey('/plan/r/b')).toBe('plan')
  })
  it('changes between a summary and its editor, and between sections', () => {
    expect(athleteSectionKey('/plan/r/a/editar')).toBe('plan:editar')
    expect(athleteSectionKey('/plan/r/a')).not.toBe(athleteSectionKey('/plan/r/a/editar'))
    expect(athleteSectionKey('/stats')).not.toBe(athleteSectionKey('/plan'))
  })
  it('falls back to the raw path for unknown routes and tolerates a missing one', () => {
    expect(athleteSectionKey('/nope')).toBe('/nope')
    expect(athleteSectionKey(undefined)).toBe('home')
    expect(athleteSectionKey('')).toBe('home')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/lib/athleteShell.test.js`
Expected: FAIL — `planRoutinePath` etc. are not exported (`is not a function`).

- [ ] **Step 3: Implement**

Append to `frontend/src/lib/athleteShell.js`:

```js

// Plan routes: on desktop /plan/r/:id is the routine's summary and the editor lives at
// /plan/r/:id/editar (same shape as the coach's); on mobile the summary redirects to the editor.
export const planRoutinePath = id => '/plan/r/' + id
export const planRoutineEditPath = id => '/plan/r/' + id + '/editar'

// Key for the shell's content frame. Per *section*, not per path: picking another routine in a
// list + detail pane must not remount the list (and lose its scroll), while a summary ↔ editor
// switch or a change of section still remounts and re-contains a view that threw.
export function athleteSectionKey(pathname) {
  const p = String(pathname || '')
  return (activeAthleteTab(p) || p) + (p.endsWith('/editar') ? ':editar' : '')
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/lib/athleteShell.test.js`
Expected: PASS (all athleteShell tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add docs/superpowers/plans/2026-10-09-athlete-desktop-plan-screens.md frontend/src/lib/athleteShell.js frontend/src/lib/athleteShell.test.js
git commit -m "feat(plan): route helpers and section key for the desktop panes, plus plan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: CSS for panes, summary grid and editor grid

**Files:**
- Modify: `frontend/src/index.css` (append one section)

**Interfaces:**
- Consumes: tokens `--sp-*`, `--list-w` (defined in the coach section), `--surface-2`, `--acc`.
- Produces (used by Tasks 4–7): `.pane` > `.pane-list` + `.pane-detail`; `.pane-list .item.sel`; `.rsum`; `.redit` > `.hdr` + `.rmain` + `.raside`.

- [ ] **Step 1: Append to `index.css`**

```css

/* ----------------------------------------- list + detail panes (athlete) --- */
/* Plan and Program: a sticky list on the left, the selected item on the right. Mirrors the
   coach's .cgrid/.cmaster/.cdetail, but inside the athlete content frame (which already has
   its own padding and width) instead of the full-bleed coach shell. */
@media (min-width:1000px){
  .pane{display:grid;grid-template-columns:var(--list-w) minmax(0,1fr);column-gap:var(--sp-6);align-items:start}
  .pane-list{
    position:sticky;top:var(--sp-5);max-height:calc(100vh - 2 * var(--sp-5));overflow-y:auto;
    min-width:0;padding-right:2px;
  }
  .pane-detail{min-width:0}
  #app .pane-list .list,#app .pane-detail .list{display:flex;flex-direction:column}
  .pane-list .item.sel{background:var(--surface-2);box-shadow:inset 3px 0 0 var(--acc)}
  .pane-detail .narrow{max-width:none;margin:0}
  .pane-detail .hdr>.lrow-i{align-self:center}
  /* a routine's summary: exercises beside the muscle map */
  .rsum{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);column-gap:var(--sp-5);align-items:start}
  .rsum>*{min-width:0}
  /* the routine editor: exercises on the left, progression / coverage / delete on the right */
  .redit{
    display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);
    grid-template-areas:"hdr hdr" "main aside";column-gap:var(--sp-6);align-items:start;
  }
  .redit>.hdr{grid-area:hdr}
  .redit>.rmain{grid-area:main;min-width:0}
  .redit>.raside{grid-area:aside;min-width:0}
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && npm run build` — Expected: succeeds.

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/index.css
git commit -m "style(plan): list + detail pane, summary grid and editor grid

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared pieces — `AdjustSheet`, `RoutineMuscles`, `RoutineSummary`

**Files:**
- Create: `frontend/src/components/AdjustSheet.jsx`
- Create: `frontend/src/components/RoutineMuscles.jsx`
- Create: `frontend/src/components/RoutineSummary.jsx`

**Interfaces:**
- Consumes: `isAssigned` (`../lib/coaching.js`), `requestAdjustment` (`../lib/coachApi.js`), `useUI`, `useStore`, `sectionsOf`/`countEx` (`../lib/routine.js`), `supersetUnits`/`exLine` (`../lib/history.js`), `loadOfRoutine`/`rankOf`/`MUSCLE_NAME` (`../lib/muscles.js`), `planRoutineEditPath` (Task 1), `POLICY_NAME` (`../lib/progression.js`).
- Produces: `<AdjustSheet r close />` (verbatim move); `<RoutineMuscles r />`; `<RoutineSummary r />`.

- [ ] **Step 1: `AdjustSheet.jsx` (verbatim move from `RoutineEdit.jsx`)**

```jsx
import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { requestAdjustment } from '../lib/coachApi.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

// "Request a change" on a coach-assigned routine. Opened from the editor's read-only view and
// from the desktop summary.
export default function AdjustSheet({ r, close }) {
  const toast = useUI(s => s.toast)
  const [note, setNote] = useState('')
  return <>
    <h3>{t('Request a change')}</h3>
    <p className="muted small">{t('Tell your coach what you want to change about this routine.')}</p>
    <textarea className="input" rows={4} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
    <Button variant="primary" style={{ marginTop: 10 }} disabled={!note.trim()}
      onClick={() => requestAdjustment(r.assignmentId, note.trim())
        .then(() => { toast(t('Sent to your coach')); close() })
        .catch(e => toast(e.message))}>{t('Send')}</Button>
  </>
}
```

- [ ] **Step 2: `RoutineMuscles.jsx` (the card the editor already renders)**

```jsx
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import BodyMap from './BodyMap.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

// Coverage of the routine as planned, so a gap shows up while you're building it rather than
// after a month of training around it. Shared by the editor and the desktop summary.
export default function RoutineMuscles({ r }) {
  const S = useStore(s => s.S)
  if (!r.ex.length) return null
  const load = loadOfRoutine(r)
  const { worked } = rankOf(load)
  return <div className="card" style={{ marginTop: 12 }}>
    <h2>{t('What this session hits')}</h2>
    <BodyMap load={load} body={S.body} />
    <div className="mchips">
      {worked.slice(0, 6).map(m => <span key={m} className="mchip">{t(MUSCLE_NAME[m])}</span>)}
    </div>
  </div>
}
```

- [ ] **Step 3: `RoutineSummary.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { isAssigned } from '../lib/coaching.js'
import { exOr } from '../lib/exercises.js'
import { exCount } from '../lib/format.js'
import { t, nameFor } from '../lib/i18n.js'
import { supersetUnits, exLine } from '../lib/history.js'
import { sectionsOf, countEx } from '../lib/routine.js'
import { POLICY_NAME } from '../lib/progression.js'
import { glyphOf } from '../lib/glyphs.js'
import { planRoutineEditPath } from '../lib/athleteShell.js'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import AdjustSheet from './AdjustSheet.jsx'
import RoutineMuscles from './RoutineMuscles.jsx'

// Desktop detail pane of the Plan screen: what a routine contains, read-only, with the way to
// edit it (or to ask the coach for a change when the coach assigned it).
export default function RoutineSummary({ r }) {
  const nav = useNavigate()
  const openSheet = useUI(s => s.openSheet)
  const S = useStore(s => s.S)
  const assigned = isAssigned(r)
  const groups = sectionsOf(r.ex)
  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())

  return <div>
    <div className="hdr">
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow">
        <h1>{r.name}</h1>
        <div className="sub">{exCount(countEx(r.ex))}{assigned && <span className="tag acc">{t('from your coach')}</span>}</div>
      </div>
      {assigned
        ? <Button size="sm" variant="tinted" icon="pencil" onClick={() => openSheet(close => <AdjustSheet r={r} close={close} />)}>{t('Request a change')}</Button>
        : <Button size="sm" variant="tinted" icon="pencil" onClick={() => nav(planRoutineEditPath(r.id))}>{t('Edit')}</Button>}
    </div>
    <div className="small muted" style={{ marginBottom: 12 }}>{t('Progression')}: {t(POLICY_NAME[r.prog || 'linear'])}</div>

    <div className="rsum">
      <div>
        {countEx(r.ex) ? <div className="list">
          {groups.map((g, gi) => <div key={gi}>
            {g.name !== null && <div className="sec" style={{ margin: '12px 2px 6px', fontWeight: 600 }}>{g.name}</div>}
            {g.rows.map(({ e, i }) => {
              const ex = exOr(e.id)
              return <div key={i}>
                {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
                <div className={'item' + (inSS.has(i) ? ' in-ss' : '')}>
                  <Thumb ex={ex} />
                  <div className="grow"><div className="tt cap1">{nameFor(ex)}</div><div className="ss">{exLine(e, S.unit)}</div></div>
                </div>
              </div>
            })}
          </div>)}
        </div> : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}
      </div>
      <div><RoutineMuscles r={r} /></div>
    </div>
  </div>
}
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && npm run build && npm test` — Expected: build succeeds; all tests pass (the components are not mounted yet).

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/components/AdjustSheet.jsx frontend/src/components/RoutineMuscles.jsx frontend/src/components/RoutineSummary.jsx
git commit -m "feat(plan): routine summary, shared muscle card and adjust sheet components

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Routes, section key, `Plan.jsx` panes

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/views/Plan.jsx` (replace the file)
- Modify: `frontend/src/sheets.jsx` (one line)

**Interfaces:**
- Consumes: Tasks 1–3 (`planRoutinePath`, `planRoutineEditPath`, `athleteSectionKey`, `RoutineSummary`, `.pane*`).
- Produces: routes `/plan`, `/plan/r/:id` → `Plan`; `/plan/r/:id/editar` → `RoutineEdit`.

- [ ] **Step 1: `App.jsx` routes and key**

In `frontend/src/App.jsx`:
- Replace `<Route path="/plan/r/:id" element={<RoutineEdit />} />` with
```jsx
      <Route path="/plan/r/:id" element={<Plan />} />
      <Route path="/plan/r/:id/editar" element={<RoutineEdit />} />
```
- Change the import `import { showAthleteShell } from './lib/athleteShell.js'` to `import { showAthleteShell, athleteSectionKey } from './lib/athleteShell.js'`.
- Change `<div className="amain-in vfade" key={loc.pathname}>` to `<div className="amain-in vfade" key={athleteSectionKey(loc.pathname)}>`.

- [ ] **Step 2: `sheets.jsx` navigation target**

In `frontend/src/sheets.jsx` (≈ line 325) change `if (isNew && r) nav('/plan/r/' + r.id)` to `if (isNew && r) nav(planRoutineEditPath(r.id))` and add `import { planRoutineEditPath } from './lib/athleteShell.js'` next to the other `./lib` imports. (A new routine always lands in the editor, on both frames.)

- [ ] **Step 3: Replace `frontend/src/views/Plan.jsx`**

```jsx
import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { isAssigned } from '../lib/coaching.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { planRoutinePath, planRoutineEditPath } from '../lib/athleteShell.js'
import RoutineSummary from '../components/RoutineSummary.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

// Mobile: the week schedule and the routines list; a routine opens the editor.
// Desktop: the same on the left, the selected routine's summary on the right
// (`/plan/r/:id`; with no id the first routine is shown).
export default function Plan() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const byId = S.routines.find(r => r.id === id)
  const selected = byId || (desktop ? S.routines[0] : null)

  // an unknown id (deleted routine, stale link) goes back to the plan
  useEffect(() => { if (id && !byId) nav('/plan', { replace: true }) }, [id, !!byId])
  if (id && !desktop) return <Navigate to={planRoutineEditPath(id)} replace />   // mobile has no summary screen

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav(planRoutineEditPath(r.id))
  }

  const header = <div className="hdr">
    <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
    <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
  </div>

  const scheduleCol = <div>
    <h4 className="sec">{t('Week schedule')}</h4>
    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2, 3, 4, 5, 6, 0].map(d => {
        const r = S.routines.find(x => x.id === S.week[d])
        return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
          <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
          {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
          <Icon name="chevronRight" className="chev" /></div>
      })}
    </div>
  </div>

  const routinesCol = <div>
    <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
    </div>
    {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id}
      className={'item' + (desktop && selected && r.id === selected.id ? ' sel' : '')}
      onClick={() => nav(desktop ? planRoutinePath(r.id) : planRoutineEditPath(r.id))}>
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow"><div className="tt">{r.name}{isAssigned(r) && <span className="tag acc" style={{ marginLeft: 6 }}>{t('from your coach')}</span>}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
      <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
      <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
      <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
    </>}
  </div>

  if (!desktop) return <>
    {header}
    <div className="cols">{scheduleCol}{routinesCol}</div>
  </>

  return <div className="pane">
    <section className="pane-list" aria-label={t('Plan')}>{header}{scheduleCol}{routinesCol}</section>
    <section className="pane-detail">
      <ErrorBoundary key={selected ? selected.id : 'none'}>
        {selected ? <RoutineSummary key={selected.id} r={selected} /> : null}
      </ErrorBoundary>
    </section>
  </div>
}
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build succeeds; all suites pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/App.jsx frontend/src/views/Plan.jsx frontend/src/sheets.jsx
git commit -m "feat(plan): list + summary panes on desktop; editor moves to /plan/r/:id/editar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `RoutineEdit.jsx` — two columns and the new back target

**Files:**
- Modify: `frontend/src/views/RoutineEdit.jsx` (replace the file)

**Interfaces:**
- Consumes: `AdjustSheet`, `RoutineMuscles` (Task 3), `planRoutinePath` (Task 1), `.redit` (Task 2).
- Produces: the same editor; desktop renders `.redit` (header + `.rmain` [list, add buttons] + `.raside` [progression, coverage, hint, delete]); non-coach `back` is `planRoutinePath(id)` on desktop and `/plan` on mobile.

- [ ] **Step 1: Replace `frontend/src/views/RoutineEdit.jsx` with**

```jsx
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { isAssigned } from '../lib/coaching.js'
import { exOr } from '../lib/exercises.js'
import { uid } from '../lib/format.js'
import { t, nameFor } from '../lib/i18n.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, SelectRow } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import { sectionsOf, isSection, countEx, sectionEnd } from '../lib/routine.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { routinePath } from '../lib/coachShell.js'
import { planRoutinePath } from '../lib/athleteShell.js'
import AdjustSheet from '../components/AdjustSheet.jsx'
import RoutineMuscles from '../components/RoutineMuscles.jsx'

function SectionHeader({ name, onRename, onMove, onDelete }) {
  return (
    <div className="sect-hdr">
      <input className="input sect-name" defaultValue={name}
        onChange={e => onRename(e.target.value)} />
      <button className="iconbtn" aria-label={t('Move section up')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={() => onMove(-1)}><Icon name="chevronUp" /></button>
      <button className="iconbtn" aria-label={t('Move section down')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={() => onMove(1)}><Icon name="chevronDown" /></button>
      <button className="iconbtn" aria-label={t('Delete section')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={onDelete}><Icon name="trash" /></button>
    </div>
  )
}

function AssignedRoutineView({ r }) {
  const nav = useNavigate()
  const openSheet = useUI(s => s.openSheet)
  const S = useStore(s => s.S)
  const groups = sectionsOf(r.ex)
  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}>{r.name}</div>
      </div>
      <span className="tag acc">{t('from your coach')}</span>
    </div>

    <div style={{ margin: '4px 0 16px' }}>
      <Button variant="tinted" icon="pencil" onClick={() => openSheet(close => <AdjustSheet r={r} close={close} />)}>{t('Request a change')}</Button>
    </div>

    <div className="list">
      {groups.map((g, gi) => <div key={gi}>
        {g.name !== null && <div className="sec" style={{ margin: '12px 2px 6px', fontWeight: 600 }}>{g.name}</div>}
        {g.rows.map(({ e, i }) => {
          const ex = exOr(e.id)
          return <div key={i} className="item">
            <Thumb ex={ex} />
            <div className="grow"><div className="tt cap1">{nameFor(ex)}</div><div className="ss">{exLine(e, S.unit)}</div></div>
          </div>
        })}
      </div>)}
    </div>
  </div>
}

export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const inCoach = useLocation().pathname.startsWith('/coach/')
  const desktop = useIsDesktop()
  const back = inCoach ? (desktop ? routinePath(id) : '/coach/rutinas') : (desktop ? planRoutinePath(id) : '/plan')
  const r = S.routines.find(x => x.id === id)
  useEffect(() => { if (!r) nav(back) }, [!!r])
  if (!r) return null
  if (isAssigned(r)) return <AssignedRoutineView r={r} />

  const edit = fn => update(s => { fn(s.routines.find(x => x.id === id).ex) })
  const move = (i, dir) => edit(ex => { const j = i + dir; if (j < 0 || j >= ex.length) return;[ex[i], ex[j]] = [ex[j], ex[i]]; cleanupSg(ex) })
  const toggleLink = i => edit(ex => {
    if (i < 1) return
    const cur = ex[i], prev = ex[i - 1]
    if (cur.sg && prev.sg && cur.sg === prev.sg) delete cur.sg
    else { const gid = prev.sg || ('sg' + uid()); prev.sg = gid; cur.sg = gid }
    cleanupSg(ex)
  })

  // Add an exercise, placing it at the splice index `at(list)` returns (computed at
  // edit time so it stays correct if the list shifted since render).
  const addEx = at => exercisePicker(ex => exConfigSheet(ex, null,
    cfg => edit(x => { x.splice(at(x), 0, { id: ex.id, ...cfg }) }), null, r))

  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())

  // The index in r.ex of the marker that opens the gi-th named section (0-based over named groups).
  const sectionMarkerIndex = gi => {
    let seen = -1
    for (let k = 0; k < r.ex.length; k++) {
      if (isSection(r.ex[k]) && ++seen === gi) return k
    }
    return -1
  }

  const header = <div className="hdr">
    <button className="iconbtn" onClick={() => nav(back)} aria-label={inCoach ? 'Rutinas' : t('Plan')}><Icon name="chevronLeft" /></button>
    <div style={{ flex: 1, margin: '0 12px' }}>
      <input className="input" defaultValue={r.name} style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
        onChange={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value.trim() || t('Routine') })} />
    </div>
    <button className="iconbtn" aria-label={t('Pick an icon')} onClick={() => glyphPicker(r.emoji, g => update(s => { s.routines.find(x => x.id === id).emoji = g }))}><Icon name={glyphOf(r.emoji)} /></button>
  </div>

  const progression = <>
    <div className="sect-b" style={{ marginBottom: 16 }}>
      <SelectRow icon="chartLine" title={t('Progression')} sheetTitle={t('Progression')}
        value={r.prog || 'linear'} onChange={v => update(s => { s.routines.find(x => x.id === id).prog = v })}
        options={POLICIES_FOR.reps.map(p => ({ value: p, label: t(POLICY_NAME[p]), subtitle: t(POLICY_DESC[p]) }))} />
    </div>
    <div className="small dim" style={{ margin: '-10px 2px 16px' }}>
      {t('Applies to every exercise in this routine that does not set its own rule.')}
    </div>
  </>

  const listBlock = countEx(r.ex) || r.ex.some(isSection)
    ? <div className="list">
      {(() => { const groups = sectionsOf(r.ex); const leadingOffset = groups[0] && groups[0].name === null ? 1 : 0; const hasSections = r.ex.some(isSection); return groups.map((g, gi) => {
        const mi = g.name === null ? -1 : sectionMarkerIndex(gi - leadingOffset)
        return <div key={gi}>
          {g.name !== null && <SectionHeader name={g.name}
            onRename={v => { if (mi < 0) return; update(s => { s.routines.find(x => x.id === id).ex[mi].section = v.trim() || t('New section') }) }}
            onMove={dir => { if (mi < 0) return; move(mi, dir) }}
            onDelete={() => {
              if (mi < 0) return
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
            }} />}
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
                    <button className="iconbtn" aria-label={t('Move up')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, -1) }}><Icon name="chevronUp" /></button>
                    <button className="iconbtn" aria-label={t('Move down')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, 1) }}><Icon name="chevronDown" /></button>
                  </div>
                </div>
              </div>
            </div>
          })}
          {hasSections && <button className="sect-add" onClick={() => addEx(x => sectionEnd(x, mi))}>
            <Icon name="plus" />{g.name === null ? t('Add exercise') : t('Add to {0}', g.name)}
          </button>}
        </div>
      }) })()}
    </div>
    : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>

  const hint = <div className="small dim row" style={{ margin: '10px 2px', gap: 5 }}><Icon name="link" style={{ fontSize: 13 }} />{t('Tap the link button on an exercise to superset it with the one above — you’ll do them back-to-back.')}</div>

  const addButtons = <>
    <Button variant="primary" onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => edit(x => { x.push({ id: ex.id, ...cfg }) }), null, r))} icon="plus">{t('Add exercise')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={() => edit(ex => { ex.push({ section: t('New section') }) })} icon="plus">{t('Add section')}</Button>
  </>

  const deleteButton = <>
    <div style={{ height: 10 }} />
    <Button variant="danger" onClick={() => confirmSheet({
      title: t('Delete routine?'), message: t('“{0}” and its exercises will be removed.', r.name), confirmText: t('Delete'), danger: true,
      onConfirm: () => {
        update(s => {
          s.routines = s.routines.filter(x => x.id !== id)
          Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
          Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
        })
        nav(back)
      }
    })}>{t('Delete routine')}</Button>
  </>

  if (desktop) return <div className="redit">
    {header}
    <div className="rmain">{listBlock}<div style={{ height: 12 }} />{addButtons}</div>
    <div className="raside">{progression}<RoutineMuscles r={r} />{hint}{deleteButton}</div>
  </div>

  return <div className="narrow">
    {header}
    {progression}
    {listBlock}
    <RoutineMuscles r={r} />
    {hint}
    {addButtons}
    {deleteButton}
  </div>
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build succeeds; all suites pass. Check no leftovers: `grep -n "requestAdjustment\|useState\|BodyMap\|loadOfRoutine" frontend/src/views/RoutineEdit.jsx` → no output.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/views/RoutineEdit.jsx
git commit -m "feat(plan): two-column routine editor on desktop

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `Program.jsx` — list + preview panes

**Files:**
- Modify: `frontend/src/views/Program.jsx` (replace the file)

**Interfaces:**
- Consumes: `useIsDesktop`, `.pane*` (Task 2), existing `BlockPreview`, `activeBlock`, `confirmSheet`.
- Produces: the same screen; desktop shows the block list on the left and the selected block's preview (default: the active block) with its actions on the right; mobile keeps "list OR preview".

- [ ] **Step 1: Replace `frontend/src/views/Program.jsx` with**

```jsx
// Program screen (#/program) — the manual periodization surface.
//
// Lists every training block, and drives the block lifecycle: create a draft,
// activate it (which materializes its routines into the live plan), and finish
// the current one (which snapshots it into history). Inert when there are no
// blocks — the empty state is all a fresh install ever sees.
//
// Activation snapshots the outgoing block via snapshotActiveBlock() BEFORE
// materializeBlock() runs: at that moment s.program.activeId still names the
// outgoing block, so its live routine edits are captured onto the right block.
//
// Mobile shows the list OR a block's preview; desktop shows both side by side.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { newManualBlock, activeBlock, materializeBlock, snapshotActiveBlock, finishActiveBlock } from '../lib/blocks.js'
import BlockPreview from '../components/BlockPreview.jsx'

export default function Program() {
  const nav = useNavigate()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [previewId, setPreviewId] = useState(null)

  const blocks = S.program?.blocks || []
  const activeId = S.program?.activeId || null
  const current = activeBlock(S)
  // desktop always has something to show once a block is running
  const preview = blocks.find(b => b.id === previewId) || (desktop ? current : null)

  const addBlock = () => {
    const b = newManualBlock({ name: t('Block {0}', (S.program?.blocks?.length || 0) + 1), weeks: 4 })
    update(s => { s.program.blocks.push(b) })
  }

  const clone = o => JSON.parse(JSON.stringify(o))

  // Per controller ruling: snapshot the outgoing active block first (activeId
  // still points at it), then materialize the incoming one — but never let that
  // wipe a live plan the target block cannot reproduce.
  const activate = id => {
    const block = (S.program?.blocks || []).find(b => b.id === id)
    if (!block) return
    const live = S.routines || []
    // Target block is empty and there's a live plan: adopt it into the block first,
    // so activating turns "my current plan" into this block instead of erasing it.
    if (!block.routines?.length && live.length > 0) {
      update(s => {
        const b = s.program.blocks.find(x => x.id === id)
        b.routines = clone((s.routines || []).filter(r => !r.coachAssigned))
        b.week = clone(s.week)
        snapshotActiveBlock(s)
        materializeBlock(s, id)
      })
      return
    }
    // Target block has its own routines and would swap out a different live plan: confirm.
    if (block.routines?.length && live.length > 0 && id !== activeId) {
      confirmSheet({
        title: t('Replace your current routines?'),
        message: t('Activating “{0}” swaps in its routines and weekly schedule. Your current ones are saved into the block you were on.', block.name),
        confirmText: t('Activate'),
        onConfirm: () => update(s => { snapshotActiveBlock(s); materializeBlock(s, id) }),
      })
      return
    }
    update(s => { snapshotActiveBlock(s); materializeBlock(s, id) })
  }

  const finish = () => confirmSheet({
    title: t('Finish current block?'),
    message: t('It moves to your history. Your routines stay until you activate another block.'),
    confirmText: t('Finish'),
    onConfirm: () => update(s => finishActiveBlock(s)),
  })

  const previewBlock = preview && <>
    <BlockPreview block={preview} />
    <div className="narrow row" style={{ gap: 10, marginTop: 4 }}>
      {activeId !== preview.id && <Button variant="primary" icon="play" onClick={() => { activate(preview.id); setPreviewId(null); nav('/plan') }}>{t('Activate this block')}</Button>}
      <Button variant="tinted" icon="pencil" onClick={() => { if (activeId !== preview.id) activate(preview.id); setPreviewId(null); nav('/plan') }}>{t('Edit routines')}</Button>
    </div>
  </>

  // mobile: a block's preview replaces the list
  if (!desktop && preview) return <>
    <div className="hdr">
      <button className="iconbtn" onClick={() => setPreviewId(null)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Block preview')}</h1></div>
    </div>
    {previewBlock}
  </>

  const header = <div className="hdr">
    {!desktop && <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="chevronLeft" /></button>}
    <div style={{ flex: 1, marginLeft: desktop ? 0 : 10 }}><h1>{t('Program')}</h1><div className="sub">{t('Your training blocks')}</div></div>
  </div>

  const body = <>
    {/* Plan 2 mounts the "Generate block" button here. */}

    {current && <div className="card" style={{ marginBottom: 16 }}>
      <div className="small dim">{t('Current block')}</div>
      <h2 style={{ margin: '2px 0 8px' }}>{current.name}</h2>
      <div className="small dim">{t('{0} weeks', current.weeks)}{current.startedAt ? ` · ${t('since')} ${fmtDate(current.startedAt, true)}` : ''}</div>
      <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
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
        const state = b.id === activeId ? t('active') : b.completedAt ? t('completed') : t('draft')
        return <div key={b.id} className={'item' + (desktop && preview && b.id === preview.id ? ' sel' : '')} onClick={() => setPreviewId(b.id)}>
          <div className="grow"><div className="tt">{b.name}</div><div className="ss">{t('{0} weeks', b.weeks)} · {state}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
    </div> : <div className="empty"><div className="ico"><Icon name="calendar" /></div>{t('No blocks yet.')}<br />{t('Create one, or set up your profile to generate one.')}</div>}
  </>

  if (!desktop) return <div className="narrow">{header}{body}</div>

  return <div className="pane">
    <section className="pane-list" aria-label={t('Program')}>{header}{body}</section>
    <section className="pane-detail">{previewBlock}</section>
  </div>
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && npm run build && npm test` — Expected: build succeeds; all tests pass.

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/views/Program.jsx
git commit -m "feat(program): block list + preview panes on desktop

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser verification and fixes

**Files:**
- Modify (only if a defect is found): `frontend/src/index.css`, `frontend/src/views/Plan.jsx`, `frontend/src/views/RoutineEdit.jsx`, `frontend/src/views/Program.jsx`, `frontend/src/components/RoutineSummary.jsx`

**Interfaces:**
- Consumes: the running app. Produces: confirmation of every Review Focus item.

- [ ] **Step 1: Start the app and seed**

Run `npm run dev` in the background from the repo root. With Playwright at **1440×900**: open `#/home`, clear `localStorage`, reload, "Continuar sin cuenta", "Cargar plan inicial (PPL)". Then patch the saved state (`gym_state_v1`) so routine 0 has a section marker and a superset, routine 2 is coach-assigned, and a block exists:

```js
const k = 'gym_state_v1'; const s = JSON.parse(localStorage.getItem(k))
const a = s.routines[0]
a.ex.splice(2, 0, { section: 'Accessories' })           // a named section in the middle
a.ex[0].sg = 'ss1'; a.ex[1].sg = 'ss1'                    // first two exercises: a superset
s.routines[2].coachAssigned = true; s.routines[2].assignmentId = 'as1'
s.program = { blocks: [{ id: 'b1', name: 'Bloque 1', weeks: 4, routines: JSON.parse(JSON.stringify(s.routines.slice(0, 2))), week: { 1: s.routines[0].id } }], activeId: null }
localStorage.setItem(k, JSON.stringify(s)); location.reload()
```
(If `isAssigned` checks another field, inspect `lib/coaching.js` and set that field instead; the assigned routine must show the "from your coach" tag.)

- [ ] **Step 2: Plan panes (Review Focus 1, 4, 5)**

At 1440: `#/plan` shows the list pane (week schedule, routines with the first one `.sel`) and the first routine's summary on the right with the superset label and the "Accessories" section, the muscle map beside the exercises, no horizontal scroll. Click another routine: the URL becomes `#/plan/r/:id`, the summary swaps, the list pane is **not** remounted (set `document.querySelector('.pane-list').scrollTop = 40` first and read it back, or tag the node with a property and check it survives). Click the coach-assigned routine: tag "from your coach" and "Request a change" (no Edit); the button opens the sheet. Open `#/plan/r/does-not-exist`: redirected to `#/plan`. Screenshot at 1440 and 1280 and read them.

- [ ] **Step 3: Editor (Review Focus 1, 2, 3)**

Click Edit on a routine: URL `#/plan/r/:id/editar`, two columns (exercises left; progression, muscle card, hint and delete right); reorder an exercise, toggle a superset link, add a section, edit the name, change progression via its sheet — each still works. The back chevron returns to `#/plan/r/:id` (the summary). Delete the routine from the editor: you land on `#/plan` with another routine selected, no crash; delete routines until none are left: the list shows the empty state with the starter-plan button and the detail pane is empty. Open the coach-assigned routine's editor URL directly: the read-only `AssignedRoutineView` appears.

- [ ] **Step 4: Program (Review Focus 6)**

At 1440 `#/program`: with a block that is not active the detail is empty until a row is clicked; click "Bloque 1": the preview shows its schedule and routines with "Activate this block"/"Edit routines"; activate it (a confirm sheet appears because the block has routines and a live plan exists), confirm, and observe the same behaviour as mobile (navigates to `#/plan`). Back on `#/program` the active block is selected by default and the "Current block" card shows View/Edit routines/Finish block. With no blocks (reset `s.program`), the empty state shows and the detail is empty.

- [ ] **Step 5: Mobile unchanged (Review Focus 1)**

At **390×844**: `#/plan` is the original list (schedule then routines); tapping a routine goes to `#/plan/r/:id/editar` (single column editor, back chevron goes to `#/plan`); `#/plan/r/:id` typed in the URL redirects to the editor; "New" creates a routine and opens its editor; Library → a custom exercise → "Add to my plan" → new routine still lands in the editor; `#/program` shows the list, a row opens the full-screen preview with the back button, the Settings chevron is present. Check light theme and accents `lime`, `sky`, `orange` once at 1440 (wait ≥300 ms after switching themes before judging colours).

- [ ] **Step 6: Clean up and commit fixes**

Stop the dev server (`TaskStop`) and delete `.playwright-mcp` and screenshots from the repo root.

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add -A frontend/src
git diff --cached --quiet || git commit -m "fix(plan): desktop polish from visual QA

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Expected: no commit if nothing needed changing. Record each defect as a ledger `Ruling:`.)

---

### Task 8: Documentation and close-out

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document in `CLAUDE.md`**

- §4 `components/` list: add `RoutineSummary` (detalle de rutina en el Plan desktop), `RoutineMuscles` (card "qué trabaja esta sesión"), `AdjustSheet` ("Request a change" de rutinas del coach); under `lib/` mention that `athleteShell.js` also holds `planRoutinePath`, `planRoutineEditPath` and `athleteSectionKey`.
- §5.4 table: add a row `| Paneles lista + detalle (atleta) | \`.pane\` > \`.pane-list\` (+ \`.item.sel\`) + \`.pane-detail\`, \`.rsum\`, \`.redit\` > \`.rmain\` + \`.raside\` | Plan y Program en desktop |`.
- §6: `/plan` row append ` Desktop ≥1000px: lista (semana + rutinas) y resumen de la rutina seleccionada (\`/plan/r/:id\`).`; `/plan/r/:id` row: change to `/plan/r/:id/editar` for the editor (and note that in mobile \`/plan/r/:id\` redirige al editor) and append ` Desktop: dos columnas (ejercicios | progresión, cobertura, borrar).`; `/program` row append ` Desktop: lista de bloques + preview del bloque seleccionado (por defecto el activo).`

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
git commit -m "docs: desktop Plan, routine editor and Program in CLAUDE.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand off**

Leave `feat/athlete-plan-desktop` unmerged and ask the user whether to merge it (local only unless they ask for the push with the `patoogm` token) before plan 5 (Stats and History).

---

## Self-review notes

- **Spec coverage:** Plan master–detail with summary (Tasks 3–4), editor two columns (Task 5), Program list + preview (Task 6), routes mirroring the coach with a mobile redirect (Tasks 1, 4), shell key that preserves list state (Tasks 1, 4), docs (Task 8).
- **Type/name consistency:** `planRoutinePath`/`planRoutineEditPath`/`athleteSectionKey` (Task 1) are the exact names imported in Tasks 3–5 and `App.jsx`; `.pane`, `.pane-list`, `.pane-detail`, `.rsum`, `.redit`, `.rmain`, `.raside` (Task 2) are the ones used in Tasks 3–6; `AdjustSheet`/`RoutineMuscles` default exports match their imports in `RoutineSummary` and `RoutineEdit`.
- **Known interim state:** Stats, History, Library, Settings, Profile and Login keep their Plan-1 layouts until their own plans.
