import { useState } from 'react'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { SearchField } from './ui.jsx'
import { TrainingNow } from './ProgressViews.jsx'
import WeekMini from './WeekMini.jsx'
import { attentionReasons, attentionTexts, sortStudents, weekSummary, lastLabel } from '../lib/coachShell.js'

// Student list for the coach. Copy is Spanish-literal; shared components get `t`.
const SEARCH_FROM = 8

export default function StudentList({ students, selectedId = null, onOpen, onInvite, compact = false }) {
  const [q, setQ] = useState('')
  const today = todayISO()
  const all = students || []
  const sorted = sortStudents(all, today)
  const attn = sorted.filter(s => attentionReasons(s, today).length)
  const list = q.trim() ? sorted.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted

  return <>
    <div className="hdr">
      <div className="grow"><h1>Alumnos</h1>
        <div className="sub">{students ? all.length + (all.length === 1 ? ' alumno' : ' alumnos') : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={onInvite} aria-label="Invitar alumno"><Icon name="plus" /></button>
    </div>

    <TrainingNow users={all} onOpen={onOpen} t={t} />

    {!compact && attn.length > 0 && <>
      <h4 className="sec">Requiere atención</h4>
      {attn.map(s => <div key={s.id} className="attn" onClick={() => onOpen(s.id)}>
        <Icon name="bell" />
        <span className="grow">{s.name}: {attentionTexts(s, today).join(' · ')}</span>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </>}

    {!compact && <h4 className="sec">Esta semana</h4>}
    {all.length >= SEARCH_FROM && <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Buscar alumno" />}
    <div className="list">
      {list.map(s => {
        const { done, planned } = weekSummary(s, today)
        const texts = compact ? attentionTexts(s, today) : []
        return <div key={s.id} className={'item' + (s.id === selectedId ? ' sel' : '')} onClick={() => onOpen(s.id)}>
          <div className="grow">
            <div className="tt">{s.live && <Icon name="dot" className="live-dot" />}{s.name}
              {!compact && s.pendingRequests > 0 && <span className="tag warn">{s.pendingRequests}</span>}</div>
            <div className="ss">{s.live ? 'entrenando ahora · ' + s.live.name
              : (planned ? done + '/' + planned + ' esta semana' : done + ' esta semana') + ' · último: ' + lastLabel(s, today)}</div>
            {texts.length > 0 && <div><span className="tag warn">{texts.join(' · ')}</span></div>}
            <WeekMini row={s} today={today} />
          </div>
          {!compact && <Icon name="chevronRight" className="chev" />}
        </div>
      })}
      {students && !all.length && <div className="empty">Todavía no tenés alumnos. Tocá + para generar un código de invitación y compartilo.</div>}
      {students && all.length > 0 && !list.length && <div className="empty small">Nadie coincide con “{q}”.</div>}
    </div>
  </>
}
