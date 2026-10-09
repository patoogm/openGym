import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { requestAdjustment } from '../lib/coachApi.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

// "Request a change" on a coach-assigned routine. Opened from the editor's read-only view and
// from the desktop summary.
export default function AdjustSheet({ r, close }) {
  const toast = useUI(s => s.toast)
  const [note, setNote] = useState('')
  return <>
    <h3>{t('Request a change')}</h3>
    <p className="muted small">{t('Tell your coach what you want to change about this routine.')}</p>
    <textarea className="input" rows={4} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
    <Button variant="primary" style={{ marginTop: 10 }} disabled={!note.trim()}
      onClick={() => requestAdjustment(r.assignmentId, note.trim())
        .then(() => { toast(t('Sent to your coach')); close() })
        .catch(e => toast(e.message))}>{t('Send')}</Button>
  </>
}
