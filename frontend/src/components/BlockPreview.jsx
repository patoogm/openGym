// Presentational preview of a training block — name, span, rationale, week
// schedule and every routine with its exercise schemes. Parent owns the
// accept / discard actions; this component only renders and calls back.

import { exOr } from '../lib/exercises.js'
import { intervalSummary } from '../lib/cardio.js'
import { DAYN } from '../lib/format.js'
import { t, nameFor } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]   // Mon-first, matching the Plan screen

// One exercise's scheme line, e.g. "3 × 8–10 · 60 kg", "3 × 45s" or
// "20 min @ 8 km/h". Cardio is detected by mode or by the catalogue body part —
// there is no dedicated cardio id.
function exScheme(e) {
  if (e.mode === 'cardio' || exOr(e.id).bp === 'cardio') {
    if (e.intervals) return intervalSummary(e.intervals)
    return `${e.min || 20} min${e.speed ? ` @ ${e.speed} km/h` : ''}`
  }
  if (e.mode === 'time') return `${e.sets || 1} × ${e.sec || 45}s`
  const reps = e.repsMin && e.repsMax && e.repsMin !== e.repsMax
    ? `${e.repsMin}–${e.repsMax}`
    : (e.reps ?? 10)
  return `${e.sets || 1} × ${reps}${e.weight ? ` · ${e.weight} kg` : ''}`
}

export default function BlockPreview({ block, onAccept, onDiscard, droppedCount = 0 }) {
  if (!block) return null
  const routines = block.routines || []
  const byId = Object.fromEntries(routines.map(r => [r.id, r]))

  return (
    <div className="narrow">
      <h2>{block.name}</h2>
      <div className="small dim" style={{ marginBottom: 12 }}>
        {t('{0} weeks', block.weeks)}
        {block.source === 'agent' ? ` · ${t('generated')}` : ''}
      </div>

      {block.rationale && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ margin: 0 }}>{block.rationale}</p>
        </div>
      )}

      {droppedCount > 0 && (
        <div className="card warn" style={{ marginBottom: 14 }}>
          <Icon name="info" />{' '}
          {t('{0} suggested exercises are not in the library and were removed — review before accepting.', droppedCount)}
        </div>
      )}

      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ marginBottom: 16 }}>
        {WEEK_ORDER.map(d => {
          const r = byId[block.week?.[d]]
          return (
            <div key={d} className="item">
              <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
              {r
                ? <span className="tag acc">{r.name}</span>
                : <span className="tag">{t('Rest')}</span>}
            </div>
          )
        })}
      </div>

      {routines.map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ textTransform: 'capitalize' }}>{r.name}</h2>
          <div className="list">
            {(r.ex || []).map((e, i) => (
              <div key={i} className="item">
                <div className="grow"><div className="tt cap1">{nameFor(exOr(e.id))}</div></div>
                <div className="ss" style={{ whiteSpace: 'nowrap' }}>{exScheme(e)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {(onAccept || onDiscard) && (
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          {onAccept && <Button variant="primary" icon="check" onClick={onAccept}>{t('Accept block')}</Button>}
          {onDiscard && <Button variant="danger" onClick={onDiscard}>{t('Discard')}</Button>}
        </div>
      )}
    </div>
  )
}
