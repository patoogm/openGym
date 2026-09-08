// Periodized program: blocks as snapshots (see docs/superpowers/specs/2026-08-27-agent-training-blocks-design.md §3.2).
//
// A block owns its own routines + weekday schedule. Activating a block clones those
// routines into the live S.routines/S.week (fresh ids), so Home/Plan/Workout/RoutineEdit
// keep operating on ordinary routine objects and need no changes. Workout history is keyed
// by exerciseId, so swapping routines never orphans a logged set.

import { uid, todayISO } from './format.js'

const deepClone = o => JSON.parse(JSON.stringify(o))

export function newManualBlock({ name, weeks }) {
  return {
    id: uid(),
    name: name || 'New block',
    weeks: Math.max(1, Math.round(weeks) || 4),
    source: 'manual',
    createdAt: todayISO(),
    startedAt: null,
    completedAt: null,
    rationale: '',
    routines: [],
    week: {}
  }
}

export function activeBlock(S) {
  const p = S.program
  if (!p || !p.activeId) return null
  return (p.blocks || []).find(b => b.id === p.activeId) || null
}

export function materializeBlock(s, blockId) {
  const block = (s.program.blocks || []).find(b => b.id === blockId)
  if (!block) return

  const idMap = {}
  const cloned = (block.routines || []).map(r => {
    const nid = uid()
    idMap[r.id] = nid
    return { ...deepClone(r), id: nid, coachAssigned: undefined, assignmentId: undefined }
  })

  s.routines = cloned

  const week = {}
  Object.entries(block.week || {}).forEach(([d, oldId]) => {
    if (idMap[oldId]) week[d] = idMap[oldId]
  })
  s.week = week

  // dayPlan holds per-date overrides pointing at routine ids (or the string 'rest').
  // Keep 'rest' and any id that still exists; drop the rest.
  const live = new Set(cloned.map(r => r.id))
  Object.keys(s.dayPlan || {}).forEach(k => {
    const v = s.dayPlan[k]
    if (v !== 'rest' && !live.has(v)) delete s.dayPlan[k]
  })

  s.program.activeId = blockId
  if (!block.startedAt) block.startedAt = todayISO()
}

export function snapshotActiveBlock(s) {
  const block = activeBlock(s)
  if (!block) return
  block.routines = deepClone((s.routines || []).filter(r => !r.coachAssigned))
  block.week = deepClone(s.week || {})
}

export function finishActiveBlock(s) {
  const block = activeBlock(s)
  if (!block) return
  snapshotActiveBlock(s)
  block.completedAt = todayISO()
  s.program.activeId = null
}
