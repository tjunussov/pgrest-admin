<template lang="pug">
q-layout(view="hHh lpR fFf")
  q-drawer(
    :model-value="!settings.drawerCollapsed"
    side="left"
    :width="settings.drawerWidth"
    class="bg-dark"
    :breakpoint="0"
    bordered
  )
    .drawer-resize-handle(@mousedown="startResize")
    .column.fit
      //- Connection section (fixed top)
      .col-auto
        .row.items-center
          q-btn-dropdown.full-width(
            flat no-caps dense
            :label="conn.active ? conn.active.name : 'Connect...'"
            :icon="conn.active ? 'cloud_done' : 'cloud_off'"
            :color="conn.active ? 'positive' : 'grey'"
            menu-anchor="bottom left"
            menu-self="top left"
          )
            q-list(dense style="min-width: 200px")
              q-item(clickable v-close-popup @click="showConnectionDialog = true")
                q-item-section(avatar)
                  q-icon(name="link" size="xs")
                q-item-section Connect
              template(v-if="conn.active")
                q-item(clickable v-close-popup @click="onRefresh")
                  q-item-section(avatar)
                    q-icon(name="refresh" size="xs")
                  q-item-section Refresh
                q-item(clickable v-close-popup @click="shareLink")
                  q-item-section(avatar)
                    q-icon(name="share" size="xs")
                  q-item-section Share link
                q-separator
                q-item(clickable v-close-popup @click="onLogout")
                  q-item-section(avatar)
                    q-icon(name="logout" size="xs")
                  q-item-section Disconnect
        q-separator

      //- Resource tree (scrollable middle)
      q-scroll-area.col
        .q-pa-sm
          resource-tree(v-if="conn.active" @select="onResourceSelect" @select-new="onResourceSelectNew")

      //- Version (fixed bottom)
      .col-auto.text-caption.text-grey-7.text-center.q-pa-sm PgRestAdmin v{{ version }}

  q-page-container
    router-view

  connection-dialog(v-model="showConnectionDialog")
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from 'src/stores/connection'
import { useSchemaStore } from 'src/stores/schema'
import { useSettingsStore } from 'src/stores/settings'
import { Notify } from 'quasar'
import ConnectionDialog from 'src/components/ConnectionDialog.vue'
import ResourceTree from 'src/components/ResourceTree.vue'
import pkg from 'app/package.json'

export default defineComponent({
  name: 'MainLayout',
  components: { ConnectionDialog, ResourceTree },

  setup () {
    const conn = useConnectionStore()
    const schema = useSchemaStore()
    const settings = useSettingsStore()
    const showConnectionDialog = ref(false)

    let resizing = false
    function startResize (e) {
      resizing = true
      e.preventDefault()
      document.addEventListener('mousemove', onResize)
      document.addEventListener('mouseup', stopResize)
    }
    function onResize (e) {
      if (!resizing) return
      settings.setDrawerWidth(e.clientX)
    }
    function stopResize () {
      resizing = false
      document.removeEventListener('mousemove', onResize)
      document.removeEventListener('mouseup', stopResize)
    }
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', onResize)
      document.removeEventListener('mouseup', stopResize)
    })

    const router = useRouter()

    async function handleDeeplink () {
      const search = window.location.search || window.location.hash.split('?')[1] || ''
      const params = new URLSearchParams(search)

      let url, loginParams

      // Base64 encoded: ?c=base64string
      const encoded = params.get('c')
      if (encoded) {
        try {
          const decoded = JSON.parse(atob(encoded))
          url = decoded.url
          loginParams = {}
          Object.entries(decoded).forEach(([k, v]) => { if (k !== 'url') loginParams[k] = v })
        } catch { return false }
      } else {
        // Plain params: ?url=...&email=...&pass=...
        url = params.get('url')
        if (!url) return false
        loginParams = {}
        for (const [key, val] of params.entries()) {
          if (key !== 'url') loginParams[key] = val
        }
      }

      if (!url || !Object.keys(loginParams).length) return false

      Notify.create({ type: 'info', message: `Connecting to ${new URL(url).host}...` })
      const res = await conn.login(url, loginParams)
      if (res.success) {
        Notify.create({ type: 'positive', message: 'Connected via deeplink' })
        schema.fetchSchemas()
        router.replace({ path: '/', query: {} })
        return true
      } else {
        Notify.create({ type: 'negative', message: `Deeplink login failed: ${res.error}` })
        return false
      }
    }

    onMounted(async () => {
      conn.initDefaults()
      const linked = await handleDeeplink()
      if (!linked) {
        if (!conn.active) {
          showConnectionDialog.value = true
        } else {
          schema.fetchSchemas()
        }
      }
    })

    function onLogout () {
      conn.logout()
      schema.reset()
    }

    function onRefresh () {
      if (conn.active) schema.fetchSchemas()
    }

    function shareLink () {
      if (!conn.active) return
      const payload = { url: conn.active.url, ...conn.active.loginParams }
      const encoded = btoa(JSON.stringify(payload))
      const base = window.location.origin + window.location.pathname
      const link = `${base}?c=${encoded}`
      navigator.clipboard.writeText(link).then(() => {
        Notify.create({ type: 'positive', message: 'Connection link copied (with credentials)' })
      }).catch(() => {
        Notify.create({ type: 'info', message: link })
      })
    }

    function onResourceSelect (resource) {
      schema.openResourceTab(resource, false)
    }

    function onResourceSelectNew (resource) {
      schema.openResourceTab(resource, true)
    }

    return {
      conn, schema, settings, showConnectionDialog,
      startResize, onLogout, onRefresh, shareLink, onResourceSelect, onResourceSelectNew,
      version: pkg.version
    }
  }
})
</script>

<style lang="scss">
.drawer-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
  &:hover { background: rgba(25, 118, 210, 0.4); }
}
</style>
