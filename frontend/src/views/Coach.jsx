import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { SearchField } from '../components/ui.jsx'
import { TrainingNow } from '../components/ProgressViews.jsx'
import InvitesCard from '../components/InvitesCard.jsx'
import WeekMini from '../components/WeekMini.jsx'
import { listStudents } from '../lib/coachApi.js'
import { attentionReasons, sortStudents, weekSummary, lastLabel } from '../lib/coachShell.js'

// Coach home: who needs attention and how the week is going, at a glance.
// Copy is Spanish-literal; the shared components get `t` so they render Spanish here.
const SEARCH_FROM = 8

export default function Coach() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [students, setStudents] = useState(null)
  const [q, setQ] = useState('')

  const load = () => listStudents().then(r => setStudents(r.students)).catch(e => toast(e.message || 'Error'))
  // poll every 15s so "entrenando ahora" stays live without a manual refresh
  useEffect(() => { if (!user?.coach) return; load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])
  if (!user?.coach) return null

  const today = todayISO()
  const all = students || []
  const sorted = sortStudents(all, today)
  const attn = sorted.filter(s => attentionReasons(s, today).length)
  const list = q.trim() ? sorted.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted
  const open = id => nav('/coach/alumno/' + id)
  const invite = () => openSheet(() => <><h3>Invitaciones</h3><InvitesCard t={t} heading={null} /></>)

  return <div className="narrow">
    <div className="hdr">
      <div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Alumnos</h1>
        <div className="sub">{students ? all.length + (all.length === 1 ? ' alumno' : ' alumnos') : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={invite} aria-label="Invitar alumno"><Icon name="plus" /></button>
    </div>

    <TrainingNow users={all} onOpen={open} t={t} />

    {attn.length > 0 && <>
      <h4 className="sec">Requiere atención</h4>
      {attn.map(s => <div key={s.id} className="attn" onClick={() => open(s.id)}>
        <Icon name="bell" />
        <span className="grow">{s.name}: {attentionReasons(s, today).map(r => r === 'request'
          ? s.pendingRequests + (s.pendingRequests === 1 ? ' pedido de cambio' : ' pedidos de cambio')
          : 'sin entrenar (' + lastLabel(s, today) + ')').join(' · ')}</span>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </>}

    <h4 className="sec">Esta semana</h4>
    {all.length >= SEARCH_FROM && <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Buscar alumno" />}
    <div className="list">
      {list.map(s => {
        const { done, planned } = weekSummary(s, today)
        return <div key={s.id} className="item" onClick={() => open(s.id)}>
          <div className="grow">
            <div className="tt">{s.live && <Icon name="dot" className="live-dot" />}{s.name}
              {s.pendingRequests > 0 && <span className="tag warn">{s.pendingRequests}</span>}</div>
            <div className="ss">{s.live ? 'entrenando ahora · ' + s.live.name
              : (planned ? done + '/' + planned + ' esta semana' : done + ' esta semana') + ' · último: ' + lastLabel(s, today)}</div>
            <WeekMini row={s} today={today} />
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
      {students && !all.length && <div className="empty">Todavía no tenés alumnos. Tocá + para generar un código de invitación y compartilo.</div>}
      {students && all.length > 0 && !list.length && <div className="empty small">Nadie coincide con “{q}”.</div>}
    </div>
  </div>
}
