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
