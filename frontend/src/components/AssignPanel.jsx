import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { nav } from '../lib/nav.js'
import Icon from './Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, Check } from './ui.jsx'
import { assignRoutine } from '../lib/coachApi.js'
import { rowProps } from '../lib/a11y.js'
import {
  assignMany, assignSummary, assignRoutines, assignRoutinesSummary, eligibleStudents, eligibleRoutines
} from '../lib/coachShell.js'

// Inline assignment (desktop). By routine: tick students. By student: tick routines.
// Selection is a Set of ids, so it survives the shell's 15s refresh of `students`.
export default function AssignPanel({ routineId = null, studentId = null, students, onDone }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [sel, setSel] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const byRoutine = !!routineId
  const mine = (S.routines || []).filter(r => !r.coachAssigned)
  const student = (students || []).find(s => s.id === studentId)
  const all = byRoutine ? (students || []) : mine
  const eligible = byRoutine ? eligibleStudents(students, routineId) : eligibleRoutines(mine, student)
  const eligibleIds = new Set(eligible.map(x => x.id))
  const chosen = eligible.filter(x => sel.has(x.id))   // ids that stopped being eligible drop out here
  const allOn = eligible.length > 0 && eligible.every(x => sel.has(x.id))
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(allOn ? new Set() : new Set(eligible.map(x => x.id)))

  const confirm = async () => {
    setBusy(true)
    const res = byRoutine
      ? await assignMany(assignRoutine, routineId, chosen)
      : await assignRoutines(assignRoutine, studentId, chosen)
    setBusy(false)
    toast((byRoutine ? assignSummary : assignRoutinesSummary)(res))
    if (res.okIds.length && onDone) onDone()
    setSel(new Set(res.failed.map(f => f.id)))   // keep only the failures ticked so a retry is one tap
  }

  // The Check button's click bubbles to the row's onClick, which does the toggle,
  // so Check's own onChange is a no-op (otherwise it would toggle twice).
  const noop = () => {}

  if (byRoutine && !students) return <div className="muted small">Cargando…</div>
  if (byRoutine && !students.length) return <>
    <div className="empty small">Todavía no tenés alumnos. Invitá a alguien desde Alumnos.</div>
    <Button variant="primary" onClick={() => nav('/coach')}>Ir a Alumnos</Button>
  </>
  if (!byRoutine && !mine.length) return <>
    <div className="empty small">Todavía no tenés rutinas para asignar.</div>
    <Button variant="primary" icon="plus" onClick={() => nav('/coach/rutinas')}>Crear rutina</Button>
  </>

  return <>
    {eligible.length > 1 && <div className="item" {...rowProps(toggleAll)}>
      <div className="grow"><div className="tt">Todos</div></div>
      <Check checked={allOn} onChange={noop} />
    </div>}
    <div className="list">
      {all.map(x => {
        const off = !eligibleIds.has(x.id)
        return <div key={x.id} className={'item' + (off ? ' off' : '')} {...rowProps(() => !off && toggle(x.id))} aria-disabled={off || undefined} tabIndex={off ? -1 : 0}>
          {!byRoutine && <span className="lrow-i"><Icon name={glyphOf(x.emoji)} /></span>}
          <div className="grow"><div className="tt">{x.name}</div>{off && <div className="ss">{byRoutine ? 'ya la tiene' : 'ya la tiene asignada'}</div>}</div>
          <Check checked={off || sel.has(x.id)} onChange={noop} />
        </div>
      })}
    </div>
    <Button variant="primary" disabled={!chosen.length || busy} onClick={confirm}>
      {chosen.length
        ? (byRoutine ? 'Asignar a ' + chosen.length : 'Asignar ' + chosen.length + (chosen.length === 1 ? ' rutina' : ' rutinas'))
        : 'Elegí al menos uno'}
    </Button>
  </>
}
