// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { EXDB } from './exercises-data.js'
import { setLang, setExNamesEn, nameFor } from './i18n.js'
import { fold } from './exercises.js'

// The exercise picker / Library filter matches a folded (lowercased, accent-stripped)
// query against BOTH the English name (e.n) and the current-language name (nameFor(e)).
const matches = (e, ql) => {
  const q = fold(ql)
  return fold(e.n).includes(q) || fold(nameFor(e)).includes(q)
}

describe('exercise search across languages', () => {
  beforeAll(async () => { await setLang('es'); setExNamesEn(false) })

  const squat = EXDB.find(e => e.id === '0043') // "barbell full squat"

  it('finds an exercise by its English term', () => {
    expect(matches(squat, 'squat')).toBe(true)
  })

  it('finds the same exercise by its Spanish term', () => {
    expect(nameFor(squat)).toContain('sentadilla')
    expect(matches(squat, 'sentadilla')).toBe(true)
  })

  it('ignores accents in the query', () => {
    const bulgarian = EXDB.find(e => nameFor(e).includes('búlgara'))
    expect(matches(bulgarian, 'bulgara')).toBe(true)
    expect(matches(bulgarian, 'BÚLGARA')).toBe(true)
  })

  it('every dataset exercise has a non-empty Spanish name', () => {
    const gaps = EXDB.filter(e => !nameFor(e) || !nameFor(e).trim())
    expect(gaps).toEqual([])
  })
})
