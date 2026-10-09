import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, equipmentOf, fold } from '../lib/exercises.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t, nameFor } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { ExerciseDetail, openExercise, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { libraryExercisePath } from '../lib/athleteShell.js'
import { rowProps } from '../lib/a11y.js'

// Mobile: search, chips and the list; a row opens the detail sheet.
// Desktop: the same on the left, the selected exercise's detail on the right (`/library/:id`;
// with no id the first match is shown).
export default function Library() {
  const nav = useNavigate()
  const { id } = useParams()
  const desktop = useIsDesktop()
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [shown, setShown] = useState(40)
  const ql = fold(q).trim()
  const all = allExercises(S)
  const base = all.filter(e => (!bp || e.bp === bp) && (!ql || fold(e.n).includes(ql) || fold(nameFor(e)).includes(ql) || fold(e.tg).includes(ql) || fold(e.eq).includes(ql) || fold(e.desc).includes(ql)))
  const eqOpts = equipmentOf(base)
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const f = eqOn ? base.filter(e => e.eq === eqOn) : base
  // The panel follows the URL, not the filter: searching never clears the open exercise.
  const byId = id ? all.find(e => e.id === id) : null
  const selected = desktop ? (byId || f[0] || null) : null

  // an unknown id (deleted custom exercise, stale link) goes back to the list
  useEffect(() => { if (id && !byId) nav('/library', { replace: true }) }, [id, !!byId])
  // the detail panel scrolls with the page: a new exercise starts at its top
  useEffect(() => { if (desktop) window.scrollTo(0, 0) }, [selected && selected.id])
  if (id && !desktop) return <Navigate to="/library" replace />   // mobile has no detail screen

  const pick = e => (desktop ? nav(libraryExercisePath(e.id)) : openExercise(e))

  const header = <div className="hdr"><div><h1>{t('Exercises')}</h1><div className="sub">{t('{0} exercises with animations', EXDB.length)}</div></div></div>
  const controls = <>
    <div className="search" style={{ marginBottom: 10 }}><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input className="input" aria-label={t('Search…')} placeholder={t('Search…')} value={q} onChange={e => { setQ(e.target.value); setShown(40) }} /></div>
    <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 12 }}>
      <button className={'chip nocap' + (!bp ? ' on' : '')} onClick={() => { setBp(''); setEq(''); setShown(40) }}>{t('All')}</button>
      {BODYPARTS.map(b => <button key={b} className={'chip' + (bp === b ? ' on' : '')} onClick={() => { setBp(b); setEq(''); setShown(40) }}>{t(b)}</button>)}
    </div>
    {eqOpts.length > 1 && <div className="chips" style={{ marginBottom: 12 }}>
      <button className={'chip nocap' + (!eqOn ? ' on' : '')} onClick={() => { setEq(''); setShown(40) }}>{t('Any equipment')}</button>
      {eqOpts.map(x => <button key={x} className={'chip' + (eqOn === x ? ' on' : '')} onClick={() => { setEq(x); setShown(40) }}>{t(x)}</button>)}
    </div>}
  </>
  const listEl = <div className="list">
    <div className="item" {...rowProps(() => customExSheet(null, ex => openExercise(ex), q.trim()))}>
      <div className="thumb thumb-x"><Icon name="sparkles" /></div>
      <div className="grow"><div className="tt">{t('Create your own exercise')}</div><div className="ss">{t('name + body part, no animation')}</div></div><Icon name="plus" className="chev" />
    </div>
    {f.slice(0, shown).map(e => {
      const best = bestWeightFor(S, e.id)
      return <div key={e.id} className={'item' + (selected && e.id === selected.id ? ' sel' : '')} aria-current={selected && e.id === selected.id ? 'true' : undefined} {...rowProps(() => pick(e), { role: false })}>
        <Thumb ex={e} />
        <div className="grow"><div className="tt cap1">{nameFor(e)}</div><div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div></div>
        {best > 0 && <span className="tag acc">{fmtNum(best)}</span>}
        <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>{t('Plan')}</Button>
      </div>
    })}
    {f.length === 0 && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
  </div>
  const more = f.length > shown ? <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></> : null

  if (!desktop) return <>{header}{controls}{listEl}{more}</>

  return <div className="pane">
    <section className="pane-list lib-list" aria-label={t('Exercises')}>{header}{controls}{listEl}{more}</section>
    <section className="pane-detail">
      <ErrorBoundary key={selected ? selected.id : 'none'}>
        {selected
          ? <ExerciseDetail key={selected.id} ex={selected} />
          : <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
      </ErrorBoundary>
    </section>
  </div>
}
