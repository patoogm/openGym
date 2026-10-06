import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import { listStudents } from '../lib/coachApi.js'
import { activityFeed } from '../lib/coachShell.js'
import Icon from '../components/Icon.jsx'

// Who trained, newest day first. Workouts carry a date but no clock time, so days are the finest grain.
export default function CoachActivity() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const [feed, setFeed] = useState(null)
  useEffect(() => {
    if (!user?.coach) return
    listStudents().then(r => setFeed(activityFeed(r.students))).catch(e => toast(e.message || 'Error'))
  }, [user?.coach, toast])
  if (!user?.coach) return null
  return <div className="narrow">
    <div className="hdr"><div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Actividad</h1><div className="sub">Lo último que entrenaron tus alumnos</div></div></div>
    {!feed ? <div className="muted small">Cargando…</div>
      : !feed.length ? <div className="empty"><div className="ico"><Icon name="history" /></div>Todavía no hay entrenos para mostrar.</div>
      : feed.map(g => <div key={g.d}>
        <div className="feed-day">{fmtDate(g.d, true)}</div>
        <div className="list">{g.items.map(i => <div key={i.studentId + g.d + i.workout} className="item" onClick={() => nav('/coach/alumno/' + i.studentId)}>
          <div className="grow"><div className="tt">{i.name}</div><div className="ss">terminó {i.workout || 'un entreno'}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>)}</div>
      </div>)}
  </div>
}
