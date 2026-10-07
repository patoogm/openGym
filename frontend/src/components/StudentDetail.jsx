import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import Icon from './Icon.jsx'
import LineChart from './LineChart.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button } from './ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { StatTiles, WorkoutHistory, rel } from './ProgressViews.jsx'
import { openAssignSheet } from './AssignSheet.jsx'
import { getStudent, unassignRoutine, resolveRequest } from '../lib/coachApi.js'
import { weekSummary } from '../lib/coachShell.js'

// Student detail for the coach. Copy is Spanish-literal; shared components get `t`.
// `onChanged` runs after any mutation so the shell can refresh the student list too.
export default function StudentDetail({ id, onChanged }) {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const desktop = useIsDesktop()
  const [d, setD] = useState(null)

  useEffect(() => {
    let live = true   // a slow response for the previous student must not overwrite this one
    setD(null)
    getStudent(id).then(r => { if (live) setD(r) })
      .catch(e => { if (live) { toast(e.message || 'Error'); nav('/coach') } })
    return () => { live = false }
  }, [id])

  const reloadSelf = () => getStudent(id).then(setD).catch(e => toast(e.message || 'Error'))
  const changed = () => { reloadSelf(); if (onChanged) onChanged() }

  if (!d) return <div className="muted small">Cargando…</div>

  const pending = (d.requests || []).filter(r => !r.resolvedAt)
  const dates = [...new Set(d.workouts.map(w => w.d))]
  const { done } = weekSummary({ workoutDates: dates, plannedWeekdays: [] }, todayISO())
  const bw = (d.bodyweight || []).slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w ?? b.kg, d: b.d }))

  const routines = <>
    <div className="row between"><h4 className="sec">Rutinas asignadas</h4>
      <Button size="sm" variant="primary" icon="plus" onClick={() => openAssignSheet({ studentId: id, onDone: changed })}>Asignar</Button></div>
    {d.assigned.length ? <div className="list">{d.assigned.map(a => <div key={a.assignmentId} className="item">
      <span className="lrow-i"><Icon name={glyphOf(a.emoji)} /></span>
      <div className="grow"><div className="tt">{a.name}</div><div className="ss">{a.count} ej.</div></div>
      <button className="iconbtn danger" aria-label={'Quitar ' + a.name}
        onClick={() => confirmSheet({ title: 'Quitar “' + a.name + '”?', confirmText: 'Quitar', danger: true,
          onConfirm: () => unassignRoutine(a.assignmentId).then(changed).catch(e => toast(e.message)) })}>
        <Icon name="trash" /></button>
    </div>)}</div> : <div className="empty small">Sin rutinas asignadas.</div>}

    {pending.length > 0 && <>
      <h4 className="sec">Pedidos de ajuste</h4>
      {pending.map(q => <div key={q.id} className="card">
        <div className="small">{q.note}</div>
        <div className="row between">
          <span className="dim t-cap">{fmtDate(String(q.createdAt).slice(0, 10))}</span>
          <Button size="sm" variant="tinted" onClick={() => resolveRequest(q.id).then(changed).catch(e => toast(e.message))}>Marcar resuelto</Button>
        </div>
      </div>)}
    </>}
  </>

  const progress = <>
    {bw.length > 1 && <>
      <h4 className="sec">Peso corporal</h4>
      <div className="card"><div className="chart"><LineChart points={bw} h={140} unit={d.unit} /></div></div>
    </>}
    <h4 className="sec">Historial</h4>
    <WorkoutHistory workouts={d.workouts} unit={d.unit} t={t} />
  </>

  return <div>
    <div className="hdr">
      {!desktop && <button className="iconbtn" onClick={() => nav('/coach')} aria-label="Volver a alumnos"><Icon name="chevronLeft" /></button>}
      <div className="grow"><h1 className="capitalize">{d.user.name}</h1>
        <div className="sub">última sincronización: {rel(d.lastSync, t)}</div></div>
    </div>

    <StatTiles tiles={[
      { label: 'Esta semana', value: done },
      { label: 'Entrenos', value: d.workouts.length },
      { label: 'Pedidos', value: pending.length, accent: pending.length > 0 }
    ]} />

    {desktop
      ? <div className="ccols"><div>{routines}</div><div>{progress}</div></div>
      : <>{routines}{progress}</>}
  </div>
}
