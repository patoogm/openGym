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
    expect(isCoachPath('/coach/rutinas/r1')).toBe(true)
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
    expect(activeCoachTab('/coach/rutinas/r1')).toBe('rutinas')
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
