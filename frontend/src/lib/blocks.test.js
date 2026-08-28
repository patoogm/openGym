import { describe, it, expect } from 'vitest'
import { newManualBlock, activeBlock, materializeBlock, snapshotActiveBlock, finishActiveBlock } from './blocks.js'
import { isSection } from './routine.js'

const baseState = () => ({
  routines: [], week: {}, dayPlan: {},
  program: { blocks: [], activeId: null }
})

const blockWith = (over = {}) => ({
  ...newManualBlock({ name: 'Mes 1', weeks: 4 }),
  id: 'blk1',
  routines: [
    { id: 'br1', name: 'Lunes', emoji: '', ex: [{ id: '0043', sets: 3, reps: 10 }] },
    { id: 'br2', name: 'Jueves', emoji: '', ex: [{ id: '0025', sets: 3, reps: 8 }] }
  ],
  week: { 1: 'br1', 4: 'br2' },
  ...over
})

describe('newManualBlock', () => {
  it('creates a manual block with empty routines and a fresh id', () => {
    const b = newManualBlock({ name: 'Bloque A', weeks: 3 })
    expect(b.name).toBe('Bloque A')
    expect(b.weeks).toBe(3)
    expect(b.source).toBe('manual')
    expect(b.routines).toEqual([])
    expect(b.week).toEqual({})
    expect(b.startedAt).toBeNull()
    expect(b.id).toMatch(/\w+/)
  })
})

describe('materializeBlock', () => {
  it('clones the block routines into s.routines with fresh ids', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    expect(s.routines).toHaveLength(2)
    expect(s.routines.map(r => r.id)).not.toContain('br1')
    expect(s.routines[0].name).toBe('Lunes')
    expect(s.routines[0].ex[0].id).toBe('0043')
  })

  it('remaps the week schedule onto the new routine ids', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    const lunesId = s.routines.find(r => r.name === 'Lunes').id
    const juevesId = s.routines.find(r => r.name === 'Jueves').id
    expect(s.week).toEqual({ 1: lunesId, 4: juevesId })
  })

  it('drops dayPlan overrides that pointed at replaced routines', () => {
    const s = baseState()
    s.routines = [{ id: 'old', name: 'Old', ex: [] }]
    s.dayPlan = { '2026-08-01': 'old', '2026-08-02': 'rest' }
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    expect(s.dayPlan).toEqual({ '2026-08-02': 'rest' })
  })

  it('sets activeId and the block startedAt', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    expect(s.program.activeId).toBe('blk1')
    expect(s.program.blocks[0].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does not mutate the stored block routines (deep clone)', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    s.routines[0].ex[0].sets = 99
    expect(s.program.blocks[0].routines[0].ex[0].sets).toBe(3)
  })

  it('materializing a block keeps section markers and re-ids exercises', () => {
    const s = baseState()
    const block = blockWith({
      routines: [{
        id: 'br1', name: 'Lunes', emoji: '', ex: [
          { section: 'Fuerza' },
          { id: '0043', sets: 3, reps: 10 },
        ],
      }],
      week: { 1: 'br1' },
    })
    s.program.blocks = [block]
    materializeBlock(s, 'blk1')
    const ex = s.routines[0].ex
    expect(isSection(ex[0])).toBe(true)
    expect(ex[0].section).toBe('Fuerza')
    expect(ex[1].id).toBe('0043')
  })
})

describe('activeBlock', () => {
  it('returns the block matching program.activeId', () => {
    const S = baseState()
    S.program.blocks = [blockWith()]
    S.program.activeId = 'blk1'
    expect(activeBlock(S).id).toBe('blk1')
  })
  it('returns null when nothing is active', () => {
    expect(activeBlock(baseState())).toBeNull()
  })
})

describe('snapshotActiveBlock', () => {
  it('copies live routines and week back into the active block', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    s.routines[0].ex.push({ id: '9999', sets: 2, reps: 15 })
    snapshotActiveBlock(s)
    const stored = s.program.blocks[0]
    expect(stored.routines[0].ex).toHaveLength(2)
    expect(stored.week).toEqual(s.week)
  })
  it('is a no-op with no active block', () => {
    const s = baseState()
    expect(() => snapshotActiveBlock(s)).not.toThrow()
  })
})

describe('finishActiveBlock', () => {
  it('snapshots, stamps completedAt, and clears activeId', () => {
    const s = baseState()
    s.program.blocks = [blockWith()]
    materializeBlock(s, 'blk1')
    finishActiveBlock(s)
    expect(s.program.blocks[0].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(s.program.activeId).toBeNull()
  })
})
