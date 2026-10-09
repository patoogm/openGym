import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { ATHLETE_TABS, ATHLETE_MORE, activeAthleteTab, athleteFooter } from '../lib/athleteShell.js'
import { useStartWorkout } from './useStartWorkout.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Desktop navigation for the athlete area (replaces the floating tab bar at ≥1000px).
// Same classes as CoachSidebar, so the two read as one family.
export default function AthleteSidebar() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const user = useStore(s => s.user)
  const training = useStore(s => !!s.S.active)
  const start = useStartWorkout()
  const cur = activeAthleteTab(pathname)
  const footer = athleteFooter(user)

  const item = tab => <button key={tab.k} type="button"
    className={'cside-i' + (cur === tab.k ? ' on' : '')}
    aria-current={cur === tab.k ? 'page' : undefined} onClick={() => nav(tab.to)}>
    <Icon name={tab.icon} /><span className="grow">{t(tab.label)}</span>
  </button>

  return <nav className="cside" aria-label="openGym">
    <div className="brand">openGym</div>
    {ATHLETE_TABS.map(item)}
    <Button variant="primary" icon={training ? 'play' : 'dumbbell'} onClick={start}
      aria-current={cur === 'workout' ? 'page' : undefined}>
      {training ? t('Resume') : t('Start')}
    </Button>
    <div className="cside-sec">{ATHLETE_MORE.map(item)}</div>
    {footer.length > 0 && <div className="cside-foot">{footer.map(item)}</div>}
  </nav>
}
