import test from 'node:test'
import assert from 'node:assert/strict'
import { isCoach, coachIdForInvite } from './coaching.js'

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
