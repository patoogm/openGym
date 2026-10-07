import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtDate } from '../lib/format.js'
import { activityFeed } from '../lib/coachShell.js'
import { useCoachData } from '../lib/useCoachData.js'
import Icon from '../components/Icon.jsx'

// Who trained, newest day first. Workouts carry a date but no clock time, so days are the finest grain.
export default function CoachActivity() {
  const nav = useNavigate()
  const { students } = useCoachData()
  const feed = useMemo(() => (students ? activityFeed(students) : null), [students])
  return <div className="narrow">
    <div className="hdr"><div className="grow"><h1>Actividad</h1><div className="sub">Lo último que entrenaron tus alumnos</div></div></div>
    {!feed ? <div className="muted small">Cargando…</div>
      : !feed.length ? <div className="empty"><div className="ico"><Icon name="history" /></div>Todavía no hay entrenos para mostrar.</div>
      : feed.map(g => <div key={g.d}>
        <div className="feed-day">{fmtDate(g.d, true)}</div>
        <div className="list">{g.items.map((i, n) => <div key={i.studentId + g.d + i.workout + n} className="item" onClick={() => nav('/coach/alumno/' + i.studentId)}>
          <div className="grow"><div className="tt">{i.name}</div><div className="ss">terminó {i.workout || 'un entreno'}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>)}</div>
      </div>)}
  </div>
}
