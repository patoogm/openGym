import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, exCount } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { openAssignSheet } from '../components/AssignSheet.jsx'

// The coach's own templates (the same S.routines the athlete Plan edits), with "assign" one tap away.
export default function CoachRoutines() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const mine = S.routines.filter(r => !r.coachAssigned)

  const add = () => {
    const r = { id: uid(), name: 'Nueva rutina', emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  return <div className="narrow">
    <div className="hdr">
      <div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Rutinas</h1><div className="sub">Tus plantillas para asignar</div></div>
      <Button size="sm" variant="tinted" icon="plus" onClick={add}>Nueva</Button>
    </div>
    {mine.length ? <div className="list">{mine.map(r => <div key={r.id} className="item">
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow" onClick={() => nav('/plan/r/' + r.id)}>
        <div className="tt">{r.name}</div><div className="ss">{exCount(countEx(r.ex))}</div></div>
      <Button size="xs" variant="tinted" onClick={() => openAssignSheet({ routineId: r.id })}>Asignar</Button>
    </div>)}</div>
      : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>Todavía no tenés rutinas.<br />Creá una y asignala a tus alumnos.</div>}
  </div>
}
