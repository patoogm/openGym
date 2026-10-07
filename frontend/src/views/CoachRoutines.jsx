import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { useCoachData } from '../lib/useCoachData.js'
import { routinePath, routineEditPath } from '../lib/coachShell.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { openAssignSheet } from '../components/AssignSheet.jsx'
import RoutinePanel from '../components/RoutinePanel.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

// The coach's own templates (the same S.routines the athlete Plan edits).
// Mobile: list; a row opens the editor and "assign" is one tap away (sheet).
// Desktop: list on the left, selected routine's summary + inline assignment on the right.
export default function CoachRoutines() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { students, reload } = useCoachData()
  const mine = S.routines.filter(r => !r.coachAssigned)
  const selected = mine.find(r => r.id === id)

  useEffect(() => { if (id && !selected) nav('/coach/rutinas', { replace: true }) }, [id, !!selected])
  if (id && !desktop) return <Navigate to={routineEditPath(id)} replace />   // mobile has no summary screen

  const add = () => {
    const r = { id: uid(), name: 'Nueva rutina', emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav(routineEditPath(r.id))
  }

  const head = <div className="hdr">
    <div className="grow"><h1>Rutinas</h1><div className="sub">Tus plantillas para asignar</div></div>
    <Button size="sm" variant="tinted" icon="plus" onClick={add}>Nueva</Button>
  </div>

  const list = mine.length ? <div className="list">{mine.map(r => <div key={r.id} className={'item' + (r.id === id ? ' sel' : '')}>
    <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
    <div className="grow" onClick={() => nav(desktop ? routinePath(r.id) : routineEditPath(r.id))}>
      <div className="tt">{r.name}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
    {!desktop && <Button size="xs" variant="tinted" onClick={() => openAssignSheet({ routineId: r.id })}>Asignar</Button>}
  </div>)}</div>
    : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>Todavía no tenés rutinas.<br />Creá una y asignala a tus alumnos.</div>

  if (!desktop) return <div className="narrow">{head}{list}</div>

  return <div className="cgrid">
    <section className="cmaster" aria-label="Rutinas">{head}{list}</section>
    <section className="cdetail">
      <ErrorBoundary key={id || 'none'}>
        {selected
          ? <RoutinePanel key={selected.id} r={selected} students={students} onChanged={reload} />
          : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>Elegí una rutina para ver a quién se la asignaste o asignarla.</div>}
      </ErrorBoundary>
    </section>
  </div>
}
