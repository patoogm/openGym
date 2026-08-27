// Program screen (#/program) — the manual periodization surface.
//
// Lists every training block, and drives the block lifecycle: create a draft,
// activate it (which materializes its routines into the live plan), and finish
// the current one (which snapshots it into history). Inert when there are no
// blocks — the empty state is all a fresh install ever sees.
//
// Activation snapshots the outgoing block via snapshotActiveBlock() BEFORE
// materializeBlock() runs: at that moment s.program.activeId still names the
// outgoing block, so its live routine edits are captured onto the right block.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { newManualBlock, activeBlock, materializeBlock, snapshotActiveBlock, finishActiveBlock } from '../lib/blocks.js'
import BlockPreview from '../components/BlockPreview.jsx'

export default function Program() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [previewId, setPreviewId] = useState(null)

  const blocks = S.program?.blocks || []
  const activeId = S.program?.activeId || null
  const current = activeBlock(S)
  const preview = blocks.find(b => b.id === previewId)

  const addBlock = () => {
    const b = newManualBlock({ name: t('New block'), weeks: 4 })
    update(s => { s.program.blocks.push(b) })
  }

  // Per controller ruling: snapshot the outgoing active block first (activeId
  // still points at it), then materialize the incoming one.
  const activate = id => update(s => {
    snapshotActiveBlock(s)
    materializeBlock(s, id)
  })

  const finish = () => confirmSheet({
    title: t('Finish current block?'),
    message: t('It moves to your history. Your routines stay until you activate another block.'),
    confirmText: t('Finish'),
    onConfirm: () => update(s => finishActiveBlock(s)),
  })

  if (preview) return <>
    <div className="hdr">
      <button className="iconbtn" onClick={() => setPreviewId(null)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Block preview')}</h1></div>
    </div>
    <BlockPreview block={preview} />
    <div className="narrow row" style={{ gap: 10, marginTop: 4 }}>
      {activeId !== preview.id && <Button variant="primary" icon="play" onClick={() => { activate(preview.id); setPreviewId(null); nav('/plan') }}>{t('Activate this block')}</Button>}
      <Button variant="tinted" icon="pencil" onClick={() => { if (activeId !== preview.id) activate(preview.id); setPreviewId(null); nav('/plan') }}>{t('Edit routines')}</Button>
    </div>
  </>

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Program')}</h1><div className="sub">{t('Your training blocks')}</div></div>
    </div>

    {/* Plan 2 mounts the "Generate block" button here. */}

    {current && <div className="card" style={{ marginBottom: 16 }}>
      <div className="small dim">{t('Current block')}</div>
      <h2 style={{ margin: '2px 0 8px' }}>{current.name}</h2>
      <div className="small dim">{t('{0} weeks', current.weeks)}{current.startedAt ? ` · ${t('since')} ${fmtDate(current.startedAt, true)}` : ''}</div>
      <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Button size="sm" variant="tinted" onClick={() => setPreviewId(current.id)}>{t('View')}</Button>
        <Button size="sm" variant="tinted" onClick={() => nav('/plan')}>{t('Edit routines')}</Button>
        <Button size="sm" variant="danger" onClick={finish}>{t('Finish block')}</Button>
      </div>
    </div>}

    <div className="row between" style={{ marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('All blocks')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={addBlock}>{t('New')}</Button>
    </div>

    {blocks.length ? <div className="list">
      {blocks.map(b => {
        const state = b.id === activeId ? t('active') : b.completedAt ? t('completed') : t('draft')
        return <div key={b.id} className="item" onClick={() => setPreviewId(b.id)}>
          <div className="grow"><div className="tt">{b.name}</div><div className="ss">{t('{0} weeks', b.weeks)} · {state}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
    </div> : <div className="empty"><div className="ico"><Icon name="calendar" /></div>{t('No blocks yet.')}<br />{t('Create one, or set up your profile to generate one.')}</div>}
  </div>
}
