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

export function resolveAssigned(db, studentId, readState, users) {
  const out = []
  for (const a of db.assignments || []) {
    if (a.studentId !== studentId) continue
    const routine = routineIn(readState(a.coachId), a.routineId)
    if (!routine) continue
    const coach = (users || []).find(u => u.id === a.coachId)
    out.push({ ...routine, coachAssigned: true, assignmentId: a.id, coachName: (coach && coach.name) || 'coach' })
  }
  return out
}

export function pruneOrphanAssignments(db, readState) {
  const before = (db.assignments || []).length
  db.assignments = (db.assignments || []).filter(a => routineIn(readState(a.coachId), a.routineId))
  return before - db.assignments.length
}

export function validateAssign(db, coachId, studentId, routineId, readState) {
  const student = (db.users || []).find(u => u.id === studentId)
  if (!student || student.coachId !== coachId) return { ok: false, error: 'not your student' }
  if (!routineId || !routineIn(readState(coachId), routineId)) return { ok: false, error: 'routine not found' }
  return { ok: true }
}
