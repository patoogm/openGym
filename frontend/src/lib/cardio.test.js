import { describe, it, expect } from 'vitest'
import { minutesJogged, intervalSummary, plannedRounds } from './cardio.js'

const iv = { warmupMin: 5, rounds: 8, workMin: 1, restMin: 1.5, cooldownMin: 5 }

describe('minutesJogged', () => {
  it('multiplies rounds done by the work minutes of each round', () => {
    expect(minutesJogged(iv, 8)).toBe(8)
    expect(minutesJogged({ ...iv, rounds: 6, workMin: 2 }, 6)).toBe(12)
  })

  it('counts only the rounds actually done, not the prescribed ones', () => {
    expect(minutesJogged(iv, 5)).toBe(5)
  })

  it('allows going past the prescribed rounds', () => {
    expect(minutesJogged(iv, 10)).toBe(10)
  })

  it('returns 0 when no round was done', () => {
    expect(minutesJogged(iv, 0)).toBe(0)
  })

  it('rounds to one decimal to avoid float drift', () => {
    expect(minutesJogged({ ...iv, workMin: 1.5 }, 3)).toBe(4.5)
  })

  it('with no intervals, returns the value unchanged (steady-state minutes)', () => {
    expect(minutesJogged(null, 22)).toBe(22)
    expect(minutesJogged(undefined, 20)).toBe(20)
  })
})

describe('intervalSummary', () => {
  it('describes warm-up, rounds and cool-down', () => {
    expect(intervalSummary(iv)).toBe('5′ warm-up · 8 × (1′ / 1.5′) · 5′ cool-down')
  })

  it('omits warm-up / cool-down when zero', () => {
    expect(intervalSummary({ warmupMin: 0, rounds: 4, workMin: 3, restMin: 1.5, cooldownMin: 0 }))
      .toBe('4 × (3′ / 1.5′)')
  })

  it('returns empty string for null', () => {
    expect(intervalSummary(null)).toBe('')
  })
})

describe('plannedRounds', () => {
  it('reads the prescribed round count', () => {
    expect(plannedRounds(iv)).toBe(8)
    expect(plannedRounds(null)).toBe(0)
  })
})
