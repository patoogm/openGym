import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { isAssigned } from '../lib/coaching.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { planRoutinePath, planRoutineEditPath } from '../lib/athleteShell.js'
import RoutineSummary from '../components/RoutineSummary.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

// Mobile: the week schedule and the routines list; a routine opens the editor.
// Desktop: the same on the left, the selected routine's summary on the right
// (`/plan/r/:id`; with no id the first routine is shown).
export default function Plan() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const byId = S.routines.find(r => r.id === id)
  const selected = byId || (desktop ? S.routines[0] : null)

  // an unknown id (deleted routine, stale link) goes back to the plan
  useEffect(() => { if (id && !byId) nav('/plan', { replace: true }) }, [id, !!byId])
  if (id && !desktop) return <Navigate to={planRoutineEditPath(id)} replace />   // mobile has no summary screen

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav(planRoutineEditPath(r.id))
  }

  const header = <div className="hdr">
    <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
    <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
  </div>

  const scheduleCol = <div>
    <h4 className="sec">{t('Week schedule')}</h4>
    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2, 3, 4, 5, 6, 0].map(d => {
        const r = S.routines.find(x => x.id === S.week[d])
        return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
          <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
          {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
          <Icon name="chevronRight" className="chev" /></div>
      })}
    </div>
  </div>

  const routinesCol = <div>
    <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
    </div>
    {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id}
      className={'item' + (desktop && selected && r.id === selected.id ? ' sel' : '')}
      onClick={() => nav(desktop ? planRoutinePath(r.id) : planRoutineEditPath(r.id))}>
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow"><div className="tt">{r.name}{isAssigned(r) && <span className="tag acc" style={{ marginLeft: 6 }}>{t('from your coach')}</span>}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
      <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
      <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
      <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
    </>}
  </div>

  if (!desktop) return <>
    {header}
    <div className="cols">{scheduleCol}{routinesCol}</div>
  </>

  return <div className="pane">
    {/* routines first: they are what you pick from; the week schedule is secondary here */}
    <section className="pane-list" aria-label={t('Plan')}>{header}{routinesCol}{scheduleCol}</section>
    <section className="pane-detail">
      <ErrorBoundary key={selected ? selected.id : 'none'}>
        {selected ? <RoutineSummary key={selected.id} r={selected} /> : null}
      </ErrorBoundary>
    </section>
  </div>
}
