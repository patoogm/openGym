import { describe, it, expect } from 'vitest'
import { entryConfigs } from './routine.js'

describe('entryConfigs', () => {
  it('drops markers and tags each config with its section', () => {
    const list = [
      { section: 'Fuerza' },
      { id: '0025', sets: 4, sg: 'a' },
      { id: '0043', sets: 3, sg: 'a' },
      { section: 'Cardio' },
      { id: 'treadmill', sets: 1 },
      { id: '0294', sets: 3 },            // still Cardio
    ]
    const out = entryConfigs(list)
    expect(out.map(x => x.cfg.id)).toEqual(['0025', '0043', 'treadmill', '0294'])
    expect(out.map(x => x.section)).toEqual(['Fuerza', 'Fuerza', 'Cardio', 'Cardio'])
    expect(out[0].cfg.sg).toBe('a')       // config passed through untouched
  })

  it('leaves pre-marker exercises with a null section', () => {
    const out = entryConfigs([{ id: '0025', sets: 3 }, { section: 'X' }, { id: '0043', sets: 3 }])
    expect(out.map(x => x.section)).toEqual([null, 'X'])
  })
})
