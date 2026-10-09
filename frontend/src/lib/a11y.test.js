import { describe, it, expect, vi } from 'vitest'
import { rowProps } from './a11y.js'

const key = (k, same = true) => {
  const el = {}
  return { key: k, target: same ? el : {}, currentTarget: el, preventDefault: vi.fn() }
}

describe('rowProps', () => {
  it('passes clicks through and is focusable with the button role', () => {
    const h = vi.fn()
    const p = rowProps(h)
    expect(p.onClick).toBe(h)
    expect(p.tabIndex).toBe(0)
    expect(p.role).toBe('button')
  })
  it('activates on Enter and Space, preventing the page scroll', () => {
    const h = vi.fn()
    const p = rowProps(h)
    for (const k of ['Enter', ' ']) {
      const e = key(k)
      p.onKeyDown(e)
      expect(e.preventDefault).toHaveBeenCalled()
    }
    expect(h).toHaveBeenCalledTimes(2)
  })
  it('ignores other keys', () => {
    const h = vi.fn()
    rowProps(h).onKeyDown(key('a'))
    rowProps(h).onKeyDown(key('Tab'))
    expect(h).not.toHaveBeenCalled()
  })
  it('ignores keys that come from a nested control', () => {
    const h = vi.fn()
    const e = key('Enter', false)
    rowProps(h).onKeyDown(e)
    expect(h).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
  it('can drop the role for rows that contain buttons', () => {
    expect('role' in rowProps(() => {}, { role: false })).toBe(false)
  })
})
