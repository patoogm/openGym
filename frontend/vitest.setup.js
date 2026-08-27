// Mock browser APIs for test environment
if (typeof global.document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    visibilityState: 'visible'
  }
}

if (typeof global.localStorage === 'undefined') {
  const store = {}
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value },
    removeItem: (key) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) }
  }
}
