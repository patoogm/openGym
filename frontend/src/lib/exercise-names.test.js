// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { EXDB } from './exercises-data.js'
import { setLang, setExNamesEn, nameFor } from './i18n.js'

// The exercise picker / Library filter matches a query against BOTH the English name
// (e.n) and the current-language name (nameFor(e)). This exercises that predicate.
const matches = (e, ql) =>
  e.n.toLowerCase().includes(ql) || nameFor(e).toLowerCase().includes(ql)

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

  it('every dataset exercise has a non-empty Spanish name', () => {
    const gaps = EXDB.filter(e => !nameFor(e) || !nameFor(e).trim())
    expect(gaps).toEqual([])
  })
})
