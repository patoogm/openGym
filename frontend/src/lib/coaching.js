// Coach-assigned routines are merged into S.routines for display only. They are
// flagged `coachAssigned` and stripped again before anything is persisted or
// synced (see useStore.js) — the coach's copy is the single source of truth.

export const isAssigned = r => !!(r && r.coachAssigned)

export function mergeAssigned(routines, assigned) {
  const out = (routines || []).slice()
  for (const a of assigned || []) {
    const flagged = { ...a, coachAssigned: true }
    const at = out.findIndex(r => r.id === a.id)
    if (at >= 0) out[at] = flagged
    else out.push(flagged)
  }
  return out
}

export const stripAssigned = routines => (routines || []).filter(r => !r.coachAssigned)
