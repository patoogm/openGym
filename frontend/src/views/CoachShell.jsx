import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { listStudents } from '../lib/coachApi.js'
import { useIsDesktop } from '../lib/useIsDesktop.js'
import { shellBoundaryKey } from '../lib/coachShell.js'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import CoachSidebar from '../components/CoachSidebar.jsx'

// Layout route for /coach/*. Owns the student list (one fetch + 15s poll for every coach screen)
// and, at ≥1000px, the sidebar. Below that it is just the outlet; the tab bar stays.
export default function CoachShell() {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const desktop = useIsDesktop()
  const { pathname } = useLocation()
  const [students, setStudents] = useState(null)
  const loaded = useRef(false)

  // toast only if the first load fails; later poll failures (offline / expired session) stay silent
  const reload = useCallback(() => listStudents()
    .then(r => { loaded.current = true; setStudents(r.students || []) })
    .catch(e => { if (!loaded.current) toast(e.message || 'Error') }), [toast])

  // poll every 15s so "entrenando ahora" stays live without a manual refresh
  useEffect(() => {
    if (!user?.coach) return
    reload()
    const iv = setInterval(reload, 15000)
    return () => clearInterval(iv)
  }, [user?.coach, reload])

  // a screen that throws is contained and the sidebar stays a way out; the key is per route on
  // mobile and per section on desktop (see shellBoundaryKey)
  const body = <ErrorBoundary key={shellBoundaryKey(pathname, desktop)}><Outlet context={{ students, reload }} /></ErrorBoundary>
  if (!desktop) return body
  return <div className="cshell">
    <CoachSidebar students={students} />
    <main className="cmain">{body}</main>
  </div>
}
