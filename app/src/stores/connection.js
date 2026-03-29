import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

const STORAGE_KEY = 'pgrestadmin_connections'
const ACTIVE_KEY = 'pgrestadmin_active'

function loadFromStorage (key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    connections: loadFromStorage(STORAGE_KEY, []),
    activeId: loadFromStorage(ACTIVE_KEY, null),
    loginLoading: false
  }),

  getters: {
    active (state) {
      return state.connections.find(c => c.id === state.activeId) || null
    },

    apiHeaders () {
      const conn = this.active
      if (!conn?.token) return {}
      return { Authorization: `Bearer ${conn.token}` }
    },

    baseUrl () {
      return this.active?.url || ''
    }
  },

  actions: {
    persist () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.connections))
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(this.activeId))
    },

    async login (url, email, pass, name) {
      this.loginLoading = true
      try {
        const cleanUrl = url.replace(/\/+$/, '')
        const { data } = await api.post(`${cleanUrl}/rpc/login`, { email, pass })

        const token = Array.isArray(data) ? data[0]?.token : data?.token || data?.[0]?.token
        if (!token) throw new Error('No token returned from login')

        const id = `${cleanUrl}_${email}_${Date.now()}`
        const conn = { id, name: name || `${email}@${new URL(cleanUrl).host}`, url: cleanUrl, token, email }

        const existing = this.connections.findIndex(c => c.url === cleanUrl && c.email === email)
        if (existing >= 0) {
          this.connections[existing] = { ...this.connections[existing], token, name: conn.name }
          this.activeId = this.connections[existing].id
        } else {
          this.connections.push(conn)
          this.activeId = conn.id
        }

        this.persist()
        return { success: true }
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.data?.hint || err.message
        return { success: false, error: msg }
      } finally {
        this.loginLoading = false
      }
    },

    addTokenConnection (url, token, name) {
      const cleanUrl = url.replace(/\/+$/, '')
      const id = `${cleanUrl}_token_${Date.now()}`
      const conn = { id, name: name || new URL(cleanUrl).host, url: cleanUrl, token, email: null }
      this.connections.push(conn)
      this.activeId = conn.id
      this.persist()
    },

    setActive (id) {
      this.activeId = id
      this.persist()
    },

    removeConnection (id) {
      this.connections = this.connections.filter(c => c.id !== id)
      if (this.activeId === id) {
        this.activeId = this.connections[0]?.id || null
      }
      this.persist()
    },

    logout () {
      if (this.active) {
        this.active.token = null
      }
      this.activeId = null
      this.persist()
    },

    initDefaults () {
      if (this.connections.length === 0) {
        const defaultUrl = process.env.DEFAULT_API_URL
        const defaultName = process.env.DEFAULT_API_NAME || 'Default'
        if (defaultUrl) {
          this.connections.push({
            id: `default_${Date.now()}`,
            name: defaultName,
            url: defaultUrl.replace(/\/+$/, ''),
            token: null,
            email: null
          })
          this.persist()
        }
      }
    }
  }
})
