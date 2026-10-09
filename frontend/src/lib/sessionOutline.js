// Pure outline of an active workout for the desktop session rail: the exercises (a superset is
// one row), the section headers between them, how many sets of each are done and which one
// the cursor is on. Names are not resolved here — rows carry exercise ids so this stays free of
// i18n and the exercise database.
import { supersetUnits } from './history.js'

export function sessionOutline(A) {
  const entries = (A && A.entries) || []
  if (!entries.length) return []
  const cur = Math.min(Math.max(A.cur || 0, 0), entries.length - 1)
  const rows = []
  let lastSection = null
  supersetUnits(entries).forEach(unit => {
    const section = entries[unit[0]].section || null
    if (section && section !== lastSection) rows.push({ type: 'section', key: 's' + unit[0], label: section })
    lastSection = section
    const items = unit.map(idx => {
      const e = entries[idx]
      return { idx, id: e.id, done: e.sets.filter(s => s.done).length, total: e.sets.length }
    })
    const done = items.reduce((n, i) => n + i.done, 0)
    const total = items.reduce((n, i) => n + i.total, 0)
    const status = unit.includes(cur) ? 'current' : total > 0 && done === total ? 'done' : 'pending'
    rows.push({ type: 'unit', key: 'u' + unit[0], first: unit[0], items, superset: unit.length > 1, done, total, status })
  })
  return rows
}
