import { describe, it, expect } from 'vitest'
import { loadOfRoutine } from './muscles.js'

describe('loadOfRoutine', () => {
  it('ignores section markers when summing planned load', () => {
    const withSections = loadOfRoutine({ ex: [
      { section: 'Fuerza' },
      { id: '0025', sets: 4 },
      { section: 'Accesorios' },
      { id: '0294', sets: 3 },
    ] })
    const flat = loadOfRoutine({ ex: [
      { id: '0025', sets: 4 },
      { id: '0294', sets: 3 },
    ] })
    expect(withSections).toEqual(flat)
  })
})
