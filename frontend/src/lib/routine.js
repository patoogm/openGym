// Routine sections. A section is a marker entry interleaved in routine.ex with the
// shape { section: "<name>" } and no id — see docs/superpowers/specs/2026-08-28-routine-sections-design.md.
// routine.ex stays the ordered source of truth; these helpers let every consumer that
// wants "just the exercises" or "the groups" read past the markers.

export const isSection = e => e != null && e.section != null && e.id == null

export const exItems = list => (list || []).filter(e => !isSection(e))

export const countEx = list => exItems(list).length

// Walk the flat list into rendered groups, keeping the real index of every exercise.
// The leading group (name: null) holds exercises before the first marker; it is
// dropped when empty. Consecutive markers produce an empty group.
export function sectionsOf(list) {
  const src = list || []
  if (!src.length) return []
  const groups = [{ name: null, rows: [] }]
  src.forEach((e, i) => {
    if (isSection(e)) groups.push({ name: e.section, rows: [] })
    else groups[groups.length - 1].rows.push({ e, i })
  })
  if (groups[0].name === null && groups[0].rows.length === 0) groups.shift()
  return groups
}

// The section name the entry at index `i` belongs to (nearest preceding marker), or null.
export function sectionAt(list, i) {
  const src = list || []
  for (let j = Math.min(i, src.length) - 1; j >= 0; j--) {
    if (isSection(src[j])) return src[j].section
  }
  return null
}
