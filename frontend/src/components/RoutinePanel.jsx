import { useNavigate } from 'react-router-dom'
import { exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { glyphOf } from '../lib/glyphs.js'
import { routineEditPath } from '../lib/coachShell.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import AssignPanel from './AssignPanel.jsx'
import { rowProps } from '../lib/a11y.js'

// Desktop summary of one of the coach's routines: who has it, edit, and inline assignment.
export default function RoutinePanel({ r, students, onChanged }) {
  const nav = useNavigate()
  const have = (students || []).filter(s => (s.assignedRoutineIds || []).includes(r.id))
  return <div>
    <div className="hdr">
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow"><h1>{r.name}</h1><div className="sub">{exCount(countEx(r.ex))}</div></div>
      <Button size="sm" variant="tinted" icon="pencil" onClick={() => nav(routineEditPath(r.id))}>Editar</Button>
    </div>

    <h4 className="sec">Asignada a</h4>
    {have.length ? <div className="list">{have.map(s => <div key={s.id} className="item" {...rowProps(() => nav('/coach/alumno/' + s.id))}>
      <div className="grow"><div className="tt">{s.name}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>)}</div> : <div className="empty small">Todavía no está asignada a nadie.</div>}

    <h4 className="sec">Asignar</h4>
    <AssignPanel routineId={r.id} students={students} onDone={onChanged} />
  </div>
}
