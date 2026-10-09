import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import BodyMap from './BodyMap.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

// Coverage of the routine as planned, so a gap shows up while you're building it rather than
// after a month of training around it. Shared by the editor and the desktop summary.
export default function RoutineMuscles({ r }) {
  const S = useStore(s => s.S)
  if (!r.ex.length) return null
  const load = loadOfRoutine(r)
  const { worked } = rankOf(load)
  return <div className="card mt-3">
    <h2>{t('What this session hits')}</h2>
    <BodyMap load={load} body={S.body} />
    <div className="mchips">
      {worked.slice(0, 6).map(m => <span key={m} className="mchip">{t(MUSCLE_NAME[m])}</span>)}
    </div>
  </div>
}
