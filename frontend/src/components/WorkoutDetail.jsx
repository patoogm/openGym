import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX } from '../lib/exercises.js'
import { fmtDate, fmtNum, fmtVol, durPart } from '../lib/format.js'
import { setLabel } from '../lib/history.js'
import { t, nameFor } from '../lib/i18n.js'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { confirmSheet } from '../sheets.jsx'

// A finished workout: what was done, set by set. Used by the bottom sheet (mobile) and the
// History detail panel (desktop); the caller decides what "deleted" should do next.
export default function WorkoutDetail({ w, onDeleted }) {
  const st = useStore(s => s.S)
  const remove = () => {
    useStore.getState().update(s => { s.workouts = s.workouts.filter(x => x.id !== w.id) })
    useUI.getState().toast(t('Workout deleted'))
    onDeleted && onDeleted()
  }
  return <>
    <h3>{w.name}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{[fmtDate(w.d, true), ...durPart(w.end - w.start), fmtVol(w.vol, st.unit), ...(w.bw ? [fmtNum(w.bw) + ' ' + st.unit] : [])].join(' · ')}</div>
    {w.entries.map((e, i) => {
      const ex = EXIDX[e.id]
      return <div key={i} className="row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
        {ex && <Thumb ex={ex} />}
        <div className="grow"><div className="tt cap1" style={{ fontWeight: 600 }}>{ex ? nameFor(ex) : (e.n || e.id)} {w.prs && w.prs.includes(e.id) && <span className="pr"><Icon name="trophy" />PR</span>}</div>
          <div className="ss">{e.sets.filter(s => s.done).map(s => setLabel(e.id, s, e.target)).join('  ·  ') || t('no sets')}</div></div>
      </div>
    })}
    <Button variant="danger" onClick={() => confirmSheet({ title: t('Delete workout?'), message: t('This removes it from your history for good.'), confirmText: t('Delete'), danger: true, onConfirm: remove })}>{t('Delete workout')}</Button>
  </>
}
