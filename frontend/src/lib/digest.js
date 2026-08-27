// Training-history digest sent to the block generator (Plan 2). Pure and testable now.
//
// The agent reasons in exercise NAMES, not ids — its output is re-mapped to ids by the
// backend validator. Cardio collapses to one "minutes" figure; strength / timed work keeps
// per-set weight / reps / seconds / effort.
//
// Workout shape (confirmed against demoSeed.js, history.js and views/Workout.jsx):
//   w.d        ISO date
//   w.name     routine name (string); w.routineId is the id
//   w.entries  [{ id, target, sets, topW }]
//   strength/timed set: { w, r, sec, rpe, rir, done }
//   cardio set:         { min, speed, done }

import { exOr } from './exercises.js'
import { modeOf } from './history.js'

const MAX_SESSIONS = 20

export function buildHistoryDigest(S, sinceISO) {
  const custom = (S && S.customEx) || []
  const resolve = id => {
    const c = custom.find(x => x.id === id)
    return c ? c.n : exOr(id).n
  }

  let workouts = ((S && S.workouts) || []).filter(w => !sinceISO || w.d >= sinceISO)
  workouts = workouts.slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  if (workouts.length > MAX_SESSIONS) workouts = workouts.slice(-MAX_SESSIONS)

  return workouts.map(w => ({
    date: w.d,
    routine: typeof w.name === 'string' ? w.name : '',
    exercises: (w.entries || []).map(e => {
      const name = resolve(e.id)
      const mode = modeOf({ ...(e.target || {}), id: e.id })
      const done = (e.sets || []).filter(s => s.done !== false)
      if (mode === 'cardio') {
        const cardioMin = done.reduce((n, s) => n + (s.min || 0), 0)
        return { name, cardioMin }
      }
      const sets = done.map(s => {
        const out = {}
        if (s.w != null) out.weight = s.w
        if (s.r != null) out.reps = s.r
        if (s.sec != null) out.sec = s.sec
        if (s.rpe != null) out.rpe = s.rpe
        if (s.rir != null) out.rir = s.rir
        return out
      })
      return { name, sets }
    })
  }))
}
