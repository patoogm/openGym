# Athlete Desktop — Settings, Profile, Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At ≥1000px, Settings becomes two panes (category list on the left, that category's grouped sections on the right), Profile becomes a centred form at the reading width, and Login becomes a centred card. Mobile (<1000px) is unchanged.

**Architecture:** Settings keeps its JSX but hoists each `<Section>` into a named constant; mobile renders them all in today's order, desktop groups them into five categories and renders one at a time. The category is in the URL (`/settings/:cat`, same list + detail pattern as Plan, History and Library), validated by a small pure helper with tests. Profile and Login only need classes and CSS.

**Tech Stack:** React 19, React Router 7 (HashRouter), Zustand, Vitest, one plain CSS file. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (section "Settings, Profile, Login").

## Global Constraints

- Mobile (<1000px) unchanged: same sections, same order, same markup; `/settings/:cat` redirects to `/settings`.
- No new dependencies; no native `<select>`/checkbox/range; no emoji icons.
- No changes to the logic of `lib/` or `store/`; the only new `lib` file is the pure helper below.
- Visual changes through classes/tokens in `frontend/src/index.css`; no new inline styles in code this plan writes (existing inline styles may stay; the cleanup is plan 8).
- Dark + light, 8 accents; hit targets ≥44px; text must wrap (12 languages).
- All visible strings through `t()`. This plan needs **no new keys**: category labels reuse `Account`, `Your data`, `Demo`, `Training`, `General`, `Notifications`, `Data` which already exist. If one turns out to be missing, add it to all `locales/*.js` and run `node scripts/check-locales.mjs`.
- Commands from `frontend/`: `npm test`, `node scripts/check-locales.mjs`, `npm run build`.

## Review Focus

- `/settings/notifications` for a guest on the web (no `user`, not `MOBILE`): that category does not exist there, so the URL must redirect to `/settings`, not render an empty pane.
- Unknown `/settings/<junk>` redirects to `/settings`; on mobile any `/settings/:cat` redirects to `/settings`.
- The two hidden `<input type="file">` (backup and app import) must be mounted whatever category is open: the Data rows call `fileRef.current.click()`, so a missing input would crash on click.
- Sign out / sign out everywhere / reset flows still end on `/home` and nothing reads a category that no longer exists afterwards.
- Changing language, theme or accent inside Settings re-renders the pane with the new labels and does not reset the selected category.
- Login: demo build variant and the "passkeys not supported" variant both render inside the card; long German/Russian strings wrap; mobile look is identical (the old inline `wrap` style becomes a class with the same values).
- Settings opened by a signed-in coach/admin: Admin dashboard row still works from the Account pane.

---

## File Structure

- Create `frontend/src/lib/settingsPanes.js` (+ `settingsPanes.test.js`) — categories and URL validation.
- Modify `frontend/src/views/Settings.jsx` — hoist sections, desktop panes.
- Modify `frontend/src/App.jsx` — route `/settings/:cat`.
- Modify `frontend/src/views/Profile.jsx`, `frontend/src/views/Login.jsx`.
- Modify `frontend/src/index.css` — three small sections.
- Modify `CLAUDE.md`; memory.

---

### Task 1: Settings categories helper

**Files:**
- Create: `frontend/src/lib/settingsPanes.js`, `frontend/src/lib/settingsPanes.test.js`

**Interfaces:**
- Produces: `settingsCats({ notifications }) -> [{ k, icon, label }]` — always `account`, `training`, `general`, `data`, plus `notifications` only when the flag is true; fixed order `account, training, general, notifications, data`. Labels are English `t()` keys: `'Account'`, `'Training'`, `'General'`, `'Notifications'`, `'Data'`.
- Produces: `resolveCat(cat, cats) -> { key, valid }` — `key` is `cat` when it is one of `cats`, else `'account'`; `valid` is `true` when `cat` is empty/undefined or one of `cats` (so `/settings` is valid, `/settings/junk` is not).
- Produces: `settingsCatPath(k) -> '/settings/' + k`.

- [ ] **Step 1: Write the failing test** — `settingsPanes.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { settingsCats, resolveCat, settingsCatPath } from './settingsPanes.js'

describe('settingsCats', () => {
  it('has a fixed order and hides Notifications unless available', () => {
    expect(settingsCats({ notifications: false }).map(c => c.k)).toEqual(['account', 'training', 'general', 'data'])
    expect(settingsCats({ notifications: true }).map(c => c.k)).toEqual(['account', 'training', 'general', 'notifications', 'data'])
  })
  it('gives every category an icon and a label', () => {
    for (const c of settingsCats({ notifications: true })) {
      expect(typeof c.icon).toBe('string')
      expect(c.label.length).toBeGreaterThan(0)
    }
  })
})

describe('resolveCat', () => {
  const cats = settingsCats({ notifications: false })
  it('treats no category as the first one and valid', () => {
    expect(resolveCat(undefined, cats)).toEqual({ key: 'account', valid: true })
    expect(resolveCat('', cats)).toEqual({ key: 'account', valid: true })
  })
  it('accepts a listed category', () => {
    expect(resolveCat('data', cats)).toEqual({ key: 'data', valid: true })
  })
  it('flags a category that is unknown or not available here', () => {
    expect(resolveCat('junk', cats)).toEqual({ key: 'account', valid: false })
    expect(resolveCat('notifications', cats)).toEqual({ key: 'account', valid: false })
  })
})

describe('settingsCatPath', () => {
  it('builds the route', () => expect(settingsCatPath('data')).toBe('/settings/data'))
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/lib/settingsPanes.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `settingsPanes.js`:

```js
// Pure helpers for the desktop Settings panes. Labels are English `t()` keys.
const CATS = [
  { k: 'account', icon: 'personCircle', label: 'Account' },
  { k: 'training', icon: 'dumbbell', label: 'Training' },
  { k: 'general', icon: 'gear', label: 'General' },
  { k: 'notifications', icon: 'bell', label: 'Notifications' },
  { k: 'data', icon: 'folder', label: 'Data' }
]

// Notifications only exists where there is something to configure (signed in, or the native app).
export const settingsCats = ({ notifications }) => CATS.filter(c => c.k !== 'notifications' || notifications)

// `valid` is false for a category that is unknown or not offered here, so the view can redirect.
export function resolveCat(cat, cats) {
  if (!cat) return { key: cats[0].k, valid: true }
  const ok = cats.some(c => c.k === cat)
  return { key: ok ? cat : cats[0].k, valid: ok }
}

export const settingsCatPath = k => '/settings/' + k
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run src/lib/settingsPanes.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/settingsPanes.js frontend/src/lib/settingsPanes.test.js
git commit -m "feat(settings): category list and URL validation for the desktop panes"
```

---

### Task 2: Settings as category list + detail

**Files:**
- Modify: `frontend/src/views/Settings.jsx`, `frontend/src/App.jsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: `settingsCats`, `resolveCat`, `settingsCatPath` (Task 1), `useIsDesktop`, `Navigate`/`useParams`.
- Produces: desktop `/settings` and `/settings/:cat`; mobile output identical to today.

- [ ] **Step 1: Hoist the sections.** In `Settings.jsx`, keep every `<Section>` exactly as it is but assign each to a constant before the `return`, in this order, with these names (the JSX inside is **moved, not edited**):

| constant | today's lines | notes |
|---|---|---|
| `account` | the Account/Your data/Demo `<Section>` **plus** the guest-mode `<p className="sect-f">` | one fragment |
| `training` | `Training` section | |
| `general` | `General` section | |
| `workout` | `During a workout` section | |
| `notifications` | `{(user \|\| MOBILE) && <NotificationsCard …/>}` | `null` when not available |
| `appearance` | `Appearance` section | |
| `data` | `Data` section | |
| `tip` | `{!MOBILE && <Section title={t('Tip')}>…}` | |
| `footer` | the final "openGym · free & open source" `<div>` | |

The two hidden file inputs (`fileRef`, `importRef`) are **not** part of `data`: keep them in the component body as `const inputs = <>…</>` and render them in both layouts, so the refs always exist.

- [ ] **Step 2: Lay them out.** Add imports (`Navigate`, `useParams` from `react-router-dom`; `useIsDesktop`; the three helpers) and:

```jsx
const { cat } = useParams()
const desktop = useIsDesktop()
const cats = settingsCats({ notifications: !!(user || MOBILE) })
const { key, valid } = resolveCat(cat, cats)
useEffect(() => { if (cat && !valid) nav('/settings', { replace: true }) }, [cat, valid])
if (cat && !desktop) return <Navigate to="/settings" replace />   // mobile has no category screen
```
(`useEffect` is already imported; the hooks go **before** the early return.)

Mobile return — the same header and order as today:
```jsx
if (!desktop) return <div className="narrow">
  {/* existing header with the back button */}
  {account}{training}{general}{workout}{notifications}{appearance}{data}{inputs}{tip}{footer}
</div>
```
Desktop return:
```jsx
const panes = { account: <>{account}</>, training: <>{training}{workout}</>, general: <>{general}{appearance}</>, notifications: <>{notifications}</>, data: <>{data}{tip}</> }
const label = c => (c.k === 'account' ? (MOBILE ? t('Your data') : DEMO ? t('Demo') : t('Account')) : t(c.label))
return <div className="pane pane-cats">
  <section className="pane-list" aria-label={t('Settings')}>
    <div className="hdr"><div className="grow"><h1>{t('Settings')}</h1></div></div>
    <div className="list">{cats.map(c => <button key={c.k} className={'item' + (c.k === key ? ' sel' : '')}
      aria-current={c.k === key ? 'page' : undefined} onClick={() => nav(settingsCatPath(c.k))}>
      <span className="lrow-i"><Icon name={c.icon} /></span>
      <div className="grow"><div className="tt">{label(c)}</div></div><Icon name="chevronRight" className="chev" />
    </button>)}</div>
  </section>
  <section className="pane-detail">{panes[key]}{inputs}{footer}</section>
</div>
```
(The desktop header has no back button: the sidebar already goes everywhere.) In `App.jsx` add `<Route path="/settings/:cat" element={<Settings />} />` after `/settings`.

- [ ] **Step 3: CSS.** Append:

```css
/* ----------------------------------------------- settings panes (desktop) --- */
@media (min-width:1000px){
  .pane.pane-cats{grid-template-columns:240px minmax(0,1fr)}
  .pane-cats .pane-detail{max-width:var(--page-w)}
  .pane-cats .pane-detail .sect:first-child{margin-top:0}
  /* the category rows are <button class="item">: keep them left-aligned and full width */
  .pane-cats .pane-list .item{width:100%;text-align:left}
}
```

- [ ] **Step 4: Verify in the browser** (1280 and 1440, dark and light, accents `lime` and `violet`; demo state via `import('/src/lib/demoSeed.js')` + `localStorage.gym_state_v1` + `gym_guest=1`; the guest has no `user`, so Notifications must be absent):
  - `/#/settings` shows the category list with Account selected and the Account pane; clicking each category changes URL and pane; the selected row is highlighted and has `aria-current`.
  - Training shows Training + During a workout; General shows General + Appearance; Data shows Data + Tip; the app footer shows at the bottom of every pane.
  - Change language, theme and accent: the pane relabels/re-themes and stays on the same category.
  - Data: "Export backup" and "Import backup" (file chooser opens) work: the inputs exist in every pane (`document.querySelectorAll('input[type=file]').length === 2`).
  - `/#/settings/notifications` (guest) → `/#/settings`; `/#/settings/junk` → `/#/settings`.
  - 390px: `/#/settings/data` → `/#/settings`; the page is the single scrolling column in the original order with the back button; no horizontal scroll.
  Run: `cd frontend && npm test && node scripts/check-locales.mjs && npm run build` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.jsx frontend/src/App.jsx frontend/src/index.css
git commit -m "feat(settings): category list + sections panel on desktop"
```

---

### Task 3: Profile at reading width, Login as a card

**Files:**
- Modify: `frontend/src/views/Profile.jsx`, `frontend/src/views/Login.jsx`, `frontend/src/index.css`

**Interfaces:**
- Produces: `.narrow.page` (Profile, centred at `--page-w` inside the athlete shell) and `.login` (the Login wrapper; same look as today's inline `wrap` on mobile, a centred card on desktop).

- [ ] **Step 1: Profile.** Change the wrapper to `<div className="narrow page">` and the header title block `<div style={{ flex: 1, marginLeft: 10 }}>` to `<div className="grow">` (the `.hdr>.iconbtn+.grow` rule already gives it the spacing; mobile margin changes from 10px to 8px, which is the same rule History already uses).

- [ ] **Step 2: Login.** Remove the `wrap` object and use `className="narrow login"` in the three places it was applied (`style={wrap}` is deleted).

- [ ] **Step 3: CSS.** Append:

```css
/* -------------------------------------------- profile + login (desktop) --- */
/* Login: the old inline wrapper, as a class so desktop can turn it into a card. */
.login{display:flex;flex-direction:column;justify-content:center;min-height:78vh;text-align:center}
@media (min-width:1000px){
  .amain-in .narrow.page{max-width:var(--page-w)}
  .narrow.login{
    max-width:440px;min-height:0;margin:12vh auto 0;padding:var(--sp-8) var(--sp-7);
    background:var(--surface);border-radius:var(--r-xl);
  }
  /* the explanatory cards inside the login card sit one step lighter than the card itself */
  .login .card{background:var(--surface-2)}
}
```

- [ ] **Step 4: Verify in the browser.** Profile at 1280: centred 720px form, steppers and chips fine, textareas save on blur. Login: clear `gym_guest`/state and reload at 1280 (card centred, buttons full width inside it, Continue without account works), at 390px (identical look to `main`: compare against a screenshot taken before the change), in dark and light; if possible also with `?` demo flag unavailable in dev, read the demo branch to confirm it uses the same class. Run: `cd frontend && npm test && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Profile.jsx frontend/src/views/Login.jsx frontend/src/index.css
git commit -m "feat(profile,login): reading-width Profile and a centred Login card on desktop"
```

---

### Task 4: Docs and close-out

**Files:**
- Modify: `CLAUDE.md` (§6 `/settings`, `/profile`, `Login` rows; structure list mentions `lib/settingsPanes.js`)

- [ ] **Step 1:** Update `CLAUDE.md`: `/settings` → "Desktop ≥1000px: dos paneles — categorías (Cuenta, Entrenamiento, General, Notificaciones, Datos) a la izquierda y sus secciones a la derecha (`/settings/:cat`); mobile igual que antes y `/settings/:cat` redirige"; `/profile` → "formulario centrado a `--page-w`"; Login → "tarjeta centrada en desktop (`.login`)".
- [ ] **Step 2:** Run `cd frontend && npm test && node scripts/check-locales.mjs && npm run build` → PASS.
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: desktop Settings, Profile and Login in CLAUDE.md"
```

---

## Self-review

- **Spec coverage:** Settings two panes with `<Section>/<Row>` (Task 2); Profile centred form at `--page-w` (Task 3); Login centred card with no structural change (Task 3); mobile unchanged (Tasks 2–3 mobile branches and redirects).
- **Placeholders:** none; Task 2 Step 1 moves existing JSX verbatim and names every constant and its source.
- **Type consistency:** `settingsCats`, `resolveCat`, `settingsCatPath` and the category keys `account|training|general|notifications|data` are used identically in Tasks 1 and 2.
- **Review Focus coverage:** items 1–3 and 5 are verified in Task 2 Step 4 (plus Task 1 tests for the URL cases); item 4 relies on the unchanged handlers and Task 2 Step 4; item 6 in Task 3 Step 4; item 7 by moving the Account JSX untouched.
