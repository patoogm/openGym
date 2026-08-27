import { describe, it, expect } from 'vitest'
import { buildPlanBundle, parsePlan, planPrintHTML } from './plan-share.js'

const stateWith = (ex, customEx = []) => ({
  unit: 'kg', customEx, week: { 1: 'r1' },
  routines: [{ id: 'r1', name: 'Day 1', emoji: '', ex }]
})

describe('plan bundle round-trip', () => {
  it('keeps interval cardio config through export → import', () => {
    const intervals = { warmupMin: 5, rounds: 8, workMin: 1, restMin: 1.5, cooldownMin: 5 }
    const bundle = buildPlanBundle(stateWith(
      [{ id: 'treadmill', sets: 1, mode: 'cardio', min: 30, speed: 8, intervals }],
      [{ id: 'treadmill', n: 'Treadmill', bp: 'cardio' }]
    ), 'Test')
    const parsed = parsePlan(JSON.stringify(bundle))
    const ex = parsed.routines[0].ex[0]
    expect(ex.intervals).toEqual(intervals)
  })

  it('prints the interval breakdown, not stale steady-state text', () => {
    const intervals = { warmupMin: 5, rounds: 8, workMin: 1, restMin: 1.5, cooldownMin: 5 }
    const html = planPrintHTML(stateWith(
      [{ id: 'treadmill', sets: 1, mode: 'cardio', min: 30, speed: 8, intervals }]
    ), '')
    expect(html).toContain('8 × (1′ / 1.5′)')
    expect(html).not.toContain('30 min @')
  })

  it('keeps repsMin / repsMax for double progression', () => {
    const bundle = buildPlanBundle(stateWith(
      [{ id: '0043', sets: 3, reps: 12, repsMin: 8, repsMax: 12, prog: 'double' }]
    ), 'Test')
    const ex = parsePlan(JSON.stringify(bundle)).routines[0].ex[0]
    expect(ex.repsMin).toBe(8)
    expect(ex.repsMax).toBe(12)
  })
})
