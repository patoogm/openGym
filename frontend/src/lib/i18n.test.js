// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { setLang, setExNamesEn, nameFor } from './i18n.js'

describe('nameFor', () => {
  beforeEach(async () => { await setLang('en'); setExNamesEn(false) })

  it('falls back to the English name when the id is not in the pack', async () => {
    await setLang('es')
    expect(nameFor({ id: 'zzzz', n: 'made up move' })).toBe('made up move')
  })

  it('returns the translated name for a known id when a pack is loaded', async () => {
    await setLang('es')
    expect(nameFor({ id: '0001', n: '3/4 sit-up' })).toBe('abdominal 3/4')
  })

  it('returns the English name when exNamesEn is on, even with a pack loaded', async () => {
    await setLang('es')
    setExNamesEn(true)
    expect(nameFor({ id: '0001', n: '3/4 sit-up' })).toBe('3/4 sit-up')
  })

  it('returns the English name when the UI language is English', async () => {
    await setLang('en')
    expect(nameFor({ id: '0001', n: '3/4 sit-up' })).toBe('3/4 sit-up')
  })
})
