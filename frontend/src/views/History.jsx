import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, openWorkout } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import WorkoutDetail from '../components/WorkoutDetail.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { pickWorkout } from '../lib/statsPanes.js'
import { historyWorkoutPath } from '../lib/athleteShell.js'

// Mobile: the full list; a row opens the detail sheet.
// Desktop: the list on the left, the selected workout's detail on the right (`/history/:id`;
// with no id the latest workout is shown).
export default function History() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const newest = [...S.workouts].reverse()
  const byId = S.workouts.some(w => w.id === id)
  const selected = desktop ? pickWorkout(S.workouts, id) : null

  // an unknown id (deleted workout, stale link) goes back to the list
  useEffect(() => { if (id && !byId) nav('/history', { replace: true }) }, [id, byId])
  if (id && !desktop) return <Navigate to="/history" replace />   // mobile has no detail screen

  const header = <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
    <div className="grow"><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div></div>
  const empty = <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>

  if (!desktop) return <>
    {header}
    {newest.length ? <div className="list">{newest.map(w => <WorkoutRow key={w.id} w={w} onClick={() => openWorkout(w)} />)}</div> : empty}
  </>

  if (!newest.length) return <>{header}{empty}</>

  return <div className="pane">
    <section className="pane-list" aria-label={t('History')}>
      {header}
      <div className="list">{newest.map(w => <WorkoutRow key={w.id} w={w} sel={w.id === selected.id} onClick={() => nav(historyWorkoutPath(w.id))} />)}</div>
    </section>
    <section className="pane-detail">
      <ErrorBoundary key={selected.id}>
        {/* after a delete the URL drops the id, so the latest remaining workout (or the empty state) takes over */}
        <WorkoutDetail key={selected.id} w={selected} onDeleted={() => nav('/history', { replace: true })} />
      </ErrorBoundary>
    </section>
  </div>
}
