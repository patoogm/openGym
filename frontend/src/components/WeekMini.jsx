import { weekStrip, weekSummary } from '../lib/coachShell.js'

const NAMES = { done: 'entrenó', miss: 'faltó', plan: 'planificado', rest: 'descanso' }
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function WeekMini({ row, today }) {
  const days = weekStrip(row, today)
  const { done, planned } = weekSummary(row, today)
  const label = 'Esta semana: ' + done + (planned ? ' de ' + planned : '') + ' entrenos. ' +
    days.map(d => DOW[d.wd] + ' ' + NAMES[d.state]).join(', ')
  return <div className="wk-mini" role="img" aria-label={label}>
    {days.map(d => <span key={d.iso} className={'d ' + d.state + (d.today ? ' today' : '')} />)}
  </div>
}
