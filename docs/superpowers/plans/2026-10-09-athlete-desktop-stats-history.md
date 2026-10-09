# Athlete Desktop — Stats & History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Stats and History a real ≥1000px layout: a card grid on Stats with a searchable exercise list for Exercise progress, and a History screen that is a list + workout-detail panel instead of a bottom sheet. Mobile (<1000px) stays unchanged.

**Architecture:** Reuse the `.pane` / `.pane-list` / `.pane-detail` primitives and `.cols` from plans 3–4. History gets a nested route `/history/:id` (desktop: selected workout in the right pane; mobile: redirects to `/history`, sheet flow untouched, like `/plan/r/:id`). The sheet's body is extracted into one `WorkoutDetail` component used by both the sheet and the panel. A single `openWorkout(w)` helper decides panel (desktop → navigate) vs. sheet (mobile) for every caller. Two tiny pure helpers get Vitest tests; everything else is markup + CSS.

**Tech Stack:** React 19, React Router 7 (HashRouter), Zustand, Vitest, one plain CSS file. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (section "Stats and History"). One deliberate deviation, see "Layout decision".

## Global Constraints

- Mobile (<1000px) unchanged: sheet flow for workout detail, `SelectRow` sheet for exercise choice.
- No new dependencies; no native `<select>`/checkbox/range; no emoji icons.
- No changes to the logic of `lib/` or `store/` beyond the two new pure helpers and one path helper added here.
- Every visual change through tokens/classes in `frontend/src/index.css`; new inline styles are not allowed in code this plan writes; inline styles in touched blocks that are plain margins may be left as they are (the cleanup is plan 8).
- Dark + light, 8 accents; hit targets ≥44px; text must wrap (12 languages, no fixed label widths).
- All visible strings through `t('English source')`; any new key goes into **all** `frontend/src/locales/*.js`, then `node scripts/check-locales.mjs` must pass.
- Commands run from `frontend/`: `npm test`, `node scripts/check-locales.mjs`, `npm run build`.
- Do not open `exercises-data.js`, `body-paths.js`, `instr/*`, `names/*`.

## Layout decision (deviation from spec)

The spec pairs "Body weight | Exercise progress". With a side list of exercises inside a half-width card, the chart would be ~330px wide. So on desktop: `Body weight | Recent workouts` share a row, and **Exercise progress is a full-width card** (list on the left, chart on the right). Everything the spec lists is still present. Muscle balance | Effort is as specified (if Effort is hidden, Muscle balance takes the left half).

## Review Focus

- Selected workout was deleted (panel open, user deletes it): panel must move to the next/latest workout or the empty state, not crash or leave a stale id in the URL.
- `/history/:id` with an unknown id (stale link, deleted workout): redirect to `/history`.
- `/history/:id` on mobile: redirect to `/history` (no blank screen).
- Exercise search with accents/case ("sentadilla" vs "Sentadílla", empty query, no match): list shows all for empty query, an empty message for no match, never throws.
- Currently selected exercise is filtered out by the search: the chart keeps showing it (selection is not cleared by typing).
- A day with 2+ workouts tapped on the heatmap on desktop: calendar sheet opens, picking one navigates to the panel (not a stacked second sheet).
- Account with zero workouts: History shows the existing empty state; Stats hides recent workouts and shows the existing "Finish your first workout" copy.

---

## File Structure

- Create `frontend/src/lib/statsPanes.js` (+ `statsPanes.test.js`) — `filterByQuery`, `pickWorkout`.
- Modify `frontend/src/lib/athleteShell.js` (+ test) — `historyWorkoutPath`.
- Create `frontend/src/components/WorkoutDetail.jsx` — extracted body of the sheet, shared with the panel.
- Modify `frontend/src/sheets.jsx` — use `WorkoutDetail`; add `openWorkout`; Calendar uses `openWorkout`.
- Modify `frontend/src/views/History.jsx` — mobile list unchanged, desktop panes.
- Modify `frontend/src/views/Stats.jsx` — grid + exercise side list.
- Modify `frontend/src/App.jsx` — route `/history/:id`.
- Modify `frontend/src/index.css` — `.xprog*`, History/Stats desktop rules.
- Modify `frontend/src/locales/*.js` only if a new key is introduced; `CLAUDE.md` §5.4/§6.

---

### Task 1: Pure helpers

**Files:**
- Create: `frontend/src/lib/statsPanes.js`, `frontend/src/lib/statsPanes.test.js`
- Modify: `frontend/src/lib/athleteShell.js`, `frontend/src/lib/athleteShell.test.js`

**Interfaces:**
- Produces: `filterByQuery(items, query, labelOf) -> items[]` (items kept in order; accent- and case-insensitive substring; blank query returns `items` unchanged).
- Produces: `pickWorkout(workouts, id) -> workout | null` (the one with `w.id === id`; if `id` is falsy or not found, the **latest** workout, i.e. last array element; `null` if the array is empty).
- Produces: `historyWorkoutPath(id) -> '/history/' + id` in `athleteShell.js`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/statsPanes.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { filterByQuery, pickWorkout } from './statsPanes.js'

const label = x => x.n
const items = [{ n: 'Sentadílla búlgara' }, { n: 'Press banca' }, { n: 'Remo con barra' }]

describe('filterByQuery', () => {
  it('returns everything for a blank query', () => {
    expect(filterByQuery(items, '', label)).toBe(items)
    expect(filterByQuery(items, '   ', label)).toBe(items)
  })
  it('ignores case and accents', () => {
    expect(filterByQuery(items, 'SENTADILLA', label)).toEqual([items[0]])
    expect(filterByQuery(items, 'busq', label)).toEqual([])
    expect(filterByQuery(items, 'bulgara', label)).toEqual([items[0]])
  })
  it('keeps the original order and matches substrings', () => {
    expect(filterByQuery(items, 'r', label).map(label)).toEqual(['Sentadílla búlgara', 'Press banca', 'Remo con barra'])
  })
  it('returns an empty list when nothing matches', () => {
    expect(filterByQuery(items, 'zzz', label)).toEqual([])
  })
})

describe('pickWorkout', () => {
  const ws = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('finds by id', () => expect(pickWorkout(ws, 'b')).toBe(ws[1]))
  it('falls back to the latest when id is missing or unknown', () => {
    expect(pickWorkout(ws, undefined)).toBe(ws[2])
    expect(pickWorkout(ws, 'gone')).toBe(ws[2])
  })
  it('is null for no workouts', () => expect(pickWorkout([], 'a')).toBeNull())
})
```
Append to `athleteShell.test.js` (and add `historyWorkoutPath` to its import):
```js
describe('historyWorkoutPath', () => {
  it('builds the detail route, which stays in the History section', () => {
    expect(historyWorkoutPath('w1')).toBe('/history/w1')
    expect(activeAthleteTab(historyWorkoutPath('w1'))).toBe('history')
    expect(athleteSectionKey('/history/w1')).toBe(athleteSectionKey('/history'))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/lib/statsPanes.test.js src/lib/athleteShell.test.js`
Expected: FAIL (module / export not found).

- [ ] **Step 3: Implement**

`frontend/src/lib/statsPanes.js`:
```js
// Pure helpers for the desktop Stats / History panes.
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Accent- and case-insensitive substring filter that keeps the input order.
export function filterByQuery(items, query, labelOf) {
  const q = norm(query).trim()
  if (!q) return items
  return items.filter(it => norm(labelOf(it)).includes(q))
}

// The workout the History panel shows: the requested one, else the latest.
export function pickWorkout(workouts, id) {
  if (!workouts.length) return null
  return (id && workouts.find(w => w.id === id)) || workouts[workouts.length - 1]
}
```
Add to `athleteShell.js` next to the plan paths:
```js
export const historyWorkoutPath = id => '/history/' + id
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run src/lib/statsPanes.test.js src/lib/athleteShell.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/statsPanes.js frontend/src/lib/statsPanes.test.js frontend/src/lib/athleteShell.js frontend/src/lib/athleteShell.test.js
git commit -m "feat(stats): pure helpers for desktop exercise search and history pane"
```

---

### Task 2: Shared WorkoutDetail + `openWorkout`

**Files:**
- Create: `frontend/src/components/WorkoutDetail.jsx`
- Modify: `frontend/src/sheets.jsx` (the `WorkoutDetail` function at ~796–812, `Calendar` at ~832–836)
- Modify: `frontend/src/views/Stats.jsx` (imports and the two `workoutDetailSheet` uses)

**Interfaces:**
- Produces: `<WorkoutDetail w={workout} onDeleted={() => void} />` — renders title, meta line, entries with PR badges and the Delete button (with the same `confirmSheet`). `onDeleted` runs after the workout is removed from the store and the toast shown. It does **not** close anything itself.
- Produces: `openWorkout(w)` exported from `sheets.jsx`: on desktop (`matchMedia('(min-width:1000px)')`) `nav(historyWorkoutPath(w.id))`, otherwise `workoutDetailSheet(w)`.
- Consumes: `historyWorkoutPath` (Task 1), `confirmSheet` from `sheets.jsx` (circular import is fine: it is only called inside an event handler).

- [ ] **Step 1: Create the component** by moving the JSX of `WorkoutDetail` unchanged out of `sheets.jsx`, replacing `close()` in the delete handler with `onDeleted && onDeleted()`:

```jsx
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX } from '../lib/exercises.js'
import { fmtDate, fmtNum, fmtVol, durPart } from '../lib/format.js'
import { setLabel } from '../lib/history.js'
import { t, nameFor } from '../lib/i18n.js'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { confirmSheet } from '../sheets.jsx'

// A finished workout: what was done, set by set. Used by the bottom sheet (mobile) and the
// History detail panel (desktop); the caller decides what "deleted" should do next.
export default function WorkoutDetail({ w, onDeleted }) {
  const st = useStore(s => s.S)
  const remove = () => {
    useStore.getState().update(s => { s.workouts = s.workouts.filter(x => x.id !== w.id) })
    useUI.getState().toast(t('Workout deleted'))
    onDeleted && onDeleted()
  }
  return <>
    <h3>{w.name}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{[fmtDate(w.d, true), ...durPart(w.end - w.start), fmtVol(w.vol, st.unit), ...(w.bw ? [fmtNum(w.bw) + ' ' + st.unit] : [])].join(' · ')}</div>
    {w.entries.map((e, i) => {
      const ex = EXIDX[e.id]
      return <div key={i} className="row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
        {ex && <Thumb ex={ex} />}
        <div className="grow"><div className="tt cap1" style={{ fontWeight: 600 }}>{ex ? nameFor(ex) : (e.n || e.id)} {w.prs && w.prs.includes(e.id) && <span className="pr"><Icon name="trophy" />PR</span>}</div>
          <div className="ss">{e.sets.filter(s => s.done).map(s => setLabel(e.id, s, e.target)).join('  ·  ') || t('no sets')}</div></div>
      </div>
    })}
    <Button variant="danger" onClick={() => confirmSheet({ title: t('Delete workout?'), message: t('This removes it from your history for good.'), confirmText: t('Delete'), danger: true, onConfirm: remove })}>{t('Delete workout')}</Button>
  </>
}
```

- [ ] **Step 2: Rewire `sheets.jsx`.** Delete the local `function WorkoutDetail`; add `import WorkoutDetail from './components/WorkoutDetail.jsx'` and `historyWorkoutPath` to the existing `athleteShell.js` import; replace the sheet export and add `openWorkout`:

```jsx
export const workoutDetailSheet = w => ui().openSheet(close => <WorkoutDetail w={w} onDeleted={close} />)
// Desktop shows a finished workout in the History panel; mobile keeps the bottom sheet.
const isDesktopNow = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width:1000px)').matches
export const openWorkout = w => (isDesktopNow() ? nav(historyWorkoutPath(w.id)) : workoutDetailSheet(w))
```
In `Calendar`, replace the two `workoutDetailSheet(ws[0])` / `workoutDetailSheet(w)` calls with `openWorkout(...)`. (The `close(); ...` before them stays, so a desktop pick closes the calendar and navigates.)

- [ ] **Step 3: Use `openWorkout` in Stats.** In `Stats.jsx` import `openWorkout` instead of `workoutDetailSheet`, and change: the Heatmap `onDay` single-workout branch, and the `WorkoutRow` `onClick` in "Recent workouts", to `openWorkout`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test && npm run build`
Expected: all tests pass, build OK. Manual (mobile width 390): Stats → tap a recent workout → sheet opens as before; delete works and closes the sheet.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/WorkoutDetail.jsx frontend/src/sheets.jsx frontend/src/views/Stats.jsx
git commit -m "refactor(history): share WorkoutDetail between sheet and panel; openWorkout picks panel or sheet"
```

---

### Task 3: History as list + detail panel

**Files:**
- Modify: `frontend/src/views/History.jsx`, `frontend/src/App.jsx` (add `<Route path="/history/:id" element={<History />} />` after `/history`)
- Modify: `frontend/src/index.css` (append a section)

**Interfaces:**
- Consumes: `pickWorkout`, `historyWorkoutPath` (Task 1), `WorkoutDetail`, `openWorkout` (Task 2), `WorkoutRow` from `sheets.jsx`, `useIsDesktop`.
- Produces: desktop `/history` and `/history/:id`; selected row gets `.item.sel`.

- [ ] **Step 1: Write the view.** Replace `History.jsx` with:

```jsx
import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, openWorkout } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import WorkoutDetail from '../components/WorkoutDetail.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { pickWorkout } from '../lib/statsPanes.js'
import { historyWorkoutPath } from '../lib/athleteShell.js'

// Mobile: the full list; a row opens the detail sheet.
// Desktop: the list on the left, the selected workout's detail on the right (`/history/:id`;
// with no id the latest workout is shown).
export default function History() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const newest = [...S.workouts].reverse()
  const byId = S.workouts.some(w => w.id === id)
  const selected = desktop ? pickWorkout(S.workouts, id) : null

  // an unknown id (deleted workout, stale link) goes back to the list
  useEffect(() => { if (id && !byId) nav('/history', { replace: true }) }, [id, byId])
  if (id && !desktop) return <Navigate to="/history" replace />   // mobile has no detail screen

  const header = <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
    <div className="grow"><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div></div>
  const empty = <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>

  if (!desktop) return <>
    {header}
    {newest.length ? <div className="list">{newest.map(w => <WorkoutRow key={w.id} w={w} onClick={() => openWorkout(w)} />)}</div> : empty}
  </>

  if (!newest.length) return <>{header}{empty}</>

  return <div className="pane">
    <section className="pane-list" aria-label={t('History')}>
      {header}
      <div className="list">{newest.map(w => <div key={w.id} className={'sel-wrap' + (selected && w.id === selected.id ? ' is-sel' : '')}>
        <WorkoutRow w={w} sel={!!selected && w.id === selected.id} onClick={() => nav(historyWorkoutPath(w.id))} /></div>)}</div>
    </section>
    <section className="pane-detail">
      <ErrorBoundary key={selected.id}>
        {/* after a delete the next-latest workout (or the empty state) takes over via the URL */}
        <WorkoutDetail key={selected.id} w={selected} onDeleted={() => nav('/history', { replace: true })} />
      </ErrorBoundary>
    </section>
  </div>
}
```
Simplify: drop the `sel-wrap` div — instead add an optional `sel` prop to `WorkoutRow` in `sheets.jsx` (`className={'item' + (sel ? ' sel' : '')}`) and render `<WorkoutRow key=… w={w} sel={…} onClick=… />` directly inside `.list`. (The code above shows the intent; use the `sel` prop version, no wrapper div.) Note the header previously used inline `style={{flex:1,marginLeft:12}}`; the `.hdr>.grow` and `.hdr>.iconbtn+.grow` rules already exist in `index.css`, so no inline style is needed.

- [ ] **Step 2: CSS.** Append to `index.css`:

```css
/* ------------------------------------------------ history + stats (desktop) --- */
@media (min-width:1000px){
  /* the detail panel reads like a card: the sheet's own content, on a surface */
  .pane-detail>h3:first-child,.pane-detail h3{margin-top:0}
  .pane-detail .row .tt{overflow-wrap:anywhere}
}
```
(Keep it to what is actually needed after looking at the rendering in Step 4; delete unused rules.)

- [ ] **Step 3: Test the empty-state, stale id and delete flows** (Review Focus items 1–3, 7). Add to `statsPanes.test.js` nothing new (logic is covered by `pickWorkout`); verify in the browser in Step 4.

- [ ] **Step 4: Verify in the browser** (1280px, then 390px; seed a guest with 3+ workouts via localStorage `gym_state_v1`; see memory tooling note):
  - `/#/history` shows the list + the latest workout selected; clicking another row updates the URL and the panel, list scroll position is kept.
  - Delete the selected workout → confirm → panel shows the next latest; delete all → empty state.
  - `/#/history/nope` → redirects to `/#/history`.
  - At 390px, `/#/history/<id>` → redirects to `/#/history`; tapping a row opens the sheet.
  Run: `cd frontend && npm test && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/History.jsx frontend/src/App.jsx frontend/src/sheets.jsx frontend/src/index.css
git commit -m "feat(history): list + workout detail panel on desktop"
```

---

### Task 4: Stats grid and exercise side list

**Files:**
- Modify: `frontend/src/views/Stats.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `filterByQuery` (Task 1), `useIsDesktop`, `SearchField` from `components/ui.jsx` (read its props first: it is a controlled `(value, onChange)` field; use its placeholder prop with an **existing** locale key such as `t('Search')` — grep `locales/es.js` for the exact existing key, and add a new key to every locale only if none fits).
- Produces: desktop Stats layout: tiles → heatmap → `.cols`(Muscle balance | Effort) → `.cols`(Body weight | Recent workouts) → full-width Exercise progress (`.xprog`: `.xprog-list` + `.xprog-main`).

- [ ] **Step 1: Restructure the JSX** (mobile output must stay in the same order it has today: tiles, heatmap, muscle, effort, `.cols`(body weight, exercise progress), recent). Build the cards once as constants (`const bwCard = …`, `const exCard = …`, `const recent = …`, `const muscleCard`, `const effortCard`) and place them with two frames, the way Home does:

```jsx
if (!desktop) return <>{hdr}{tiles}{heat}{muscle}{effort}<div className="cols">{bwCard}{exCard}</div>{recent}</>
return <>
  {hdr}{tiles}{heat}
  {(muscle || effort) && <div className="cols">{muscle}{effort}</div>}
  <div className="cols">{bwCard}{recentCard}</div>
  {exCard}
</>
```
where `recentCard` is the "Recent workouts" block wrapped in `<div className="card">` for desktop (heading `h2` style, `All N` ghost button kept), listing 6 rows in a flex column (`#app .card .list` is flex column — add that rule in CSS), and `recent` is the existing unwrapped markup for mobile. Both render `WorkoutRow` with `onClick={() => openWorkout(w)}`. `muscle`/`effort` are `null` when not applicable (same conditions as today).

- [ ] **Step 2: Exercise progress card, desktop variant.** Add `const [q, setQ] = useState('')` and `const shown = filterByQuery(exHist, q, id => nameFor(EXIDX[id]))`. In the desktop card replace the `SelectRow` block by:

```jsx
<div className="xprog">
  <div className="xprog-list">
    <SearchField value={q} onChange={setQ} placeholder={t('Search')} />
    <div className="xprog-opts" role="listbox" aria-label={t('Exercise progress')}>
      {shown.length ? shown.map(id => <button key={id} role="option" aria-selected={id === curEx}
        className={'xprog-opt cap1' + (id === curEx ? ' sel' : '')} onClick={() => setExId(id)}>{nameFor(EXIDX[id])}</button>)
        : <div className="muted small">{t('No results')}</div>}
    </div>
  </div>
  <div className="xprog-main">{/* metric Segmented, chart, last sessions, captions: the existing JSX, unchanged */}</div>
</div>
```
Mobile keeps `SelectRow`. Typing never clears `exId` (Review Focus 4). Use existing locale keys for 'Search' / 'No results' (grep first; if either is missing add it to all `locales/*.js`).

- [ ] **Step 3: CSS** (append to the section from Task 3, all inside `@media (min-width:1000px)` unless noted):

```css
  .xprog{display:grid;grid-template-columns:240px minmax(0,1fr);column-gap:var(--sp-5);align-items:start}
  .xprog-list{display:flex;flex-direction:column;gap:var(--sp-2);min-width:0}
  .xprog-opts{display:flex;flex-direction:column;gap:2px;max-height:360px;overflow-y:auto}
  .xprog-opt{
    min-height:44px;padding:var(--sp-2) var(--sp-3);border-radius:var(--r);text-align:left;
    color:var(--label-2);font-size:15px;overflow-wrap:anywhere;
    transition:background var(--fast),color var(--fast);
  }
  .xprog-opt:hover{background:var(--surface-2)}
  .xprog-opt.sel{background:var(--surface-2);color:var(--label);box-shadow:inset 3px 0 0 var(--acc)}
  .xprog-main{min-width:0}
  #app .card .list{display:flex;flex-direction:column}
```
Because `.xprog-opt` is a `<button>`, the global `button` hit-target/`:focus-visible` rules apply; check the focus ring is not clipped by `overflow-y:auto` (deferred minor in plan 4 — if clipped, add `padding:2px` to `.xprog-opts`).

- [ ] **Step 4: Verify in the browser** (1280 and 1440, dark and light, accents `lime` and `violet`; seed 20+ workouts including a timed and a cardio exercise and some rated sets so Effort shows):
  - Grid layout as described; with no rated sets, Muscle balance alone occupies the left half.
  - Search "sent" filters the list; the chart keeps the previously selected exercise; clearing the field restores the list.
  - Heatmap: click a day with one workout → URL `#/history/<id>` with that workout selected; day with two → calendar sheet → pick one → panel.
  - 390px: identical to before (screenshot compare to main, `SelectRow` sheet still used).
  - Zero workouts: no Recent card, empty exercise copy intact.
  Run: `cd frontend && npm test && node scripts/check-locales.mjs && npm run build` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Stats.jsx frontend/src/index.css frontend/src/locales
git commit -m "feat(stats): desktop card grid and searchable exercise list"
```

---

### Task 5: Docs and close-out

**Files:**
- Modify: `CLAUDE.md` (§5.4 table: add `.xprog*`; §6: `/history` row now "Desktop: list + detail panel (`/history/:id`)", `/stats` row mentions the grid)
- Modify: memory `opengym-athlete-desktop.md` (mark plan 5 done + deferred minors)

- [ ] **Step 1:** Update `CLAUDE.md` as above; add `athleteShell.js` mention of `historyWorkoutPath` and `statsPanes.js` to the structure list.
- [ ] **Step 2:** Run `cd frontend && npm test && node scripts/check-locales.mjs && npm run build`; Expected: all PASS, tests ≥ 332 + the new ones.
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: desktop Stats and History in CLAUDE.md"
```

---

## Self-review

- **Spec coverage:** 4 tiles (existing `.tiles` 4-col), heatmap full width (existing card), Muscle balance | Effort (Task 4), Body weight | recent workouts + full-width Exercise progress (deviation, stated), searchable side list (Task 4), SelectRow kept on mobile (Task 4), History list + detail panel instead of sheet (Task 3), mobile unchanged (redirects + `openWorkout`).
- **Placeholders:** none; the only "look it up" items are the existing locale key names for 'Search' / 'No results' and the `SearchField` props, flagged where used.
- **Type consistency:** `filterByQuery`, `pickWorkout`, `historyWorkoutPath`, `WorkoutDetail({ w, onDeleted })`, `openWorkout(w)`, `WorkoutRow({ w, onClick, sel })` are used with the same names throughout.
- **Review Focus coverage:** items 1–3 and 7 verified in Task 3 Step 4; item 4 by `filterByQuery` tests plus Task 4 Step 4; item 5 in Task 4 Step 4; item 6 by the `pickWorkout`/`filterByQuery` tests.
