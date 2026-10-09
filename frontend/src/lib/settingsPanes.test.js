import { describe, it, expect } from 'vitest'
import { settingsCats, resolveCat, settingsCatPath } from './settingsPanes.js'

describe('settingsCats', () => {
  it('has a fixed order and hides Notifications unless available', () => {
    expect(settingsCats({ notifications: false }).map(c => c.k)).toEqual(['account', 'training', 'general', 'data'])
    expect(settingsCats({ notifications: true }).map(c => c.k)).toEqual(['account', 'training', 'general', 'notifications', 'data'])
  })
  it('gives every category an icon and a label', () => {
    for (const c of settingsCats({ notifications: true })) {
      expect(typeof c.icon).toBe('string')
      expect(c.label.length).toBeGreaterThan(0)
    }
  })
})

describe('resolveCat', () => {
  const cats = settingsCats({ notifications: false })
  it('treats no category as the first one and valid', () => {
    expect(resolveCat(undefined, cats)).toEqual({ key: 'account', valid: true })
    expect(resolveCat('', cats)).toEqual({ key: 'account', valid: true })
  })
  it('accepts a listed category', () => {
    expect(resolveCat('data', cats)).toEqual({ key: 'data', valid: true })
  })
  it('flags a category that is unknown or not available here', () => {
    expect(resolveCat('junk', cats)).toEqual({ key: 'account', valid: false })
    expect(resolveCat('notifications', cats)).toEqual({ key: 'account', valid: false })
  })
})

describe('settingsCatPath', () => {
  it('builds the route', () => expect(settingsCatPath('data')).toBe('/settings/data'))
})
