import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { COACH_TABS, activeCoachTab, attentionReasons } from '../lib/coachShell.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Desktop navigation for the coach area (replaces the floating tab bar at ≥1000px).
export default function CoachSidebar({ students }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const training = useStore(s => !!s.S.active)
  const active = activeCoachTab(pathname)
  const today = todayISO()
  const rows = students || []
  const attn = rows.filter(s => attentionReasons(s, today).length).length
  const live = rows.filter(s => s.live).length

  return <nav className="cside" aria-label="Panel del coach">
    <div className="brand">openGym <span className="muted t-foot">coach</span></div>
    {COACH_TABS.map(tab => <button key={tab.k} type="button"
      className={'cside-i' + (active === tab.k ? ' on' : '')}
      aria-current={active === tab.k ? 'page' : undefined} onClick={() => nav(tab.to)}>
      <Icon name={tab.icon} /><span className="grow">{tab.label}</span>
      {tab.k === 'alumnos' && live > 0 && <span className="tag acc" aria-label={live + ' entrenando ahora'}><Icon name="dot" />{live}</span>}
      {tab.k === 'alumnos' && attn > 0 && <span className="tag warn" aria-label={attn + ' requieren atención'}>{attn}</span>}
    </button>)}
    <Button variant="primary" icon="plus" onClick={() => nav('/coach/rutinas')}>Asignar rutina</Button>
    <div className="cside-foot">
      <button type="button" className="cside-i" onClick={() => nav('/home')}
        aria-label={training ? 'Yo, entrenamiento en curso' : undefined}>
        <Icon name="dumbbell" /><span className="grow">Yo</span>{training && <i className="act-dot" aria-hidden="true" />}
      </button>
    </div>
  </nav>
}
