# Athlete Desktop — Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Exercises screen a ≥1000px layout: search + chips + list on the left, the selected exercise's detail (media, tags, best, add-to-plan, 1RM, instructions) in a panel on the right. Mobile (<1000px) stays unchanged (detail sheet).

**Architecture:** Same list + detail pattern as Plan and History: nested route `/library/:id`, `.pane > .pane-list + .pane-detail`, `useIsDesktop()` picks the layout. The sheet's `ExerciseDetail` is exported from `sheets.jsx` and rendered in the panel, so there is one source of truth. An `openExercise(ex)` helper chooses panel (desktop → navigate) or sheet (mobile) for the callers that live on the Library screen. The Workout screen's "Details" button keeps opening the sheet on purpose (you must not leave a workout in progress).

**Tech Stack:** React 19, React Router 7 (HashRouter), Zustand, Vitest, one plain CSS file. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (section "Library"; "Foundations" mentions extracting `ExerciseDetail`).

**Ruling carried in the plan:** the spec says to extract `ExerciseDetail` into a component file. It depends on two things that live privately in `sheets.jsx` (`OneRM`, `deleteCustomEx`), so moving it would drag half of that file along (the spec's own risk note: "keep the change surgical"). Instead it is **exported in place** and gains small, optional props. If wrong, the cost is one later file move.

## Global Constraints

- Mobile (<1000px) unchanged: tapping a row opens the detail sheet; `/library/:id` redirects to `/library`.
- No new dependencies; no native `<select>`/checkbox/range; no emoji icons.
- No changes to the logic of `lib/` or `store/` beyond `libraryExercisePath`.
- Visual changes through classes/tokens in `frontend/src/index.css`; no new inline styles in code this plan writes (existing inline styles may stay; the cleanup is plan 8).
- Dark + light, 8 accents; hit targets ≥44px; text must wrap (12 languages).
- All visible strings through `t()`; this plan needs **no new keys** (reuse `No match`, `Search…`, etc.). If one turns out to be needed, add it to all `locales/*.js` and run `node scripts/check-locales.mjs`.
- Commands from `frontend/`: `npm test`, `node scripts/check-locales.mjs`, `npm run build`.
- Do not open `exercises-data.js`, `body-paths.js`, `instr/*`, `names/*`.

## Review Focus

- The selected exercise is filtered out by the search or chips: the panel keeps showing it (selection must not depend on the filtered list).
- `/library/:id` with an unknown id: redirect to `/library`; on mobile `/library/:id` redirects to `/library`.
- A custom exercise is deleted while selected: panel falls back (URL cleaned), no crash. Editing a custom exercise from the panel does not deselect it and the panel shows the new name.
- "Create your own exercise" on desktop selects the new exercise in the panel (not a stacked sheet).
- Zero matches: the list shows "No match" and the panel shows an empty state instead of crashing on a null selection.
- The selected exercise sits beyond the first 40 rows ("Show more" not pressed): panel still shows it.
- `Workout` → "Details" still opens the sheet on desktop.

---

## File Structure

- Modify `frontend/src/lib/athleteShell.js` (+ test) — `libraryExercisePath`.
- Modify `frontend/src/sheets.jsx` — export `ExerciseDetail`, optional `close`, `.exd` wrappers, `openExercise`.
- Modify `frontend/src/App.jsx` — route `/library/:id`.
- Modify `frontend/src/views/Library.jsx` — desktop panes.
- Modify `frontend/src/index.css` — Library desktop section.
- Modify `CLAUDE.md` §5.4/§6; memory.

---

### Task 1: Plumbing — path helper, shareable `ExerciseDetail`, `openExercise`, route

**Files:**
- Modify: `frontend/src/lib/athleteShell.js`, `frontend/src/lib/athleteShell.test.js`
- Modify: `frontend/src/sheets.jsx` (`ExerciseDetail` ~287–311)
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Produces: `libraryExercisePath(id) -> '/library/' + id`.
- Produces: `export function ExerciseDetail({ ex, close })` — `close` is now **optional**: when given (sheet), Edit closes the sheet before opening the form; when absent (panel), Edit just opens the form and Delete passes `undefined` as `afterDelete`.
- Produces: `openExercise(ex)` — desktop (`matchMedia('(min-width:1000px)')`) → `nav(libraryExercisePath(ex.id))`, else `exerciseDetailSheet(ex)`.
- Consumes: `isDesktopNow` already defined in `sheets.jsx` (added in plan 5, next to `openWorkout`).

- [ ] **Step 1: Write the failing test** — append to `athleteShell.test.js` (and add `libraryExercisePath` to its import):

```js
describe('libraryExercisePath', () => {
  it('builds the detail route, which stays in the Library section', () => {
    expect(libraryExercisePath('0313')).toBe('/library/0313')
    expect(activeAthleteTab(libraryExercisePath('0313'))).toBe('library')
    expect(athleteSectionKey('/library/0313')).toBe(athleteSectionKey('/library'))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/lib/athleteShell.test.js`
Expected: FAIL (`libraryExercisePath` is not exported).

- [ ] **Step 3: Implement.** In `athleteShell.js`:
```js
// Library: on desktop /library/:id is the selected exercise's detail panel.
export const libraryExercisePath = id => '/library/' + id
```
In `sheets.jsx`: import `libraryExercisePath` with the other `athleteShell.js` names; change `function ExerciseDetail({ ex, close })` to `export function ExerciseDetail({ ex, close })`; make the custom-exercise buttons tolerate a missing `close`:
```jsx
<Button icon="pencil" style={{ flex: 1 }} onClick={() => { close && close(); customExSheet(ex) }}>{t('Edit')}</Button>
<Button variant="danger" icon="trash" style={{ flex: 1 }} onClick={() => deleteCustomEx(ex, close)}>{t('Delete')}</Button>
```
Wrap the content in two blocks so desktop can lay them out side by side (blocks are plain `display:block` on mobile, so the sheet is unchanged):
```jsx
return <>
  <h3 className="cap1">{nameFor(ex)}</h3>
  <div className="exd">
    <div className="exd-media">
      <Media ex={ex} />
      {/* the tags row and the .exnote description, unchanged */}
    </div>
    <div className="exd-main">
      {/* best line, Add to my plan, custom edit/delete row, OneRM, How-to list: unchanged */}
    </div>
  </div>
</>
```
After the `exerciseDetailSheet` export add:
```jsx
// Desktop shows an exercise in the Library panel; mobile keeps the bottom sheet.
export const openExercise = ex => (isDesktopNow() ? nav(libraryExercisePath(ex.id)) : exerciseDetailSheet(ex))
```
Make sure `isDesktopNow` is declared **above** its first use at module level or only used inside functions (it is a `const` arrow used inside a function, so order does not matter at call time).

In `App.jsx` add after the `/library` route: `<Route path="/library/:id" element={<Library />} />`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run src/lib/athleteShell.test.js && npm test && npm run build`
Expected: PASS, build OK. Manual at 390px: Exercises → tap a row → sheet identical to before (media, tags, Add to my plan, 1RM, instructions); a custom exercise's Edit/Delete still work.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/athleteShell.js frontend/src/lib/athleteShell.test.js frontend/src/sheets.jsx frontend/src/App.jsx
git commit -m "refactor(library): export ExerciseDetail for the desktop panel; openExercise picks panel or sheet"
```

---

### Task 2: Library as list + detail panel

**Files:**
- Modify: `frontend/src/views/Library.jsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: `ExerciseDetail`, `openExercise` (Task 1), `libraryExercisePath`, `useIsDesktop`, `ErrorBoundary`, `allExercises`.
- Produces: desktop `/library` and `/library/:id`; selected row has `.item.sel`.

- [ ] **Step 1: Rewrite the view.** Keep the existing filtering code (`ql`, `base`, `eqOpts`, `eqOn`, `f`) exactly as is. Changes:

1. Imports: add `useEffect`; `Navigate, useNavigate, useParams` from `react-router-dom`; `ExerciseDetail, openExercise` from `../sheets.jsx` (drop `exerciseDetailSheet` from the import if unused); `useIsDesktop`; `libraryExercisePath`; `ErrorBoundary`.
2. Selection (desktop only; **independent of the filter**, so filtering never clears the panel):
```jsx
const nav = useNavigate()
const { id } = useParams()
const desktop = useIsDesktop()
const all = allExercises(S)
const byId = id ? all.find(e => e.id === id) : null
const selected = desktop ? (byId || f[0] || null) : null
useEffect(() => { if (id && !byId) nav('/library', { replace: true }) }, [id, !!byId])
if (id && !desktop) return <Navigate to="/library" replace />   // mobile has no detail screen
```
(Hooks go before the early return; the `useEffect` must be declared before `if (id && !desktop) return …`.)
3. Build the header, search, chips and list once (as constants `header`, `controls`, `listEl`), then place them with two frames:
```jsx
const pick = e => (desktop ? nav(libraryExercisePath(e.id)) : openExercise(e))
// row: className={'item' + (selected && e.id === selected.id ? ' sel' : '')} onClick={() => pick(e)}
// "Create your own exercise": customExSheet(null, ex => openExercise(ex), q.trim())
```
```jsx
if (!desktop) return <>{header}{controls}{listEl}{more}</>
return <div className="pane">
  <section className="pane-list lib-list" aria-label={t('Exercises')}>{header}{controls}{listEl}{more}</section>
  <section className="pane-detail">
    <ErrorBoundary key={selected ? selected.id : 'none'}>
      {selected
        ? <ExerciseDetail key={selected.id} ex={selected} />
        : <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
    </ErrorBoundary>
  </section>
</div>
```
The inner "Plan" button on each row keeps `ev.stopPropagation(); addToRoutineSheet(e)`.

- [ ] **Step 2: CSS.** Append:
```css
/* ------------------------------------------------------ library (desktop) --- */
@media (min-width:1000px){
  /* 340px is too narrow for a horizontally scrolling chip strip with a mouse: wrap instead */
  .lib-list .chips{flex-wrap:wrap;overflow:visible}
  .pane-detail .exmedia{margin-bottom:var(--sp-3)}
}
/* media + tags on the left, numbers and instructions on the right once the panel has room */
@container (min-width:760px){
  .exd{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:var(--sp-5);align-items:start}
  .exd>*{min-width:0}
}
```
(`.exd-media`/`.exd-main` stay plain blocks everywhere; delete any rule you end up not needing after looking at the rendering.)

- [ ] **Step 3: Verify in the browser** (1280 and 1440, dark and light, accents `lime` and `violet`; seed with the demo state: `import('/src/lib/demoSeed.js')` from the page, `buildDemoState()`, store it in `localStorage.gym_state_v1`, set `gym_guest=1`):
  - `/#/library` shows the list with the first exercise selected and its detail; clicking another row changes URL and panel, list scroll is kept.
  - Type in the search so the selected exercise is filtered out: the panel keeps it. Search for nonsense: "No match" in the list **and** in the panel, no crash.
  - Body-part and equipment chips wrap inside the 340px list.
  - "Create your own exercise": create "Test X" → it becomes the selected exercise in the panel. Edit it from the panel: still selected, new name shown. Delete it: confirm → URL goes back to `/library`.
  - `/#/library/nope` → `/#/library`.
  - 390px: `/#/library/<id>` redirects to `/#/library`; tapping a row opens the sheet; no horizontal scroll; the Workout screen's Details button (start a freestyle workout, add an exercise) opens the sheet at desktop width too.
  Run: `cd frontend && npm test && node scripts/check-locales.mjs && npm run build` → all PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Library.jsx frontend/src/index.css
git commit -m "feat(library): list + exercise detail panel on desktop"
```

---

### Task 3: Docs and close-out

**Files:**
- Modify: `CLAUDE.md` (§6 `/library` row; §5.4 "Paneles lista + detalle" mention `.exd`; structure list: `openExercise`/`ExerciseDetail` exported from `sheets.jsx`)

- [ ] **Step 1:** Update `CLAUDE.md`: `/library` row → "Desktop ≥1000px: búsqueda + chips + lista a la izquierda y detalle del ejercicio (`/library/:id`) a la derecha; en mobile `/library/:id` redirige y la fila abre el sheet. `openExercise(ex)` decide panel vs sheet; el botón Detalles del Workout sigue abriendo el sheet."
- [ ] **Step 2:** Run `cd frontend && npm test && node scripts/check-locales.mjs && npm run build` → PASS.
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: desktop Library in CLAUDE.md"
```

---

## Self-review

- **Spec coverage:** search + chips + list left, `ExerciseDetail` panel right (media, instructions, "add to routine") → Task 2; mobile keeps the sheet → Tasks 1–2; single source of truth for the detail → Task 1 (exported in place, ruled above).
- **Placeholders:** none; the "unchanged" comments in Task 1 mark JSX that is moved as-is inside the new wrappers.
- **Type consistency:** `libraryExercisePath`, `ExerciseDetail({ ex, close? })`, `openExercise(ex)` are used with the same names in both tasks.
- **Review Focus coverage:** items 1, 3–6 verified in Task 2 Step 3; item 2 in Task 2 Step 3 (redirects); item 7 in Task 2 Step 3 last bullet (and by leaving `Workout.jsx` untouched).
