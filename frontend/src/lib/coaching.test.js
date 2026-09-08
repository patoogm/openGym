import { describe, it, expect } from 'vitest'
import { mergeAssigned, stripAssigned, isAssigned } from './coaching.js'

const local = [{ id: 'l1', name: 'Mine', ex: [] }, { id: 'l2', name: 'Also mine', ex: [] }]
const assigned = [{ id: 'c1', name: 'Coach plan', ex: [], coachAssigned: true }]

describe('mergeAssigned', () => {
  it('appends assigned routines flagged coachAssigned', () => {
    const out = mergeAssigned(local, assigned)
    expect(out.map(r => r.id)).toEqual(['l1', 'l2', 'c1'])
    expect(out[2].coachAssigned).toBe(true)
  })
  it('does not mutate inputs', () => {
    const l = JSON.parse(JSON.stringify(local))
    mergeAssigned(l, assigned)
    expect(l).toEqual(local)
  })
  it('an assigned id equal to a local id replaces the local in place', () => {
    const out = mergeAssigned(local, [{ id: 'l2', name: 'Overridden', ex: [], coachAssigned: true }])
    expect(out.map(r => r.id)).toEqual(['l1', 'l2'])
    expect(out[1].name).toBe('Overridden')
    expect(out[1].coachAssigned).toBe(true)
  })
  it('empty assigned returns an equivalent list', () => {
    expect(mergeAssigned(local, [])).toEqual(local)
  })
})

describe('stripAssigned', () => {
  it('removes every coachAssigned routine, keeps local order', () => {
    expect(stripAssigned(mergeAssigned(local, assigned))).toEqual(local)
  })
})

describe('isAssigned', () => {
  it('true only for a coachAssigned routine', () => {
    expect(isAssigned(assigned[0])).toBe(true)
    expect(isAssigned(local[0])).toBe(false)
    expect(isAssigned(undefined)).toBe(false)
  })
})
