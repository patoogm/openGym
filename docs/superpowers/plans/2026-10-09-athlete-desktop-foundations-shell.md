# Athlete Desktop — Foundations + Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the athlete area a real desktop frame at ≥1000px — fixed sidebar, no floating tab bar, rest timer docked in the sidebar — without changing mobile.

**Architecture:** The athlete shell reuses the coach shell's classes (`.cshell/.cside/.cside-i/.cmain`) and adds a content frame (`.amain-in`), spacing/width tokens, and a docked timer, all in `index.css`. Navigation data and the "should the shell show" decision live in a pure module `lib/athleteShell.js` (Vitest). `App.jsx` renders the shell when `showAthleteShell(...)` is true; `TabBar` returns `null` on desktop.

**Tech Stack:** React 19, React Router 7 (HashRouter), Zustand, plain CSS (`frontend/src/index.css`), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (sub-projects 0 and 1 of its rollout table).

**Plans that follow (each written right before it is executed, because they build on this shell):**
2 Workout + SessionRail · 3 Home · 4 Plan/RoutineEdit/Program · 5 Stats/History · 6 Library (+ `ExerciseDetail` extraction) · 7 Settings/Profile/Login · 8 QA and close-out.

**Deviations from the spec (decided while planning):**
- `ExerciseDetail` extraction moves to plan 6 (Library) — it has no consumer before that, and it touches the large `sheets.jsx`.
- `/history` is its own sidebar item (the spec's "`/history` → Stats" mapping was for the mobile tab bar, which has no History tab).
- "Orange dot while a workout is active" becomes the Start button turning into **Resume** with a play icon (same signal the mobile tab bar already uses).

## Global Constraints

- Breakpoint is **1000px** (`useIsDesktop`, `@media (min-width:1000px)`). Below it, nothing changes.
- **No new dependencies.** No emoji as icons. No native `<select>`/checkbox/range.
- Visual changes go through **tokens and classes in `index.css`**; no new inline `style={{}}`.
- Dark and light must both work; `--on-acc` is not touched; all 8 accents keep working.
- Hit targets ≥44px. `prefers-reduced-motion` and `:focus-visible` respected. Icon-only buttons need `aria-label`.
- Every visible string goes through `t('English source')`. **This plan adds no new keys** (it reuses `Home`, `Plan`, `Stats`, `Exercises`, `Start`, `Resume`, `Settings`, `Program`, `History`, `Training profile`). Coach/Admin labels stay literal. `node scripts/check-locales.mjs` must still pass.
- Do not touch `lib/` logic other than adding `athleteShell.js`, nor `store/`, `api/`.
- Do not open `lib/exercises-data.js`, `lib/body-paths.js`, `instr/*`, `names/*`.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Guest/demo session** (`user` is `null`, `isGuest()` true): the sidebar must render and navigate without reading `user.coach` on `null`.
2. **Resize across 1000px mid-workout**: an active workout (in the store) must survive switching between mobile and desktop frames, and the route must stay the same.
3. **Timer docked + `body.resting`**: while a rest/work timer runs, the sidebar's bottom items stay reachable and page content is not padded by the mobile `250px` rule on desktop.
4. **Coach user visiting athlete screens** (`/home` as coach): athlete sidebar shows "Panel coach"; `/coach/*` still gets only the coach sidebar (never two sidebars).
5. **Odd paths**: `/`, `/plan/`, `/plan/r/xyz`, `/workout/extra`, `/constructor`, `/coach/x`, `''` must not throw and must map to a sensible tab or `null`.
6. **Long labels** (German/Russian/Hindi) in the 240px sidebar wrap or ellipsize without breaking the row.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/lib/athleteShell.js` | Create | Pure: nav item lists, `activeAthleteTab`, `athleteFooter`, `showAthleteShell` |
| `frontend/src/lib/athleteShell.test.js` | Create | Vitest for the above |
| `frontend/src/index.css` | Modify | Spacing/width tokens; share shell classes with the athlete; `.amain-in`; docked timer; `body.resting` desktop fix |
| `frontend/src/components/useStartWorkout.js` | Create | Hook: the "Start / Resume" action shared by `TabBar` and the sidebar |
| `frontend/src/components/AthleteSidebar.jsx` | Create | Desktop navigation for the athlete area |
| `frontend/src/components/TabBar.jsx` | Modify | Use the hook; return `null` on desktop |
| `frontend/src/App.jsx` | Modify | Render the athlete shell when `showAthleteShell` |
| `CLAUDE.md`, spec file | Modify | Document tokens/shell; record the deviations |

---

### Task 1: Pure shell logic (`lib/athleteShell.js`)

**Files:**
- Create: `frontend/src/lib/athleteShell.js`
- Test: `frontend/src/lib/athleteShell.test.js`

**Interfaces:**
- Consumes: `isCoachPath(pathname)` from `./coachShell.js`.
- Produces (used by Tasks 3–4):
  - `ATHLETE_TABS`, `ATHLETE_MORE`: `Array<{ k: string, icon: string, to: string, label: string }>` (labels are English `t()` keys)
  - `activeAthleteTab(pathname: string): string | null`
  - `athleteFooter(user: object | null): Array<{ k, icon, to, label }>`
  - `showAthleteShell(pathname: string, desktop: boolean, authed: boolean): boolean`

- [ ] **Step 1: Create the branch**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git switch -c feat/athlete-desktop
```
Expected: `Switched to a new branch 'feat/athlete-desktop'`. (`docs/agent-import/` stays untracked; do not add it.)

- [ ] **Step 2: Write the failing test**

Create `frontend/src/lib/athleteShell.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { ATHLETE_TABS, ATHLETE_MORE, activeAthleteTab, athleteFooter, showAthleteShell } from './athleteShell.js'

describe('nav lists', () => {
  it('have unique keys and routes, and the main tabs mirror the mobile tab bar', () => {
    const all = [...ATHLETE_TABS, ...ATHLETE_MORE]
    expect(new Set(all.map(i => i.k)).size).toBe(all.length)
    expect(new Set(all.map(i => i.to)).size).toBe(all.length)
    expect(ATHLETE_TABS.map(i => i.to)).toEqual(['/home', '/plan', '/stats', '/library'])
    expect(ATHLETE_MORE.map(i => i.to)).toEqual(['/program', '/history', '/profile', '/settings'])
  })
})

describe('activeAthleteTab', () => {
  it('maps each section, including nested routes', () => {
    expect(activeAthleteTab('/home')).toBe('home')
    expect(activeAthleteTab('/')).toBe('home')
    expect(activeAthleteTab('')).toBe('home')
    expect(activeAthleteTab('/plan')).toBe('plan')
    expect(activeAthleteTab('/plan/')).toBe('plan')
    expect(activeAthleteTab('/plan/r/abc')).toBe('plan')
    expect(activeAthleteTab('/workout')).toBe('workout')
    expect(activeAthleteTab('/workout/extra')).toBe('workout')
    expect(activeAthleteTab('/stats')).toBe('stats')
    expect(activeAthleteTab('/history')).toBe('history')
    expect(activeAthleteTab('/library')).toBe('library')
    expect(activeAthleteTab('/program')).toBe('program')
    expect(activeAthleteTab('/profile')).toBe('profile')
    expect(activeAthleteTab('/settings')).toBe('settings')
    expect(activeAthleteTab('/admin')).toBe('admin')
  })
  it('returns null for the coach area and for unknown or hostile paths', () => {
    expect(activeAthleteTab('/coach')).toBe(null)
    expect(activeAthleteTab('/coach/x')).toBe(null)
    expect(activeAthleteTab('/nope')).toBe(null)
    expect(activeAthleteTab('/constructor')).toBe(null)
    expect(activeAthleteTab('/__proto__')).toBe(null)
    expect(activeAthleteTab(undefined)).toBe('home')
  })
})

describe('athleteFooter', () => {
  it('is empty without a user (guest/demo) and for plain athletes', () => {
    expect(athleteFooter(null)).toEqual([])
    expect(athleteFooter(undefined)).toEqual([])
    expect(athleteFooter({ name: 'a' })).toEqual([])
  })
  it('offers the coach panel and admin by role', () => {
    expect(athleteFooter({ coach: true }).map(i => i.to)).toEqual(['/coach'])
    expect(athleteFooter({ admin: true }).map(i => i.to)).toEqual(['/admin'])
    expect(athleteFooter({ coach: true, admin: true }).map(i => i.k)).toEqual(['coach', 'admin'])
  })
})

describe('showAthleteShell', () => {
  it('needs desktop, a session, and a non-coach path', () => {
    expect(showAthleteShell('/home', true, true)).toBe(true)
    expect(showAthleteShell('/workout', true, true)).toBe(true)
    expect(showAthleteShell('/home', false, true)).toBe(false)
    expect(showAthleteShell('/home', true, false)).toBe(false)
    expect(showAthleteShell('/coach', true, true)).toBe(false)
    expect(showAthleteShell('/coach/rutinas/r1', true, true)).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/lib/athleteShell.test.js`
Expected: FAIL — cannot resolve `./athleteShell.js`.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/lib/athleteShell.js`:

```js
// Pure logic for the athlete desktop shell (sidebar at ≥1000px). Labels are English `t()` keys
// except the coach/admin footer, which keep their documented literal copy.
import { isCoachPath } from './coachShell.js'

// Main destinations — the same four the mobile tab bar has (Start is a button, not a tab).
export const ATHLETE_TABS = [
  { k: 'home', icon: 'house', to: '/home', label: 'Home' },
  { k: 'plan', icon: 'calendar', to: '/plan', label: 'Plan' },
  { k: 'stats', icon: 'chart', to: '/stats', label: 'Stats' },
  { k: 'library', icon: 'list', to: '/library', label: 'Exercises' }
]

// Reachable only through Settings / icon buttons on mobile; first-class items on desktop.
export const ATHLETE_MORE = [
  { k: 'program', icon: 'clipboard', to: '/program', label: 'Program' },
  { k: 'history', icon: 'history', to: '/history', label: 'History' },
  { k: 'profile', icon: 'person', to: '/profile', label: 'Training profile' },
  { k: 'settings', icon: 'gear', to: '/settings', label: 'Settings' }
]

const SECTION = {
  '': 'home', home: 'home', plan: 'plan', workout: 'workout', stats: 'stats', history: 'history',
  library: 'library', program: 'program', profile: 'profile', settings: 'settings', admin: 'admin'
}

// First path segment decides the section; anything unknown (including the coach area) is null.
export function activeAthleteTab(pathname) {
  const seg = String(pathname || '').split('/')[1] || ''
  return Object.prototype.hasOwnProperty.call(SECTION, seg) ? SECTION[seg] : null
}

// Role-based links under the nav; safe for guests (user is null).
export function athleteFooter(user) {
  const out = []
  if (user && user.coach) out.push({ k: 'coach', icon: 'person', to: '/coach', label: 'Panel coach' })
  if (user && user.admin) out.push({ k: 'admin', icon: 'shield', to: '/admin', label: 'Admin' })
  return out
}

// The coach area has its own shell; the athlete shell covers every other signed-in route.
export const showAthleteShell = (pathname, desktop, authed) => !!desktop && !!authed && !isCoachPath(pathname)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/athleteShell.test.js`
Expected: PASS (all tests).

- [ ] **Step 6: Commit (spec + plan + logic)**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add docs/superpowers/specs/2026-10-09-athlete-desktop-design.md docs/superpowers/plans/2026-10-09-athlete-desktop-foundations-shell.md frontend/src/lib/athleteShell.js frontend/src/lib/athleteShell.test.js
git commit -m "feat(athlete): pure shell logic for the desktop sidebar, plus spec and plan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tokens, shared shell classes, docked timer (CSS only)

**Files:**
- Modify: `frontend/src/index.css` (tokens block ~line 20–63; coach desktop section ~line 960–1004; append a new section at the end)

**Interfaces:**
- Consumes: existing `.cshell/.cside/.cside-i/.cmain/#app.cdesk` rules and `--side-w`.
- Produces (used by Tasks 3–4 and later plans): tokens `--sp-1…--sp-8`, `--page-w`, `--wide-w`; classes `.ashell`, `.amain`, `.amain-in`, `#app.adesk`, `.cside-sec`; docked `#timer` at ≥1000px.

- [ ] **Step 1: Add the tokens**

In the `:root` block, after the `--icon-stroke:1.7;` line, insert:

```css
  /* spacing scale — use these instead of ad-hoc 6/10/14/18px margins */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-7:32px; --sp-8:40px;

  /* desktop content widths: reading column vs dashboards */
  --page-w:720px; --wide-w:1200px;
```

(Edit with old_string `  --icon-stroke:1.7;\n\n  /* motion */` → same line plus the new block before the blank line + `/* motion */`.)

- [ ] **Step 2: Share the coach shell classes with the athlete**

In the coach desktop section make these three exact replacements:

| old | new |
|---|---|
| `  #app.cdesk{max-width:none;margin:0;padding:0}` | `  #app.cdesk,#app.adesk{max-width:none;margin:0;padding:0}` |
| `  .cshell{display:grid;grid-template-columns:var(--side-w) minmax(0,1fr);min-height:100vh}` | `  .cshell,.ashell{display:grid;grid-template-columns:var(--side-w) minmax(0,1fr);min-height:100vh}` |
| `  .cmain{min-width:0}` | `  .cmain,.amain{min-width:0}` |

- [ ] **Step 3: Append the athlete section at the end of `index.css`**

```css

/* ------------------------------------------------- athlete desktop shell --- */
/* The athlete area shares the coach shell's grid and sidebar classes (.cshell/.ashell, .cside,
   .cside-i); what is new is the content frame, a sidebar group divider, and the rest/work
   timer docked in the sidebar so it is visible on every screen. */
@media (min-width:1000px){
  .amain-in{max-width:var(--wide-w);margin:0 auto;padding:22px 28px calc(40px + var(--sab))}
  .amain-in.vfade{animation:viewfade var(--med) var(--ease)}
  .cside-sec{margin-top:var(--sp-4);padding-top:var(--sp-2);border-top:var(--hair) solid var(--sep)}
  .cside-i .grow{overflow-wrap:anywhere}

  /* the mobile "keep the timer scrollable-past" padding must not leak into the desktop shells */
  body.resting #app.cdesk,body.resting #app.adesk{padding-bottom:0}

  /* docked timer: bottom of the sidebar, same width as its items */
  #timer{
    left:var(--sp-3);right:auto;margin-left:0;bottom:calc(var(--sp-3) + var(--sab));
    width:calc(var(--side-w) - 2 * var(--sp-3));flex-wrap:wrap;gap:var(--sp-2);
  }
  #timer.rest{flex-direction:column;align-items:stretch;gap:10px}
  #timer.rest .head{flex:none}
  #timer.working .grow{flex:1 1 100%;order:3}
  /* leave room under the last sidebar item so the timer never covers it */
  body.resting .cside{padding-bottom:calc(180px + var(--sab))}
}
```

- [ ] **Step 4: Verify nothing broke**

Run: `cd frontend && npm run build`
Expected: build succeeds (CSS has no compile step, so this catches only syntax-level issues in the bundle; visual check happens in Task 4).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/index.css
git commit -m "style(athlete): spacing/width tokens, shared shell classes, docked timer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `useStartWorkout` hook, `AthleteSidebar`, `TabBar` desktop-hidden

**Files:**
- Create: `frontend/src/components/useStartWorkout.js`
- Create: `frontend/src/components/AthleteSidebar.jsx`
- Modify: `frontend/src/components/TabBar.jsx`

**Interfaces:**
- Consumes: `startFlow` from `../sheets.jsx`; `effectiveRoutine` (`../lib/history.js`), `todayISO` (`../lib/format.js`), `countEx` (`../lib/routine.js`); Task 1 exports.
- Produces: `useStartWorkout(): () => void`; `<AthleteSidebar />` (no props).

- [ ] **Step 1: Create the hook (moves `TabBar`'s existing logic verbatim)**

`frontend/src/components/useStartWorkout.js`:

```js
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { startFlow } from '../sheets.jsx'

// The "Start / Resume" action: with no session running and a routine planned for today, begin
// it (after the body-weight prompt); otherwise open the Workout screen (resume, or the chooser).
export function useStartWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  return () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && countEx(r.ex)) { startFlow(r.id); return }
    }
    nav('/workout')
  }
}
```

- [ ] **Step 2: Create the sidebar**

`frontend/src/components/AthleteSidebar.jsx`:

```jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { ATHLETE_TABS, ATHLETE_MORE, activeAthleteTab, athleteFooter } from '../lib/athleteShell.js'
import { useStartWorkout } from './useStartWorkout.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Desktop navigation for the athlete area (replaces the floating tab bar at ≥1000px).
// Same classes as CoachSidebar, so the two read as one family.
export default function AthleteSidebar() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const user = useStore(s => s.user)
  const training = useStore(s => !!s.S.active)
  const start = useStartWorkout()
  const cur = activeAthleteTab(pathname)
  const footer = athleteFooter(user)

  const item = tab => <button key={tab.k} type="button"
    className={'cside-i' + (cur === tab.k ? ' on' : '')}
    aria-current={cur === tab.k ? 'page' : undefined} onClick={() => nav(tab.to)}>
    <Icon name={tab.icon} /><span className="grow">{t(tab.label)}</span>
  </button>

  return <nav className="cside" aria-label="openGym">
    <div className="brand">openGym</div>
    {ATHLETE_TABS.map(item)}
    <Button variant="primary" icon={training ? 'play' : 'dumbbell'} onClick={start}>
      {training ? t('Resume') : t('Start')}
    </Button>
    <div className="cside-sec">{ATHLETE_MORE.map(item)}</div>
    {footer.length > 0 && <div className="cside-foot">{footer.map(item)}</div>}
  </nav>
}
```

- [ ] **Step 3: Refactor `TabBar` to use the hook and hide on desktop**

In `frontend/src/components/TabBar.jsx`:

1. Replace the imports block's `effectiveRoutine`, `todayISO`, `countEx` lines with the hook import. The imports become:

```jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { COACH_TABS, activeCoachTab, isCoachPath } from '../lib/coachShell.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { openAssignSheet } from './AssignSheet.jsx'
import { useStartWorkout } from './useStartWorkout.js'
import Icon from './Icon.jsx'
```

2. Change the signature `export default function TabBar({ onStart }) {` to `export default function TabBar() {`.
3. After `const desktop = useIsDesktop()` add `const startWorkout = useStartWorkout()`.
4. Delete the old `const startWorkout = () => { ... }` block.
5. Replace `  if (coachMode && desktop) return null   // CoachSidebar replaces the bar` with:

```jsx
  if (desktop) return null   // CoachSidebar / AthleteSidebar replace the bar at ≥1000px
```

(The line `const coachMode = ...` and `const activeCoach = ...` stay above it.)

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds. (`App.jsx` still passes `onStart` to `TabBar`; React ignores the extra prop until Task 4 removes it.)

- [ ] **Step 5: Run the suite**

Run: `cd frontend && npm test`
Expected: all existing tests plus `athleteShell` pass.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/components/useStartWorkout.js frontend/src/components/AthleteSidebar.jsx frontend/src/components/TabBar.jsx
git commit -m "feat(athlete): sidebar component; tab bar is mobile-only

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the shell into `App.jsx` and verify in the browser

**Files:**
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `showAthleteShell` (Task 1), `AthleteSidebar` (Task 3), classes from Task 2.
- Produces: the working athlete desktop frame.

- [ ] **Step 1: Update imports**

In `App.jsx`:
- Remove the line `import { startFlow } from './sheets.jsx'`.
- After `import { homePathFor, isCoachPath } from './lib/coachShell.js'` add:

```jsx
import { showAthleteShell } from './lib/athleteShell.js'
import AthleteSidebar from './components/AthleteSidebar.jsx'
```

- [ ] **Step 2: Replace the render block**

Replace everything from `const coachOnly = ...` through the end of the `return (...)` of `Shell` (lines 72–115 before editing) with:

```jsx
  const coachOnly = el => (user?.coach ? el : <Navigate to="/home" replace />)
  // On desktop the coach area is one persistent shell: a stable key keeps it (and its student
  // polling) mounted while navigating between coach screens. Elsewhere #app re-keys per route.
  const coachDesk = desktop && !!user?.coach && isCoachPath(loc.pathname)
  // Same idea for the athlete area: the sidebar stays mounted, only the content frame re-keys.
  const athleteDesk = showAthleteShell(loc.pathname, desktop, authed)

  const routes = (
    <Routes>
      <Route path="/home" element={<Home />} />
      <Route path="/plan" element={<Plan />} />
      <Route path="/plan/r/:id" element={<RoutineEdit />} />
      <Route path="/workout" element={<Workout />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/history" element={<History />} />
      <Route path="/library" element={<Library />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/program" element={<Program />} />
      <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
      <Route element={coachOnly(<CoachShell />)}>
        <Route path="/coach" element={<Coach />} />
        <Route path="/coach/alumno/:id" element={<Coach />} />
        <Route path="/coach/rutinas" element={<CoachRoutines />} />
        <Route path="/coach/rutinas/:id" element={<CoachRoutines />} />
        <Route path="/coach/rutinas/:id/editar" element={<RoutineEdit />} />
        <Route path="/coach/actividad" element={<CoachActivity />} />
      </Route>
      <Route path="*" element={<Navigate to={homePathFor(user)} replace />} />
    </Routes>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar / sidebar is always a way out */}
      <div id="app" className={'vfade' + (coachDesk ? ' cdesk' : '') + (athleteDesk ? ' adesk' : '')}
        key={coachDesk ? 'coach-desktop' : athleteDesk ? 'athlete-desktop' : loc.pathname}>
        {athleteDesk
          ? <div className="ashell">
            <AthleteSidebar />
            <main className="amain">
              <div className="amain-in vfade" key={loc.pathname}><ErrorBoundary>{routes}</ErrorBoundary></div>
            </main>
          </div>
          : <ErrorBoundary>{!authed ? <Login /> : routes}</ErrorBoundary>}
      </div>
      <TabBar />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}
```

- [ ] **Step 3: Build and run tests**

Run: `cd frontend && npm run build && npm test`
Expected: both succeed.

- [ ] **Step 4: Start the app**

Run (background): `cd /c/Users/patog/Desktop/my-projects/openGym && npm run dev` and wait for `http://localhost:5173`.

- [ ] **Step 5: Browser check — desktop, guest session**

With Playwright (or a browser) at **1280×800**: open `http://localhost:5173/#/home`, choose the guest ("invitado") entry on Login, then confirm:
1. A 240px sidebar is on the left; no floating tab bar; content centered, not capped at 1080px.
2. Clicking Home / Plan / Stats / Exercises / Program / History / Training profile / Settings changes the route and highlights exactly one item (`aria-current="page"`); the sidebar does **not** flicker or remount between routes.
3. The "Panel coach" / "Admin" footer is absent for a guest, and there are no console errors.
4. **Start** on a day with no routine opens `/workout` (chooser); after loading the starter plan (Home → "Load starter plan") Start asks for body weight then begins; the button now reads **Resume** with a play icon.

- [ ] **Step 6: Browser check — mobile unchanged**

Resize to **390×844** (same session): floating tab bar is back at the bottom with Home / Plan / Start / Stats / Exercises; no sidebar; layouts identical to before. Resize back to 1280 with the workout still running: the session is still active (Review Focus 2) and the route did not change.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/App.jsx
git commit -m "feat(athlete): render the desktop shell with the sidebar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Timer docking and visual QA (themes, accents, long labels)

**Files:**
- Modify (only if a defect is found): `frontend/src/index.css` (the Task 2 athlete section)

**Interfaces:**
- Consumes: the running app from Task 4.
- Produces: confirmation of Review Focus 3 and 6, plus theme/accent coverage.

- [ ] **Step 1: Rest timer**

At 1280×800 with a workout running (`/workout`), tick a set so the rest timer appears. Confirm: it sits at the bottom-left inside the sidebar width, shows clock + bar + `−15s / +15s / Skip` fully visible; "Settings" (the last item of the sidebar) remains clickable above it; the page content has **no** large bottom padding (the `250px` mobile rule is overridden). Click Skip: timer disappears and the sidebar bottom padding returns to normal.

- [ ] **Step 2: Work timer**

Add/choose a timed exercise (e.g. a plank), press its ▶: the working timer shows the clock, Cancel and Done, and the exercise-name + bar wrap to a full-width row without overflowing the 216px dock. If any control clips or overlaps, adjust the `#timer.working` rules in the athlete section (for example `#timer.working .t{min-width:0}`), re-check, and note the change.

- [ ] **Step 3: Themes and accents**

Toggle light/dark (Settings → theme) and cycle accents `lime`, `sky`, `orange`, `pink`: the sidebar active row (`--surface-2`), the primary Start button text (`--on-acc`) and the docked timer remain legible in all combinations.

- [ ] **Step 4: Long labels**

Set the language to German then Russian (Settings → language): the sidebar items ("Trainingsprofil", "Тренировочный профиль", etc.) wrap or break inside the row without widening the sidebar or hiding the icon.

- [ ] **Step 5: Role checks (Review Focus 4)**

A real coach session needs the API with `COACH_UIDS`, so check this with Playwright `page.route` mocks (as in the coach desktop work): mock `/api/me` → `{ name: 'x', coach: true }`, `/api/data`, and `/api/coaching/*`. Confirm: on `#/home` the sidebar footer shows "Panel coach" and it navigates to `#/coach`; on `#/coach` only the coach sidebar renders (exactly one `nav.cside` in the DOM). Then stop the dev servers (`npm run dev` background task).

- [ ] **Step 6: Commit any CSS fixes**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/index.css
git diff --cached --quiet || git commit -m "fix(athlete): timer dock and label polish from visual QA

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Expected: no commit if nothing needed changing.)

---

### Task 6: Documentation and close-out

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md`

- [ ] **Step 1: Record the new design-system pieces in `CLAUDE.md`**

In §5.2 after the `**Geometría**` line add:

```
**Spacing y anchos (desktop)**: `--sp-1…--sp-8` (4/8/12/16/20/24/32/40px) para márgenes y gaps nuevos; `--page-w` 720px (columna de lectura) y `--wide-w` 1200px (dashboards).
```

In §5.5, after the line `- Transición entre vistas: \`.vfade\` (fade + 4px).` add:

```
- **Shell del atleta (≥1000px)**: `AthleteSidebar` (clases `.cside*` compartidas con el coach) + `.amain-in` (contenido centrado a `--wide-w`); la tab bar es solo mobile. El timer de descanso/serie se acopla al pie del sidebar. Lógica pura en `lib/athleteShell.js`. Spec: `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md`.
```

In §4 (estructura), in the `components/` list add `AthleteSidebar` next to `CoachSidebar`, and under `lib/` add `athleteShell.js` next to `coachShell.js`.

In §7 "Deuda de diseño conocida", append to the spacing bullet: ` (ya existe la escala \`--sp-*\`; falta migrar los inline existentes pantalla por pantalla)`.

- [ ] **Step 2: Record the deviations in the spec**

In `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md`:
- Foundations bullet about `ExerciseDetail`: append ` — moved to the Library plan (sub-project 6), its first consumer.`
- Shell nav-model sentence: change `` `/history` → Stats `` to `` `/history` → its own item``.
- Shell bullet "Start / Resume … (orange dot while a workout is active)": replace the parenthetical with `(turns into Resume with a play icon while a workout is active)`.

- [ ] **Step 3: Full verification**

Run:

```bash
cd /c/Users/patog/Desktop/my-projects/openGym/frontend
npm test
node scripts/check-locales.mjs
npm run build
```
Expected: tests pass; `N locales, M keys each — in sync.`; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add CLAUDE.md docs/superpowers/specs/2026-10-09-athlete-desktop-design.md
git commit -m "docs: athlete desktop shell tokens and deviations

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off**

Leave the branch `feat/athlete-desktop` unmerged and ask the user whether to continue with plan 2 (Workout) on the same branch or merge this shell first.

---

## Self-review notes

- **Spec coverage:** shell/sidebar, TabBar mobile-only, docked timer, tokens, layout classes, pure nav module + tests, documentation are all tasks above. Not in this plan by design: `ExerciseDetail` (plan 6), Workout inline timer/`SessionRail` (plan 2), per-screen layouts (plans 2–7), final QA across all screens (plan 8).
- **Type consistency:** `ATHLETE_TABS/MORE` items `{k, icon, to, label}`; `athleteFooter` items use the same shape so `AthleteSidebar.item` renders all three lists; `showAthleteShell(pathname, desktop, authed)` matches its single call in `App.jsx`.
- **Known interim state:** between Task 4 and plan 2 the Workout screen shows inside the shell with its current mobile-like layout and the global docked timer; the session rail arrives in plan 2.
