// Props that make a clickable <div> row behave like a button for keyboard users.
// Keys that bubble up from a nested control (a button or input inside the row) are ignored,
// so the inner control keeps its own behaviour.
export function rowProps(handler, { role = 'button' } = {}) {
  const props = {
    onClick: handler,
    tabIndex: 0,
    onKeyDown: e => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e) }
    }
  }
  if (role) props.role = role
  return props
}
