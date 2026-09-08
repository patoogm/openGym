// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { DEF } from './useStore.js'
import { stripAssigned } from '../lib/coaching.js'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn(() => Promise.resolve({})) }))
vi.mock('../lib/api.js', () => ({ api: apiMock }))
vi.mock('../lib/coachApi.js', () => ({ fetchAssigned: vi.fn(() => Promise.resolve([])) }))

describe('assigned routines never reach the persisted blob', () => {
  it('stripAssigned removes coach routines from a merged list before PUT', () => {
    const merged = [
      { id: 'l1', name: 'Mine', ex: [] },
      { id: 'c1', name: 'Coach', ex: [], coachAssigned: true }
    ]
    expect(stripAssigned(merged)).toEqual([{ id: 'l1', name: 'Mine', ex: [] }])
  })

  it('pushState() PUTs a state whose routines carry no coachAssigned entry', async () => {
    const { useStore } = await import('./useStore.js')
    apiMock.mockClear()
    useStore.getState().setUser({ uid: 'u1', name: 'Stu' })
    useStore.getState().update(s => {
      s.routines = [
        { id: 'l1', name: 'Mine', ex: [] },
        { id: 'c1', name: 'Coach', ex: [], coachAssigned: true, assignmentId: 'a1' }
      ]
    }, false)
    await useStore.getState().pushState()
    const put = apiMock.mock.calls.find(c => c[0] === '/api/data' && c[1] && c[1].method === 'PUT')
    expect(put).toBeTruthy()
    const body = JSON.parse(put[1].body)
    expect(body.state.routines.some(r => r.coachAssigned)).toBe(false)
    expect(body.state.routines).toHaveLength(1)
    expect(body.state.routines[0].id).toBe('l1')
  })

  it('persist() writes localStorage without coachAssigned routines', async () => {
    const { useStore } = await import('./useStore.js')
    useStore.getState().update(s => {
      s.routines = [
        { id: 'l2', name: 'Mine', ex: [] },
        { id: 'c2', name: 'Coach', ex: [], coachAssigned: true }
      ]
    }, false)
    const raw = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(raw.routines.some(r => r.coachAssigned)).toBe(false)
  })
})

describe('DEF', () => {
  it('has an empty training profile', () => {
    expect(DEF.profile).toEqual({})
  })

  it('has an empty program with no active block', () => {
    expect(DEF.program).toEqual({ blocks: [], activeId: null })
  })

  it('merging an old state (no profile/program) onto DEF fills them in', () => {
    const old = { routines: [{ id: 'r1', name: 'A', ex: [] }], week: { 1: 'r1' } }
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), old)
    expect(merged.program).toEqual({ blocks: [], activeId: null })
    expect(merged.profile).toEqual({})
    expect(merged.routines).toHaveLength(1)
  })

  it('shows translated exercise names by default (exNamesEn false)', () => {
    expect(DEF.exNamesEn).toBe(false)
  })

  it('an old state without exNamesEn reads as false after merge', () => {
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), { routines: [] })
    expect(merged.exNamesEn).toBe(false)
  })

  it('a pre-sections routine is unchanged after merge onto DEF', () => {
    const old = { routines: [{ id: 'r1', name: 'A', ex: [{ id: '0025', sets: 3, reps: 8 }] }] }
    const merged = Object.assign(JSON.parse(JSON.stringify(DEF)), old)
    expect(merged.routines[0].ex).toEqual([{ id: '0025', sets: 3, reps: 8 }])
  })
})
