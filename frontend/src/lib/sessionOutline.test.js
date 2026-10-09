import { describe, it, expect } from 'vitest'
import { sessionOutline } from './sessionOutline.js'

const E = (id, done, total, extra = {}) => ({ id, sets: Array.from({ length: total }, (_, i) => ({ done: i < done })), ...extra })

describe('sessionOutline', () => {
  it('is empty for no workout, no entries (freestyle) or a missing list', () => {
    expect(sessionOutline(null)).toEqual([])
    expect(sessionOutline(undefined)).toEqual([])
    expect(sessionOutline({ cur: 0, entries: [] })).toEqual([])
    expect(sessionOutline({ cur: 0 })).toEqual([])
  })

  it('one row per exercise with set counts and a status', () => {
    const rows = sessionOutline({ cur: 1, entries: [E('a', 3, 3), E('b', 1, 4), E('c', 0, 3)] })
    expect(rows.map(r => [r.type, r.first, r.done, r.total, r.status])).toEqual([
      ['unit', 0, 3, 3, 'done'],
      ['unit', 1, 1, 4, 'current'],
      ['unit', 2, 0, 3, 'pending']
    ])
    expect(rows[1].items).toEqual([{ idx: 1, id: 'b', done: 1, total: 4 }])
    expect(rows[1].superset).toBe(false)
  })

  it('a finished exercise that is also the current one reads as current', () => {
    const rows = sessionOutline({ cur: 0, entries: [E('a', 3, 3), E('b', 0, 3)] })
    expect(rows[0].status).toBe('current')
  })

  it('an exercise with no sets is pending, never done', () => {
    const rows = sessionOutline({ cur: 1, entries: [E('a', 0, 0), E('b', 0, 2)] })
    expect(rows[0].status).toBe('pending')
    expect(rows[0].total).toBe(0)
  })

  it('groups a superset into one row whose status follows any member being current', () => {
    const rows = sessionOutline({ cur: 2, entries: [
      E('a', 2, 2),
      E('b', 1, 3, { sg: 's1' }),
      E('c', 0, 3, { sg: 's1' }),
      E('d', 0, 2)
    ] })
    expect(rows).toHaveLength(3)
    expect(rows[1].superset).toBe(true)
    expect(rows[1].first).toBe(1)
    expect(rows[1].items.map(i => i.idx)).toEqual([1, 2])
    expect(rows[1].done).toBe(1)
    expect(rows[1].total).toBe(6)
    expect(rows[1].status).toBe('current')
  })

  it('emits a section header only when the section changes', () => {
    const rows = sessionOutline({ cur: 0, entries: [
      E('a', 0, 1, { section: 'Warm-up' }),
      E('b', 0, 1, { section: 'Warm-up' }),
      E('c', 0, 1, { section: 'Main' }),
      E('d', 0, 1, { section: null }),
      E('e', 0, 1, { section: 'Main' })
    ] })
    expect(rows.map(r => r.type === 'section' ? 'S:' + r.label : 'U' + r.first)).toEqual(
      ['S:Warm-up', 'U0', 'U1', 'S:Main', 'U2', 'U3', 'S:Main', 'U4'])
  })

  it('clamps a cursor that points past the end or below zero', () => {
    const past = sessionOutline({ cur: 99, entries: [E('a', 0, 1), E('b', 0, 1)] })
    expect(past.map(r => r.status)).toEqual(['pending', 'current'])
    const neg = sessionOutline({ cur: -3, entries: [E('a', 0, 1), E('b', 0, 1)] })
    expect(neg.map(r => r.status)).toEqual(['current', 'pending'])
  })

  it('keys are unique across rows', () => {
    const rows = sessionOutline({ cur: 0, entries: [E('a', 0, 1, { section: 'X' }), E('b', 0, 1, { section: 'Y' })] })
    expect(new Set(rows.map(r => r.key)).size).toBe(rows.length)
  })
})
