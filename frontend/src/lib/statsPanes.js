// Pure helpers for the desktop Stats / History panes.
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Accent- and case-insensitive substring filter that keeps the input order.
export function filterByQuery(items, query, labelOf) {
  const q = norm(query).trim()
  if (!q) return items
  return items.filter(it => norm(labelOf(it)).includes(q))
}

// The workout the History panel shows: the requested one, else the latest.
export function pickWorkout(workouts, id) {
  if (!workouts.length) return null
  return (id && workouts.find(w => w.id === id)) || workouts[workouts.length - 1]
}
