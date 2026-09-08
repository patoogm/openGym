import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, seedData, cookieFor, jfetch } from './test-helpers.js';

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gym-coach-')); }

test('GET /api/coaching/student: 404 across coaches', async () => {
  const dir = tmpDir()
  seedData(dir, { db: { users: [
    { id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }, { id: 's1', name: 'S', coachId: 'c1' }
  ] } })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1,c2' } })
  try {
    const mine = await jfetch(srv.base, '/api/coaching/student?id=s1', { cookie: cookieFor(dir, 'c1') })
    assert.equal(mine.status, 200)
    const notMine = await jfetch(srv.base, '/api/coaching/student?id=s1', { cookie: cookieFor(dir, 'c2') })
    assert.equal(notMine.status, 404)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('GET /api/me reports coach for a COACH_UIDS user, not for others', async () => {
  const dir = tmpDir();
  seedData(dir, { db: { users: [{ id: 'c1', name: 'Coach' }, { id: 's1', name: 'Stu' }] } });
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } });
  try {
    const asCoach = await jfetch(srv.base, '/api/me', { cookie: cookieFor(dir, 'c1') });
    assert.equal(asCoach.json.user.coach, true);
    const asStu = await jfetch(srv.base, '/api/me', { cookie: cookieFor(dir, 's1') });
    assert.equal(asStu.json.user.coach, false);
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('assign / unassign: creates one row, idempotent, then removes it', async () => {
  const dir = tmpDir()
  seedData(dir, {
    db: { users: [{ id: 'c1', name: 'C' }, { id: 's1', name: 'S', coachId: 'c1' }] },
    states: { c1: { routines: [{ id: 'r1', name: 'A', emoji: '💪', ex: [] }] } }
  })
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } })
  const ck = cookieFor(dir, 'c1')
  try {
    const a = await jfetch(srv.base, '/api/coaching/assign', { cookie: ck, method: 'POST', body: { studentId: 's1', routineId: 'r1' } })
    assert.equal(a.status, 200)
    const again = await jfetch(srv.base, '/api/coaching/assign', { cookie: ck, method: 'POST', body: { studentId: 's1', routineId: 'r1' } })
    assert.equal(again.json.assignment.id, a.json.assignment.id)
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'))
    assert.equal(db.assignments.length, 1)
    const bad = await jfetch(srv.base, '/api/coaching/assign', { cookie: ck, method: 'POST', body: { studentId: 's1', routineId: 'ghost' } })
    assert.equal(bad.status, 400)
    const u = await jfetch(srv.base, '/api/coaching/unassign', { cookie: ck, method: 'POST', body: { assignmentId: a.json.assignment.id } })
    assert.equal(u.status, 200)
    const db2 = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'))
    assert.equal(db2.assignments.length, 0)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('assign: 403 for a non-coach', async () => {
  const dir = tmpDir()
  seedData(dir, { db: { users: [{ id: 's1', name: 'S' }] } })
  const srv = await startServer({ dataDir: dir })
  try {
    const r = await jfetch(srv.base, '/api/coaching/assign', { cookie: cookieFor(dir, 's1'), method: 'POST', body: {} })
    assert.equal(r.status, 403)
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('GET /api/coaching/assigned resolves the body from the coach state', async () => {
  const dir = tmpDir();
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'Coach' }, { id: 's1', name: 'S', coachId: 'c1' }],
      assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }]
    },
    states: { c1: { routines: [{ id: 'r1', name: 'Full body', emoji: '💪', ex: [{ id: '0025', sets: 3, reps: 8 }] }] } }
  });
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } });
  try {
    const r = await jfetch(srv.base, '/api/coaching/assigned', { cookie: cookieFor(dir, 's1') });
    assert.equal(r.status, 200);
    assert.equal(r.json.routines.length, 1);
    assert.equal(r.json.routines[0].name, 'Full body');
    assert.equal(r.json.routines[0].coachAssigned, true);
    assert.equal(r.json.routines[0].assignmentId, 'a1');
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('change-request: student creates, non-student is 403, coach resolves', async () => {
  const dir = tmpDir();
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'C' }, { id: 's1', name: 'S', coachId: 'c1' }, { id: 'x', name: 'X' }],
      assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }]
    },
    states: { c1: { routines: [{ id: 'r1', name: 'A', emoji: '💪', ex: [] }] } }
  });
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } });
  try {
    const bad = await jfetch(srv.base, '/api/coaching/change-request', { cookie: cookieFor(dir, 'x'), method: 'POST', body: { assignmentId: 'a1', note: 'hi' } });
    assert.equal(bad.status, 403);
    const ok = await jfetch(srv.base, '/api/coaching/change-request', { cookie: cookieFor(dir, 's1'), method: 'POST', body: { assignmentId: 'a1', note: 'knee hurts' } });
    assert.equal(ok.status, 200);
    const id = ok.json.request.id;
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    assert.equal(db.changeRequests.length, 1);
    assert.equal(db.changeRequests[0].note, 'knee hurts');
    const notMine = await jfetch(srv.base, '/api/coaching/change-request/resolve', { cookie: cookieFor(dir, 's1'), method: 'POST', body: { id } });
    assert.equal(notMine.status, 403);
    const res = await jfetch(srv.base, '/api/coaching/change-request/resolve', { cookie: cookieFor(dir, 'c1'), method: 'POST', body: { id } });
    assert.equal(res.status, 200);
    const db2 = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    assert.ok(db2.changeRequests[0].resolvedAt);
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('unassign drops the assignment\'s change requests and clears pendingRequests', async () => {
  const dir = tmpDir();
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'C' }, { id: 's1', name: 'S', coachId: 'c1' }],
      assignments: [{ id: 'a1', coachId: 'c1', studentId: 's1', routineId: 'r1', createdAt: 'x' }]
    },
    states: { c1: { routines: [{ id: 'r1', name: 'A', emoji: '💪', ex: [] }] } }
  });
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1' } });
  try {
    const cr = await jfetch(srv.base, '/api/coaching/change-request', { cookie: cookieFor(dir, 's1'), method: 'POST', body: { assignmentId: 'a1', note: 'too heavy' } });
    assert.equal(cr.status, 200);
    const u = await jfetch(srv.base, '/api/coaching/unassign', { cookie: cookieFor(dir, 'c1'), method: 'POST', body: { assignmentId: 'a1' } });
    assert.equal(u.status, 200);
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    assert.equal(db.changeRequests.length, 0);
    const students = await jfetch(srv.base, '/api/coaching/students', { cookie: cookieFor(dir, 'c1') });
    assert.equal(students.status, 200);
    assert.equal(students.json.students.find(s => s.id === 's1').pendingRequests, 0);
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('PUT /api/data strips coachAssigned routines before persisting', async () => {
  const dir = tmpDir();
  seedData(dir, { db: { users: [{ id: 's1', name: 'S' }] } });
  const srv = await startServer({ dataDir: dir });
  try {
    const put = await jfetch(srv.base, '/api/data', { cookie: cookieFor(dir, 's1'), method: 'PUT', body: { state: { _ts: 1, routines: [
      { id: 'l1', name: 'Mine', ex: [] },
      { id: 'c1', name: 'Coach', ex: [], coachAssigned: true }
    ] } } });
    assert.equal(put.status, 200);
    const got = await jfetch(srv.base, '/api/data', { cookie: cookieFor(dir, 's1') });
    assert.equal(got.json.state.routines.length, 1);
    assert.equal(got.json.state.routines[0].id, 'l1');
    assert.ok(!got.json.state.routines.some(r => r.coachAssigned));
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a coach can create an invite and sees only their own', async () => {
  const dir = tmpDir();
  seedData(dir, {
    db: {
      users: [{ id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }],
      invites: [{ code: 'OTHER', createdBy: 'c2', created: 'x' }]
    }
  });
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c1,c2', INVITE_ONLY: '1' } });
  const ck = cookieFor(dir, 'c1');
  try {
    const made = await jfetch(srv.base, '/api/admin/invites/new', { cookie: ck, method: 'POST', body: { note: 'ana' } });
    assert.equal(made.status, 200);
    const list = await jfetch(srv.base, '/api/admin/invites', { cookie: ck });
    assert.equal(list.status, 200);
    assert.ok(list.json.invites.every(i => i.createdBy === 'c1'));
    const revokeOther = await jfetch(srv.base, '/api/admin/invites/revoke', { cookie: ck, method: 'POST', body: { code: 'OTHER' } });
    assert.equal(revokeOther.status, 404);
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an admin sees all invites and can revoke any unused code', async () => {
  const dir = tmpDir();
  seedData(dir, {
    db: {
      users: [{ id: 'a1', name: 'A1', admin: true }, { id: 'c2', name: 'C2' }],
      invites: [{ code: 'OTHER', createdBy: 'c2', created: 'x' }]
    }
  });
  const srv = await startServer({ dataDir: dir, env: { COACH_UIDS: 'c2', INVITE_ONLY: '1' } });
  const ck = cookieFor(dir, 'a1');
  try {
    const list = await jfetch(srv.base, '/api/admin/invites', { cookie: ck });
    assert.equal(list.status, 200);
    assert.ok(list.json.invites.some(i => i.code === 'OTHER'));
    const revoke = await jfetch(srv.base, '/api/admin/invites/revoke', { cookie: ck, method: 'POST', body: { code: 'OTHER' } });
    assert.equal(revoke.status, 200);
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
