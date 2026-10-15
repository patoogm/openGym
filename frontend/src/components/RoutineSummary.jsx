import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { isAssigned } from '../lib/coaching.js'
import { exOr } from '../lib/exercises.js'
import { exCount, DAYN } from '../lib/format.js'
import { t, nameFor } from '../lib/i18n.js'
import { supersetUnits, exLine } from '../lib/history.js'
import { sectionsOf, countEx } from '../lib/routine.js'
import { POLICY_NAME } from '../lib/progression.js'
import { glyphOf } from '../lib/glyphs.js'
import { planRoutineEditPath } from '../lib/athleteShell.js'
import { startFlow } from '../sheets.jsx'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import AdjustSheet from './AdjustSheet.jsx'
import RoutineMuscles from './RoutineMuscles.jsx'

// Desktop detail pane of the Plan screen: what a routine contains, read-only, with the way to
// edit it (or to ask the coach for a change when the coach assigned it).
export default function RoutineSummary({ r }) {
  const nav = useNavigate()
  const openSheet = useUI(s => s.openSheet)
  const S = useStore(s => s.S)
  const assigned = isAssigned(r)
  const groups = sectionsOf(r.ex)
  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())

  const days = [1, 2, 3, 4, 5, 6, 0].filter(d => S.week[d] === r.id).map(d => t(DAYN[d]))
  return <div>
    <div className="hdr">
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow">
        {days.length > 0 && <div className="weyebrow show">{days.join(' · ')}</div>}
        <h1>{r.name}</h1>
        <div className="sub">{exCount(countEx(r.ex))}{assigned && <span className="tag acc">{t('from your coach')}</span>}</div>
      </div>
      {assigned
        ? <Button size="sm" icon="pencil" onClick={() => openSheet(close => <AdjustSheet r={r} close={close} />)}>{t('Request a change')}</Button>
        : <Button size="sm" icon="pencil" onClick={() => nav(planRoutineEditPath(r.id))}>{t('Edit')}</Button>}
      {countEx(r.ex) > 0 && <Button size="sm" variant="primary" icon="play" onClick={() => startFlow(r.id)}>{t('Start')}</Button>}
    </div>
    <div className="small muted mb-3">{t('Progression')}: {t(POLICY_NAME[r.prog || 'linear'])}</div>

    <div className="rsum">
      <div>
        {countEx(r.ex) ? <div className="list">
          {groups.map((g, gi) => <div key={gi}>
            {g.name !== null && <div className="sec sec-g">{g.name}</div>}
            {g.rows.map(({ e, i }) => {
              const ex = exOr(e.id)
              return <div key={i}>
                {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
                <div className={'item' + (inSS.has(i) ? ' in-ss' : '')}>
                  <Thumb ex={ex} />
                  <div className="grow"><div className="tt cap1">{nameFor(ex)}</div></div>
                  <div className="rx-v">{exLine(e, S.unit)}</div>
                </div>
              </div>
            })}
          </div>)}
        </div> : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}
      </div>
      <div><RoutineMuscles r={r} /></div>
    </div>
  </div>
}
