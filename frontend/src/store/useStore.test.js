// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { DEF } from './useStore.js'
import { stripAssigned } from '../lib/coaching.js'

describe('assigned routines never reach the persisted blob', () => {
  it('stripAssigned removes coach routines from a merged list before PUT', () => {
    const merged = [
      { id: 'l1', name: 'Mine', ex: [] },
      { id: 'c1', name: 'Coach', ex: [], coachAssigned: true }
    ]
    expect(stripAssigned(merged)).toEqual([{ id: 'l1', name: 'Mine', ex: [] }])
  })
})

describe('DEF', () => {
  it('has an empty training profile', () => {
    expect(DEF.profile).toEqual({})
  })

  it('has an empty program with no active block', () => {
    expect(DEF.program).toEqual({ blocks: [], activeId: null })
  })

  it('merging an old state (no profile/program) onto DEF fills them in', () => {
    const old = { routines: [{ id: 'r1', name: 'A', ex: [] }], week: { 1: 'r1' } }
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), old)
    expect(merged.program).toEqual({ blocks: [], activeId: null })
    expect(merged.profile).toEqual({})
    expect(merged.routines).toHaveLength(1)
  })

  it('shows translated exercise names by default (exNamesEn false)', () => {
    expect(DEF.exNamesEn).toBe(false)
  })

  it('an old state without exNamesEn reads as false after merge', () => {
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), { routines: [] })
    expect(merged.exNamesEn).toBe(false)
  })

  it('a pre-sections routine is unchanged after merge onto DEF', () => {
    const old = { routines: [{ id: 'r1', name: 'A', ex: [{ id: '0025', sets: 3, reps: 8 }] }] }
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), old)
    expect(merged.routines[0].ex).toEqual([{ id: '0025', sets: 3, reps: 8 }])
  })
})
