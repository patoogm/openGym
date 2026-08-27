// Interval cardio math. Ported from gimnastic/src/domain/cardio.ts.
//
// What gets logged for the running chart is always MINUTES actually jogged, never
// rounds: 6 rounds of 2 min is more running than 8 rounds of 1 min, and storing
// "6" vs "8" would draw a dip where there was progress. Steady-state weeks already
// enter minutes, so those pass straight through.

const round1dp = n => Math.round(n * 10) / 10
const min = n => `${round1dp(n)}′`

export function minutesJogged(intervals, roundsOrMinutes) {
  if (!intervals) return roundsOrMinutes
  return round1dp((roundsOrMinutes || 0) * (intervals.workMin || 0))
}

export function plannedRounds(intervals) {
  return (intervals && intervals.rounds) || 0
}

export function intervalSummary(intervals) {
  if (!intervals) return ''
  const { warmupMin = 0, rounds = 0, workMin = 0, restMin = 0, cooldownMin = 0 } = intervals
  const parts = []
  if (warmupMin > 0) parts.push(`${min(warmupMin)} warm-up`)
  parts.push(`${rounds} × (${min(workMin)} / ${min(restMin)})`)
  if (cooldownMin > 0) parts.push(`${min(cooldownMin)} cool-down`)
  return parts.join(' · ')
}
