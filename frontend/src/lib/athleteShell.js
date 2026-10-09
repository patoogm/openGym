// Pure logic for the athlete desktop shell (sidebar at ≥1000px). Labels are English `t()` keys
// except the coach/admin footer, which keep their documented literal copy.
import { isCoachPath } from './coachShell.js'

// Main destinations — the same four the mobile tab bar has (Start is a button, not a tab).
export const ATHLETE_TABS = [
  { k: 'home', icon: 'house', to: '/home', label: 'Home' },
  { k: 'plan', icon: 'calendar', to: '/plan', label: 'Plan' },
  { k: 'stats', icon: 'chart', to: '/stats', label: 'Stats' },
  { k: 'library', icon: 'list', to: '/library', label: 'Exercises' }
]

// Reachable only through Settings / icon buttons on mobile; first-class items on desktop.
export const ATHLETE_MORE = [
  { k: 'program', icon: 'clipboard', to: '/program', label: 'Program' },
  { k: 'history', icon: 'history', to: '/history', label: 'History' },
  { k: 'profile', icon: 'person', to: '/profile', label: 'Training profile' },
  { k: 'settings', icon: 'gear', to: '/settings', label: 'Settings' }
]

const SECTION = {
  '': 'home', home: 'home', plan: 'plan', workout: 'workout', stats: 'stats', history: 'history',
  library: 'library', program: 'program', profile: 'profile', settings: 'settings', admin: 'admin'
}

// First path segment decides the section; anything unknown (including the coach area) is null.
export function activeAthleteTab(pathname) {
  const seg = String(pathname || '').split('/')[1] || ''
  return Object.prototype.hasOwnProperty.call(SECTION, seg) ? SECTION[seg] : null
}

// Role-based links under the nav; safe for guests (user is null).
export function athleteFooter(user) {
  const out = []
  if (user && user.coach) out.push({ k: 'coach', icon: 'crown', to: '/coach', label: 'Panel coach' })
  if (user && user.admin) out.push({ k: 'admin', icon: 'shield', to: '/admin', label: 'Admin' })
  return out
}

// The coach area has its own shell; the athlete shell covers every other signed-in route.
export const showAthleteShell = (pathname, desktop, authed) => !!desktop && !!authed && !isCoachPath(String(pathname || ''))

// Plan routes: on desktop /plan/r/:id is the routine's summary and the editor lives at
// /plan/r/:id/editar (same shape as the coach's); on mobile the summary redirects to the editor.
export const planRoutinePath = id => '/plan/r/' + id
export const planRoutineEditPath = id => '/plan/r/' + id + '/editar'

// Key for the shell's content frame. Per *section*, not per path: picking another routine in a
// list + detail pane must not remount the list (and lose its scroll), while a summary <-> editor
// switch or a change of section still remounts and re-contains a view that threw.
export function athleteSectionKey(pathname) {
  const p = String(pathname || '')
  return (activeAthleteTab(p) || p) + (p.endsWith('/editar') ? ':editar' : '')
}
