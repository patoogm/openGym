import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { countEx } from '../lib/routine.js'
import { startFlow } from '../sheets.jsx'

// The "Start / Resume" action: with no session running and a routine planned for today, begin
// it (after the body-weight prompt); otherwise open the Workout screen (resume, or the chooser).
export function useStartWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  return () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && countEx(r.ex)) { startFlow(r.id); return }
    }
    nav('/workout')
  }
}
