#!/usr/bin/env node
// Verifies the Spanish exercise-name pack covers every exercise, and (re)writes the
// review CSV used to collect native-speaker corrections.
//
//   node scripts/check-exercise-names.mjs           # check + rewrite docs/exercise-names-es-review.csv
//   node scripts/check-exercise-names.mjs --check   # check only, non-zero exit on any gap
//
// Corrections flow: edit the "es" column in the CSV, then run
//   node scripts/apply-exercise-names.mjs   (folds CSV back into frontend/src/names/es.js)

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = p => 'file://' + join(root, p).replace(/\\/g, '/')
const { EXDB } = await import(url('frontend/src/lib/exercises-data.js'))
const pack = (await import(url('frontend/src/names/es.js'))).default

const missing = EXDB.filter(e => !pack[e.id] || !pack[e.id].trim())
const extra = Object.keys(pack).filter(id => !EXDB.some(e => e.id === id))
const untranslated = EXDB.filter(e => pack[e.id] && pack[e.id].toLowerCase() === e.n.toLowerCase())

console.log(`pack: ${Object.keys(pack).length} entries · dataset: ${EXDB.length} exercises`)
if (missing.length) console.log(`\n${missing.length} MISSING:\n` + missing.map(e => `  ${e.id}  ${e.n}`).join('\n'))
if (extra.length) console.log(`\n${extra.length} stale ids: ${extra.join(', ')}`)
if (untranslated.length) console.log(`\n${untranslated.length} still identical to English (ok if the term is the same): ${untranslated.map(e => e.id).join(', ')}`)

if (!process.argv.includes('--check')) {
  const csv = ['id,en,es']
  for (const e of EXDB) csv.push([e.id, JSON.stringify(e.n), JSON.stringify(pack[e.id] || '')].join(','))
  writeFileSync(join(root, 'docs/exercise-names-es-review.csv'), csv.join('\n') + '\n')
  console.log('\n→ docs/exercise-names-es-review.csv rewritten')
}

if (missing.length || extra.length) process.exit(1)
