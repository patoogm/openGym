import { useOutletContext } from 'react-router-dom'

// Students + reload, owned by CoachShell (the only place that polls).
export const useCoachData = () => useOutletContext()
