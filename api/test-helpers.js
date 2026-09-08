import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('./server.js', import.meta.url));
const KNOWN_SECRET = 'a'.repeat(64);

function freePort() {
  return new Promise(res => {
    const srv = net.createServer();
    srv.listen(0, () => { const p = srv.address().port; srv.close(() => res(p)); });
  });
}

export function seedData(dataDir, { db = {}, states = {} } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'secret'), KNOWN_SECRET);
  const full = { users: [], creds: [], subs: [], invites: [], assignments: [], changeRequests: [], ...db };
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(full, null, 2));
  for (const [uid, state] of Object.entries(states)) {
    const safe = uid.replace(/[^a-zA-Z0-9_-]/g, '');
    fs.writeFileSync(path.join(dataDir, 'state-' + safe + '.json'), JSON.stringify(state));
  }
}

export function cookieFor(dataDir, uid) {
  const secret = fs.readFileSync(path.join(dataDir, 'secret'), 'utf8').trim();
  const exp = Date.now() + 86400000;
  const payload = `${uid}:${exp}:0`;
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `gymsid=${payload}.${mac}`;
}

export async function startServer({ dataDir, env = {} } = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir,
           RP_ID: 'localhost', ORIGIN: 'http://localhost:5173', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('server did not start')), 5000);
    child.stdout.on('data', d => { if (String(d).includes('gym-api on')) { clearTimeout(to); resolve(); } });
    child.on('error', reject);
  });
  return {
    base: `http://localhost:${port}`,
    dataDir,
    stop: () => new Promise(r => { child.once('exit', () => r()); child.kill(); })
  };
}

export async function jfetch(base, p, { cookie, method = 'GET', body } = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}
