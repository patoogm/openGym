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

export const routinePath = id => '/coach/rutinas/' + id
export const routineEditPath = id => '/coach/rutinas/' + id + '/editar'

// Students who can still receive `routineId` (older API rows may lack assignedRoutineIds).
export const eligibleStudents = (students, routineId) =>
  (students || []).filter(s => !(s.assignedRoutineIds || []).includes(routineId))

// Routines `student` does not have yet.
export const eligibleRoutines = (routines, student) => {
  const has = (student && student.assignedRoutineIds) || []
  return (routines || []).filter(r => !has.includes(r.id))
}

// Same wording as the "Requiere atención" banner, one string per reason.
export function attentionTexts(row, today) {
  return attentionReasons(row, today).map(r => r === 'request'
    ? row.pendingRequests + (row.pendingRequests === 1 ? ' pedido de cambio' : ' pedidos de cambio')
    : row.lastWorkout ? 'sin entrenar (' + lastLabel(row, today) + ')' : 'sin entrenos todavía')
}

// One student, many routines. Reuses assignMany by swapping roles, so okIds/failed carry ROUTINE ids.
export const assignRoutines = (assignFn, studentId, routines) =>
  assignMany((routineId, sid) => assignFn(sid, routineId), studentId, routines)

export function assignRoutinesSummary({ okIds, failed }) {
  if (!failed.length) return okIds.length === 1 ? 'Rutina asignada' : okIds.length + ' rutinas asignadas'
  const total = okIds.length + failed.length
  return okIds.length + ' de ' + total + ' asignadas; falló ' + failed.map(f => f.name).join(', ') + ': ' + failed[0].message
}
