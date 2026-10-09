import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { nav } from '../lib/nav.js'
import Icon from './Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, Check } from './ui.jsx'
import { listStudents, assignRoutine } from '../lib/coachApi.js'
import { assignMany, assignSummary } from '../lib/coachShell.js'
import { rowProps } from '../lib/a11y.js'

export function openAssignSheet(opts = {}) {
  useUI.getState().openSheet(close => <AssignSheet {...opts} close={close} />)
}

function AssignSheet({ routineId: rid0 = null, studentId = null, onDone, close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [rid, setRid] = useState(rid0)
  const [students, setStudents] = useState(null)
  const [sel, setSel] = useState(() => new Set(studentId ? [studentId] : []))
  const [busy, setBusy] = useState(false)
  const mine = (S.routines || []).filter(r => !r.coachAssigned)

  useEffect(() => {
    listStudents().then(r => setStudents(r.students || [])).catch(e => { toast(e.message || 'Error'); close() })
  }, [])

  if (!rid) return <>
    <h3>Asignar rutina</h3>
    {mine.length ? <div className="list">
      {mine.map(r => <button type="button" key={r.id} className="item" onClick={() => setRid(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div></div>
        <Icon name="chevronRight" className="chev" />
      </button>)}
    </div> : <>
      <div className="empty small">Todavía no tenés rutinas para asignar.</div>
      <Button variant="primary" icon="plus" onClick={() => { close(); nav('/coach/rutinas') }}>Crear rutina</Button>
    </>}
  </>

  const routine = mine.find(r => r.id === rid)
  const taken = s => (s.assignedRoutineIds || []).includes(rid)
  const eligible = (students || []).filter(s => !taken(s))
  const allOn = eligible.length > 0 && eligible.every(s => sel.has(s.id))
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(allOn ? new Set() : new Set(eligible.map(s => s.id)))
  const chosen = eligible.filter(s => sel.has(s.id))

  const confirm = async () => {
    setBusy(true)
    const res = await assignMany(assignRoutine, rid, chosen)
    setBusy(false)
    toast(assignSummary(res))
    if (res.okIds.length) setStudents(p => p.map(s => res.okIds.includes(s.id) ? { ...s, assignedRoutineIds: [...(s.assignedRoutineIds || []), rid] } : s))
    if (res.okIds.length) onDone && onDone()
    if (!res.failed.length) close()
    else setSel(new Set(res.failed.map(f => f.id))) // keep only the failures selected so a retry is one tap
  }

  // The Check button's click bubbles to the row's onClick, which does the toggle,
  // so Check's own onChange is a no-op (otherwise it would toggle twice).
  const noop = () => {}

  return <>
    <h3>Asignar “{routine ? routine.name : '…'}”</h3>
    {!students ? <div className="muted small">Cargando…</div>
      : !students.length ? <>
        <div className="empty small">Todavía no tenés alumnos. Invitá a alguien desde la pantalla Alumnos.</div>
        <Button variant="primary" onClick={() => { close(); nav('/coach') }}>Ir a Alumnos</Button>
      </>
      : <>
        {eligible.length > 1 && <div className="item" {...rowProps(toggleAll)}>
          <div className="grow"><div className="tt">Todos</div></div>
          <Check checked={allOn} onChange={noop} />
        </div>}
        <div className="list">
          {students.map(s => <div key={s.id} className={'item' + (taken(s) ? ' off' : '')} {...rowProps(() => !taken(s) && toggle(s.id))} aria-disabled={taken(s) || undefined} tabIndex={taken(s) ? -1 : 0}>
            <div className="grow"><div className="tt">{s.name}</div>{taken(s) && <div className="ss">ya la tiene</div>}</div>
            <Check checked={taken(s) || sel.has(s.id)} onChange={noop} />
          </div>)}
        </div>
        <Button variant="primary" disabled={!chosen.length || busy} onClick={confirm}>
          {chosen.length ? 'Asignar a ' + chosen.length : 'Elegí al menos un alumno'}
        </Button>
      </>}
  </>
}
