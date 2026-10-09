import { t, nameFor } from '../lib/i18n.js'
import { exOr } from '../lib/exercises.js'
import { sessionOutline } from '../lib/sessionOutline.js'
import Icon from './Icon.jsx'
import Elapsed from './Elapsed.jsx'
import RestTimer from './RestTimer.jsx'
import { Button } from './ui.jsx'

// Desktop-only right rail of the Workout screen: where you are in the session, a way to jump
// to any exercise, the rest/work timer, and finish/discard.
export default function SessionRail({ A, done, total, onJump, onFinish, onDiscard }) {
  const rows = sessionOutline(A)
  const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
  const allDone = A.entries.length > 0 && exDone === A.entries.length
  const pct = total ? Math.round(done / total * 100) : 0

  return <aside className="wrail" aria-label={t('Exercises')}>
    <div className="wrail-hd">
      <div className="wrail-name">{A.name}</div>
      <div className="wrail-sub"><Elapsed start={A.start} /> · {t('{0} sets', done + '/' + total)}</div>
      <div className="wprog"><i style={{ width: pct + '%' }} /></div>
    </div>
    <div className="wout">
      {!rows.length && <div className="small dim">{t('Freestyle workout — add your first exercise.')}</div>}
      {rows.map(r => r.type === 'section'
        ? <div key={r.key} className="wsection">{r.label}</div>
        : <button key={r.key} type="button" className={'wout-i ' + r.status}
          aria-current={r.status === 'current' ? 'step' : undefined} onClick={() => onJump(r.first)}>
          <span className="wout-ic"><Icon name={r.status === 'done' ? 'check' : r.status === 'current' ? 'play' : 'dot'} /></span>
          <span className="wout-names">{r.items.map(it => <span key={it.idx} className="cap1">{nameFor(exOr(it.id))}</span>)}</span>
          {r.superset && <Icon name="link" className="wout-ss" />}
          <span className="wout-n">{r.done}/{r.total}</span>
        </button>)}
    </div>
    <div className="wrail-ft">
      <RestTimer inline />
      <button type="button" className={allDone ? 'btn primary' : 'btn ghost dim'} onClick={onFinish}>
        {allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
      </button>
      <Button variant="ghost" className="dim" onClick={onDiscard}>{t('Discard')}</Button>
    </div>
  </aside>
}
