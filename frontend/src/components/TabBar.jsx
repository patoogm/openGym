import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { COACH_TABS, activeCoachTab, isCoachPath } from '../lib/coachShell.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { openAssignSheet } from './AssignSheet.jsx'
import { useStartWorkout } from './useStartWorkout.js'
import Icon from './Icon.jsx'

export default function TabBar() {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const desktop = useIsDesktop()
  const startWorkout = useStartWorkout()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')

  const Tab = ({ k, icon, to, label }) => (
    <button className={on(k) ? 'on' : ''} onClick={() => nav(to)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  )

  const coachMode = !!user?.coach && isCoachPath(loc.pathname)
  const activeCoach = activeCoachTab(loc.pathname)
  if (desktop) return null   // CoachSidebar / AthleteSidebar replace the bar at ≥1000px

  if (coachMode) {
    const CT = ({ k, icon, to, label, dot }) => (
      <button className={activeCoach === k ? 'on' : ''} onClick={() => nav(to)}
        aria-label={dot ? label + ', entrenamiento en curso' : undefined}>
        <Icon name={icon} />{dot && <i className="tab-dot" aria-hidden="true" />}<span>{label}</span>
      </button>
    )
    const [alumnos, rutinas, actividad] = COACH_TABS
    return (
      <nav id="tabbar">
        <CT {...alumnos} />
        <CT {...rutinas} />
        <button className="start" onClick={() => openAssignSheet()}>
          <span className="cir"><Icon name="plus" /></span><span>Asignar</span>
        </button>
        <CT {...actividad} />
        <CT k="yo" icon="dumbbell" to="/home" label="Yo" dot={!!S.active} />
      </nav>
    )
  }

  return (
    <nav id="tabbar">
      {user?.coach && <button onClick={() => nav('/coach')}><Icon name="chevronLeft" /><span>Coach</span></button>}
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
      <button className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
        <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
        <span>{S.active ? t('Resume') : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
    </nav>
  )
}
