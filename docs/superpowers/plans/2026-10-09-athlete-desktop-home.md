# Athlete Desktop — Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Home a real ≥1000px dashboard: a 2:1 grid with the week strip, "Today" and body weight on the left and the setup/welcome/streak cards on the right — without changing mobile — and retire three known design-debt inline styles on the way.

**Architecture:** `Home.jsx` builds each card once as a constant and renders them in two frames chosen by `useIsDesktop()`: the existing `.narrow` column (original order) on mobile, and `.hdesk` (header + `.hmain` + `.haside`) on desktop. New classes live in `index.css`. No logic changes; sheets, week navigation and the start/resume action are untouched.

**Tech Stack:** React 19, React Router 7, Zustand, plain CSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (sub-project 3, "Home"). Builds on the merged shell (plan 1) and Workout (plan 2).

**Scope note:** only the three debt items CLAUDE.md §7 names as missing variants are converted from inline styles to classes — the iconbtn at 30px, the `.big` at 22px and the orange "Resume" tag. The remaining ad-hoc margins/gaps stay inline: converting them to the spacing scale would change mobile pixel values (6/9/10px are not on the scale) and "mobile unchanged" wins. They move to the QA/cleanup plan (sub-project 8) together with the `Workout.jsx` ones.

## Global Constraints

- Breakpoint **1000px** (`useIsDesktop`, `@media (min-width:1000px)`); below it nothing changes. Mobile card order stays: setup → week → welcome → body weight → streak.
- **No new dependencies.** No emoji as icons. No native form controls.
- Visual changes go through tokens and classes in `index.css`. No **new** inline `style={{}}`.
- Do not touch `lib/`, `store/`, `api/`. No behaviour changes: week navigation, `onToday`, `dayOverrideSheet`, `calendarSheet`, `bwSheet`, `goalSheet`, `loadStarterPlan` stay as they are.
- Dark and light both work; all 8 accents; `--on-acc` untouched. `prefers-reduced-motion` and `:focus-visible` respected; icon-only buttons keep their `aria-label`.
- Every visible string goes through `t()`. **No new keys** (everything reused); `node scripts/check-locales.mjs` must still pass.
- Do not open `lib/exercises-data.js`, `lib/body-paths.js`, `instr/*`, `names/*`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mobile unchanged**: the DOM order of the cards at <1000px is identical to `main`, and the three converted styles render the same pixels (30px icon buttons, 22px welcome title, orange Resume tag without the extra `margin-left`).
2. **Empty states**: brand-new guest (setup + welcome cards, no body weight, no routines), profile set but no program (setup says "Create your first training block"), fully set up (neither card) — the right column is never empty (the streak card is always there) and the left never collapses.
3. **Active workout**: "Today" shows the orange in-progress row and the orange Resume tag; tapping it goes to `/workout`; with a routine it starts; on a rest day it opens the day-override sheet.
4. **Week strip**: ◀ ▶ week navigation, day taps (`dayOverrideSheet`), and the dots (plan/override/done) still work in the wider card; today highlight intact.
5. **Chart width**: the body-weight `LineChart` stretches to the narrower 1000–1100px left column without clipping its axis labels or tooltip.
6. **Long text**: German/Russian greeting ("Hi {0}"), long routine names and goal text wrap inside their cards in both columns.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/index.css` | Modify | `.iconbtn.sm`, `.card .big.sm`, today-row state classes, Resume tag fix, `.hdesk/.hmain/.haside` |
| `frontend/src/views/Home.jsx` | Modify | Cards as constants, two frames, converted styles |
| `CLAUDE.md` | Modify | Document the Home desktop layout and the new variants |

---

### Task 1: CSS — variants and the dashboard grid

**Files:**
- Modify: `frontend/src/index.css` (append one section at the end)

**Interfaces:**
- Consumes: tokens `--sp-*`, `--r`, `--orange`, `--acc`, `--surface-3`; existing `.iconbtn`, `.card .big`, `.today-row`, `.lrow-i`, `.tag.warn`.
- Produces (used by Task 2): `.iconbtn.sm`, `.card .big.sm`, `.today-row .lrow-i.live|.plan|.rest`, `.today-row .tag.warn`, `.hdesk` > `.hdr` + `.hmain` + `.haside`.

- [ ] **Step 1: Append the Home section to `index.css`**

```css

/* ------------------------------------------------------------------- home --- */
/* Variants for what Home used to override inline. */
.iconbtn.sm{width:30px;height:30px;font-size:15px}
.card .big.sm{font-size:22px}
/* the "Today" row's icon square: in progress / planned / rest day */
.today-row .lrow-i.live{background:var(--orange)}
.today-row .lrow-i.plan{background:var(--acc)}
.today-row .lrow-i.rest{background:var(--surface-3)}
/* .tag.warn carries a left margin for use inside lists; the Today row spaces itself */
.today-row .tag.warn{margin-left:0}

/* desktop dashboard: week, Today and body weight on the left; setup/welcome/streak on the right */
@media (min-width:1000px){
  .hdesk{
    display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);
    grid-template-areas:"hdr hdr" "main aside";column-gap:var(--sp-6);align-items:start;
  }
  .hdesk>.hdr{grid-area:hdr}
  .hdesk>.hmain{grid-area:main;min-width:0}
  .hdesk>.haside{grid-area:aside;min-width:0}
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add docs/superpowers/plans/2026-10-09-athlete-desktop-home.md frontend/src/index.css
git commit -m "style(home): variants for the three inline overrides and the dashboard grid, plus plan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Home.jsx` — cards as constants, two frames

**Files:**
- Modify: `frontend/src/views/Home.jsx` (replace the file)

**Interfaces:**
- Consumes: Task 1 classes; `useIsDesktop` from `../lib/useIsDesktop.js`; everything `Home.jsx` already imports.
- Produces: the same screen; desktop renders `.hdesk` (header + `.hmain` [week, body weight] + `.haside` [setup, welcome, streak]).

- [ ] **Step 1: Replace `frontend/src/views/Home.jsx` with**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
// Each card is built once and placed by one of two frames: the phone column (original order) or,
// at ≥1000px, a two-column dashboard.
export default function Home() {
  const nav = useNavigate()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (routine) startFlow(routine.id); else dayOverrideSheet(todayISO()) }

  const header = <div className="hdr">
    <div><h1>{user ? t('Hi {0}', user.name) : 'openGym'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
    {/* Settings is a sidebar item on desktop */}
    {!desktop && <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>}
  </div>

  const setup = (() => {
    const P = S.profile || {}
    // "Has profile" = a meaningful field is set. NOT Object.keys(P).length: Profile.jsx
    // writes empty-string `limitations`/`notes` on textarea blur, so that would false-positive.
    const hasProfile = !!(P.goal || P.level || P.cardio || P.daysPerWeek != null || P.sessionMin != null || (P.equipment || []).length)
    const hasProgram = !!(S.program?.blocks || []).length
    if (hasProfile && hasProgram) return null
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>{t('Set up your training')}</h2>
        <p className="small dim" style={{ marginTop: 4, marginBottom: 12 }}>
          {hasProfile
            ? t('Create your first training block.')
            : t('Tell us your goal and constraints to build a periodized plan.')}
        </p>
        <Button size="sm" variant="primary" onClick={() => nav(hasProfile ? '/program' : '/profile')}>
          {hasProfile ? t('Go to Program') : t('Set up profile')}
        </Button>
      </div>
    )
  })()

  const week = <div className="card">
    <div className="row between" style={{ marginBottom: 8 }}>
      <button className="iconbtn sm" onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
      <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
      <button className="iconbtn sm" onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
    </div>
    <div className="week">{strip}</div>
    <div className="today-row" onClick={onToday}>
      <div className="row" style={{ gap: 9, minWidth: 0 }}>
        <span className={'lrow-i ' + (S.active ? 'live' : routine ? 'plan' : 'rest')}>
          <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="lbl2">{t('Today')}</div>
          <div className="ttl">{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' · ' + t('rescheduled') : ''}</div>
        </div>
      </div>
      {S.active ? <span className="tag warn">{t('Resume')}</span>
        : routine ? <span className="tag acc">{t('Start')}</span>
        : <Icon name="plus" className="chev" />}
    </div>
  </div>

  const welcome = !S.routines.length && !S.active ? (
    <div className="card">
      <div className="row" style={{ gap: 10, marginBottom: 6 }}>
        <span className="lrow-i"><Icon name="sparkles" /></span>
        <div className="big sm">{t('Welcome!')}</div>
      </div>
      <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
      <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
      <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
    </div>
  ) : null

  const bodyWeight = <div className="card">
    <div className="row between" style={{ marginBottom: 6 }}>
      <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
      <div className="row" style={{ gap: 8 }}>
        <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
        <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
      </div>
    </div>
    {bw ? <>
      <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
        <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
        {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
        {!!delta && (
          <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
            <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
            {fmtNum(Math.abs(delta))}
          </span>
        )}
        <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
      </div>
      {S.targetW && (
        <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
          <Icon name="target" style={{ fontSize: 13 }} />
          <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
        </div>
      )}
      <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={desktop ? 180 : 130} unit={S.unit} goal={S.targetW} /></div>
    </> : <div className="muted small">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
  </div>

  const streak = <div className="card tappable" style={{ cursor: 'pointer' }} onClick={() => calendarSheet()}>
    <div className="row between">
      <div>
        <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
          <Icon name="flame" style={{ color: 'var(--orange)' }} />
          {t('{0} week streak', streakWeeks(S))}
        </div>
        <div className="muted small" style={{ marginTop: 2 }}>{wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}</div>
      </div>
      <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
    </div>
  </div>

  if (desktop) return <div className="hdesk">
    {header}
    <div className="hmain">{week}{bodyWeight}</div>
    <div className="haside">{setup}{welcome}{streak}</div>
  </div>

  return <div className="narrow">
    {header}
    {setup}
    {week}
    {welcome}
    {bodyWeight}
    {streak}
  </div>
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build succeeds; all suites pass (327).

- [ ] **Step 3: Commit**

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add frontend/src/views/Home.jsx
git commit -m "feat(home): desktop dashboard frame; retire three inline overrides

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Browser verification and fixes

**Files:**
- Modify (only if a defect is found): `frontend/src/index.css`, `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: the running app. Produces: confirmation of every Review Focus item.

- [ ] **Step 1: Start the app and capture the baseline**

Run `npm run dev` in the background from the repo root. First capture the mobile baseline from `main`'s behaviour is not needed — instead compare against the code: with Playwright at **390×844**, guest session ("Continuar sin cuenta"), open `#/home` and record the order of top-level cards: `[...document.querySelectorAll('.narrow > .hdr, .narrow > .card')].map(e => e.querySelector('h2')?.innerText || e.className)`. Expected order for a new guest: header, "Configurá tu entrenamiento" (setup), week card (no `h2`), welcome card, "Peso corporal", streak card.

- [ ] **Step 2: Desktop frame (1440 and 1280)**

At **1440×900** (new guest): `.hdesk` grid exists, no gear button in the header, left column holds the week card then body weight, the right column holds setup, welcome and streak (in that order). Take a screenshot and read it: the cards align at the top of their columns, nothing overflows horizontally (`document.documentElement.scrollWidth <= clientWidth`), the week strip is readable at ~700px wide, the chart (180px) fills the card. Repeat at **1280×800** and at **1024×768** (left column ≈ 440px): the chart axis labels and tooltip are not clipped (hover a point after logging two weights via the "Registrar" sheet).

- [ ] **Step 3: States (Review Focus 2 and 3)**

- Load the starter plan: the welcome card disappears, "Today" shows the routine with the green "Empezar" tag; the right column still has the setup card (profile/program not set) and the streak.
- Press Start from the Today row: the body-weight prompt opens; choose "Empezar sin pesarse"; go back to Home via the sidebar: the Today row is the orange in-progress row with the orange "Seguir" tag, and clicking it opens `/workout`.
- Set a profile goal in `#/profile` and create a block in `#/program` so both exist: the setup card disappears and the right column shows only the streak.
- Tap a day in the strip: the day-override sheet opens; ◀ ▶ change the week label.

- [ ] **Step 4: Mobile pixel check and themes (Review Focus 1)**

At 390×844 confirm the card order from step 1 is unchanged, the week nav buttons are 30×30 (`getBoundingClientRect`), the welcome title computes to 22px, the Resume tag has `margin-left: 0px` and the orange look of before (`getComputedStyle(tag).color` is `rgb(255, 159, 10)` in dark). Toggle light theme and accents `lime`, `sky`, `orange`: the Today icon square, tags and chart stay legible (wait ≥300ms after changing the theme before judging colours — transitions are mid-flight right after the change).

- [ ] **Step 5: Long text (Review Focus 6)**

Via `browser_evaluate`, temporarily replace the greeting with a 60-character name and the routine name in the Today row with a 80-character one: both wrap/ellipsize inside their cards at 1280 and 390 with no horizontal overflow. Restore the text afterwards.

- [ ] **Step 6: Clean up and commit fixes**

Stop the dev server (`TaskStop`) and delete `.playwright-mcp` and any screenshots from the repo root.

```bash
cd /c/Users/patog/Desktop/my-projects/openGym
git add -A frontend/src
git diff --cached --quiet || git commit -m "fix(home): desktop polish from visual QA

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Expected: no commit if nothing needed changing. Record each defect as a ledger `Ruling:`.)

---

### Task 4: Documentation and close-out

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document Home in `CLAUDE.md`**

- §5.4 table: add a row `| Home | \`.week\`, \`.today-row\` (\`.lrow-i.live/.plan/.rest\`, \`.tag.warn\`), \`.hdesk\` > \`.hmain\` + \`.haside\` (desktop) | primera pantalla |`; and mention the variants `.iconbtn.sm` and `.card .big.sm` next to the `.iconbtn`/`.card` rows (append `, variante \`.sm\` (30px)` to the Header row text and `, \`.big.sm\` (22px)` to the Card row's `.card .big` mention).
- §6 `/home` row, Contenido column: append ` Desktop ≥1000px: dashboard 2:1 (semana + Hoy + peso a la izquierda; setup/bienvenida/racha a la derecha).`
- §7 "Deuda de diseño conocida": in the bullet about inline styles, change the colour bullet ("Colores de estado armados inline…") to note that the Home Resume tag now uses `.tag.warn`, and append to the first bullet that `.iconbtn.sm` / `.big.sm` now exist (Home migrated).

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
git commit -m "docs: desktop Home and the new variants in CLAUDE.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand off**

Leave `feat/athlete-home-desktop` unmerged and ask the user whether to merge it (local only unless they ask for the push with the `patoogm` token) before plan 4 (Plan, RoutineEdit, Program).

---

## Self-review notes

- **Spec coverage:** 2:1 dashboard with week/Today/weight left and setup/welcome/streak right (Tasks 1–2); chart taller on desktop; Settings gear hidden where the sidebar replaces it; the three debt variants (Task 1–2); docs (Task 4). Remaining inline spacing deliberately deferred (scope note).
- **Type/name consistency:** classes defined in Task 1 (`.iconbtn.sm`, `.card .big.sm`, `.today-row .lrow-i.live|plan|rest`, `.today-row .tag.warn`, `.hdesk`, `.hmain`, `.haside`) are exactly the ones used in Task 2's JSX.
- **Known interim state:** Home is the only screen changed; other screens keep their earlier layouts until their plans.
