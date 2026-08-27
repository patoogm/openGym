import { describe, it, expect } from 'vitest'
import { buildHistoryDigest } from './digest.js'

// Field names confirmed against demoSeed.js / history.js / views/Workout.jsx:
//   w.d       — ISO date
//   w.name    — routine name (string); w.routineId is the id
//   w.entries — [{ id, target, sets, topW }]   (NOT w.ex)
//   strength/timed set: { w, r, sec, rpe, rir, done }
//   cardio set: { min, speed, done }
const S = {
  customEx: [],
  workouts: [
    { d: '2026-07-01', name: 'Lunes', entries: [
      { id: '0043', sets: [
        { w: 40, r: 12, rpe: 7, done: true },
        { w: 40, r: 11, rpe: 8, done: true }
      ] }
    ] },
    { d: '2026-08-05', name: 'Lunes', entries: [
      { id: '0043', sets: [{ w: 45, r: 10, rir: 2, done: true }] },
      { id: '2331', target: { mode: 'cardio' }, sets: [
        { min: 12, speed: 20, done: true },
        { min: 10, speed: 20, done: true }
      ] }
    ] }
  ]
}

describe('buildHistoryDigest', () => {
  it('returns one entry per workout, oldest first', () => {
    const d = buildHistoryDigest(S, null)
    expect(d.map(s => s.date)).toEqual(['2026-07-01', '2026-08-05'])
  })

  it('resolves exercise ids to names', () => {
    const d = buildHistoryDigest(S, null)
    expect(d[0].exercises[0].name).toMatch(/squat/i)
  })

  it('carries the routine name', () => {
    const d = buildHistoryDigest(S, null)
    expect(d[0].routine).toBe('Lunes')
  })

  it('summarizes strength sets as weight/reps/rpe', () => {
    const d = buildHistoryDigest(S, null)
    expect(d[0].exercises[0].sets).toEqual([
      { weight: 40, reps: 12, rpe: 7 },
      { weight: 40, reps: 11, rpe: 8 }
    ])
  })

  it('carries rir effort when that is the scale logged', () => {
    const d = buildHistoryDigest(S, null)
    expect(d[1].exercises[0].sets).toEqual([{ weight: 45, reps: 10, rir: 2 }])
  })

  it('summarizes cardio as a single cardioMin figure', () => {
    const d = buildHistoryDigest(S, null)
    const tm = d[1].exercises.find(e => e.cardioMin != null)
    expect(tm.cardioMin).toBe(22)
  })

  it('filters by sinceISO (inclusive)', () => {
    const d = buildHistoryDigest(S, '2026-08-05')
    expect(d).toHaveLength(1)
    expect(d[0].date).toBe('2026-08-05')
  })

  it('caps at 20 sessions, keeping the most recent', () => {
    const many = { customEx: [], workouts: Array.from({ length: 30 }, (_, i) => ({
      d: `2026-01-${String(i + 1).padStart(2, '0')}`, name: 'X',
      entries: [{ id: '0043', sets: [{ w: 20, r: 10, done: true }] }]
    })) }
    const d = buildHistoryDigest(many, null)
    expect(d).toHaveLength(20)
    expect(d[19].date).toBe('2026-01-30')
    expect(d[0].date).toBe('2026-01-11')
  })

  it('ignores sets not marked done', () => {
    const s2 = { customEx: [], workouts: [
      { d: '2026-09-01', name: 'A', entries: [
        { id: '0043', sets: [
          { w: 50, r: 5, done: true },
          { w: 50, r: 5, done: false }
        ] }
      ] }
    ] }
    const d = buildHistoryDigest(s2, null)
    expect(d[0].exercises[0].sets).toEqual([{ weight: 50, reps: 5 }])
  })
})
