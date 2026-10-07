# Coach desktop panel — design

Date: 2026-10-07
Status: draft for review
Related: `2026-10-06-coach-first-shell-design.md` (mobile coach shell, merged)

## Goal

A coach is likelier to review students from a PC than to train. Today the coach area at
≥1000px is the mobile layout stretched (`#app` 1080px, 2-column lists, floating tab bar).
Give the coach area a real desktop layout: a fixed sidebar plus a wide work panel, so the
coach can supervise students and build/assign routines comfortably.

Mobile (<1000px) is unchanged.

## Decisions (from brainstorming)

- The coach does two things on desktop, equally: **supervise students** and **build/assign routines**.
- Shell: **fixed sidebar** (Alumnos · Rutinas · Actividad, "＋ Asignar rutina" button, "Yo" at the bottom) + wide panel.
- Alumnos: **master–detail** (student list left, selected student's detail right).
- Assignment: **inline panel**, no modal, reachable from Rutinas (pick a routine → check students) and from a student's detail (pick routines).
- Routine editing: the existing `RoutineEdit` stays a **full page** inside the shell. Embedding it in the panel is a possible later phase.
- Implementation: **nested layout route + shared components** (approach A).
- Defaults: Actividad is a wide single column and clicking an event opens that student in Alumnos; "Yo" links to `/settings`; the sidebar replaces the tab bar only on `/coach/*` at ≥1000px.

## Routes

URLs for the existing screens do not change, except the editor.

```
<Route element={<CoachShell />}>            // coachOnly guard
  /coach                      Alumnos (desktop: list + empty detail "Elegí un alumno")
  /coach/alumno/:id           Alumnos (desktop: list + detail)
  /coach/rutinas              Rutinas (list + empty panel)
  /coach/rutinas/:id          Rutinas (list + selected routine summary + assignment panel)
  /coach/actividad            Actividad
  /coach/rutinas/:id/editar   RoutineEdit (moved from /coach/rutinas/:id)
</Route>
```

Links to update: `CoachRoutines.jsx` (rows open the summary; "Editar" opens `.../editar`),
`RoutineEdit.jsx` (`back`), `AssignSheet.jsx` (unchanged target `/coach/rutinas`).
Non-coach routes (`/plan/r/:id`, etc.) are untouched.

## Components

| Unit | Purpose | Depends on |
|---|---|---|
| `views/CoachShell.jsx` (new) | Layout route. ≥1000px: sidebar + `<Outlet/>`. <1000px: just `<Outlet/>` (tab bar stays). **Sole owner** of `listStudents()` + 15s polling; shares `{students, reload}` through `useOutletContext`. First-load failure toasts; later poll failures are silent (as today). | `coachApi`, `useIsDesktop` |
| `components/CoachSidebar.jsx` (new) | `<nav aria-label>`; items from `COACH_TABS`, active via `activeCoachTab`, `aria-current`. Attention badge + live count from shell data. "＋ Asignar rutina" and "Yo". | `coachShell.js` |
| `components/StudentList.jsx` (extracted from `Coach.jsx`) | Search, "Requiere atención", `TrainingNow`, list with `WeekMini`. Selected row highlighted. | `coachShell.js` |
| `components/StudentDetail.jsx` (extracted from `CoachStudent.jsx`) | Tiles, assigned routines, requests, bodyweight, history. Loads `getStudent(id)` on `:id` change; after mutations reloads itself and calls the shell `reload`. Desktop: two columns under the tiles. | `coachApi` |
| `components/AssignPanel.jsx` (new) | Inline assignment UI (routine → students with "Todos"/"ya la tiene", and student → routines). Same logic as `AssignSheet` via `assignMany` / `assignSummary`. | `coachShell.js` |
| `lib/useIsDesktop.js` (new) | `matchMedia('(min-width:1000px)')` hook. | — |
| `views/Coach*.jsx` | Thin wrappers: mobile shows list OR detail (as today); desktop shows list + detail inside the shell. | above |

`AssignSheet` (mobile) is kept as is; it and `AssignPanel` share the pure helpers.

## Visual design (all via `index.css`)

New section "Coach desktop", commented like the rest of the file. No inline styles added.

- Tokens: `--side-w: 240px`, `--list-w: 340px`. No new colors, radii or shadows.
- `.cshell` (grid: sidebar | content), `.cside`, `.cside-i` (+ `.on`), `.cmaster` (list column, hairline right), `.cdetail` (scrolling panel).
- Sidebar: `--bg-el` + hairline; active item `--surface-2`; badge reuses `.tag.warn`; "Asignar rutina" is `.btn.primary`; "Yo" separated by a hairline.
- List: reuses `.item`/`.tt`/`.ss`/`WeekMini`; selected = `--surface-2` + 3px `--acc` bar; attention = `.tag.warn`; live = existing live dot.
- Detail: reuses `.tiles`, `.card`, `.list`, `LineChart`; two columns below the tiles (assigned routines + requests | bodyweight + history).
- Actividad: single column, max ~720px, existing `.feed-day` headers.
- At ≥1000px the shell escapes the 1080px `#app` cap and uses the full width; the floating tab bar is hidden on `/coach/*`.
- Dark and light via tokens only; verified with the 8 accents (`--on-acc` untouched). Long labels wrap; no fixed label widths. Coach copy stays Spanish-literal (no `t()` keys, so no locale changes).

## States and errors

- Loading: "Cargando…" in list and detail.
- No students: current invite empty-state with the invite action.
- Search with no match: current message.
- Unknown `:id` / load error: toast + redirect to `/coach` (as today).
- `/coach` on desktop with no student chosen: empty panel "Elegí un alumno" — nothing auto-selected.
- Viewport crossing 1000px mid-session: the URL decides what is shown; `useIsDesktop` only changes presentation.
- Accessibility: `<nav>` + `aria-current`, keyboard-navigable list with `:focus-visible`, `aria-label` on icon-only buttons, `prefers-reduced-motion` respected.

## Testing

- Vitest (pure logic only): `activeCoachTab` for the new `/coach/rutinas/:id/editar` path, and any new pure helper extracted for the assign panel. Existing `coachShell.test.js` keeps passing.
- Visual check with Playwright at 1280px and 1440px, dark and light, two accents; confirm mobile (390px) is unchanged.
- Commands: `cd frontend && npm test`, `node scripts/check-locales.mjs`, `npm run build`.
- Manual: coach flow end to end on desktop (open student → assign → resolve request → remove routine), plus one full workout flow to confirm nothing regressed for non-coach users.

## Out of scope

Embedded routine editor, keyboard shortcuts, a table view of students, any change to `api/`, `store/`, `lib/coachApi.js` or non-coach screens, bulk operations beyond the existing multi-student assignment.

## Repo hygiene

Add `.superpowers/` to `.gitignore` (visual-companion mockups are not project files).
