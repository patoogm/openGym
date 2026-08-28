import { describe, it, expect } from 'vitest'
import { isSection, exItems, countEx, sectionsOf, sectionAt } from './routine.js'

const SEC = n => ({ section: n })
const EX = id => ({ id, sets: 3, reps: 10 })

describe('isSection', () => {
  it('is true for a marker and false for an exercise or junk', () => {
    expect(isSection(SEC('Fuerza'))).toBe(true)
    expect(isSection(EX('0025'))).toBe(false)
    expect(isSection({ section: 'x', id: '0025' })).toBe(false) // has an id → not a marker
    expect(isSection(null)).toBe(false)
    expect(isSection(undefined)).toBe(false)
  })
})

describe('exItems / countEx', () => {
  it('drops markers, keeps exercises, tolerates undefined', () => {
    const list = [SEC('A'), EX('1'), EX('2'), SEC('B'), EX('3')]
    expect(exItems(list).map(e => e.id)).toEqual(['1', '2', '3'])
    expect(countEx(list)).toBe(3)
    expect(exItems(undefined)).toEqual([])
    expect(countEx(undefined)).toBe(0)
    expect(countEx([SEC('A'), SEC('B')])).toBe(0)
  })
})

describe('sectionsOf', () => {
  it('returns a single null group when there are no markers', () => {
    const list = [EX('1'), EX('2')]
    const g = sectionsOf(list)
    expect(g).toHaveLength(1)
    expect(g[0].name).toBe(null)
    expect(g[0].rows.map(r => r.i)).toEqual([0, 1])
  })

  it('omits the leading null group when a marker is first', () => {
    const g = sectionsOf([SEC('Fuerza'), EX('1'), EX('2')])
    expect(g).toHaveLength(1)
    expect(g[0].name).toBe('Fuerza')
    expect(g[0].rows.map(r => r.e.id)).toEqual(['1', '2'])
  })

  it('keeps the leading null group when exercises precede the first marker', () => {
    const g = sectionsOf([EX('1'), SEC('Fuerza'), EX('2')])
    expect(g.map(x => x.name)).toEqual([null, 'Fuerza'])
    expect(g[0].rows.map(r => r.i)).toEqual([0])
    expect(g[1].rows.map(r => r.i)).toEqual([2])
  })

  it('represents consecutive markers as an empty group', () => {
    const g = sectionsOf([SEC('A'), SEC('B'), EX('1')])
    expect(g.map(x => x.name)).toEqual(['A', 'B'])
    expect(g[0].rows).toEqual([])
    expect(g[1].rows.map(r => r.e.id)).toEqual(['1'])
  })

  it('returns [] for an empty list', () => {
    expect(sectionsOf([])).toEqual([])
    expect(sectionsOf(undefined)).toEqual([])
  })
})

describe('sectionAt', () => {
  const list = [EX('0'), SEC('Fuerza'), EX('2'), EX('3'), SEC('Cardio'), EX('5')]
  it('finds the enclosing section name', () => {
    expect(sectionAt(list, 0)).toBe(null)
    expect(sectionAt(list, 2)).toBe('Fuerza')
    expect(sectionAt(list, 3)).toBe('Fuerza')
    expect(sectionAt(list, 5)).toBe('Cardio')
  })
})
