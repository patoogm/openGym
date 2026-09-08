import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, seedData, cookieFor, jfetch } from './test-helpers.js';

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gym-coach-')); }

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
