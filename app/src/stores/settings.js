import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    drawerWidth: 260,
    drawerCollapsed: false
  }),

  getters: {
    effectiveDrawerWidth (state) {
      return state.drawerCollapsed ? 0 : state.drawerWidth
    }
  },

  actions: {
    setDrawerWidth (w) {
      this.drawerWidth = Math.max(180, Math.min(500, w))
    },

    toggleDrawer () {
      this.drawerCollapsed = !this.drawerCollapsed
    }
  },

  persist: true
})
