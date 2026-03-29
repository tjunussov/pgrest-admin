import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    connections: [],
    activeId: null,
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
    async login (url, params) {
      this.loginLoading = true
      try {
        const cleanUrl = url.replace(/\/+$/, '')
        const { data } = await api.post(`${cleanUrl}/rpc/login`, params)

        const token = Array.isArray(data) ? data[0]?.token : data?.token || data?.[0]?.token
        if (!token) throw new Error('No token returned from login')

        const label = params.email || params.username || params.user || Object.values(params)[0] || ''
        const id = `${cleanUrl}_${label}_${Date.now()}`
        const conn = { id, name: `${label}@${new URL(cleanUrl).host}`, url: cleanUrl, token, email: label, loginParams: { ...params } }

        const existing = this.connections.findIndex(c => c.url === cleanUrl && c.email === label)
        if (existing >= 0) {
          this.connections[existing] = { ...this.connections[existing], token, name: conn.name, loginParams: { ...params } }
          this.activeId = this.connections[existing].id
        } else {
          this.connections.push(conn)
          this.activeId = conn.id
        }

        return { success: true }
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.data?.hint || err.message
        return { success: false, error: msg }
      } finally {
        this.loginLoading = false
      }
    },

    setActive (id) {
      this.activeId = id
    },

    removeConnection (id) {
      this.connections = this.connections.filter(c => c.id !== id)
      if (this.activeId === id) {
        this.activeId = this.connections[0]?.id || null
      }
    },

    logout () {
      if (this.active) {
        this.active.token = null
      }
      this.activeId = null
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
        }
      }
    }
  },

  persist: {
    pick: ['connections', 'activeId']
  }
})
