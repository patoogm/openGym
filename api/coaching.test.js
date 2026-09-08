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

test('pruneOrphanAssignments: keeps an assignment whose coach state is unreadable (null)', () => {
  const db = {
    users: [{ id: 'c9', name: 'C' }, { id: 's1' }],
    assignments: [{ id: 'a9', coachId: 'c9', studentId: 's1', routineId: 'r1', createdAt: 'x' }],
    changeRequests: []
  }
  const removed = pruneOrphanAssignments(db, () => null)
  assert.equal(removed, 0)
  assert.deepEqual(db.assignments.map(a => a.id), ['a9'])
})

test('pruneOrphanAssignments: scoped to one student leaves other students untouched', () => {
  const { db, readState } = fixture()
  // a2 (s1) is orphaned, a3 (s2) points at a live routine. Prune only s2 -> nothing removed.
  const removed = pruneOrphanAssignments(db, readState, 's2')
  assert.equal(removed, 0)
  assert.deepEqual(db.assignments.map(a => a.id), ['a1', 'a2', 'a3'])
})

test('resolveAssigned: skips a coach who no longer qualifies when coachUids is passed', () => {
  const { db, readState, users } = fixture()
  assert.equal(resolveAssigned(db, 's1', readState, users, ['c1']).length, 1)
  assert.equal(resolveAssigned(db, 's1', readState, users, []).length, 0)
})

test('resolveAssigned: skips a self-coach assignment', () => {
  const db = {
    users: [{ id: 's1', name: 'Ana' }],
    assignments: [{ id: 'a1', coachId: 's1', studentId: 's1', routineId: 'r1', createdAt: 'x' }],
    changeRequests: []
  }
  const readState = () => ({ routines: [R('r1', 'Full body')] })
  assert.equal(resolveAssigned(db, 's1', readState, db.users).length, 0)
})

import { validateAssign } from './coaching.js'

test('validateAssign: ok when student is mine and routine exists', () => {
  const db = { users: [{ id: 's1', coachId: 'c1' }], assignments: [] }
  const readState = () => ({ routines: [{ id: 'r1' }] })
  assert.deepEqual(validateAssign(db, 'c1', 's1', 'r1', readState), { ok: true })
})

test('validateAssign: rejects a student that is not mine', () => {
  const db = { users: [{ id: 's1', coachId: 'other' }], assignments: [] }
  const r = validateAssign(db, 'c1', 's1', 'r1', () => ({ routines: [{ id: 'r1' }] }))
  assert.equal(r.ok, false)
})

test('validateAssign: rejects a routine absent from my state', () => {
  const db = { users: [{ id: 's1', coachId: 'c1' }], assignments: [] }
  const r = validateAssign(db, 'c1', 's1', 'nope', () => ({ routines: [{ id: 'r1' }] }))
  assert.equal(r.ok, false)
})

test('validateAssign: rejects assigning to yourself', () => {
  const db = { users: [{ id: 'c1', coachId: 'c1' }], assignments: [] }
  const r = validateAssign(db, 'c1', 'c1', 'r1', () => ({ routines: [{ id: 'r1' }] }))
  assert.equal(r.ok, false)
})

import { studentRows, studentDetail } from './coaching.js'

function coachFixture() {
  const db = {
    users: [
      { id: 'c1', name: 'Coach' },
      { id: 's1', name: 'Ana', coachId: 'c1', created: '2026-01-01' },
      { id: 's2', name: 'Bea', coachId: 'other' }
    ],
    assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }],
    changeRequests: [
      { id: 'q1', assignmentId: 'a1', studentId: 's1', note: 'too heavy', createdAt: '2026-02-01' },
      { id: 'q2', assignmentId: 'a1', studentId: 's1', note: 'done', createdAt: '2026-01-15', resolvedAt: '2026-01-16' }
    ]
  }
  const states = {
    c1: { routines: [{ id: 'r1', name: 'Full body', emoji: '💪', ex: [{ id: '0025' }, { id: '0026' }] }] },
    s1: { unit: 'kg', _ts: 123, bodyweight: [{ d: '2026-02-01', kg: 70 }],
          workouts: [{ id: 'w1', d: '2026-02-02', name: 'Full body' }], routines: [] }
  }
  return { db, readState: uid => states[uid] || null, livePresence: () => null }
}

test('studentRows: only my students, with counts', () => {
  const { db, readState, livePresence } = coachFixture()
  const rows = studentRows(db, 'c1', readState, livePresence)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 's1')
  assert.equal(rows[0].workouts, 1)
  assert.equal(rows[0].assignmentCount, 1)
  assert.equal(rows[0].pendingRequests, 1)   // q2 is resolved
})

test('studentRows: pendingRequests is 0 after the assignment is unassigned (orphan requests ignored)', () => {
  const { db, readState, livePresence } = coachFixture()
  db.assignments = db.assignments.filter(a => a.id !== 'a1')   // unassign, requests left orphaned
  const rows = studentRows(db, 'c1', readState, livePresence)
  assert.equal(rows[0].pendingRequests, 0)
})

test('studentDetail: null for a student that is not mine', () => {
  const { db, readState } = coachFixture()
  assert.equal(studentDetail(db, 'c1', 's2', readState), null)
})

test('studentDetail: history + assigned + requests for my student', () => {
  const { db, readState } = coachFixture()
  const d = studentDetail(db, 'c1', 's1', readState)
  assert.equal(d.user.name, 'Ana')
  assert.equal(d.workouts.length, 1)
  assert.equal(d.assigned[0].name, 'Full body')
  assert.equal(d.assigned[0].count, 2)
  assert.equal(d.requests[0].id, 'q1')   // newest first
})
