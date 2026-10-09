import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Check } from './ui.jsx'

describe('Check', () => {
  it('is a checkbox button that reflects its state', () => {
    const html = renderToStaticMarkup(<Check checked onChange={() => {}} />)
    expect(html).toContain('role="checkbox"')
    expect(html).toContain('aria-checked="true"')
    expect(html).not.toContain('disabled')
  })
  it('can be disabled, which takes it out of the tab order', () => {
    const html = renderToStaticMarkup(<Check checked disabled onChange={() => {}} />)
    expect(html).toContain('disabled')
    expect(html).toContain('aria-disabled="true"')
  })
})
