import { useEffect, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Invite-code manager, shared by the admin dashboard and the coach dashboard.
// The /api/admin/invites* endpoints are scoped admin-OR-coach server-side (a coach
// only ever sees and revokes their own codes), so the same card works for both.
// Deliberately English-only — the strings are shared with the English-only Admin view.
//
// Controlled use (Admin): pass `invites` + `reload` and the parent owns the data.
// Uncontrolled use (Coach): pass nothing and the card loads/refreshes itself.
export default function InvitesCard({ invites, reload }) {
  const toast = useUI(s => s.toast)
  const [own, setOwn] = useState(null)
  const controlled = typeof reload === 'function'
  const list = controlled ? invites : own
  const load = () => api('/api/admin/invites').then(d => setOwn(d.invites)).catch(() => {})
  useEffect(() => { if (!controlled) load() }, [])
  const refresh = controlled ? reload : load

  const gen = () => api('/api/admin/invites/new', { method: 'POST', body: '{}' })
    .then(({ invite }) => { navigator.clipboard?.writeText(invite.code).catch(() => {}); toast('Code ' + invite.code + ' created & copied'); refresh() })
    .catch(e => toast(e.message))
  const revoke = code => api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
    .then(() => { toast('Code revoked'); refresh() }).catch(e => toast(e.message))
  const open = (list || []).filter(i => !i.usedBy)
  const used = (list || []).filter(i => i.usedBy)
  return <div className="card">
    <div className="row between"><h2 style={{ margin: 0 }}>Invite codes</h2>
      <Button variant="primary" size="sm" onClick={gen} icon="plus">Generate</Button></div>
    <div className="small muted" style={{ margin: '6px 0 10px' }}>{open.length} unused · {used.length} redeemed</div>
    {open.map(i => <div key={i.code} className="row between" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)' }}>
      <span style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 500, letterSpacing: '.06em' }}
        onClick={() => { navigator.clipboard?.writeText(i.code).catch(() => {}); toast('Copied ' + i.code) }}>{i.code}</span>
      <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 15, color: 'var(--red)' }} onClick={() => revoke(i.code)} aria-label="revoke"><Icon name="trash" /></button>
    </div>)}
    {used.map(i => <div key={i.code} className="row between dim" style={{ padding: '7px 2px', fontSize: '.8rem' }}>
      <span style={{ fontFamily: 'monospace' }}>{i.code}</span><span>→ {i.usedByName || 'used'}</span>
    </div>)}
    {!open.length && !used.length && <div className="dim small">No codes yet — generate one to invite someone.</div>}
  </div>
}
