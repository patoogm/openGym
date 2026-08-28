# Routine sections — design

**Date:** 2026-08-28
**Status:** approved, ready for implementation plan
**Base app:** openGym fork (this repo)

---

## 1. Context & goal

A routine in openGym is a flat, ordered list of exercises (`routine.ex: [Ex, …]`).
The owner wants to organise that list into **named sections** while building the
routine — "Fuerza", "Cardio", "Propiocepción", "Accesorios" — with a custom name
per section. Sections are purely organisational labels: no per-section
progression, rest, or other settings.

Sections must show up in three places: the routine editor, the workout screen,
and the printed / shared plan.

### Locked decisions (from brainstorming, 2026-08-28)

| Decision | Choice |
|---|---|
| Data model | **Approach A — section marker entries in `routine.ex`** (see §3). |
| Section semantics | **Label only.** No progression / rest / collapse per section. |
| UI term | **"Sección"** (avoids clashing with periodized `program.blocks`, which the UI calls "bloque"). |
| Where sections appear | Editor **+** workout screen **+** printed/shared plan. |
| Deleting a section | Deletes the section **and all its exercises**, behind a destructive confirm. |
| Workout label | Its own line above the current exercise (`CARDIO`), not merged into "Ejercicio 3 / 8". |
| "Add exercise" placement | Appends to the end of the routine (last section). Does not detect which section is on screen. |

### Non-goals

- Per-section progression, rest timers, collapse/expand state, colours, icons.
- Drag-to-reorder a whole section with its exercises as one unit (v1 moves rows
  one at a time with the existing up/down arrows).
- Sections in the periodized block generator's output (Plan 2 — not built).
- Any migration: every new field is additive and absent-reads-as-before.
- Changes to workout history shape — sections never reach `S.workouts`.

---

## 2. High-level approach

`routine.ex` stays the single ordered source of truth. A section is a marker
object interleaved in that array:

```
routine.ex = [
  { section: "Fuerza" },
  { id: "0025", sets: 4, reps: 6, prog: "double" },   // in "Fuerza"
  { id: "0043", sets: 3, reps: 8 },                     // in "Fuerza"
  { section: "Accesorios" },
  { id: "0294", sets: 3, reps: 12 },                    // in "Accesorios"
]
```

Exercises before the first marker belong to no section and render with no header.
Everything that today treats `routine.ex` as "a list of exercises" gains a filter
that skips markers, via one shared helper module.

---

## 3. Data model

### 3.1 Section marker

```js
{ section: "Fuerza" }   // a string name; no `id`, no other keys
```

- Identified by `e.section != null && e.id == null`.
- The name is free text, defaulting to a localised "Nueva sección". Empty/whitespace
  names fall back to that default on blur (same rule as `routine.name`).
- Consecutive markers (a section with no exercises) are allowed and render as an
  empty section in the editor. They are harmless everywhere else.

### 3.2 Compatibility

- Routines without markers are unchanged. No `DEF` change, no store migration.
- `blocks.js` `materializeBlock` / `snapshotActiveBlock`: markers are plain
  objects with no `id`, so the deep-clone copies them verbatim and the
  `id → newId` remap never touches them. No code change; covered by a regression
  test.
- Plan share/print format (`PLAN_FMT`) is **not bumped** — markers are additive
  within `ex[]` and older importers simply ignore unknown-shaped entries (see §7).

---

## 4. New module: `frontend/src/lib/routine.js`

Pure, dependency-free. Unit-tested in `routine.test.js`.

```js
// A section marker vs. a real exercise config.
export const isSection = e => e != null && e.section != null && e.id == null

// Real exercises only (markers removed).
export const exItems = list => (list || []).filter(e => !isSection(e))

// Count of real exercises.
export const countEx = list => exItems(list).length

// Group the flat list into rendered sections, preserving real indices into `list`.
//   → [{ name: string | null, rows: [{ e, i }] }]
// `name: null` is the leading unsectioned group; it is omitted when empty.
export const sectionsOf = list => { /* walk list, start a new group on each marker */ }

// The section name the exercise at real index `i` belongs to (or null).
export const sectionAt = (list, i) => { /* nearest preceding marker */ }
```

Edge cases the tests pin down:

- empty list → `[]`
- no markers → single group `{ name: null, rows: [...] }`
- marker at index 0 → no leading `null` group
- two markers in a row → an empty group between them
- exercises, then a marker, then exercises → leading `null` group kept

---

## 5. Consumers of `routine.ex` to update

| File / site | Today | Change |
|---|---|---|
| `views/Plan.jsx:44` | `exCount(r.ex.length)` | `exCount(countEx(r.ex))` |
| `views/Workout.jsx` (home list, ~31, ~39) | `exCount(r.ex.length)` | `exCount(countEx(r.ex))` |
| `sheets.jsx` routine pickers (~333, ~768, ~786) | `exCount(r.ex.length)` | `exCount(countEx(r.ex))` |
| `sheets.jsx:334` `r.ex.some(e => e.id === ex.id)` | — | fine as-is (markers have no `id`) |
| `sheets.jsx:677` `r.ex && r.ex.length` (has-routines) | — | `countEx(r.ex)` so a routine that is only an empty section doesn't count as populated |
| `components/TabBar.jsx:21` `r.ex.length` gate | — | `countEx(r.ex)` |
| `sheets.jsx` `usageMap` (~408) | `r.ex.forEach` | `exItems(r.ex).forEach` |
| `lib/muscles.js:115` `loadOfRoutine` | `(routine?.ex || []).map` | wrap in `exItems(...)` |
| `lib/digest.js` (resolve loop over entries) | operates on `w.entries`, not `r.ex` | **no change** — workout entries never contain markers (see §6) |
| `sheets.jsx` `beginWorkout` (~877) | `(r ? r.ex : []).map(cfg => …)` | `exItems(r ? r.ex : []).map(…)`; attach `section: sectionAt(r.ex, realIndex)` to each entry |
| `lib/history.js` `cleanupSg` (~140) | iterates `ex` | markers have no `sg`; a marker between two superset partners would break adjacency. `cleanupSg` and `supersetUnits` must treat a marker as a **non-partner** (never continue a group across it) — a marker already fails the `prev.sg === e.sg` check, so no code change; pinned by a test |
| `lib/history.js` `supersetUnits` | index-based grouping | marker index becomes a singleton unit; `RoutineEdit`'s `unitFirst`/`inSS` sets are keyed by index so they still line up. No change; test covers it |
| `lib/plan-share.js` `cleanEx` (~35) | maps an exercise | if `isSection(e)` return `{ section: e.section }` unchanged |
| `lib/plan-share.js` `buildPlanBundle` (~56-58) | `r.ex.map(cleanEx)`, `usedIds` from `r.ex` | keep `.map(cleanEx)` (now passes markers through); `usedIds` / `exerciseCount` over `exItems(r.ex)` |
| `lib/plan-share.js` `parsePlan` (~84-99) | `Array.isArray(r.ex)`, filters each `e` | keep a marker entry when `isSection(e)`; only validate `id` on non-markers |
| `lib/plan-share.js` `routineHTML` (~173) | `units(r.ex)` then rows | iterate `sectionsOf(r.ex)`, emit a section header before each named group, then `units()` within the group's rows |
| `lib/demoSeed.js` (~97) | `routine.ex.map` | demo seed emits no sections; guard with `exItems` only if a crash is possible — otherwise leave |
| `lib/import-csv.js` | builds `day.ex` as a Map from scratch | no markers involved; **no change** |

The list above is the full blast radius. Every change is a filter or a
passthrough; none alters exercise semantics.

---

## 6. Editor — `views/RoutineEdit.jsx`

### Rendering

Replace the `r.ex.map((e, i) => …)` body with a walk over `sectionsOf(r.ex)`:

- For each group with `name !== null`, render a **section header row**:
  - an inline `<input>` bound to the marker's `section` (same pattern as the
    routine-name input at the top): `onChange` writes
    `s.routines[…].ex[markerIndex].section = value.trim() || t('New section')`.
  - a small **delete-section** icon button → opens `confirmSheet`:
    - title `t('Delete section?')`
    - message `t('“{0}” and its {1} exercises will be removed. This can’t be undone.', name, n)`
      — or a no-exercises variant when the section is empty
    - on confirm: `edit(ex => ex.splice(markerIndex, groupLength + 1))` then
      `cleanupSg(ex)`.
  - up/down arrows to move the **marker only** (existing `move(i, dir)` — moving a
    marker past an exercise reassigns that exercise's section, which is the
    intended behaviour).
- Within each group, render the existing exercise rows unchanged, keyed by their
  **real index `i`** so `edit`, `move`, `toggleLink`, and the superset
  `unitFirst`/`inSS` sets keep working untouched.

### Adding

- New **"Añadir sección"** button next to "Añadir ejercicio":
  `edit(ex => ex.push({ section: t('New section') }))`. After the update, focus
  the new input (ref + `useEffect`, or autoFocus on a freshly-mounted last input).
- "Añadir exercise" is unchanged: `exercisePicker → exConfigSheet →
  edit(x => x.push({ id, ...cfg }))`. It lands at the end, i.e. in the last
  section if there is one.

### Move semantics

`move(i, dir)` already swaps adjacent entries and runs `cleanupSg`. With markers
in the array this transparently supports: moving an exercise across a section
boundary, moving a marker up/down, and moving a marker to the top (its group
becomes the first section). No change to `move`.

The "What this session hits" body-map card uses `loadOfRoutine(r)` → covered by
the `muscles.js` change in §5. Gate it on `countEx(r.ex) > 0`.

---

## 7. Workout — `views/Workout.jsx`

- `beginWorkout` (§5) attaches `section` to each entry. `A.entries` therefore
  never contains markers, so `supersetUnits(A.entries)`, the presence heartbeat,
  the finish summary, and history writing are all unaffected.
- In the workout view, above the current exercise block (near the
  "Ejercicio {n} / {N}" line at ~281), render — when `A.entries[cur].section` is
  set — a section label on its own line:
  `<div className="wsection">{entry.section}</div>` styled small / uppercase /
  dim, matching the existing `.muted .small` treatment.
- Nothing else changes: no section navigation, no inter-section rest.

---

## 8. Printed / shared plan — `lib/plan-share.js`

### Bundle (JSON)

- `cleanEx`: `if (isSection(e)) return { section: e.section }`.
- `buildPlanBundle`: `usedIds` and `customEx` filtering over `exItems(r.ex)`;
  `exerciseCount` over `exItems`.
- `parsePlan`: within the per-routine `ex` filter, keep the entry as-is when
  `isSection(e)`; run id validation only on real exercises. `exerciseCount` in the
  returned summary counts `exItems`.
- `PLAN_FMT` unchanged. A routine shared from an older build simply has no
  markers; a plan with markers imported into an older build lists the markers as
  unresolvable and drops them (acceptable — the format is best-effort and the
  owner controls both ends).

### Print HTML (`routineHTML`)

- Walk `sectionsOf(r.ex)`. Before each named group emit
  `<h3 class="rt-section">${esc(name)}</h3>`.
- Within a group, keep the existing `units(...)` superset grouping, fed the
  group's exercise configs (`rows.map(r => r.e)`).
- CSS: uppercase, letter-spaced, `--label-3`-ish colour, small top margin, a hair
  of border-bottom. Sits between routine `<h2>` and the exercise rows.

---

## 9. i18n

New source strings (added to `frontend/src/locales/es.js`, and every other locale
falls back to English as usual):

| key | es |
|---|---|
| `Add section` | Añadir sección |
| `New section` | Nueva sección |
| `Section` | Sección |
| `Delete section?` | ¿Borrar sección? |
| `“{0}” and its {1} exercises will be removed. This can’t be undone.` | Se eliminarán «{0}» y sus {1} ejercicios. No se puede deshacer. |
| `“{0}” will be removed.` | Se eliminará «{0}». |

---

## 10. Testing

**`lib/routine.test.js`** (new)
- `isSection` true/false table.
- `exItems` / `countEx`: no markers, leading marker, trailing marker, consecutive
  markers, only-a-marker list, empty list.
- `sectionsOf`: shapes for each of the above; real indices preserved.
- `sectionAt`: exercise in a section, exercise before the first marker, index on a
  marker row.

**`lib/history` regression**
- `supersetUnits` / `cleanupSg` over a list with a marker between two `sg`
  partners: the group does **not** span the marker; the marker is its own unit.

**`sheets` / workout (`beginWorkout`)**
- Routine `[marker, exA, exB, marker, exC]` → `A.entries` has 3 entries,
  `section` = `["Fuerza","Fuerza","Accesorios"]`, no marker entries.
- Superset that sits entirely inside one section still groups in the workout.

**`lib/plan-share.test.js`**
- Round-trip: a routine with two sections exports and re-imports with markers in
  the same positions; `exerciseCount` counts only real exercises.
- `routineHTML` output contains the section headers in order (string assertion).

**`lib/blocks.test.js`**
- `materializeBlock` on a block whose routine has sections: the materialised
  `S.routines` keeps the markers, exercises get fresh ids, markers untouched.

**`store/useStore.test.js`**
- A pre-sections routine (`ex` with only `{id,…}` entries) is unchanged after
  `Object.assign(clone(DEF), state)`.

---

## 11. Build order (for the implementation plan)

1. **`lib/routine.js` + tests** — helpers only, no consumers touched.
2. **Wire the read-only consumers** — counts (`Plan`, `Workout` home, pickers,
   `TabBar`), `usageMap`, `muscles.loadOfRoutine`; their existing tests stay green,
   add coverage where thin.
3. **`beginWorkout` + workout label** — filter markers, attach `section`, render
   the `.wsection` line; `beginWorkout` test.
4. **RoutineEdit** — section headers, rename input, add-section button,
   delete-section confirm; move semantics verified manually.
5. **plan-share** — `cleanEx` / `parsePlan` / `buildPlanBundle` passthrough,
   `routineHTML` headers + CSS; round-trip and HTML tests.
6. **i18n** — source strings + `es.js`.
7. **Regression pass** — `blocks`, `store`, full `vitest`, `vite build`, manual
   smoke (build a routine with three sections, train it, print it, export/import).
