import { useEffect, useRef } from 'react'
import { t } from '../lib/i18n.js'

const KEY = 'og.paneW'
const MIN = 260
const MAX = 560
const STEP = 16

const clamp = n => Math.max(MIN, Math.min(MAX, Math.round(n)))

function stored() {
  try {
    const n = parseInt(localStorage.getItem(KEY), 10)
    return Number.isFinite(n) ? clamp(n) : null
  } catch { return null }
}

// Drag handle between the list and the detail of a `.pane`: resizes the list column.
// The width lives in the pane's --list-w and is remembered across panes (Plan, History, …).
export default function PaneGrip() {
  const ref = useRef(null)
  const pane = () => ref.current && ref.current.parentElement

  const apply = (w, save) => {
    const p = pane()
    if (!p) return
    if (w == null) p.style.removeProperty('--list-w')
    else p.style.setProperty('--list-w', w + 'px')
    if (!save) return
    try { w == null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, String(w)) } catch { /* private mode */ }
  }

  useEffect(() => { const w = stored(); if (w) apply(w, false) }, [])

  const current = () => {
    const l = pane() && pane().querySelector('.pane-list')
    return l ? l.getBoundingClientRect().width : 340
  }

  const down = e => {
    e.preventDefault()
    const p = pane()
    const left = p.getBoundingClientRect().left
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
    const move = ev => apply(clamp(ev.clientX - left), false)
    const up = ev => {
      el.releasePointerCapture(e.pointerId)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      document.body.classList.remove('resizing')
      apply(clamp(ev.clientX - left), true)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const key = e => {
    const d = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0
    if (!d) return
    e.preventDefault()
    apply(clamp(current() + d), true)
  }

  return <div ref={ref} className="pane-grip" role="separator" aria-orientation="vertical" tabIndex={0}
    aria-label={t('Resize panel')} onPointerDown={down} onKeyDown={key} onDoubleClick={() => apply(null, true)} />
}
