# Athlete desktop experience — design

Date: 2026-10-09
Status: draft for review
Related: `2026-10-07-coach-desktop-panel-design.md` (coach desktop shell, merged — this reuses its patterns)

## Goal

Today the athlete area at ≥1000px is the mobile layout stretched: `#app` capped at 1080px, a
generic `.cols` two-column grid, a 520px floating tab bar, a floating rest timer. Only the coach
area has a real desktop layout.

Make the athlete experience **first-class on desktop, including training**. The user decides on
which device to train (laptop, desktop, landscape tablet); no screen may be a "phone only" screen.

Success criteria:

1. A full workout (start → log sets → rest timer → finish) is comfortable on a ≥1000px screen,
   with mouse or touch (hit targets ≥44px).
2. Every athlete screen has a layout designed for ≥1000px, not a stretched phone layout.
3. Mobile (<1000px) is **unchanged**.
4. Dark + light, all 8 accents, all 12 languages keep working.

## Decisions (from brainstorming)

- Scope: all athlete screens, workout included. Coach screens are already done.
- Navigation: **fixed sidebar** (option A), same pattern as `CoachSidebar`. Floating pill tab bar is
  mobile-only.
- Breakpoint stays **1000px** (existing). Tablet portrait (<1000px) keeps the mobile layout; landscape
  tablets and laptops get desktop.
- Non-goals: no new dependencies, no change to `lib/`, `store/`, `api/` logic, no new data, no
  embedded routine editor in the panel (editor stays a full page, as for the coach), no keyboard
  shortcut layer, no Capacitor-specific work.

## Shell

`AthleteShell` wraps the athlete routes at ≥1000px; below that it renders only the routes (tab bar stays).

- **`AthleteSidebar`** (`.cside` family, generalised so coach and athlete share the classes; width
  `--side-w` 240px):
  - brand;
  - main: Home · Plan · Stats · Exercises;
  - **Start / Resume** as `.btn.primary` (orange dot while a workout is active); same start logic as
    `TabBar.startWorkout`;
  - secondary: Program · History · Profile · Settings (today these are hidden behind icon buttons);
  - foot: "Panel coach" when `user.coach`, "Admin" when `user.admin`.
- `TabBar` returns `null` at ≥1000px for the athlete too (coach branch already does).
- **Rest/work timer**: `RestTimer` docks to the sidebar foot on desktop (pure CSS positioning, no
  portal), so it is visible on every screen. On `/workout` with an active session the global instance
  hides and the same component renders `inline` in the session rail (larger).
- `#app` on desktop: `.ashell` grid (`sidebar | main`). `main` content is centred with
  `--page-w` (reading width, 720px) or `--wide-w` (dashboards, ~1200px) per screen, instead of the
  1080px cap. Coach desktop (`.cdesk`) is untouched.
- Nav model lives in a pure module `lib/athleteShell.js` (items, `activeAthleteTab(pathname)`;
  `/plan/r/*` → Plan, `/history` → Stats, `/settings|profile|program` → their own items), mirroring
  `lib/coachShell.js`, with a Vitest test.

## Foundations (sub-project 0)

Design-system additions, all in `index.css` (new commented sections), documented in CLAUDE.md §5:

- Tokens: `--page-w`, `--wide-w`; a spacing scale `--sp-1…--sp-8` (4/8/12/16/20/24/32/40) — the
  known debt "no spacing scale".
- Layout primitives: `.ashell`, `.amain`, `.dgrid` (12-col-ish grid with `.span-*` helpers or the
  `.cols-2-1` / `.cols-1-1` presets), `.pane` master–detail (reusing `.cgrid/.cmaster/.cdetail`
  generalised), `.stack` / `.row-gap` utilities to replace ad-hoc margins.
- Inline-style cleanup is done **only for the screens being touched**, converting ad-hoc margins and
  size overrides to classes/variants (`.iconbtn.sm`, `.tag.warn` already exists, `.big.sm`, etc.).
- `ExerciseDetail` content extracted from `exerciseDetailSheet` (sheets.jsx) into a component used
  by both the sheet and the Library panel — one source of truth.

## Screens

### Workout (highest priority)

Three zones at ≥1000px: sidebar | current exercise | **session rail**.

- **Centre**: media left / set table right when width allows (stacked otherwise); same
  `ExerciseBlock`, `toggle`, `setField`, supersets, timed sets, progression line — logic untouched,
  only container markup and classes change. Larger steppers (≥44px targets) for touch.
- **`SessionRail`** (new): elapsed clock + progress bar, outline of every exercise/superset/section
  with sets done (`3/4`), current one highlighted, click to jump (`update(s => s.active.cur = …)` as
  Prev/Next do today), the inline rest timer, Finish and Discard. The outline comes from a pure helper
  `sessionOutline(active)` in `lib/` with a Vitest test (unit status: pending/current/done, superset
  grouping, section headers).
- **`StartChooser`**: today's routine as a hero card (left), other routines in a grid (right),
  Freestyle below.
- The live-presence heartbeat and wake-lock are untouched.

### Home

`wide` dashboard, 2:1 grid. Left: week strip + "Today" (bigger) and the body-weight card with the
chart. Right: streak, setup/welcome cards. Week navigation and sheets unchanged.

### Plan, RoutineEdit, Program

- **Plan**: master–detail. Left: week schedule + routines list. Right: selected routine summary
  (exercises, muscles preview, "Edit", assigned-by-coach tag). Routes mirror the coach: on desktop
  `/plan/r/:id` is the summary and the editor moves to `/plan/r/:id/editar`; on mobile `/plan/r/:id`
  redirects to the editor, so the mobile flow is unchanged.
- **RoutineEdit**: stays a full page, two columns on desktop (sections/exercises | muscle preview and
  actions).
- **Program**: blocks list left, `BlockPreview` right, replacing the mobile "list OR preview" toggle.

### Stats and History

Stats on a `wide` grid: 4 tiles; heatmap full width; Muscle balance | Effort; Body weight | Exercise
progress; recent workouts as a grid. Exercise progress gets a searchable side list of exercises on
desktop (the `SelectRow` sheet stays on mobile). History: wider list + workout detail panel instead of
a sheet.

### Library

Master–detail: search + chips + list left, `ExerciseDetail` panel right (media, instructions, "add to
routine"). Mobile keeps the detail sheet.

### Settings, Profile, Login

- **Settings**: two panes — category list left, grouped sections right (reuses `<Section>/<Row>`).
- **Profile**: centred form at `--page-w`.
- **Login**: centred card; no structural change beyond width/spacing.

### Sheets / dialogs

Stay sheets (640px bottom sheet, 340px centre). Revisit only if a screen above replaces a sheet with a
panel.

## States and errors

- Empty states (no routines, no workouts, no profile) keep their current copy, laid out inside the
  panel.
- Viewport crossing 1000px mid-session: the URL and store decide the content; `useIsDesktop` only
  changes presentation. A workout in progress must not reset on resize.
- Active workout + navigating elsewhere on desktop: the sidebar Start/Resume dot and the docked timer
  keep it visible.
- Accessibility: `<nav aria-label>` + `aria-current`, `:focus-visible`, `aria-label` on icon-only
  buttons, `prefers-reduced-motion` respected, session outline items are buttons.
- i18n: all new visible strings via `t()`; reuse existing keys (Home, Plan, Stats, Exercises, Start,
  Resume, Settings, Program, History, Profile…) wherever they exist; new keys added to **all**
  `locales/*.js` and verified with `node scripts/check-locales.mjs`. Long German/Russian/Hindi labels
  must wrap; no fixed label widths. Coach and Admin labels stay literal (Spanish / English).

## Testing

- Vitest (pure logic): `lib/athleteShell.js` (`activeAthleteTab`, items by role), `sessionOutline`.
  Existing suites keep passing.
- Visual (Playwright at 1280 and 1440, plus 390 for the mobile no-regression check): each touched
  screen in dark and light and two accents; Workout at 1280 with a superset and a timed exercise.
- Manual end-to-end per sub-project: for Workout, start → log sets → rest timer → finish → completed
  sheet; for Plan/Library, create and edit a routine from desktop.
- Commands: `cd frontend && npm test`, `node scripts/check-locales.mjs`, `npm run build`.

## Rollout / sub-projects

Each is independently shippable. After #1 every screen already works inside the new shell using its
existing layout (centred at the wide width), so later sub-projects are pure improvements.

| # | Sub-project | Priority |
|---|---|---|
| 0 | Foundations (tokens, primitives, `ExerciseDetail` extraction) | Required first |
| 1 | Athlete shell (sidebar, docked timer, TabBar mobile-only) | Required second |
| 2 | Workout + StartChooser + SessionRail | Max |
| 3 | Home | High |
| 4 | Plan, RoutineEdit, Program | High |
| 5 | Stats, History | High |
| 6 | Library | Medium |
| 7 | Settings, Profile, Login | Medium |
| 8 | QA and close-out (themes, accents, languages, docs in CLAUDE.md §5/§6) | Last |

## Risks

- `sheets.jsx` (~120 inline styles) holds the exercise-detail content; extracting `ExerciseDetail`
  touches a big file — keep the change surgical and covered by the existing sheet behaviour.
- Fixed-position timer docking must not collide with the sidebar scroll or the coach shell.
- `body.resting` bottom padding is mobile-only; desktop must not inherit it.
- Master–detail routes for Plan add URLs; mobile must keep its current navigation (redirect rule like
  `/coach/rutinas/:id`).
