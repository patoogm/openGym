import { useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { useCoachData } from '../lib/useCoachData.js'
import Icon from '../components/Icon.jsx'
import InvitesCard from '../components/InvitesCard.jsx'
import StudentList from '../components/StudentList.jsx'
import StudentDetail from '../components/StudentDetail.jsx'

// Alumnos. Mobile: the list, or one student's detail when the URL has an id (as before).
// Desktop: list on the left, selected student's detail on the right.
export default function Coach() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const openSheet = useUI(s => s.openSheet)
  const { students, reload } = useCoachData()
  const open = sid => nav('/coach/alumno/' + sid)
  const invite = () => openSheet(() => <><h3>Invitaciones</h3><InvitesCard t={t} heading={null} /></>)
  const detail = id ? <StudentDetail key={id} id={id} students={students} onChanged={reload} /> : null

  if (!desktop) return <div className="narrow">
    {detail || <StudentList students={students} onOpen={open} onInvite={invite} />}
  </div>

  return <div className="cgrid">
    <section className="cmaster" aria-label="Alumnos">
      <StudentList compact students={students} selectedId={id} onOpen={open} onInvite={invite} />
    </section>
    <section className="cdetail">
      {detail || <div className="empty"><div className="ico"><Icon name="person" /></div>Elegí un alumno para ver su progreso.</div>}
    </section>
  </div>
}
