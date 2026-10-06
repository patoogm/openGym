/* opengym-api — pure coach-mode logic. No I/O: callers pass readState / livePresence in.
   server.js runs its listener on import, so keeping this logic here keeps it unit-testable. */

export function isCoach(user, coachUids) {
  return !!user && (user.coach === true || (coachUids || []).includes(user.id))
}

// The coach a newly-registered user should be linked to, given the invite they used.
export function coachIdForInvite(invite, users, coachUids) {
  if (!invite || !invite.createdBy) return undefined
  const creator = (users || []).find(u => u.id === invite.createdBy)
  return creator && isCoach(creator, coachUids) ? creator.id : undefined
}

// Look up one routine by id inside a coach's state blob.
function routineIn(state, routineId) {
  return ((state && state.routines) || []).find(r => r.id === routineId) || null
}

export function resolveAssigned(db, studentId, readState, users, coachUids) {
  const out = []
  for (const a of db.assignments || []) {
    if (a.studentId !== studentId) continue
    if (a.coachId === studentId) continue
    const coach = (users || []).find(u => u.id === a.coachId)
    if (coachUids !== undefined && !isCoach(coach, coachUids)) continue
    const routine = routineIn(readState(a.coachId), a.routineId)
    if (!routine) continue
    out.push({ ...routine, coachAssigned: true, assignmentId: a.id, coachName: (coach && coach.name) || 'coach' })
  }
  return out
}

export function pruneOrphanAssignments(db, readState, studentId) {
  const before = (db.assignments || []).length
  db.assignments = (db.assignments || []).filter(a => {
    if (studentId != null && a.studentId !== studentId) return true
    const st = readState(a.coachId)
    if (!st) return true            // unreadable ≠ deleted — keep
    return !!routineIn(st, a.routineId)
  })
  return before - db.assignments.length
}

export function validateAssign(db, coachId, studentId, routineId, readState) {
  if (studentId === coachId) return { ok: false, error: 'cannot assign to yourself' }
  const student = (db.users || []).find(u => u.id === studentId)
  if (!student || student.coachId !== coachId) return { ok: false, error: 'not your student' }
  if (!routineId || !routineIn(readState(coachId), routineId)) return { ok: false, error: 'routine not found' }
  return { ok: true }
}

const countEx = ex => (ex || []).filter(e => !(e && e.section != null && e.id == null)).length

export function studentRows(db, coachId, readState, livePresence) {
  return (db.users || []).filter(u => u.coachId === coachId).map(u => {
    const S = readState(u.id) || {}
    const workouts = S.workouts || []
    const last = workouts[workouts.length - 1]
    return {
      id: u.id, name: u.name, created: u.created || null,
      workouts: workouts.length,
      lastWorkout: last ? last.d : null,
      lastSync: S._ts || null,
      workoutDates: [...new Set(workouts.map(w => w.d))].slice(-60),
      plannedWeekdays: Object.keys(S.week || {}).filter(k => S.week[k]).map(Number).sort((a, b) => a - b),
      recent: workouts.slice(-5).reverse().map(w => ({ d: w.d, name: w.name || '' })),
      assignedRoutineIds: (db.assignments || []).filter(a => a.studentId === u.id && a.coachId === coachId).map(a => a.routineId),
      live: livePresence(u.id),
      assignmentCount: (db.assignments || []).filter(a => a.studentId === u.id && a.coachId === coachId).length,
      pendingRequests: (() => {
        const myAssignmentIds = new Set((db.assignments || []).filter(a => a.coachId === coachId && a.studentId === u.id).map(a => a.id))
        return (db.changeRequests || []).filter(q => myAssignmentIds.has(q.assignmentId) && !q.resolvedAt).length
      })()
    }
  })
}

export function studentDetail(db, coachId, studentId, readState) {
  const u = (db.users || []).find(x => x.id === studentId)
  if (!u || u.coachId !== coachId) return null
  const S = readState(u.id) || {}
  const myAssignments = (db.assignments || []).filter(a => a.studentId === u.id && a.coachId === coachId)
  const coachRoutines = (readState(coachId) || {}).routines || []
  return {
    user: { id: u.id, name: u.name, created: u.created || null },
    unit: S.unit || 'kg',
    lastSync: S._ts || null,
    routines: (S.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, count: countEx(r.ex) })),
    bodyweight: S.bodyweight || [],
    workouts: (S.workouts || []).slice().reverse(),
    assigned: myAssignments.map(a => {
      const r = coachRoutines.find(x => x.id === a.routineId)
      return { assignmentId: a.id, routineId: a.routineId,
        name: r ? r.name : '(deleted)', emoji: r ? r.emoji : '❓', count: r ? countEx(r.ex) : 0 }
    }),
    requests: (db.changeRequests || [])
      .filter(q => myAssignments.some(a => a.id === q.assignmentId))
      .slice().sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))
      .map(q => ({ id: q.id, note: q.note, createdAt: q.createdAt, resolvedAt: q.resolvedAt || null }))
  }
}
