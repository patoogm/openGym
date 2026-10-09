// Pure helpers for the desktop Settings panes. Labels are English `t()` keys.
const CATS = [
  { k: 'account', icon: 'personCircle', label: 'Account' },
  { k: 'training', icon: 'dumbbell', label: 'Training' },
  { k: 'general', icon: 'gear', label: 'General' },
  { k: 'notifications', icon: 'bell', label: 'Notifications' },
  { k: 'data', icon: 'folder', label: 'Data' }
]

// Notifications only exists where there is something to configure (signed in, or the native app).
export const settingsCats = ({ notifications }) => CATS.filter(c => c.k !== 'notifications' || notifications)

// `valid` is false for a category that is unknown or not offered here, so the view can redirect.
export function resolveCat(cat, cats) {
  if (!cat) return { key: cats[0].k, valid: true }
  const ok = cats.some(c => c.k === cat)
  return { key: ok ? cat : cats[0].k, valid: ok }
}

export const settingsCatPath = k => '/settings/' + k
