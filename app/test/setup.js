// Vitest setup file
// Mock localStorage for store tests
const storage = {}
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val) },
  removeItem: (key) => { delete storage[key] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) }
}

// Base API URL for integration tests
global.TEST_API_URL = process.env.TEST_API_URL || 'https://pos.imbir.kz/api'
