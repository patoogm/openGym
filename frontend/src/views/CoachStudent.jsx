import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import LineChart from '../components/LineChart.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { StatTiles, WorkoutHistory, rel } from '../components/ProgressViews.jsx'
import { openAssignSheet } from '../components/AssignSheet.jsx'
import { getStudent, unassignRoutine, resolveRequest } from '../lib/coachApi.js'
import { weekSummary } from '../lib/coachShell.js'

// Student detail for the coach. Copy is Spanish-literal; shared components get `t`.
export default function CoachStudent() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const [d, setD] = useState(null)
  const load = () => getStudent(id).then(setD).catch(e => { toast(e.message || 'Error'); nav('/coach') })
  useEffect(() => { if (user?.coach) load() }, [id])
  if (!user?.coach) return null
  if (!d) return <div className="narrow"><div className="muted small">Cargando…</div></div>

  const pending = (d.requests || []).filter(r => !r.resolvedAt)
  const dates = [...new Set(d.workouts.map(w => w.d))]
  const { done } = weekSummary({ workoutDates: dates, plannedWeekdays: [] }, todayISO())
  const bw = (d.bodyweight || []).slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w ?? b.kg, d: b.d }))

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/coach')} aria-label="Volver a alumnos"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8 }}><h1 className="capitalize" style={{ margin: 0 }}>{d.user.name}</h1>
        <div className="sub">última sincronización: {rel(d.lastSync, t)}</div></div>
    </div>

    <StatTiles tiles={[
      { label: 'Esta semana', value: done },
      { label: 'Entrenos', value: d.workouts.length },
      { label: 'Pedidos', value: pending.length, accent: pending.length > 0 }
    ]} />

    <div className="row between"><h4 className="sec">Rutinas asignadas</h4>
      <Button size="sm" variant="primary" icon="plus" onClick={() => openAssignSheet({ studentId: id, onDone: load })}>Asignar</Button></div>
    {d.assigned.length ? <div className="list">{d.assigned.map(a => <div key={a.assignmentId} className="item">
      <span className="lrow-i"><Icon name={glyphOf(a.emoji)} /></span>
      <div className="grow"><div className="tt">{a.name}</div><div className="ss">{a.count} ej.</div></div>
      <button className="iconbtn danger" aria-label={'Quitar ' + a.name}
        onClick={() => confirmSheet({ title: 'Quitar “' + a.name + '”?', confirmText: 'Quitar', danger: true,
          onConfirm: () => unassignRoutine(a.assignmentId).then(load).catch(e => toast(e.message)) })}>
        <Icon name="trash" /></button>
    </div>)}</div> : <div className="empty small">Sin rutinas asignadas.</div>}

    {pending.length > 0 && <>
      <h4 className="sec">Pedidos de ajuste</h4>
      {pending.map(q => <div key={q.id} className="card">
        <div className="small">{q.note}</div>
        <div className="row between">
          <span className="dim t-cap">{fmtDate(String(q.createdAt).slice(0, 10))}</span>
          <Button size="sm" variant="tinted" onClick={() => resolveRequest(q.id).then(load).catch(e => toast(e.message))}>Marcar resuelto</Button>
        </div>
      </div>)}
    </>}

    {bw.length > 1 && <>
      <h4 className="sec">Peso corporal</h4>
      <div className="card"><div className="chart"><LineChart points={bw} h={140} unit={d.unit} /></div></div>
    </>}

    <h4 className="sec">Historial</h4>
    <WorkoutHistory workouts={d.workouts} unit={d.unit} t={t} />
  </div>
}
