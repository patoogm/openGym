import Icon from './Icon.jsx'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'

export const rel = ts => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
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

export function TrainingNow({ users, onOpen }) {
  const live = (users || []).filter(u => u.live)
  if (!live.length) return null
  return <div className="card" style={{ borderColor: 'var(--acc)' }}>
    <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}>
      <Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />Training now</h2>
    {live.map(u => <div key={u.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }} onClick={() => onOpen(u.id)}>
      <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · ex {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} sets</div></div>
      <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
    </div>)}
  </div>
}

export function WorkoutHistory({ workouts, unit }) {
  if (!workouts || !workouts.length) return <div className="empty small">No workouts logged.</div>
  return <div className="list" style={{ gap: 0 }}>
    {workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
      <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} sets{w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}</div></div>
      <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), unit)}</span>
    </div>)}
  </div>
}

export function StudentRow({ u, onOpen, extra }) {
  return <div className="item" onClick={() => onOpen(u.id)} style={u.disabled ? { opacity: .55 } : null}>
    <div className="grow">
      <div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name}{extra}</div>
      <div className="ss">{u.live ? 'training now · ' + u.live.name
        : (u.workouts + ' workouts' + (u.lastWorkout ? ' · last ' + fmtDate(u.lastWorkout) : '') + ' · synced ' + rel(u.lastSync))}</div>
    </div>
    {u.hasPush && <Icon name="bell" title="push enabled" style={{ fontSize: 15, color: 'var(--label-3)' }} />}
    <Icon name="chevronRight" className="chev" />
  </div>
}
