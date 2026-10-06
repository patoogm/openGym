# Coach-first shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un usuario `coach` abre la app en un panel de alumnos con adherencia semanal, asigna rutinas a varios alumnos en 2 toques, y conserva su propio entrenamiento detrás de un tab "Yo".

**Architecture:** `TabBar` elige entre un arreglo de tabs de coach y el de atleta según `user.coach` y la ruta (`/coach*`). La lógica nueva (tira semanal, atención, orden, feed, asignación múltiple) vive en una lib pura `lib/coachShell.js` con tests. El API suma 4 campos baratos a `studentRows`; el cálculo de la semana se hace en el cliente con la fecha local del coach (el servidor no conoce la zona horaria del alumno ni la del coach).

**Tech Stack:** React 19 + Vite + React Router 7 (HashRouter) + Zustand, CSS plano en `frontend/src/index.css`, Vitest (frontend), `node --test` (api). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-coach-first-shell-design.md` (ver también §10 "Ajustes al implementar", agregada por el Task 8).

## Global Constraints

- Sin dependencias nuevas (ni Tailwind, ni librerías de iconos/charts/animación).
- No tocar `frontend/src/lib/` salvo el archivo nuevo `coachShell.js`, ni `frontend/src/store/`. `mergeAssigned`/`stripAssigned` quedan intactos.
- Todo cambio visual pasa por tokens y clases de `index.css`: un valor nuevo (tamaño, color) se agrega primero como token en `:root`. Sin `style={{}}` nuevos salvo valores dinámicos.
- Dark y light en cada cambio; los 8 acentos no se rompen (`--on-acc` ya está calculado).
- Hit targets ≥ 44px; `aria-label` en botones de solo ícono; respetar `:focus-visible` y `prefers-reduced-motion`.
- Iconos solo del set existente (`person`, `clipboard`, `history`, `dumbbell`, `plus`, `chevronLeft`, `chevronRight`, `dot`, `bell`, `trash`, `personCircle`). Sin emoji como íconos.
- Copy de las pantallas de coach en **español literal** (excepción documentada en CLAUDE.md): no se tocan los 12 locales. Los componentes compartidos con Admin (`ProgressViews`, `InvitesCard`) siguen recibiendo la prop `t`.
- Controles propios de `components/ui.jsx` (`Button`, `Check`, `SearchField`, `Row`, `Section`); nada de `<select>`/checkbox/range nativos.
- Mobile first (375–430px), luego desktop ≥ 1000px.
- Commits: terminar el mensaje con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Hay cambios sin commitear ajenos a este plan en `InvitesCard.jsx`, `ProgressViews.jsx`, `Coach.jsx`, `locales/es.js`. Hacer `git add` solo de los archivos de cada task. `Coach.jsx` se reescribe en el Task 5: antes de reemplazarlo, revisar `git diff frontend/src/views/Coach.jsx` y conservar esas mejoras si siguen aplicando.

## Review Focus

Modos de falla que el spec implica y las tareas cubren con tests:

1. Alumno sin plan semanal (`plannedWeekdays` vacío): la tira muestra solo entrenados, nunca aros de "faltó"; el resumen no divide por 0. → Task 2.
2. Alumno recién asignado que nunca entrenó (`lastWorkout: null`, `assignmentCount > 0`): se marca como "inactivo" en vez de crashear al calcular días; orden con `lastWorkout` nulo al final. → Task 2.
3. Asignación parcial: de N alumnos fallan algunos; el toast dice cuántos y cuáles, y no se reintenta lo que ya se asignó. → Task 2.
4. Fecha de hoy domingo/lunes y cambio de semana: la semana es lunes–domingo, y el domingo pertenece a la semana que empieza el lunes anterior. → Task 2.
5. Coach sin rutinas propias o sin alumnos: el sheet de asignación y las pantallas muestran estados vacíos con una acción, no listas vacías mudas. → Tasks 4, 5, 6.

---

### Task 1: API — datos de adherencia en `studentRows`

**Files:**
- Modify: `api/coaching.js:55-73` (`studentRows`)
- Test: `api/coaching.test.js` (fixture `coachFixture` ~línea 148 y tests de `studentRows` ~164)

**Interfaces:**
- Produces: cada fila de `studentRows` suma
  - `workoutDates: string[]` — fechas `YYYY-MM-DD` distintas de workouts, orden cronológico, máx. 60 (las más recientes)
  - `plannedWeekdays: number[]` — días de la semana (0=domingo … 6=sábado) con rutina en `S.week`, ordenados
  - `recent: { d: string, name: string }[]` — últimos 5 workouts, el más reciente primero
  - `assignedRoutineIds: string[]` — ids de rutinas del coach asignadas a ese alumno

- [ ] **Step 1: Write the failing tests**

En `api/coaching.test.js`, en `coachFixture`, agregar `week` al estado de `s1` (junto a `routines: []`):

```js
    s1: { unit: 'kg', _ts: 123, bodyweight: [{ d: '2026-02-01', kg: 70 }],
          week: { 1: 'r9', 3: 'r9', 5: null },
          workouts: [{ id: 'w1', d: '2026-02-02', name: 'Full body' }], routines: [] }
```

Agregar después del test `studentRows: only my students, with counts`:

```js
test('studentRows: adherence fields', () => {
  const { db, readState, livePresence } = coachFixture()
  const [row] = studentRows(db, 'c1', readState, livePresence)
  assert.deepEqual(row.workoutDates, ['2026-02-02'])
  assert.deepEqual(row.plannedWeekdays, [1, 3])          // key 5 is null → rest day
  assert.deepEqual(row.recent, [{ d: '2026-02-02', name: 'Full body' }])
  assert.deepEqual(row.assignedRoutineIds, ['r1'])
})

test('studentRows: no weekly plan and no workouts → empty arrays, not undefined', () => {
  const { db, readState, livePresence } = coachFixture()
  const bare = { ...readState('s1'), week: undefined, workouts: undefined }
  const rows = studentRows(db, 'c1', uid => (uid === 's1' ? bare : readState(uid)), livePresence)
  assert.deepEqual(rows[0].workoutDates, [])
  assert.deepEqual(rows[0].plannedWeekdays, [])
  assert.deepEqual(rows[0].recent, [])
})

test('studentRows: workoutDates dedupes same-day workouts and caps at 60', () => {
  const { db, readState, livePresence } = coachFixture()
  const st = { ...readState('s1'), workouts: [{ id: 'a', d: '2026-03-01', name: 'A' }, { id: 'b', d: '2026-03-01', name: 'B' }] }
  let rows = studentRows(db, 'c1', uid => (uid === 's1' ? st : readState(uid)), livePresence)
  assert.deepEqual(rows[0].workoutDates, ['2026-03-01'])
  const big = { ...readState('s1'), workouts: Array.from({ length: 80 }, (_, i) => ({ id: 'w' + i, d: '2026-01-01T' + i, name: 'x' })) }
  rows = studentRows(db, 'c1', uid => (uid === 's1' ? big : readState(uid)), livePresence)
  assert.equal(rows[0].workoutDates.length, 60)
  assert.equal(rows[0].workoutDates[59], '2026-01-01T79')
})
```

(El segundo caso usa fechas sintéticas únicas solo para comprobar el tope de 60.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && node --test coaching.test.js`
Expected: FAIL (`row.workoutDates` es `undefined`).

- [ ] **Step 3: Implement**

En `api/coaching.js`, dentro del objeto que devuelve `studentRows`, después de `lastSync`:

```js
      workoutDates: [...new Set(workouts.map(w => w.d))].slice(-60),
      plannedWeekdays: Object.keys(S.week || {}).filter(k => S.week[k]).map(Number).sort((a, b) => a - b),
      recent: workouts.slice(-5).reverse().map(w => ({ d: w.d, name: w.name || '' })),
      assignedRoutineIds: (db.assignments || []).filter(a => a.studentId === u.id && a.coachId === coachId).map(a => a.routineId),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && npm test`
Expected: PASS (todos, incluidos los previos).

- [ ] **Step 5: Commit**

```bash
git add api/coaching.js api/coaching.test.js
git commit -m "feat(api): adherence fields on studentRows (workoutDates, plannedWeekdays, recent, assignedRoutineIds)"
```

---

### Task 2: Lógica pura `lib/coachShell.js`

**Files:**
- Create: `frontend/src/lib/coachShell.js`
- Test: `frontend/src/lib/coachShell.test.js`

**Interfaces:**
- Consumes: filas de `listStudents()` con los campos del Task 1 más los existentes (`lastWorkout`, `live`, `pendingRequests`, `assignmentCount`, `name`).
- Produces:
  - `ATTENTION_DAYS = 5`
  - `isCoachPath(pathname): boolean`
  - `homePathFor(user): '/coach' | '/home'`, `routinesPathFor(user): '/coach/rutinas' | '/plan'`
  - `COACH_TABS` (array de `{ k, icon, to, label }` sin el botón central) y `activeCoachTab(pathname): 'alumnos'|'rutinas'|'actividad'|null`
  - `weekStrip(row, today): { iso, wd, state: 'done'|'miss'|'plan'|'rest', today: boolean }[]` (7 elementos, lunes a domingo)
  - `weekSummary(row, today): { done: number, planned: number }`
  - `daysSince(iso, today): number`
  - `attentionReasons(row, today): ('request'|'idle')[]`
  - `sortStudents(rows, today): row[]` (no muta)
  - `lastLabel(row, today): string`
  - `activityFeed(rows, limit = 30): { d: string, items: { studentId, name, workout }[] }[]`
  - `assignMany(assignFn, routineId, students): Promise<{ okIds: string[], failed: { id, name, message }[] }>`
  - `assignSummary({ okIds, failed }): string`

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/coachShell.test.js` (hoy en el test = `'2026-10-07'`, miércoles; la semana es lun 05/10 – dom 11/10):

```js
import { describe, it, expect, vi } from 'vitest'
import {
  ATTENTION_DAYS, isCoachPath, homePathFor, routinesPathFor, activeCoachTab,
  weekStrip, weekSummary, daysSince, attentionReasons, sortStudents, lastLabel,
  activityFeed, assignMany, assignSummary
} from './coachShell.js'

const TODAY = '2026-10-07'   // Wednesday

describe('paths and tabs', () => {
  it('isCoachPath only matches the coach area', () => {
    expect(isCoachPath('/coach')).toBe(true)
    expect(isCoachPath('/coach/rutinas')).toBe(true)
    expect(isCoachPath('/coachxyz')).toBe(false)
    expect(isCoachPath('/home')).toBe(false)
  })
  it('home and routines paths depend on role', () => {
    expect(homePathFor({ coach: true })).toBe('/coach')
    expect(homePathFor({})).toBe('/home')
    expect(homePathFor(null)).toBe('/home')
    expect(routinesPathFor({ coach: true })).toBe('/coach/rutinas')
    expect(routinesPathFor(null)).toBe('/plan')
  })
  it('activeCoachTab maps routes to tabs; student detail belongs to Alumnos', () => {
    expect(activeCoachTab('/coach')).toBe('alumnos')
    expect(activeCoachTab('/coach/alumno/s1')).toBe('alumnos')
    expect(activeCoachTab('/coach/rutinas')).toBe('rutinas')
    expect(activeCoachTab('/coach/actividad')).toBe('actividad')
    expect(activeCoachTab('/home')).toBe(null)
  })
})

describe('weekStrip', () => {
  const row = { workoutDates: ['2026-10-05'], plannedWeekdays: [1, 2, 3, 5] }
  it('is Monday-first and 7 days long', () => {
    const w = weekStrip(row, TODAY)
    expect(w.map(d => d.iso)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
  })
  it('marks done, missed (planned, past, not done), upcoming plan, and rest', () => {
    const w = weekStrip(row, TODAY)
    expect(w.map(d => d.state)).toEqual(['done', 'miss', 'plan', 'rest', 'plan', 'rest', 'rest'])
    expect(w[2].today).toBe(true)
  })
  it('Sunday belongs to the week that started the previous Monday', () => {
    const w = weekStrip({ workoutDates: [], plannedWeekdays: [] }, '2026-10-11')
    expect(w[0].iso).toBe('2026-10-05')
    expect(w[6].iso).toBe('2026-10-11')
    expect(w[6].today).toBe(true)
  })
  it('Monday is the first day of its own week', () => {
    expect(weekStrip({}, '2026-10-12')[0].iso).toBe('2026-10-12')
  })
  it('no weekly plan: only trained days show, nothing is ever "miss"', () => {
    const w = weekStrip({ workoutDates: ['2026-10-06'], plannedWeekdays: [] }, TODAY)
    expect(w.map(d => d.state)).toEqual(['rest', 'done', 'rest', 'rest', 'rest', 'rest', 'rest'])
  })
  it('tolerates a row with no adherence fields (older server)', () => {
    expect(weekStrip({}, TODAY).every(d => d.state === 'rest')).toBe(true)
  })
})

describe('weekSummary', () => {
  it('counts done this week against the planned days', () => {
    expect(weekSummary({ workoutDates: ['2026-10-05', '2026-10-07'], plannedWeekdays: [1, 3, 5] }, TODAY)).toEqual({ done: 2, planned: 3 })
  })
  it('ignores workouts outside the current week', () => {
    expect(weekSummary({ workoutDates: ['2026-10-04', '2026-09-30'], plannedWeekdays: [1] }, TODAY).done).toBe(0)
  })
  it('no plan → planned 0 (caller must not divide by it)', () => {
    expect(weekSummary({ workoutDates: [], plannedWeekdays: [] }, TODAY)).toEqual({ done: 0, planned: 0 })
  })
})

describe('daysSince', () => {
  it('whole days, 0 for the same day, across a month boundary', () => {
    expect(daysSince('2026-10-07', TODAY)).toBe(0)
    expect(daysSince('2026-10-06', TODAY)).toBe(1)
    expect(daysSince('2026-09-30', TODAY)).toBe(7)
  })
})

describe('attentionReasons', () => {
  it('pending requests', () => {
    expect(attentionReasons({ pendingRequests: 2, assignmentCount: 1, lastWorkout: '2026-10-07' }, TODAY)).toEqual(['request'])
  })
  it(`idle after ${ATTENTION_DAYS} days with an assigned routine`, () => {
    expect(attentionReasons({ assignmentCount: 1, lastWorkout: '2026-10-02' }, TODAY)).toEqual(['idle'])
    expect(attentionReasons({ assignmentCount: 1, lastWorkout: '2026-10-03' }, TODAY)).toEqual([])
  })
  it('never trained but has an assignment → idle', () => {
    expect(attentionReasons({ assignmentCount: 1, lastWorkout: null }, TODAY)).toEqual(['idle'])
  })
  it('no assignment → never idle (nothing to skip)', () => {
    expect(attentionReasons({ assignmentCount: 0, lastWorkout: null }, TODAY)).toEqual([])
  })
  it('training right now suppresses idle', () => {
    expect(attentionReasons({ assignmentCount: 1, lastWorkout: '2026-09-01', live: { name: 'x' } }, TODAY)).toEqual([])
  })
  it('both reasons can apply', () => {
    expect(attentionReasons({ pendingRequests: 1, assignmentCount: 1, lastWorkout: null }, TODAY)).toEqual(['request', 'idle'])
  })
})

describe('sortStudents', () => {
  const rows = [
    { id: 'a', name: 'Ana', assignmentCount: 0, lastWorkout: '2026-10-06' },
    { id: 'b', name: 'Beto', assignmentCount: 0, lastWorkout: null },
    { id: 'c', name: 'Cora', assignmentCount: 1, lastWorkout: '2026-09-01' },   // idle → attention
    { id: 'd', name: 'Dani', assignmentCount: 0, lastWorkout: '2026-10-07' }
  ]
  it('attention first, then most recent activity, no-activity last; does not mutate', () => {
    const copy = rows.slice()
    expect(sortStudents(rows, TODAY).map(r => r.id)).toEqual(['c', 'd', 'a', 'b'])
    expect(rows).toEqual(copy)
  })
  it('ties break by name', () => {
    const r = [{ id: 'z', name: 'Zoe', lastWorkout: '2026-10-06' }, { id: 'a', name: 'Ana', lastWorkout: '2026-10-06' }]
    expect(sortStudents(r, TODAY).map(x => x.id)).toEqual(['a', 'z'])
  })
})

describe('lastLabel', () => {
  it('reads naturally in Spanish', () => {
    expect(lastLabel({ lastWorkout: null }, TODAY)).toBe('sin entrenos')
    expect(lastLabel({ lastWorkout: '2026-10-07' }, TODAY)).toBe('hoy')
    expect(lastLabel({ lastWorkout: '2026-10-06' }, TODAY)).toBe('ayer')
    expect(lastLabel({ lastWorkout: '2026-10-02' }, TODAY)).toBe('hace 5 d')
  })
})

describe('activityFeed', () => {
  const rows = [
    { id: 'a', name: 'Ana', recent: [{ d: '2026-10-06', name: 'Pierna' }, { d: '2026-10-04', name: 'Empuje' }] },
    { id: 'b', name: 'Beto', recent: [{ d: '2026-10-06', name: 'Tirón' }] },
    { id: 'c', name: 'Cora' }                                       // no `recent` (older server)
  ]
  it('groups by day, newest day first, ties by student name', () => {
    const f = activityFeed(rows)
    expect(f.map(g => g.d)).toEqual(['2026-10-06', '2026-10-04'])
    expect(f[0].items.map(i => i.name)).toEqual(['Ana', 'Beto'])
    expect(f[0].items[0]).toEqual({ studentId: 'a', name: 'Ana', workout: 'Pierna' })
  })
  it('respects the limit on events', () => {
    expect(activityFeed(rows, 2).reduce((n, g) => n + g.items.length, 0)).toBe(2)
  })
  it('empty when nobody has trained', () => {
    expect(activityFeed([{ id: 'c', name: 'Cora' }])).toEqual([])
  })
})

describe('assignMany / assignSummary', () => {
  const students = [{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Beto' }, { id: 's3', name: 'Cora' }]
  it('assigns everyone and reports all ok', async () => {
    const fn = vi.fn(() => Promise.resolve({}))
    const r = await assignMany(fn, 'r1', students)
    expect(fn).toHaveBeenCalledTimes(3)
    expect(fn).toHaveBeenCalledWith('s2', 'r1')
    expect(r).toEqual({ okIds: ['s1', 's2', 's3'], failed: [] })
    expect(assignSummary(r)).toBe('Asignada a 3 alumnos')
  })
  it('one student → singular message', async () => {
    const r = await assignMany(() => Promise.resolve({}), 'r1', [students[0]])
    expect(assignSummary(r)).toBe('Rutina asignada')
  })
  it('partial failure keeps the successes and names the failures', async () => {
    const fn = vi.fn(sid => (sid === 's2' ? Promise.reject(new Error('not your student')) : Promise.resolve({})))
    const r = await assignMany(fn, 'r1', students)
    expect(r.okIds).toEqual(['s1', 's3'])
    expect(r.failed).toEqual([{ id: 's2', name: 'Beto', message: 'not your student' }])
    expect(assignSummary(r)).toBe('2 de 3 asignadas; falló Beto: not your student')
  })
  it('a rejection with no message still produces a readable failure', async () => {
    const r = await assignMany(() => Promise.reject({}), 'r1', [students[0]])
    expect(r.failed[0].message).toBe('error')
  })
  it('empty selection does nothing', async () => {
    const fn = vi.fn()
    expect(await assignMany(fn, 'r1', [])).toEqual({ okIds: [], failed: [] })
    expect(fn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/coachShell.test.js`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Write the implementation**

`frontend/src/lib/coachShell.js`:

```js
// Pure logic for the coach-first shell. Copy here is Spanish-literal on purpose (coach
// screens are the documented exception to t()). Dates are 'YYYY-MM-DD' strings; `today`
// is always passed in so nothing depends on the clock or the server's timezone.
import { isoOf } from './format.js'

export const ATTENTION_DAYS = 5

export const isCoachPath = p => p === '/coach' || p.startsWith('/coach/')
export const homePathFor = user => (user && user.coach ? '/coach' : '/home')
export const routinesPathFor = user => (user && user.coach ? '/coach/rutinas' : '/plan')

// Side tabs only: the elevated "＋ Asignar" button sits between the first two and the last two.
export const COACH_TABS = [
  { k: 'alumnos', icon: 'person', to: '/coach', label: 'Alumnos' },
  { k: 'rutinas', icon: 'clipboard', to: '/coach/rutinas', label: 'Rutinas' },
  { k: 'actividad', icon: 'history', to: '/coach/actividad', label: 'Actividad' }
]
export function activeCoachTab(pathname) {
  if (pathname === '/coach' || pathname.startsWith('/coach/alumno')) return 'alumnos'
  if (pathname.startsWith('/coach/rutinas')) return 'rutinas'
  if (pathname.startsWith('/coach/actividad')) return 'actividad'
  return null
}

const at = iso => new Date(iso + 'T12:00:00')
export const daysSince = (iso, today) => Math.round((at(today) - at(iso)) / 86400000)

// Monday-first week containing `today`.
export function weekStrip(row, today) {
  const done = new Set((row && row.workoutDates) || [])
  const planned = new Set((row && row.plannedWeekdays) || [])
  const t0 = at(today)
  const monday = new Date(t0)
  monday.setDate(t0.getDate() - ((t0.getDay() + 6) % 7))
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const wd = d.getDay()
    const state = done.has(iso) ? 'done' : planned.has(wd) ? (iso < today ? 'miss' : 'plan') : 'rest'
    days.push({ iso, wd, state, today: iso === today })
  }
  return days
}

export function weekSummary(row, today) {
  const strip = weekStrip(row, today)
  return {
    done: strip.filter(d => d.state === 'done').length,
    planned: new Set((row && row.plannedWeekdays) || []).size
  }
}

export function attentionReasons(row, today, limit = ATTENTION_DAYS) {
  const out = []
  if (row.pendingRequests > 0) out.push('request')
  const idle = !row.live && row.assignmentCount > 0 && (!row.lastWorkout || daysSince(row.lastWorkout, today) >= limit)
  if (idle) out.push('idle')
  return out
}

export function sortStudents(rows, today) {
  const key = r => (r.lastWorkout ? r.lastWorkout : '')
  return rows.slice().sort((a, b) => {
    const A = attentionReasons(a, today).length > 0, B = attentionReasons(b, today).length > 0
    if (A !== B) return A ? -1 : 1
    if (key(a) !== key(b)) return key(a) < key(b) ? 1 : -1
    return String(a.name).localeCompare(String(b.name))
  })
}

export function lastLabel(row, today) {
  if (!row.lastWorkout) return 'sin entrenos'
  const n = daysSince(row.lastWorkout, today)
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + n + ' d'
}

export function activityFeed(rows, limit = 30) {
  const events = []
  for (const r of rows || []) for (const w of r.recent || []) events.push({ studentId: r.id, name: r.name, d: w.d, workout: w.name })
  events.sort((a, b) => (a.d === b.d ? String(a.name).localeCompare(String(b.name)) : a.d < b.d ? 1 : -1))
  const groups = []
  for (const e of events.slice(0, limit)) {
    let g = groups[groups.length - 1]
    if (!g || g.d !== e.d) { g = { d: e.d, items: [] }; groups.push(g) }
    g.items.push({ studentId: e.studentId, name: e.name, workout: e.workout })
  }
  return groups
}

// One request per student: the API stays single-student, so a partial failure never undoes the rest.
export async function assignMany(assignFn, routineId, students) {
  const res = await Promise.allSettled(students.map(s => assignFn(s.id, routineId)))
  const okIds = [], failed = []
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') okIds.push(students[i].id)
    else failed.push({ id: students[i].id, name: students[i].name, message: (r.reason && r.reason.message) || 'error' })
  })
  return { okIds, failed }
}

export function assignSummary({ okIds, failed }) {
  if (!failed.length) return okIds.length === 1 ? 'Rutina asignada' : 'Asignada a ' + okIds.length + ' alumnos'
  const total = okIds.length + failed.length
  return okIds.length + ' de ' + total + ' asignadas; falló ' + failed.map(f => f.name).join(', ') + ': ' + failed[0].message
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/coachShell.test.js`
Expected: PASS. (Si falla `activeCoachTab('/coach/alumno/s1')`, revisar el orden de los `if`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/coachShell.js frontend/src/lib/coachShell.test.js
git commit -m "feat(web): coachShell lib — week strip, attention, sort, feed, bulk assign"
```

---

### Task 3: CSS — tira semanal compacta, banda de atención, tab de coach

**Files:**
- Modify: `frontend/src/index.css` (`:root` tokens ~línea 52; después de `.tag.acc` ~368; después del bloque `#tabbar` ~325)

**Interfaces:**
- Produces: tokens `--wk-dot`; clases `.wk-mini` + `.d.{done,miss,plan,rest,today}`, `.tag.warn`, `.attn`, `.tab-dot`, `.feed-day`.

- [ ] **Step 1: Add the token**

En `:root`, junto a `--pad:16px;`:

```css
  --wk-dot:10px;
```

- [ ] **Step 2: Add the component classes**

Después de `.tag.acc{...}`:

```css
.tag.warn{background:color-mix(in srgb,var(--orange) 16%,transparent);color:var(--orange)}
```

Después del bloque de la tab bar (después de `@keyframes ping{...}`):

```css
#tabbar button{position:relative}
.tab-dot{position:absolute;top:1px;left:calc(50% + 9px);width:8px;height:8px;border-radius:50%;background:var(--orange)}

/* --------------------------------------------- coach: student week strip --- */
.wk-mini{display:flex;gap:6px;margin-top:6px}
.wk-mini .d{width:var(--wk-dot);height:var(--wk-dot);border-radius:50%;box-sizing:border-box;background:var(--surface-3)}
.wk-mini .d.done{background:var(--acc)}
.wk-mini .d.plan{background:none;box-shadow:inset 0 0 0 1.5px var(--label-3)}
.wk-mini .d.miss{background:none;box-shadow:inset 0 0 0 1.5px var(--orange)}
.wk-mini .d.today{outline:1.5px solid var(--label-2);outline-offset:2px}
.attn{display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:12px;border-radius:var(--r);
  background:color-mix(in srgb,var(--orange) 12%,transparent);color:var(--label)}
.attn .icn{color:var(--orange);flex:none}
.feed-day{margin:16px 2px 6px;font-size:13px;color:var(--label-2);text-transform:capitalize}
```

(`#tabbar button{position:relative}` pisa nada: el bloque original no define `position`. El `.start` usa `margin-top` y sigue igual.)

- [ ] **Step 3: Verify build and visual sanity**

Run: `cd frontend && npm run build`
Expected: build OK. (La verificación visual real ocurre en el Task 8, cuando las clases ya se usan.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(web): css for coach week strip, attention band, tab dot"
```

---

### Task 4: Sheet de asignación (2 pasos, multi-alumno)

**Files:**
- Create: `frontend/src/components/AssignSheet.jsx`
- Create: `frontend/src/components/WeekMini.jsx`

**Interfaces:**
- Consumes: `listStudents`, `assignRoutine` de `lib/coachApi.js`; `assignMany`, `assignSummary`, `weekStrip` de `lib/coachShell.js`; `nav` de `lib/nav.js`; `Button`, `Check` de `ui.jsx`; `useUI().openSheet`.
- Produces:
  - `openAssignSheet({ routineId?: string, studentId?: string, onDone?: () => void })` — sin `routineId` arranca en el paso 1 (elegir rutina); sin `studentId` el paso 2 permite multi-selección; con `studentId` ese alumno viene preseleccionado.
  - `<WeekMini row today />` — la tira de 7 puntos con `role="img"` y `aria-label`.

- [ ] **Step 1: Write `WeekMini.jsx`**

```jsx
import { weekStrip, weekSummary } from '../lib/coachShell.js'

const NAMES = { done: 'entrenó', miss: 'faltó', plan: 'planificado', rest: 'descanso' }
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function WeekMini({ row, today }) {
  const days = weekStrip(row, today)
  const { done, planned } = weekSummary(row, today)
  const label = 'Esta semana: ' + done + (planned ? ' de ' + planned : '') + ' entrenos. ' +
    days.map(d => DOW[d.wd] + ' ' + NAMES[d.state]).join(', ')
  return <div className="wk-mini" role="img" aria-label={label}>
    {days.map(d => <span key={d.iso} className={'d ' + d.state + (d.today ? ' today' : '')} />)}
  </div>
}
```

- [ ] **Step 2: Write `AssignSheet.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { nav } from '../lib/nav.js'
import Icon from './Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, Check } from './ui.jsx'
import { listStudents, assignRoutine } from '../lib/coachApi.js'
import { assignMany, assignSummary } from '../lib/coachShell.js'

export function openAssignSheet(opts = {}) {
  useUI.getState().openSheet(close => <AssignSheet {...opts} close={close} />)
}

function AssignSheet({ routineId: rid0 = null, studentId = null, onDone, close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [rid, setRid] = useState(rid0)
  const [students, setStudents] = useState(null)
  const [sel, setSel] = useState(() => new Set(studentId ? [studentId] : []))
  const [busy, setBusy] = useState(false)
  const mine = (S.routines || []).filter(r => !r.coachAssigned)

  useEffect(() => { listStudents().then(r => setStudents(r.students || [])).catch(e => { toast(e.message || 'Error'); close() }) }, [])

  if (!rid) return <>
    <h3>Asignar rutina</h3>
    {mine.length ? <div className="list">
      {mine.map(r => <div key={r.id} className="item" onClick={() => setRid(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div></div>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </div> : <>
      <div className="empty small">Todavía no tenés rutinas para asignar.</div>
      <Button variant="primary" icon="plus" onClick={() => { close(); nav('/coach/rutinas') }}>Crear rutina</Button>
    </>}
  </>

  const routine = mine.find(r => r.id === rid)
  const taken = s => (s.assignedRoutineIds || []).includes(rid)
  const eligible = (students || []).filter(s => !taken(s))
  const allOn = eligible.length > 0 && eligible.every(s => sel.has(s.id))
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(allOn ? new Set() : new Set(eligible.map(s => s.id)))
  const chosen = eligible.filter(s => sel.has(s.id))

  const confirm = async () => {
    setBusy(true)
    const res = await assignMany(assignRoutine, rid, chosen)
    setBusy(false)
    toast(assignSummary(res))
    if (res.okIds.length) onDone && onDone()
    if (!res.failed.length) close()
    else setSel(new Set(res.failed.map(f => f.id)))   // keep only the failures selected so a retry is one tap
  }

  return <>
    <h3>Asignar “{routine ? routine.name : '…'}”</h3>
    {!students ? <div className="muted small">Cargando…</div>
      : !students.length ? <div className="empty small">Todavía no tenés alumnos. Invitá a alguien desde la pantalla Alumnos.</div>
      : <>
        {eligible.length > 1 && <div className="item" onClick={toggleAll}>
          <div className="grow"><div className="tt">Todos</div></div>
          <Check checked={allOn} onChange={toggleAll} />
        </div>}
        <div className="list">
          {students.map(s => <div key={s.id} className="item" style={taken(s) ? { opacity: .55 } : null} onClick={() => !taken(s) && toggle(s.id)}>
            <div className="grow"><div className="tt">{s.name}</div>{taken(s) && <div className="ss">ya la tiene</div>}</div>
            <Check checked={taken(s) || sel.has(s.id)} onChange={() => !taken(s) && toggle(s.id)} />
          </div>)}
        </div>
        <Button variant="primary" disabled={!chosen.length || busy} onClick={confirm}>
          {chosen.length ? 'Asignar a ' + chosen.length : 'Elegí al menos un alumno'}
        </Button>
      </>}
  </>
}
```

(El `style` del alumno que ya la tiene es dinámico y de un solo valor; si se prefiere sin inline, usar la clase `.dim` o agregar `.item.off{opacity:.55}` al CSS en este mismo task y usarla.)

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build OK, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AssignSheet.jsx frontend/src/components/WeekMini.jsx
git commit -m "feat(web): multi-student assign sheet and week mini strip"
```

---

### Task 5: Pantalla Alumnos (raíz) y detalle de alumno

**Files:**
- Modify (reescribir): `frontend/src/views/Coach.jsx`
- Create: `frontend/src/views/CoachStudent.jsx`

**Interfaces:**
- Consumes: Tasks 2 y 4; `StatTiles`, `TrainingNow`, `WorkoutHistory`, `rel` de `ProgressViews.jsx`; `InvitesCard`; `LineChart` (`points: {t,y,d}[]`, `h`, `unit`); `getStudent`, `unassignRoutine`, `resolveRequest`.
- Produces: default exports `Coach` (lista, ruta `/coach`) y `CoachStudent` (ruta `/coach/alumno/:id`).

- [ ] **Step 1: Revisar los cambios sin commitear de `Coach.jsx`**

Run: `git diff frontend/src/views/Coach.jsx`
Conservar cualquier mejora de copy/estructura que siga aplicando al reescribir.

- [ ] **Step 2: Reescribir `Coach.jsx` (lista de alumnos)**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { SearchField } from '../components/ui.jsx'
import { TrainingNow } from '../components/ProgressViews.jsx'
import InvitesCard from '../components/InvitesCard.jsx'
import WeekMini from '../components/WeekMini.jsx'
import { listStudents } from '../lib/coachApi.js'
import { attentionReasons, sortStudents, weekSummary, lastLabel } from '../lib/coachShell.js'

// Coach home: who needs attention and how the week is going, at a glance.
// Copy is Spanish-literal; the shared components get `t` so they render Spanish here.
const SEARCH_FROM = 8

export default function Coach() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [students, setStudents] = useState(null)
  const [q, setQ] = useState('')

  const load = () => listStudents().then(r => setStudents(r.students)).catch(e => toast(e.message || 'Error'))
  // poll every 15s so "entrenando ahora" stays live without a manual refresh
  useEffect(() => { if (!user?.coach) return; load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])
  if (!user?.coach) return null

  const today = todayISO()
  const all = students || []
  const sorted = sortStudents(all, today)
  const attn = sorted.filter(s => attentionReasons(s, today).length)
  const list = q.trim() ? sorted.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted
  const open = id => nav('/coach/alumno/' + id)
  const invite = () => openSheet(() => <><h3>Invitaciones</h3><InvitesCard t={t} heading={null} /></>)

  return <div className="narrow">
    <div className="hdr">
      <div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Alumnos</h1>
        <div className="sub">{students ? all.length + (all.length === 1 ? ' alumno' : ' alumnos') : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={invite} aria-label="Invitar alumno"><Icon name="plus" /></button>
    </div>

    <TrainingNow users={all} onOpen={open} t={t} />

    {attn.length > 0 && <>
      <h4 className="sec">Requiere atención</h4>
      {attn.map(s => <div key={s.id} className="attn" onClick={() => open(s.id)}>
        <Icon name="bell" />
        <span className="grow">{s.name}: {attentionReasons(s, today).map(r => r === 'request'
          ? s.pendingRequests + (s.pendingRequests === 1 ? ' pedido de cambio' : ' pedidos de cambio')
          : 'sin entrenar (' + lastLabel(s, today) + ')').join(' · ')}</span>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </>}

    <h4 className="sec">Esta semana</h4>
    {all.length >= SEARCH_FROM && <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Buscar alumno" />}
    <div className="list">
      {list.map(s => {
        const { done, planned } = weekSummary(s, today)
        return <div key={s.id} className="item" onClick={() => open(s.id)}>
          <div className="grow">
            <div className="tt">{s.live && <Icon name="dot" className="live-dot" />}{s.name}
              {s.pendingRequests > 0 && <span className="tag warn" style={{ marginLeft: 6 }}>{s.pendingRequests}</span>}</div>
            <div className="ss">{s.live ? 'entrenando ahora · ' + s.live.name
              : (planned ? done + '/' + planned + ' esta semana' : done + ' esta semana') + ' · último: ' + lastLabel(s, today)}</div>
            <WeekMini row={s} today={today} />
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
      {students && !all.length && <div className="empty">Todavía no tenés alumnos. Tocá + para generar un código de invitación y compartilo.</div>}
      {students && all.length > 0 && !list.length && <div className="empty small">Nadie coincide con “{q}”.</div>}
    </div>
  </div>
}
```

Agregar al CSS (Task 3 ya está commiteado; agregar en este task) `.live-dot{font-size:9px;color:var(--green);display:inline-block;margin-right:5px}` junto a `.attn`, y quitar el `style` inline de `marginLeft` reemplazándolo por `.tag.warn{margin-left:6px}`.

- [ ] **Step 3: Crear `CoachStudent.jsx`**

Mover aquí el contenido de `StudentDetail` (viejo `Coach.jsx`: rutinas asignadas, pedidos, historial), como pantalla:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import LineChart from '../components/LineChart.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { StatTiles, WorkoutHistory, rel } from '../components/ProgressViews.jsx'
import { openAssignSheet } from '../components/AssignSheet.jsx'
import { getStudent, unassignRoutine, resolveRequest } from '../lib/coachApi.js'
import { weekSummary } from '../lib/coachShell.js'

export default function CoachStudent() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const [d, setD] = useState(null)
  const load = () => getStudent(id).then(setD).catch(e => { toast(e.message || 'Error'); nav('/coach') })
  useEffect(() => { if (user?.coach) load() }, [id])
  if (!user?.coach) return null
  if (!d) return <div className="narrow"><div className="muted small">Cargando…</div></div>

  const pending = (d.requests || []).filter(r => !r.resolvedAt)
  const dates = [...new Set(d.workouts.map(w => w.d))]
  const { done } = weekSummary({ workoutDates: dates, plannedWeekdays: [] }, todayISO())
  const bw = (d.bodyweight || []).slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/coach')} aria-label="Volver a alumnos"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8 }}><h1 className="capitalize" style={{ margin: 0 }}>{d.user.name}</h1>
        <div className="sub">última sincronización: {rel(d.lastSync, t)}</div></div>
    </div>

    <StatTiles tiles={[
      { label: 'Esta semana', value: done },
      { label: 'Entrenos', value: d.workouts.length },
      { label: 'Pedidos', value: pending.length, accent: pending.length > 0 }
    ]} />

    <div className="row between"><h4 className="sec">Rutinas asignadas</h4>
      <Button size="sm" variant="primary" icon="plus" onClick={() => openAssignSheet({ studentId: id, onDone: load })}>Asignar</Button></div>
    {d.assigned.length ? <div className="list">{d.assigned.map(a => <div key={a.assignmentId} className="item">
      <span className="lrow-i"><Icon name={glyphOf(a.emoji)} /></span>
      <div className="grow"><div className="tt">{a.name}</div><div className="ss">{a.count} ej.</div></div>
      <button className="iconbtn danger" aria-label={'Quitar ' + a.name}
        onClick={() => confirmSheet({ title: 'Quitar “' + a.name + '”?', confirmText: 'Quitar', danger: true,
          onConfirm: () => unassignRoutine(a.assignmentId).then(load).catch(e => toast(e.message)) })}>
        <Icon name="trash" /></button>
    </div>)}</div> : <div className="empty small">Sin rutinas asignadas.</div>}

    {pending.length > 0 && <>
      <h4 className="sec">Pedidos de ajuste</h4>
      {pending.map(q => <div key={q.id} className="card">
        <div className="small">{q.note}</div>
        <div className="row between">
          <span className="dim t-cap">{fmtDate(String(q.createdAt).slice(0, 10))}</span>
          <Button size="sm" variant="tinted" onClick={() => resolveRequest(q.id).then(load).catch(e => toast(e.message))}>Marcar resuelto</Button>
        </div>
      </div>)}
    </>}

    {bw.length > 1 && <>
      <h4 className="sec">Peso corporal</h4>
      <div className="card"><div className="chart"><LineChart points={bw} h={140} unit={d.unit} /></div></div>
    </>}

    <h4 className="sec">Historial</h4>
    <WorkoutHistory workouts={d.workouts} unit={d.unit} t={t} />
  </div>
}
```

Notas: (a) si `.iconbtn.danger` no existe en `index.css`, agregar `.iconbtn.danger{color:var(--red)}` (reemplaza el `style` de color rojo del código viejo); (b) ver el `bodyweight` de la API: el fixture usa `kg`, la app usa `w` (`bw.w` en `Home.jsx`) — **verificar con `getStudent` real** y mapear `b.w ?? b.kg`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build OK (las rutas aún no apuntan a estas vistas hasta el Task 7), tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Coach.jsx frontend/src/views/CoachStudent.jsx frontend/src/index.css
git commit -m "feat(web): coach students home with weekly adherence + student detail screen"
```

---

### Task 6: Rutinas y Actividad

**Files:**
- Create: `frontend/src/views/CoachRoutines.jsx`
- Create: `frontend/src/views/CoachActivity.jsx`

**Interfaces:**
- Consumes: `openAssignSheet`, `activityFeed`, `listStudents`, `uid`, `exCount`, `countEx`, `DEFAULT_GLYPH`/`glyphOf`.
- Produces: default exports `CoachRoutines` (`/coach/rutinas`), `CoachActivity` (`/coach/actividad`).

- [ ] **Step 1: `CoachRoutines.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { openAssignSheet } from '../components/AssignSheet.jsx'

// The coach's own templates (the same S.routines the athlete Plan edits), with "assign" one tap away.
export default function CoachRoutines() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const mine = S.routines.filter(r => !r.coachAssigned)

  const add = () => {
    const r = { id: uid(), name: 'Nueva rutina', emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  return <div className="narrow">
    <div className="hdr">
      <div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Rutinas</h1><div className="sub">Tus plantillas para asignar</div></div>
      <Button size="sm" variant="tinted" icon="plus" onClick={add}>Nueva</Button>
    </div>
    {mine.length ? <div className="list">{mine.map(r => <div key={r.id} className="item">
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow" onClick={() => nav('/plan/r/' + r.id)}>
        <div className="tt">{r.name}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
      <Button size="xs" variant="tinted" onClick={() => openAssignSheet({ routineId: r.id })}>Asignar</Button>
    </div>)}</div>
      : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>Todavía no tenés rutinas.<br />Creá una y asignala a tus alumnos.</div>}
  </div>
}
```

- [ ] **Step 2: `CoachActivity.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import { listStudents } from '../lib/coachApi.js'
import { activityFeed } from '../lib/coachShell.js'
import Icon from '../components/Icon.jsx'

// Who trained, newest day first. Workouts carry a date but no clock time, so days are the finest grain.
export default function CoachActivity() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const [feed, setFeed] = useState(null)
  useEffect(() => {
    if (!user?.coach) return
    listStudents().then(r => setFeed(activityFeed(r.students))).catch(e => toast(e.message || 'Error'))
  }, [])
  if (!user?.coach) return null
  return <div className="narrow">
    <div className="hdr"><div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Actividad</h1><div className="sub">Lo último que entrenaron tus alumnos</div></div></div>
    {!feed ? <div className="muted small">Cargando…</div>
      : !feed.length ? <div className="empty"><div className="ico"><Icon name="history" /></div>Todavía no hay entrenos para mostrar.</div>
      : feed.map(g => <div key={g.d}>
        <div className="feed-day">{fmtDate(g.d, true)}</div>
        <div className="list">{g.items.map(i => <div key={i.studentId + g.d + i.workout} className="item" onClick={() => nav('/coach/alumno/' + i.studentId)}>
          <div className="grow"><div className="tt">{i.name}</div><div className="ss">terminó {i.workout || 'un entreno'}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>)}</div>
      </div>)}
  </div>
}
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: build OK, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/CoachRoutines.jsx frontend/src/views/CoachActivity.jsx
git commit -m "feat(web): coach routines and activity screens"
```

---

### Task 7: Cableado — tab bar, rutas, entrada y Ajustes

**Files:**
- Modify: `frontend/src/components/TabBar.jsx`
- Modify: `frontend/src/App.jsx:17-29, 73-87`
- Modify: `frontend/src/views/Settings.jsx:90`
- Modify: `frontend/src/views/RoutineEdit.jsx:86, 120, 213` (los `nav('/plan')` del editor de rutinas propias; la línea 54 es la vista de rutina asignada de un alumno y no se toca)

**Interfaces:**
- Consumes: `COACH_TABS`, `activeCoachTab`, `isCoachPath`, `homePathFor`, `routinesPathFor`, `openAssignSheet`.

- [ ] **Step 1: `TabBar.jsx`**

Agregar imports:

```jsx
import { COACH_TABS, activeCoachTab, isCoachPath } from '../lib/coachShell.js'
import { openAssignSheet } from './AssignSheet.jsx'
```

Después de `const on = ...` y antes de `startWorkout`, y reemplazando el `return`:

```jsx
  const coachMode = !!user?.coach && isCoachPath(loc.pathname)
  const activeCoach = activeCoachTab(loc.pathname)

  if (coachMode) {
    const CT = ({ k, icon, to, label, dot }) => (
      <button className={activeCoach === k ? 'on' : ''} onClick={() => nav(to)}>
        <Icon name={icon} />{dot && <i className="tab-dot" aria-hidden="true" />}<span>{label}</span>
      </button>
    )
    const [alumnos, rutinas, actividad] = COACH_TABS
    return (
      <nav id="tabbar">
        <CT {...alumnos} />
        <CT {...rutinas} />
        <button className="start" onClick={() => openAssignSheet()}>
          <span className="cir"><Icon name="plus" /></span><span>Asignar</span>
        </button>
        <CT {...actividad} />
        <CT k="yo" icon="dumbbell" to="/home" label="Yo" dot={!!S.active} />
      </nav>
    )
  }
```

Y en el `return` de atleta, agregar como primer hijo, solo para coaches:

```jsx
      {user?.coach && <button onClick={() => nav('/coach')}><Icon name="chevronLeft" /><span>Coach</span></button>}
```

- [ ] **Step 2: `App.jsx`**

Imports:

```jsx
import CoachStudent from './views/CoachStudent.jsx'
import CoachRoutines from './views/CoachRoutines.jsx'
import CoachActivity from './views/CoachActivity.jsx'
import { homePathFor } from './lib/coachShell.js'
```

Reemplazar la ruta `/coach` y el comodín:

```jsx
              {(() => { const only = el => (user?.coach ? el : <Navigate to="/home" replace />); return <>
                <Route path="/coach" element={only(<Coach />)} />
                <Route path="/coach/rutinas" element={only(<CoachRoutines />)} />
                <Route path="/coach/actividad" element={only(<CoachActivity />)} />
                <Route path="/coach/alumno/:id" element={only(<CoachStudent />)} />
              </> })()}
              <Route path="*" element={<Navigate to={homePathFor(user)} replace />} />
```

(`<Routes>` solo admite `<Route>`/fragmentos como hijos directos: si React Router 7 rechaza el IIFE, declarar `const only = ...` arriba del `return` de `Shell` y listar las 4 `<Route>` planas.)

- [ ] **Step 3: `Settings.jsx`** — borrar la línea 90 (`{user.coach && <Row ... Coach dashboard ...` ) ya que el panel es la raíz del coach.

- [ ] **Step 4: `RoutineEdit.jsx`** — importar `routinesPathFor` y `useStore` (ya está) y reemplazar los tres `nav('/plan')` por `nav(routinesPathFor(user))` con `const user = useStore(s => s.user)` en el componente de edición.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm test && npm run build && node scripts/check-locales.mjs`
Expected: todo PASS (no se agregaron keys de `t()`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TabBar.jsx frontend/src/App.jsx frontend/src/views/Settings.jsx frontend/src/views/RoutineEdit.jsx
git commit -m "feat(web): coach-first shell — coach tab bar, routes, role-based entry"
```

---

### Task 8: Verificación end-to-end y documentación

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-coach-first-shell-design.md` (agregar §10)
- Modify: `CLAUDE.md` (§4 estructura y §6 inventario: rutas nuevas)

- [ ] **Step 1: Correr todo**

Run: `cd api && npm test && cd ../frontend && npm test && npm run build && node scripts/check-locales.mjs`
Expected: todo PASS.

- [ ] **Step 2: Recorrido manual** (`npm run dev` en la raíz, abrir `:5173`, cuenta coach con ≥ 2 alumnos y 1 alumno con workouts recientes)

1. Abrir la app sin hash → cae en `#/coach` (no en `#/home`).
2. Alumnos: tira semanal, "Requiere atención", badge de pedidos; "+" abre invitaciones.
3. ＋ Asignar → elegir rutina → "Todos" → confirmar → toast "Asignada a N alumnos"; repetir y ver "ya la tiene".
4. Fallo parcial: desasignar/forzar un error y ver el toast `2 de 3 asignadas; falló …`.
5. Tocar un alumno → detalle: asignar, quitar, resolver pedido, gráfico de peso, historial. Volver.
6. Rutinas: crear, abrir editor, volver (queda en `/coach/rutinas`), asignar desde la fila.
7. Actividad: días agrupados; tocar abre al alumno.
8. Yo → Home de atleta con tab "← Coach"; iniciar workout, registrar series, timer, terminar; punto naranja en "Yo" durante el workout; volver con "← Coach".
9. Usuario alumno y guest: tab bar y entrada **idénticos** a antes.
10. Dark y light; acentos lime, sky, gold (contraste de `.wk-mini .d.done`); 375px y ≥ 1000px; textos largos (nombre de alumno largo no rompe la fila). Con 6 tabs (coach en modo atleta) en 375px, comprobar que las etiquetas no se cortan.

- [ ] **Step 3: Docs**

Spec: agregar §10 "Ajustes al implementar" con estos cambios respecto del texto original:
- El API devuelve `workoutDates`, `plannedWeekdays`, `recent`, `assignedRoutineIds` (no `weekDays`/`plannedDays`); la semana se calcula en el cliente con la fecha local del coach.
- Rutinas es una vista nueva y delgada (`CoachRoutines`), no una reutilización de `Plan.jsx`; "Yo" es `/home` (no `/yo`).
- Actividad se agrupa por día: los workouts no tienen hora.
- Detalle de alumno: tiles + gráfico de peso + historial (sin PRs/1RM; requeriría datos nuevos).
- El indicador de workout en curso es un punto en el tab "Yo" (sin chip "Resume").
- `dayPlan` (overrides por fecha) del alumno se ignora en la tira; solo cuenta `S.week`.

`CLAUDE.md`: agregar las rutas `/coach/rutinas`, `/coach/actividad`, `/coach/alumno/:id` al §6, y nota en §5.4 sobre `.wk-mini`, `.attn`, `.tag.warn`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-06-coach-first-shell-design.md CLAUDE.md
git commit -m "docs: coach-first shell — spec adjustments and route inventory"
```
