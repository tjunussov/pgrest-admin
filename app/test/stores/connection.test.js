import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from 'src/stores/connection'

describe('Connection Store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('should start with empty connections', () => {
    const store = useConnectionStore()
    expect(store.connections).toEqual([])
    expect(store.active).toBeNull()
  })

  it('should add a token connection', () => {
    const store = useConnectionStore()
    store.addTokenConnection('https://pos.imbir.kz/api', 'test-token', 'Test')

    expect(store.connections).toHaveLength(1)
    expect(store.connections[0].name).toBe('Test')
    expect(store.connections[0].token).toBe('test-token')
    expect(store.active).toBeTruthy()
    expect(store.activeId).toBe(store.connections[0].id)
  })

  it('should persist to localStorage', () => {
    const store = useConnectionStore()
    store.addTokenConnection('https://example.com/api', 'tok', 'Ex')

    const saved = JSON.parse(localStorage.getItem('pgrestadmin_connections'))
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Ex')
  })

  it('should remove a connection', () => {
    const store = useConnectionStore()
    store.addTokenConnection('https://a.com', 'tok1', 'A')
    store.addTokenConnection('https://b.com', 'tok2', 'B')

    expect(store.connections).toHaveLength(2)

    const idToRemove = store.connections[0].id
    store.removeConnection(idToRemove)

    expect(store.connections).toHaveLength(1)
    expect(store.connections[0].name).toBe('B')
  })

  it('should set active connection', () => {
    const store = useConnectionStore()
    store.addTokenConnection('https://a.com', 'tok1', 'A')
    store.addTokenConnection('https://b.com', 'tok2', 'B')

    const idB = store.connections[1].id
    store.setActive(idB)

    expect(store.active.name).toBe('B')
  })

  it('should provide auth headers when active', () => {
    const store = useConnectionStore()
    store.addTokenConnection('https://a.com', 'my-jwt-token', 'A')

    expect(store.apiHeaders).toEqual({ Authorization: 'Bearer my-jwt-token' })
  })

  it('should return empty headers when no active connection', () => {
    const store = useConnectionStore()
    expect(store.apiHeaders).toEqual({})
  })

  it('should logout and clear token', () => {
    const store = useConnectionStore()
    store.addTokenConnection('https://a.com', 'tok', 'A')
    expect(store.active.token).toBe('tok')

    store.logout()
    expect(store.activeId).toBeNull()
  })

  it('should initialize defaults from env', () => {
    // Mock the env
    const origUrl = process.env.DEFAULT_API_URL
    process.env.DEFAULT_API_URL = 'https://test.example.com/api'
    process.env.DEFAULT_API_NAME = 'TestDB'

    const store = useConnectionStore()
    store.initDefaults()

    expect(store.connections).toHaveLength(1)
    expect(store.connections[0].name).toBe('TestDB')
    expect(store.connections[0].url).toBe('https://test.example.com/api')

    // Restore
    process.env.DEFAULT_API_URL = origUrl
  })
})
