import { describe, it, expect } from 'vitest'
import { ATHLETE_TABS, ATHLETE_MORE, activeAthleteTab, athleteFooter, showAthleteShell } from './athleteShell.js'

describe('nav lists', () => {
  it('have unique keys and routes, and the main tabs mirror the mobile tab bar', () => {
    const all = [...ATHLETE_TABS, ...ATHLETE_MORE]
    expect(new Set(all.map(i => i.k)).size).toBe(all.length)
    expect(new Set(all.map(i => i.to)).size).toBe(all.length)
    expect(ATHLETE_TABS.map(i => i.to)).toEqual(['/home', '/plan', '/stats', '/library'])
    expect(ATHLETE_MORE.map(i => i.to)).toEqual(['/program', '/history', '/profile', '/settings'])
  })
})

describe('activeAthleteTab', () => {
  it('maps each section, including nested routes', () => {
    expect(activeAthleteTab('/home')).toBe('home')
    expect(activeAthleteTab('/')).toBe('home')
    expect(activeAthleteTab('')).toBe('home')
    expect(activeAthleteTab('/plan')).toBe('plan')
    expect(activeAthleteTab('/plan/')).toBe('plan')
    expect(activeAthleteTab('/plan/r/abc')).toBe('plan')
    expect(activeAthleteTab('/workout')).toBe('workout')
    expect(activeAthleteTab('/workout/extra')).toBe('workout')
    expect(activeAthleteTab('/stats')).toBe('stats')
    expect(activeAthleteTab('/history')).toBe('history')
    expect(activeAthleteTab('/library')).toBe('library')
    expect(activeAthleteTab('/program')).toBe('program')
    expect(activeAthleteTab('/profile')).toBe('profile')
    expect(activeAthleteTab('/settings')).toBe('settings')
    expect(activeAthleteTab('/admin')).toBe('admin')
  })
  it('returns null for the coach area and for unknown or hostile paths', () => {
    expect(activeAthleteTab('/coach')).toBe(null)
    expect(activeAthleteTab('/coach/x')).toBe(null)
    expect(activeAthleteTab('/nope')).toBe(null)
    expect(activeAthleteTab('/constructor')).toBe(null)
    expect(activeAthleteTab('/__proto__')).toBe(null)
    expect(activeAthleteTab(undefined)).toBe('home')
  })
})

describe('athleteFooter', () => {
  it('is empty without a user (guest/demo) and for plain athletes', () => {
    expect(athleteFooter(null)).toEqual([])
    expect(athleteFooter(undefined)).toEqual([])
    expect(athleteFooter({ name: 'a' })).toEqual([])
  })
  it('offers the coach panel and admin by role', () => {
    expect(athleteFooter({ coach: true }).map(i => i.to)).toEqual(['/coach'])
    expect(athleteFooter({ admin: true }).map(i => i.to)).toEqual(['/admin'])
    expect(athleteFooter({ coach: true, admin: true }).map(i => i.k)).toEqual(['coach', 'admin'])
  })
  it('gives every nav entry its own icon so two rows never look alike', () => {
    const icons = [...ATHLETE_TABS, ...ATHLETE_MORE, ...athleteFooter({ coach: true, admin: true })].map(i => i.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })
})

describe('showAthleteShell', () => {
  it('needs desktop, a session, and a non-coach path', () => {
    expect(showAthleteShell('/home', true, true)).toBe(true)
    expect(showAthleteShell('/workout', true, true)).toBe(true)
    expect(showAthleteShell('/home', false, true)).toBe(false)
    expect(showAthleteShell('/home', true, false)).toBe(false)
    expect(showAthleteShell('/coach', true, true)).toBe(false)
    expect(showAthleteShell('/coach/rutinas/r1', true, true)).toBe(false)
  })
  it('does not throw on a missing path', () => {
    expect(showAthleteShell(undefined, true, true)).toBe(true)
    expect(showAthleteShell(null, true, true)).toBe(true)
    expect(showAthleteShell('', true, true)).toBe(true)
  })
})
