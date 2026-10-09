import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { SelectRow, Stepper } from '../components/ui.jsx'

// S.profile shape (spec §3.1): goal, daysPerWeek, sessionMin, level, equipment[], limitations, cardio, notes.
// The store seeds S.profile as {} — every read below falls back, every write spreads over the current object.
const GOALS = ['general', 'strength', 'hypertrophy', 'return', 'endurance']
const LEVELS = ['beginner', 'intermediate', 'advanced']
const CARDIO = ['none', 'light', 'moderate', 'priority']
const EQUIPMENT = ['dumbbell', 'barbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'bands']

export default function Profile() {
  const nav = useNavigate()
  const p = useStore(s => s.S.profile) || {}
  const update = useStore(s => s.update)
  const set = (k, v) => update(s => { s.profile = { ...s.profile, [k]: v } })
  const toggleEq = eq => update(s => {
    const cur = new Set(s.profile?.equipment || [])
    cur.has(eq) ? cur.delete(eq) : cur.add(eq)
    s.profile = { ...s.profile, equipment: [...cur] }
  })

  return <div className="narrow page">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="chevronLeft" /></button>
      <div className="grow"><h1>{t('Training profile')}</h1></div>
    </div>

    <div className="small dim" style={{ margin: '0 2px 16px' }}>
      {t('Used to generate your training blocks. You can change it any time.')}
    </div>

    <div className="sect-b" style={{ marginBottom: 16 }}>
      <SelectRow icon="target" iconTint="var(--purple)" title={t('Goal')} sheetTitle={t('Goal')}
        value={p.goal || 'general'} onChange={v => set('goal', v)}
        options={GOALS.map(g => ({ value: g, label: t(g) }))} />
      <SelectRow icon="figureStrength" iconTint="var(--teal)" title={t('Experience')} sheetTitle={t('Experience')}
        value={p.level || 'beginner'} onChange={v => set('level', v)}
        options={LEVELS.map(l => ({ value: l, label: t(l) }))} />
      <SelectRow icon="figureRun" iconTint="var(--orange)" title={t('Cardio emphasis')} sheetTitle={t('Cardio emphasis')}
        value={p.cardio || 'light'} onChange={v => set('cardio', v)}
        options={CARDIO.map(c => ({ value: c, label: t(c) }))} />
    </div>

    <div className="row cfgrow" style={{ marginBottom: 18 }}>
      <Stepper label={t('Days per week')} value={p.daysPerWeek || 3} step={1} decimal={false}
        onChange={v => set('daysPerWeek', Math.max(2, Math.min(6, v)))} />
      <Stepper label={t('Minutes per session')} value={p.sessionMin || 60} step={5} decimal={false}
        onChange={v => set('sessionMin', Math.max(20, Math.min(180, v)))} />
    </div>

    <h4 className="sec">{t('Equipment')}</h4>
    <div className="mchips" style={{ marginBottom: 18 }}>
      {EQUIPMENT.map(eq => {
        const on = (p.equipment || []).includes(eq)
        return <button key={eq} className={'mchip' + (on ? ' on' : '')} onClick={() => toggleEq(eq)}>{t(eq)}</button>
      })}
    </div>

    <h4 className="sec">{t('Injuries / limitations')}</h4>
    <textarea className="input" rows={3} defaultValue={p.limitations || ''}
      placeholder={t('e.g. right knee ACL reconstruction, no current restrictions')}
      onBlur={e => set('limitations', e.target.value.trim())} style={{ marginBottom: 16, width: '100%' }} />

    <h4 className="sec">{t('Extra notes for the coach')}</h4>
    <textarea className="input" rows={3} defaultValue={p.notes || ''}
      placeholder={t('Exercises you dislike, gym constraints, anything else')}
      onBlur={e => set('notes', e.target.value.trim())} style={{ marginBottom: 16, width: '100%' }} />
  </div>
}
