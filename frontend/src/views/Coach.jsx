import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { StatTiles, TrainingNow, WorkoutHistory, StudentRow, rel } from '../components/ProgressViews.jsx'
import InvitesCard from '../components/InvitesCard.jsx'
import { listStudents, getStudent, assignRoutine, unassignRoutine, resolveRequest } from '../lib/coachApi.js'

// Coach-only dashboard (backend adds `coach` to the user; guarded again server-side).
// Deliberately Spanish-literal — it mirrors Admin.jsx's raw-literal operator-panel pattern,
// and the app default language is 'es'.

function AssignPicker({ studentId, onDone, close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const mine = (S.routines || []).filter(r => !r.coachAssigned)
  const pick = r => assignRoutine(studentId, r.id)
    .then(() => { toast('Rutina asignada'); onDone(); close() })
    .catch(e => toast(e.message))
  return <>
    <h3>Asignar rutina</h3>
    {mine.length ? <div className="list">
      {mine.map(r => <div key={r.id} className="item" onClick={() => pick(r)}>
        <div className="grow"><div className="tt">{r.name}</div></div>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </div> : <div className="empty small">Creá una rutina en tu Plan primero.</div>}
  </>
}

function StudentDetail({ id, reload, close }) {
  const [d, setD] = useState(null)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const load = () => getStudent(id).then(setD).catch(e => toast(e.message))
  useEffect(() => { load() }, [id])
  if (!d) return <div className="muted small">Cargando…</div>
  const pending = (d.requests || []).filter(r => !r.resolvedAt)
  return <>
    <h3 className="capitalize">{d.user.name}</h3>
    <div className="small muted" style={{ margin: '4px 0 12px' }}>último sync {rel(d.lastSync)}</div>

    <div className="row between"><h4 className="sec" style={{ margin: 0 }}>Rutinas asignadas</h4>
      <Button size="sm" variant="primary" icon="plus"
        onClick={() => openSheet(c => <AssignPicker studentId={id} onDone={() => { load(); reload() }} close={c} />)}>Asignar</Button></div>
    {d.assigned.length ? <div className="list">{d.assigned.map(a => <div key={a.assignmentId} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }}>
      <span className="small">{a.emoji} {a.name} · {a.count} ej.</span>
      <button className="iconbtn" style={{ color: 'var(--red)', width: 30, height: 28 }} aria-label="quitar"
        onClick={() => confirmSheet({ title: 'Quitar “' + a.name + '”?', confirmText: 'Quitar', danger: true,
          onConfirm: () => unassignRoutine(a.assignmentId).then(() => { load(); reload() }).catch(e => toast(e.message)) })}>
        <Icon name="trash" /></button>
    </div>)}</div> : <div className="empty small">Sin rutinas asignadas.</div>}

    {pending.length > 0 && <>
      <h4 className="sec">Pedidos de ajuste</h4>
      {pending.map(q => <div key={q.id} className="card" style={{ padding: 10 }}>
        <div className="small">{q.note}</div>
        <div className="row between" style={{ marginTop: 6 }}>
          <span className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(String(q.createdAt).slice(0, 10))}</span>
          <Button size="sm" variant="tinted" onClick={() => resolveRequest(q.id).then(() => { load(); reload() }).catch(e => toast(e.message))}>Marcar resuelto</Button>
        </div>
      </div>)}
    </>}

    <h4 className="sec">Historial</h4>
    <WorkoutHistory workouts={d.workouts} unit={d.unit} />
  </>
}

export default function Coach() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [students, setStudents] = useState(null)

  const load = () => listStudents().then(r => setStudents(r.students)).catch(e => toast(e.message || 'Error'))
  // poll every 15s so "entrenando ahora" stays live without a manual refresh
  useEffect(() => { if (!user?.coach) return; load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])
  if (!user?.coach) return null

  const open = id => openSheet(close => <StudentDetail id={id} reload={load} close={close} />)
  const list = students || []
  const liveN = list.filter(s => s.live).length
  const pendN = list.reduce((n, s) => n + (s.pendingRequests || 0), 0)

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8 }}><h1 style={{ margin: 0 }}>Coach</h1>
        <div className="sub">{students ? list.length + ' alumnos' : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={load} aria-label="refresh">↻</button>
    </div>

    <StatTiles tiles={[
      { label: 'Alumnos', value: students ? list.length : '—' },
      { label: 'Entrenando', value: students ? liveN : '—', accent: liveN > 0 },
      { label: 'Pedidos', value: students ? pendN : '—', accent: pendN > 0 }
    ]} />

    <TrainingNow users={list} onOpen={open} />

    <h4 className="sec">Alumnos</h4>
    <div className="list">
      {list.map(u => <StudentRow key={u.id} u={u} onOpen={open}
        extra={u.pendingRequests ? <span className="tag" style={{ marginLeft: 4, color: 'var(--orange)' }}>{u.pendingRequests}</span> : null} />)}
      {students && !list.length && <div className="empty">Todavía no tenés alumnos. Generá un código de invitación abajo y compartilo con tu alumno.</div>}
    </div>

    <InvitesCard />
  </div>
}
