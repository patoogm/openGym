// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { DEF } from './useStore.js'

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
})
