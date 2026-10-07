import { useEffect, useState } from 'react'

const QUERY = '(min-width:1000px)'
const read = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches

// True at the same breakpoint index.css uses for the desktop layout.
export function useIsDesktop() {
  const [match, setMatch] = useState(read)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(QUERY)
    const on = e => setMatch(e.matches)
    setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return match
}
