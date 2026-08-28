#!/usr/bin/env node
// Folds native-speaker corrections from docs/exercise-names-es-review.csv back into
// frontend/src/names/es.js. Run after editing the "es" column of the CSV.
//
//   node scripts/apply-exercise-names.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const csv = readFileSync(join(root, 'docs/exercise-names-es-review.csv'), 'utf8')

// minimal CSV: id,"en","es" — en/es are JSON-quoted, may contain commas but not raw newlines
const rows = csv.split(/\r?\n/).slice(1).filter(Boolean)
const pack = {}
for (const line of rows) {
  const m = line.match(/^([^,]+),("(?:[^"\\]|\\.)*"),("(?:[^"\\]|\\.)*")$/)
  if (!m) { console.error('skip unparseable row:', line); continue }
  const id = m[1].trim()
  const es = JSON.parse(m[3])
  if (es.trim()) pack[id] = es
}

const header = '// Exercise names in Spanish (rioplatense gym usage). Hand-authored, keyed by exercise id.\n' +
  '// Coverage is checked by scripts/check-exercise-names.mjs; corrections come from\n' +
  '// docs/exercise-names-es-review.csv. Any id missing here falls back to the English name.\n'
const body = 'export default {\n' +
  Object.keys(pack).map(id => `  ${JSON.stringify(id)}: ${JSON.stringify(pack[id])},`).join('\n') +
  '\n}\n'
writeFileSync(join(root, 'frontend/src/names/es.js'), header + body)
console.log(`wrote ${Object.keys(pack).length} names → frontend/src/names/es.js`)
