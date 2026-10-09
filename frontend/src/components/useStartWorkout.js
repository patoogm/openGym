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
  // Read the store when the button is pressed instead of subscribing to all of it, so the
  // sidebar and tab bar don't re-render on every set edit.
  return () => {
    const S = useStore.getState().S
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && countEx(r.ex)) { startFlow(r.id); return }
    }
    nav('/workout')
  }
}
