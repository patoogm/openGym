import Icon from './Icon.jsx'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { rowProps } from '../lib/a11y.js'

// `t` is optional: the admin dashboard renders these components English-only and passes
// nothing (identity fallback), the coach dashboard passes the real translator.
export const id = (s, ...a) => s.replace(/\{(\d+)\}/g, (m, i) => i < a.length ? a[i] : m)
export const rel = (ts, t = id) => {
  if (!ts) return t('never')
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return t('just now')
  if (s < 3600) return t('{0}m ago', Math.floor(s / 60))
  if (s < 86400) return t('{0}h ago', Math.floor(s / 3600))
  return t('{0}d ago', Math.floor(s / 86400))
}
export const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm' }

export function StatTiles({ tiles }) {
  return <div className="tiles" style={{ marginBottom: 12 }}>
    {tiles.map(t => <div className="tile" key={t.label}>
      <div className="l">{t.label}</div>
      <div className="v" style={t.accent ? { color: 'var(--acc)' } : undefined}>{t.value}</div>
    </div>)}
  </div>
}

export function TrainingNow({ users, onOpen, t = id }) {
  const live = (users || []).filter(u => u.live)
  if (!live.length) return null
  return <div className="card" style={{ borderColor: 'var(--acc)' }}>
    <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}>
      <Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />{t('Training now')}</h2>
    {live.map(u => <div key={u.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }} onClick={() => onOpen(u.id)}>
      <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · {t('ex {0}/{1}', u.live.exIdx, u.live.exTotal)} · {t('{0}/{1} sets', u.live.setsDone, u.live.setsTotal)}</div></div>
      <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
    </div>)}
  </div>
}

export function WorkoutHistory({ workouts, unit, t = id }) {
  if (!workouts || !workouts.length) return <div className="empty small">{t('No workouts logged.')}</div>
  return <div className="list" style={{ gap: 0 }}>
    {workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
      <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {t('{0} sets', setsDone(w))}{w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}</div></div>
      <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), unit)}</span>
    </div>)}
  </div>
}

export function StudentRow({ u, onOpen, extra, t = id }) {
  return <div className="item" {...rowProps(() => onOpen(u.id))} style={u.disabled ? { opacity: .55 } : null}>
    <div className="grow">
      <div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name}{extra}</div>
      <div className="ss">{u.live ? t('training now') + ' · ' + u.live.name
        : (t('{0} workouts', u.workouts) + (u.lastWorkout ? ' · ' + t('last') + ' ' + fmtDate(u.lastWorkout) : '') + ' · ' + t('synced') + ' ' + rel(u.lastSync, t))}</div>
    </div>
    {u.hasPush && <Icon name="bell" title={t('push enabled')} style={{ fontSize: 15, color: 'var(--label-3)' }} />}
    <Icon name="chevronRight" className="chev" />
  </div>
}
