import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, setExNamesEn, useLang } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { useWakeLock } from './lib/wakelock.js'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Profile from './views/Profile.jsx'
import Program from './views/Program.jsx'
import Admin from './views/Admin.jsx'
import Coach from './views/Coach.jsx'
import CoachRoutines from './views/CoachRoutines.jsx'
import CoachActivity from './views/CoachActivity.jsx'
import CoachShell from './views/CoachShell.jsx'
import { useIsDesktop } from './lib/useIsDesktop.js'
import { homePathFor, isCoachPath } from './lib/coachShell.js'
import { showAthleteShell, athleteSectionKey } from './lib/athleteShell.js'
import AthleteSidebar from './components/AthleteSidebar.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  const desktop = useIsDesktop()
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || 'es') }, [S.lang])
  useEffect(() => { setExNamesEn(S.exNamesEn) }, [S.exNamesEn])
  useEffect(() => { document.documentElement.lang = S.lang || 'es' }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  const coachOnly = el => (user?.coach ? el : <Navigate to="/home" replace />)
  // On desktop the coach area is one persistent shell: a stable key keeps it (and its student
  // polling) mounted while navigating between coach screens. Elsewhere #app re-keys per route.
  const coachDesk = desktop && !!user?.coach && isCoachPath(loc.pathname)
  // Same idea for the athlete area: the sidebar stays mounted, only the content frame re-keys.
  const athleteDesk = showAthleteShell(loc.pathname, desktop, authed)

  const routes = (
    <Routes>
      <Route path="/home" element={<Home />} />
      <Route path="/plan" element={<Plan />} />
      <Route path="/plan/r/:id" element={<Plan />} />
      <Route path="/plan/r/:id/editar" element={<RoutineEdit />} />
      <Route path="/workout" element={<Workout />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/history" element={<History />} />
      <Route path="/history/:id" element={<History />} />
      <Route path="/library" element={<Library />} />
      <Route path="/library/:id" element={<Library />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/:cat" element={<Settings />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/program" element={<Program />} />
      <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
      <Route element={coachOnly(<CoachShell />)}>
        <Route path="/coach" element={<Coach />} />
        <Route path="/coach/alumno/:id" element={<Coach />} />
        <Route path="/coach/rutinas" element={<CoachRoutines />} />
        <Route path="/coach/rutinas/:id" element={<CoachRoutines />} />
        <Route path="/coach/rutinas/:id/editar" element={<RoutineEdit />} />
        <Route path="/coach/actividad" element={<CoachActivity />} />
      </Route>
      <Route path="*" element={<Navigate to={homePathFor(user)} replace />} />
    </Routes>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar / sidebar is always a way out */}
      <div id="app" className={'vfade' + (coachDesk ? ' cdesk' : '') + (athleteDesk ? ' adesk' : '')}
        key={coachDesk ? 'coach-desktop' : athleteDesk ? 'athlete-desktop' : loc.pathname}>
        {athleteDesk
          ? <div className="ashell">
            <AthleteSidebar />
            <main className="amain">
              <div className="amain-in vfade" key={athleteSectionKey(loc.pathname)}><ErrorBoundary>{routes}</ErrorBoundary></div>
            </main>
          </div>
          : <ErrorBoundary>{!authed ? <Login /> : routes}</ErrorBoundary>}
      </div>
      <TabBar />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
