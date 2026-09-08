import test from 'node:test'
import assert from 'node:assert/strict'
import { isCoach, coachIdForInvite, resolveAssigned, pruneOrphanAssignments } from './coaching.js'

test('isCoach: false for undefined or a plain user', () => {
  assert.equal(isCoach(undefined, []), false)
  assert.equal(isCoach({ id: 'u1' }, []), false)
})

test('isCoach: true when user.coach is exactly true', () => {
  assert.equal(isCoach({ id: 'u1', coach: true }, []), true)
  assert.equal(isCoach({ id: 'u1', coach: 'yes' }, []), false)
})

test('isCoach: true when coachUids includes the id', () => {
  assert.equal(isCoach({ id: 'u1' }, ['u1', 'u2']), true)
  assert.equal(isCoach({ id: 'u9' }, ['u1', 'u2']), false)
})

test('coachIdForInvite: creator id when the creator is a coach', () => {
  const users = [{ id: 'c1', coach: true }, { id: 's1' }]
  assert.equal(coachIdForInvite({ createdBy: 'c1' }, users, []), 'c1')
  assert.equal(coachIdForInvite({ createdBy: 'c1' }, [{ id: 'c1' }], ['c1']), 'c1')
})

test('coachIdForInvite: undefined for non-coach creator, missing creator, or null invite', () => {
  const users = [{ id: 'c1', coach: true }, { id: 'x1' }]
  assert.equal(coachIdForInvite({ createdBy: 'x1' }, users, []), undefined)
  assert.equal(coachIdForInvite({ createdBy: 'ghost' }, users, []), undefined)
  assert.equal(coachIdForInvite(null, users, []), undefined)
  assert.equal(coachIdForInvite({}, users, []), undefined)
})

const R = (id, name) => ({ id, name, emoji: '💪', ex: [{ id: '0025', sets: 3, reps: 8 }] })

function fixture() {
  const db = {
    users: [{ id: 'c1', name: 'Coach' }, { id: 's1', name: 'Ana' }, { id: 's2', name: 'Bea' }],
    assignments: [
      { id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' },
      { id: 'a2', coachId: 'c1', studentId: 's1', routineId: 'gone', createdAt: 'x' },
      { id: 'a3', coachId: 'c1', studentId: 's2', routineId: 'r1', createdAt: 'x' }
    ],
    changeRequests: []
  }
  const states = { c1: { routines: [R('r1', 'Full body')] } }
  const readState = uid => states[uid] || null
  return { db, readState, users: db.users }
}

test('resolveAssigned: one entry per live assignment for the student, flagged', () => {
  const { db, readState, users } = fixture()
  const out = resolveAssigned(db, 's1', readState, users)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'r1')
  assert.equal(out[0].name, 'Full body')
  assert.equal(out[0].coachAssigned, true)
  assert.equal(out[0].assignmentId, 'a1')
  assert.equal(out[0].coachName, 'Coach')
})

test('resolveAssigned: omits an assignment whose routine is gone', () => {
  const { db, readState, users } = fixture()
  const out = resolveAssigned(db, 's1', readState, users)
  assert.deepEqual(out.map(r => r.assignmentId), ['a1'])
})

test('resolveAssigned: ignores other students', () => {
  const { db, readState, users } = fixture()
  assert.equal(resolveAssigned(db, 'nobody', readState, users).length, 0)
})

test('pruneOrphanAssignments: drops only the ones with a missing routine', () => {
  const { db, readState } = fixture()
  const removed = pruneOrphanAssignments(db, readState)
  assert.equal(removed, 1)
  assert.deepEqual(db.assignments.map(a => a.id), ['a1', 'a3'])
})
