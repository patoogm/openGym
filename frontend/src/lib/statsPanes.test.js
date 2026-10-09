import { describe, it, expect } from 'vitest'
import { filterByQuery, pickWorkout } from './statsPanes.js'

const label = x => x.n
const items = [{ n: 'Sentadílla búlgara' }, { n: 'Press banca' }, { n: 'Remo con barra' }]

describe('filterByQuery', () => {
  it('returns everything for a blank query', () => {
    expect(filterByQuery(items, '', label)).toBe(items)
    expect(filterByQuery(items, '   ', label)).toBe(items)
  })
  it('ignores case and accents', () => {
    expect(filterByQuery(items, 'SENTADILLA', label)).toEqual([items[0]])
    expect(filterByQuery(items, 'busq', label)).toEqual([])
    expect(filterByQuery(items, 'bulgara', label)).toEqual([items[0]])
  })
  it('keeps the original order and matches substrings', () => {
    expect(filterByQuery(items, 'r', label).map(label)).toEqual(['Sentadílla búlgara', 'Press banca', 'Remo con barra'])
  })
  it('returns an empty list when nothing matches', () => {
    expect(filterByQuery(items, 'zzz', label)).toEqual([])
  })
})

describe('pickWorkout', () => {
  const ws = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('finds by id', () => expect(pickWorkout(ws, 'b')).toBe(ws[1]))
  it('falls back to the latest when id is missing or unknown', () => {
    expect(pickWorkout(ws, undefined)).toBe(ws[2])
    expect(pickWorkout(ws, 'gone')).toBe(ws[2])
  })
  it('is null for no workouts', () => expect(pickWorkout([], 'a')).toBeNull())
})
