// Local dev launcher — starts the API, the Vite dev server and a static media
// server (images + gifs) in one terminal. Local only; nothing here ships.
//
//   node scripts/dev.mjs      (or: npm run dev  from the repo root)
//
//   [api]   → node api/server.js            :3000   (Vite proxies /api here)
//   [media] → this file serves ./media      :8888   (Vite proxies /img, /gif here)
//   [web]   → npm run dev in frontend/       :5173   ← open this one
//
// Ctrl+C tears down all three.

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const MEDIA_DIR = join(ROOT, 'media')
const MEDIA_PORT = 8888
const isWin = process.platform === 'win32'

const COLORS = { api: '\x1b[36m', media: '\x1b[33m', web: '\x1b[32m' }
const RESET = '\x1b[0m'
const tag = name => `${COLORS[name] || ''}[${name}]${RESET} `

// Prefix every line of a stream with its owner's tag.
function pipePrefixed(stream, name) {
  let buf = ''
  stream.setEncoding('utf8')
  stream.on('data', chunk => {
    buf += chunk
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) process.stdout.write(tag(name) + line + '\n')
  })
  stream.on('end', () => { if (buf) process.stdout.write(tag(name) + buf + '\n') })
}

// ---- media server (static ./media, no dependencies) ----------------------
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm'
}

const media = createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const filePath = join(MEDIA_DIR, normalize(urlPath))
  if (!filePath.startsWith(MEDIA_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(200, {
    'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=3600'
  })
  createReadStream(filePath).pipe(res)
})

// ---- child processes -----------------------------------------------------
const children = []
function start(name, command, args, cwd) {
  const child = spawn(command, args, { cwd: join(ROOT, cwd), shell: isWin })
  child.on('error', err => {
    process.stdout.write(tag(name) + `failed to start: ${err.message}\n`)
    shutdown(1)
  })
  child.on('exit', code => {
    process.stdout.write(tag(name) + `exited (code ${code ?? 0})\n`)
    shutdown(code ?? 0)
  })
  pipePrefixed(child.stdout, name)
  pipePrefixed(child.stderr, name)
  children.push({ name, child })
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  media.close()
  for (const { child } of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    if (isWin) spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'])
    else child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 500)
}

process.on('SIGINT', () => { process.stdout.write('\n'); shutdown(0) })
process.on('SIGTERM', () => shutdown(0))
process.on('SIGBREAK', () => shutdown(0)) // Windows Ctrl+Break

// ---- go -----------------------------------------------------------------
if (!existsSync(MEDIA_DIR)) {
  console.error(`[media] ${MEDIA_DIR} not found — run from the repo root`)
  process.exit(1)
}

media.listen(MEDIA_PORT, () => {
  process.stdout.write(tag('media') + `serving ./media on http://localhost:${MEDIA_PORT}\n`)
})

start('api', 'node', ['server.js'], 'api')
start('web', isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], 'frontend')

process.stdout.write(tag('web') + 'starting Vite — open the URL it prints below\n')
