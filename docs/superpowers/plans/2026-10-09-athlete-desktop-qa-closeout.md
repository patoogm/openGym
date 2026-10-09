# Athlete Desktop — QA and Close-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the athlete-desktop effort: make the new list rows operable by keyboard, fix the deferred minors from plans 2–7, replace the ad-hoc inline spacing in the touched screens with the `--sp-*` scale, run a themes × accents × languages sweep and fix what it finds, and bring `CLAUDE.md` up to date.

**Architecture:** Five independent, mostly mechanical tasks. The only new logic is a tiny pure helper for keyboard activation (TDD). The inline-style cleanup is a one-off codemod (Python, kept in the scratchpad, not in the repo) that only rewrites styles it fully understands and logs everything else. The QA sweep is a function evaluated in the browser; it reports offenders and the task fixes them with CSS.

**Tech Stack:** React 19, React Router 7 (HashRouter), Zustand, Vitest, one plain CSS file. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md` (rollout row 8: "QA and close-out (themes, accents, languages, docs in CLAUDE.md §5/§6)").

## Global Constraints

- Mobile (<1000px) must look the same. The only allowed visual drift is the spacing snap in Task 4 (≤ 2px per margin), which is ruled below.
- No new dependencies; no native `<select>`/checkbox/range; no emoji icons.
- No changes to the logic of `lib/` or `store/` beyond `lib/a11y.js`.
- Visual changes through classes/tokens in `frontend/src/index.css`.
- Dark + light, all 8 accents (`--on-acc` contrast is already computed: do not change accent values), all 12 languages.
- All visible strings through `t()`; this plan adds no new keys. If one turns out to be needed, add it to all `locales/*.js` and run `node scripts/check-locales.mjs`.
- Commands from `frontend/`: `npm test`, `node scripts/check-locales.mjs`, `npm run build`.

## Rulings carried in the plan

- **Spacing snap (Task 4):** off-scale margins snap to the nearest `--sp-*` step, ties go up: 2→4, 6→8, 10→12, 14→16, 18→20, 22→24, 26→24. Cost if wrong: ≤2px of drift in a few places; reversible by reverting that one commit.
- **`sheets.jsx` and `Admin.jsx` are out of scope for Task 4** (126 and 12 inline styles): the sheets are shared mobile UI that this effort did not redesign, and Admin is operator-only. They stay listed as known debt in `CLAUDE.md`.
- **Not fixed here** (design calls, not defects): `.wchoose` looks half-empty when only Freestyle exists; the minimized exercise GIF still reserves its 5fr column; the viewport crossing 1000px remounts the shell (heartbeat blip) and drops uncommitted input. They stay in the deferred list.

## Review Focus

- A list row that contains an inner button (Library's "Plan" button): pressing Enter/Space on the **inner** button must not also trigger the row.
- Space on a focused row must not scroll the page; Enter/Space on a row inside a text input must not fire.
- `rowProps` applied to a row that is conditionally disabled (`.item.off` in AssignPanel/AssignSheet: handler returns early): keyboard must not bypass the disabled state.
- Codemod safety: a `style` object with a dynamic value, a conditional `className`, or a spread must be left alone, and every skipped site must be listed.
- Deleting a routine from its editor must leave **one** history entry (back button goes to the previous page, not to the deleted routine).
- Settings: `/settings/notifications` for a guest must not flash the Account pane.
- Longest languages (de, ru, hi) in the sidebar, the Settings category list, the Plan/Library/History lists and the Workout rail: no label clipped or overlapping a chevron/tag.
- Light theme: `.tag.warn` text must be readable on its tinted background.

---

## File Structure

- Create `frontend/src/lib/a11y.js` (+ `a11y.test.js`).
- Modify the ~25 `.item` rows listed in Task 1; `Stats.jsx`, `Library.jsx` (labels, roles).
- Modify `frontend/src/index.css` (polish section, utilities section, light-theme token).
- Modify `RoutineEdit.jsx`, `Plan.jsx`, `Program.jsx`, `Library.jsx`, `Settings.jsx` (small behaviour fixes).
- Modify views/components listed in Task 4 (codemod).
- Modify `frontend/index.html`, `frontend/public/manifest.json` (theme colour).
- Modify `CLAUDE.md`; memory.

---

### Task 1: Keyboard-operable list rows

**Files:**
- Create: `frontend/src/lib/a11y.js`, `frontend/src/lib/a11y.test.js`
- Modify: every `<div … className=… item … onClick=…>` row (list below), plus `aria-current` on selected rows

**Interfaces:**
- Produces: `rowProps(handler, { role = 'button' } = {}) -> { onClick, onKeyDown, tabIndex: 0, role? }`. `onKeyDown` fires `handler(e)` on Enter or Space **only when `e.target === e.currentTarget`** (so inner buttons/inputs keep their own behaviour), and calls `e.preventDefault()` first (Space must not scroll). `role` is omitted when `role: false` (for rows that contain inner buttons).

- [ ] **Step 1: Write the failing test** — `a11y.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { rowProps } from './a11y.js'

const key = (k, same = true) => {
  const el = {}
  return { key: k, target: same ? el : {}, currentTarget: el, preventDefault: vi.fn() }
}

describe('rowProps', () => {
  it('passes clicks through and is focusable with the button role', () => {
    const h = vi.fn()
    const p = rowProps(h)
    expect(p.onClick).toBe(h)
    expect(p.tabIndex).toBe(0)
    expect(p.role).toBe('button')
  })
  it('activates on Enter and Space, preventing the page scroll', () => {
    const h = vi.fn()
    const p = rowProps(h)
    for (const k of ['Enter', ' ']) {
      const e = key(k)
      p.onKeyDown(e)
      expect(e.preventDefault).toHaveBeenCalled()
    }
    expect(h).toHaveBeenCalledTimes(2)
  })
  it('ignores other keys', () => {
    const h = vi.fn()
    rowProps(h).onKeyDown(key('a'))
    rowProps(h).onKeyDown(key('Tab'))
    expect(h).not.toHaveBeenCalled()
  })
  it('ignores keys that come from a nested control', () => {
    const h = vi.fn()
    const e = key('Enter', false)
    rowProps(h).onKeyDown(e)
    expect(h).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
  it('can drop the role for rows that contain buttons', () => {
    expect('role' in rowProps(() => {}, { role: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/lib/a11y.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `a11y.js`:

```js
// Props that make a clickable <div> row behave like a button for keyboard users.
// Keys that bubble up from a nested control (a button or input inside the row) are ignored,
// so the inner control keeps its own behaviour.
export function rowProps(handler, { role = 'button' } = {}) {
  const props = {
    onClick: handler,
    tabIndex: 0,
    onKeyDown: e => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e) }
    }
  }
  if (role) props.role = role
  return props
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run src/lib/a11y.test.js` → PASS.

- [ ] **Step 5: Apply to the rows.** Write this codemod to the **scratchpad** (not the repo) as `rowprops.py` and run it from the repo root with `--dry` first; it must report exactly the sites below before you run it for real.

```python
import re, sys, pathlib
DRY = '--dry' in sys.argv
ROOT = pathlib.Path('frontend/src')
files = [p for p in ROOT.rglob('*.jsx') if 'locales' not in str(p)]

def balanced(s, i):          # s[i] == '{' -> index after the matching '}'
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return j + 1
    raise ValueError

def tag_end(s, i):           # s[i] == '<' -> index of the '>' closing the opening tag
    j = i
    while j < len(s):
        if s[j] == '{': j = balanced(s, j); continue
        if s[j] == '>': return j
        j += 1
    raise ValueError

total = 0
for p in files:
    raw = p.read_text(encoding='utf-8')
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n')
    out, pos, n = [], 0, 0
    for m in re.finditer(r'<div\b', s):
        if m.start() < pos: continue
        end = tag_end(s, m.start())
        tag = s[m.start():end + 1]
        cm = re.search(r'className=("[^"]*"|\{(?:[^{}]|\{[^{}]*\})*\})', tag)
        if not cm or not re.search(r"\bitem\b|'item", cm.group(1)): continue
        om = re.search(r'onClick=\{', tag)
        if not om: continue
        k = tag.index('{', om.start())
        e = balanced(tag, k)
        expr = tag[k + 1:e - 1]
        new_tag = tag[:om.start()] + '{...rowProps(' + expr + ')}' + tag[e:]
        out.append(s[pos:m.start()]); out.append(new_tag); pos = end + 1; n += 1
        print(f'{p}:{s.count(chr(10), 0, m.start()) + 1}  rowProps({expr[:50]})')
    out.append(s[pos:])
    if n and not DRY:
        s2 = ''.join(out)
        if 'lib/a11y.js' not in s2:
            depth = '../lib/a11y.js' if '/views/' in str(p) or '/components/' in str(p) else './lib/a11y.js'
            s2 = re.sub(r"^(import .*\n)(?!import)", lambda m: m.group(1) + f"import {{ rowProps }} from '{depth}'\n", s2, count=1, flags=re.M)
        p.write_text(s2.replace('\n', '\r\n') if crlf else s2, encoding='utf-8', newline='')
    total += n
print('sites:', total)
```
Expected dry-run: one line per row in `AssignPanel.jsx` (2), `AssignSheet.jsx` (2), `ProgressViews.jsx` (1), `RoutinePanel.jsx` (1), `StudentList.jsx` (1), `sheets.jsx` (11), `CoachActivity.jsx` (1), `Library.jsx` (2), `Plan.jsx` (2: the schedule row and the routine row, which spans lines), `Program.jsx` (1), `RoutineEdit.jsx` (1), `Workout.jsx` (1) — about 26. If the count differs, read the extra/missing sites and decide by hand; do not run blind. Note: the import insertion regex must land after the **last** top import for files whose first line is not an import; check each changed file's head and fix by hand if it landed inside a multi-line import.

After the run, hand-fix these cases:
- **Rows that contain an inner button** (`Library.jsx` exercise rows with the "Plan" button): use `{...rowProps(fn, { role: false })}`.
- **`AssignPanel.jsx:64` and `AssignSheet.jsx:78`** (`.item.off`): the handler is `() => !off && toggle(x.id)`, which already refuses; keep it, and add `aria-disabled={off || undefined}` and `tabIndex={off ? -1 : 0}` **after** the spread so the disabled row leaves the tab order.
- **`aria-current`** on rows that carry the `sel` class: `WorkoutRow` (`aria-current={sel ? 'true' : undefined}`), `Library.jsx` exercise rows, `Plan.jsx` routine rows, `Program.jsx` block rows, `StudentList.jsx` student rows.
- **Stats `.xprog-opt`**: remove `role="listbox"` and `role="option"`/`aria-selected`; use `aria-pressed={id === curEx}` on each button and `role="group"` on the container. Add `aria-label={t('Search…')}` to the `SearchField` in `Stats.jsx` and to the search `<input>` in `Library.jsx`.

- [ ] **Step 6: Verify.** `cd frontend && npm test && npm run build` → PASS. In the browser at 1280px (demo state): Tab to the first History row, Enter → URL changes and the panel updates; Space does not scroll; in Library, Tab into a row, Tab again lands on its "Plan" button, Enter there opens the "add to plan" sheet and does **not** navigate; AssignSheet: a disabled student row is skipped by Tab. At 390px: rows still open sheets on tap.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(a11y): keyboard-operable list rows, aria-current on selected rows, plain button group for exercise progress"
```

---

### Task 2: CSS polish for the deferred minors

**Files:** Modify `frontend/src/index.css`.

- [ ] **Step 1: Light-theme warning text.** In the light block (the `:root[data-theme="light"]` rule that defines `--orange:#ff9500`, ~line 86) add a darker ink token and use it:

```css
  --orange-ink:#a85a00;   /* readable orange text on a light surface (≥4.5:1 on the 16% tint) */
```
In the dark block add `--orange-ink:var(--orange);` next to `--orange`. Change `.tag.warn` (line ~395) to `color:var(--orange-ink)`.

- [ ] **Step 2: Append a polish section** at the end of `index.css`:

```css
/* ------------------------------------------------ desktop polish (plan 8) --- */
.today-row .tag{white-space:nowrap}
@media (min-width:1000px){
  /* long labels (de/ru/hi) wrap instead of running under the chevron */
  .pane-cats .pane-list .tt,.pane-list .item .tt{overflow-wrap:anywhere}
  /* focus rings inside scroll containers must not be clipped by the container's edge */
  .pane-list :focus-visible,.wout :focus-visible,.xprog-opts :focus-visible,.lib-list .chips :focus-visible{outline-offset:-2px}
  /* the delete button in a detail panel is an action, not a full-width bar */
  .pane-detail>.btn.danger{width:auto;min-width:200px}
}
```
Delete the dead rules from plan 7 (`.pane-cats .pane-detail .sect:first-child{margin-top:0}` and `.pane-cats .pane-list .item{width:100%;text-align:left}`; the second one is still needed only if the `<button class="item">` rows are not full width — check in the browser before deleting it, and keep it if they shrink).

- [ ] **Step 3: Verify.** At 1280px in **light** theme: a `.tag.warn` (start a workout, leave it, open Home: "Resume") is readable; in dark it is unchanged. Switch the language to Deutsch and open `/#/settings` (signed-out guest has no Notifications; check "Entrenamiento"-equivalent rows) and Library: no label overlaps a chevron. Tab through a Plan row and a Workout rail item: the focus ring is fully visible. Run `npm run build` → PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix(css): light-theme warn ink, wrapping list labels, unclipped focus rings, calmer delete button"
```

---

### Task 3: Small behaviour fixes

**Files:** Modify `RoutineEdit.jsx`, `Plan.jsx`, `Program.jsx`, `Library.jsx`, `Settings.jsx`.

- [ ] **Step 1: One history entry on delete.** `RoutineEdit.jsx:77` currently reads `useEffect(() => { if (!r) nav(back) }, [!!r])` and the delete handler also calls `nav(back)` (~line 196), so deleting pushes twice. Change the effect to `nav(back, { replace: true })`.

- [ ] **Step 2: No blank detail panes.** `Plan.jsx` renders `{selected ? <RoutineSummary …/> : null}` and `Program.jsx` shows nothing when there is no `preview`. Replace the `null` branch with the existing empty-state markup used elsewhere:
```jsx
<div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}</div>
```
in `Plan.jsx` (desktop pane only), and in `Program.jsx` the equivalent with the copy that screen already uses for "no blocks" (reuse the existing key; do not add one).

- [ ] **Step 3: Library scroll to top when the exercise changes.** In `Library.jsx` add, after the existing hooks:
```jsx
useEffect(() => { if (desktop) window.scrollTo(0, 0) }, [selected && selected.id])
```
(Declared before the early `return <Navigate …>`.)

- [ ] **Step 4: Settings, no wrong-pane flash.** In `Settings.jsx` replace the redirect effect with a render-time redirect: keep the hook order intact by putting the `Navigate` **after** all hooks:
```jsx
if (cat && (!desktop || !valid)) return <Navigate to="/settings" replace />
```
and delete the `useEffect` that did `nav('/settings', { replace: true })`.

- [ ] **Step 5: Verify.** `cd frontend && npm test && npm run build` → PASS. Browser: create a routine, delete it from the editor, press Back: you land on the page before the editor, not on `/plan/r/<deleted>`. Delete all routines on desktop: the Plan detail pane shows the empty state. `/#/settings/notifications` as a guest goes straight to `/#/settings` (no Account flash). Library: scroll the detail panel down, pick another exercise: the page returns to the top.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "fix: single history entry on routine delete, empty states for blank panes, Library scroll reset, Settings redirect without flash"
```

---

### Task 4: Replace ad-hoc inline spacing with the `--sp-*` scale

**Files:** Modify `frontend/src/index.css` (utilities) and the views/components the codemod touches (`views/*.jsx` except `Admin.jsx`; `components/*.jsx`). **Not** `sheets.jsx`, **not** `Admin.jsx` (see rulings).

- [ ] **Step 1: Utilities.** Append to `index.css`:

```css
/* ------------------------------------------------------------ utilities --- */
/* Spacing on the --sp-* scale (4/8/12/16/20/24/32/40) for what used to be inline styles. */
.m-0{margin:0}
.mt-0{margin-top:0}.mb-0{margin-bottom:0}
.mt-1{margin-top:var(--sp-1)}.mt-2{margin-top:var(--sp-2)}.mt-3{margin-top:var(--sp-3)}.mt-4{margin-top:var(--sp-4)}
.mt-5{margin-top:var(--sp-5)}.mt-6{margin-top:var(--sp-6)}.mt-7{margin-top:var(--sp-7)}.mt-8{margin-top:var(--sp-8)}
.mb-1{margin-bottom:var(--sp-1)}.mb-2{margin-bottom:var(--sp-2)}.mb-3{margin-bottom:var(--sp-3)}.mb-4{margin-bottom:var(--sp-4)}
.mb-5{margin-bottom:var(--sp-5)}.mb-6{margin-bottom:var(--sp-6)}.mb-7{margin-bottom:var(--sp-7)}.mb-8{margin-bottom:var(--sp-8)}
.ml-1{margin-left:var(--sp-1)}.ml-2{margin-left:var(--sp-2)}.ml-auto{margin-left:auto}
.gap-1{gap:var(--sp-1)}.gap-2{gap:var(--sp-2)}.gap-3{gap:var(--sp-3)}
.sp-1{height:var(--sp-1)}.sp-2{height:var(--sp-2)}.sp-3{height:var(--sp-3)}.sp-4{height:var(--sp-4)}.sp-5{height:var(--sp-5)}
.ta-l{text-align:left}.ta-c{text-align:center}.ta-r{text-align:right}
.w-full{width:100%}
.nocase{text-transform:none;letter-spacing:0}
.hidden{display:none}
```
Specificity note: `.m-0` etc. are single-class rules; where an element also has a class that sets the same property (`.card h2{margin:…}`), the more specific selector wins. After the codemod, check `h2` margins in cards in the browser; if a utility loses, raise it with `.card .m-0{margin:0}` rather than going back to inline.

- [ ] **Step 2: Codemod** — scratchpad `inline.py`, run from the repo root, `--dry` first:

```python
import re, sys, pathlib
DRY = '--dry' in sys.argv
STEP = {0: 0, 2: 1, 4: 1, 6: 2, 8: 2, 10: 3, 12: 3, 14: 4, 16: 4, 18: 5, 20: 5, 22: 6, 24: 6, 26: 6, 28: 7, 32: 7, 40: 8}
ROOT = pathlib.Path('frontend/src')
files = [p for p in list(ROOT.glob('views/*.jsx')) + list(ROOT.glob('components/*.jsx')) if p.name != 'Admin.jsx']

def classes_for(obj):
    """obj is the text inside style={{ … }}. Return a class list, or None if anything is not understood."""
    pairs = [x.strip() for x in obj.split(',') if x.strip()]
    cls = []
    for pr in pairs:
        m = re.fullmatch(r"(\w+)\s*:\s*(.+)", pr)
        if not m: return None
        k, v = m.group(1), m.group(2).strip()
        num = re.fullmatch(r"-?\d+(\.\d+)?", v)
        if k in ('marginTop', 'marginBottom') and num and v.lstrip('-').isdigit() and not v.startswith('-') and int(v) in STEP:
            cls.append(('mt-' if k == 'marginTop' else 'mb-') + str(STEP[int(v)]) if int(v) else ('mt-0' if k == 'marginTop' else 'mb-0'))
        elif k == 'margin' and v == '0': cls.append('m-0')
        elif k == 'marginLeft' and v == "'auto'": cls.append('ml-auto')
        elif k == 'marginLeft' and v.isdigit() and int(v) in (4, 8): cls.append('ml-' + str(STEP[int(v)]))
        elif k == 'gap' and v.isdigit() and int(v) in (4, 8, 12): cls.append('gap-' + str(STEP[int(v)]))
        elif k == 'textAlign' and v in ("'left'", "'center'", "'right'"): cls.append('ta-' + v[1])
        elif k == 'width' and v == "'100%'": cls.append('w-full')
        elif k == 'display' and v == "'none'": cls.append('hidden')
        elif k == 'textTransform' and v == "'none'": cls.append('nocase')
        elif k == 'letterSpacing' and v == '0': pass          # folded into .nocase together with textTransform
        else: return None
    if 'letterSpacing' in obj and 'nocase' not in cls: return None
    return cls or None

total = skipped = 0
for p in files:
    raw = p.read_text(encoding='utf-8'); crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n')
    def spacer(m):                       # <div style={{ height: N }} />
        n = int(m.group(1))
        return '<div className="sp-%d" />' % STEP[n] if n in STEP and STEP[n] in (1, 2, 3, 4, 5) else m.group(0)
    s2 = re.sub(r"<div style=\{\{ height: (\d+) \}\} />", spacer, s)
    out, pos = [], 0
    for m in re.finditer(r"style=\{\{([^{}]*)\}\}", s2):
        # find the opening tag this attribute belongs to
        lt = s2.rfind('<', 0, m.start())
        tag_head = s2[lt:m.start()]
        if re.match(r"<[A-Z]", tag_head) and not tag_head.startswith('<Button'):   # other components: skip
            skipped += 1; print('SKIP component', p, s2.count('\n', 0, m.start()) + 1); continue
        cls = classes_for(m.group(1))
        if not cls:
            skipped += 1; print('SKIP dynamic ', p, s2.count('\n', 0, m.start()) + 1, m.group(0)[:60]); continue
        cm = re.search(r'className="([^"]*)"', tag_head)
        after = s2[m.end():s2.find('>', m.end())]
        cm2 = re.search(r'className="([^"]*)"', after) if not cm else None
        if re.search(r'className=\{', tag_head + after):
            skipped += 1; print('SKIP expr cls', p, s2.count('\n', 0, m.start()) + 1); continue
        out.append((m.start(), m.end(), cls, cm, cm2)); total += 1
    # apply from the end so offsets stay valid
    for a, b, cls, cm, cm2 in reversed(out):
        add = ' '.join(cls)
        if cm:
            lt = s2.rfind('<', 0, a)
            s2 = s2[:a] + s2[b:]                              # drop the style attribute
            s2 = s2[:lt + cm.start()] + 'className="' + cm.group(1) + ' ' + add + '"' + s2[lt + cm.end():]
        elif cm2:
            s2 = s2[:a] + s2[b:]
            i = s2.find('className="', a - 1)
            s2 = s2[:i] + 'className="' + cm2.group(1) + ' ' + add + '"' + s2[i + len('className="' + cm2.group(1) + '"'):]
        else:
            s2 = s2[:a] + 'className="' + add + '"' + s2[b:]
        s2 = re.sub(r'  +>', '>', s2)
    if s2 != s and not DRY:
        p.write_text(s2.replace('\n', '\r\n') if crlf else s2, encoding='utf-8', newline='')
print('rewritten:', total, 'skipped:', skipped)
```
The codemod is deliberately conservative (anything it does not fully understand is left untouched and printed). **Review the `--dry` output first**; run it for real only if every rewritten site is a margin/gap/alignment/hidden style on a DOM element or `<Button>`. Run `git diff --stat` and skim 10 random hunks for broken JSX (a double `className`, an orphaned `style`). Rerun `npm run build` after the real run: a double `className` attribute is a build **warning in Vite, not an error**, so also run `grep -rnE 'className="[^"]*"[^>]*className=' frontend/src` and expect no output.

- [ ] **Step 3: Verify.** `cd frontend && npm test && npm run build` → PASS. Browser spot checks at 390px and 1280px (dark): Home, Stats, Settings, Profile, Library, Plan, Workout (start a freestyle workout), RoutineEdit: spacing looks the same to within a couple of pixels, headings in cards have no stray margin, nothing collapsed to zero. Report the new inline-style counts per file (`grep -o 'style={{' | wc -l`) in the commit message.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "refactor(css): move ad-hoc inline spacing to --sp-* utility classes in views and components"
```

---

### Task 5: Theme colour, QA sweep, docs

**Files:** Modify `frontend/index.html`, `frontend/public/manifest.json`, `CLAUDE.md`, and whatever the sweep points at.

- [ ] **Step 1: Theme colour matches `--bg`.** `index.html:8` has `<meta name="theme-color" content="#0c0e12">` and the manifest has `background_color`/`theme_color` `#0c0e12`, but dark `--bg` is `#000000` (App.jsx corrects it at runtime). Set all three to `#000000`.

- [ ] **Step 2: The sweep.** Start the app (`npm run dev` from the repo root; seed the demo state with `import('/src/lib/demoSeed.js')` → `buildDemoState()` into `localStorage.gym_state_v1`, and `gym_guest=1`). Save this function in the scratchpad and evaluate it in the browser with `browser_evaluate`, once at 1280×900 and once at 390×800:

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const { useStore } = await import('/src/store/useStore.js')
  const ws = useStore.getState().S.workouts, rs = useStore.getState().S.routines
  const routes = ['#/home', '#/plan', '#/plan/r/' + rs[0].id, '#/stats', '#/history', '#/history/' + ws[ws.length - 1].id,
    '#/library', '#/settings/account', '#/settings/training', '#/settings/general', '#/settings/data', '#/profile', '#/program']
  const langs = ['en', 'es', 'de', 'ru', 'hi', 'fr', 'it', 'pt', 'pl', 'tr', 'zh', 'ko']
  const sel = '.cside-i,.item .tt,.item .ss,.lrow-t,.lrow-s,.btn,.tag,.chip,.sect-t,.tile .l,.hdr h1,.hdr .sub,.xprog-opt,.wout-names'
  const offenders = []
  const check = (route, lang) => {
    if (document.documentElement.scrollWidth > innerWidth + 1) offenders.push({ route, lang, what: 'page h-scroll' })
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || !el.offsetParent) continue
      const clips = ['hidden', 'clip'].includes(cs.overflowX)
      if (!clips && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
        offenders.push({ route, lang, what: 'overflow', cls: el.className.toString().slice(0, 30), text: el.textContent.trim().slice(0, 40) })
    }
  }
  for (const lang of langs) {
    useStore.getState().update(s => { s.lang = lang })
    await sleep(400)
    for (const r of routes) { location.hash = r; await sleep(350); check(r, lang) }
  }
  useStore.getState().update(s => { s.lang = 'es' })
  return { count: offenders.length, offenders: offenders.slice(0, 60) }
}
```
Expected: `count: 0`. For every offender: fix it with CSS (`overflow-wrap:anywhere` on the label, `min-width:0` on its flex parent, or `flex-wrap` on the row), re-run, repeat until 0, or write it to the ledger as `Final: minor (deferred)` with the route/language if it needs a design call. Elements that intentionally scroll (`.chips`, `.xprog-opts`) have `overflow-y:auto` or `overflow-x:auto`; if they show up, add them to the exclusion (`:not(.chips)`), they are not defects.

- [ ] **Step 3: Accent and theme contrast.** Evaluate in the browser at 1280px:

```js
async () => {
  const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * b }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
  const out = []
  for (const theme of ['dark', 'light']) for (const acc of ['lime', 'sky', 'orange', 'violet', 'pink', 'red', 'teal', 'gold']) {
    document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = acc
    await new Promise(r => setTimeout(r, 50))
    const probe = document.createElement('button'); probe.className = 'btn primary'; probe.textContent = 'x'; document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    out.push({ theme, acc, onAcc: +ratio(cs.color, cs.backgroundColor).toFixed(2), accOnBg: +ratio(getComputedStyle(document.documentElement).getPropertyValue('--acc').trim().startsWith('#') ? 'rgb(0,0,0)' : cs.backgroundColor, getComputedStyle(document.body).backgroundColor).toFixed(2) })
    probe.remove()
  }
  return out.filter(o => o.onAcc < 4.5)
}
```
Expected: an empty list (every `.btn.primary` label reaches ≥4.5:1 in both themes and all 8 accents). If one fails, report it to the ledger instead of changing accent values (the rule in `CLAUDE.md` §5.2 forbids breaking the computed `--on-acc`), and say which accent/theme.

- [ ] **Step 4: Full workout pass** (required by `CLAUDE.md` §7): at 1280px start a freestyle workout, add an exercise, log two sets, let the rest timer run, use the rail to jump, finish. Repeat the same at 390px.

- [ ] **Step 5: Docs.** Update `CLAUDE.md`:
  - §5.2 tokens: add `--orange-ink`.
  - §5.4: add the utility classes (`.mt-*`, `.mb-*`, `.gap-*`, `.sp-*`, `.ta-*`, `.nocase`, `.hidden`, `.w-full`), `rowProps` (`lib/a11y.js`), and `.pane-cats`.
  - §5.5 / structure: mention `lib/a11y.js`.
  - "Deuda de diseño conocida": replace the inline-style paragraph with the current counts per file (re-measure), state that `sheets.jsx` and `Admin.jsx` were left out on purpose, remove the `theme-color` item, and list the not-fixed items from the "Rulings" section.
  - §8: note that the athlete desktop work (plans 1–8) is complete and where the plans live.

- [ ] **Step 6: Final run and commit**

Run: `cd frontend && npm test && node scripts/check-locales.mjs && npm run build` → all PASS.

```bash
git add -A frontend CLAUDE.md
git commit -m "chore: theme-color matches --bg, QA sweep fixes, CLAUDE.md up to date for the athlete desktop"
```

---

## Self-review

- **Spec coverage:** rollout row 8 — themes (Task 5 Step 3, both themes), accents (Step 3, 8 accents), languages (Step 2, 12 languages), docs §5/§6 (Step 5), plus the deferred minors from plans 2–7 (Tasks 1–3, Task 5 Step 1) and the known inline-style debt (Task 4).
- **Placeholders:** none. The codemods are given in full; steps that depend on what they find say exactly what to do with each outcome.
- **Type consistency:** `rowProps(handler, { role })` is used identically in the test, the implementation and the Task 1 call sites; utility class names in Task 4 Step 1 match the `classes_for` output (`mt-N`, `mb-N`, `ml-N`, `ml-auto`, `gap-N`, `ta-l|c|r`, `w-full`, `hidden`, `nocase`, `m-0`, `sp-N`).
- **Review Focus coverage:** inner-button and Space behaviour → Task 1 test + Step 6; disabled rows → Task 1 Step 5; codemod safety → Task 4 Steps 2–3; delete history → Task 3 Steps 1/5; Settings flash → Task 3 Steps 4/5; long languages → Task 5 Step 2; light-theme warn → Task 2 Steps 1/3.
