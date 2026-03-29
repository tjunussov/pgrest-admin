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
    q-scroll-area.fit
      .q-pa-sm
        //- Connection section
        .row.items-center.q-mb-sm
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
                q-separator
                q-item(clickable v-close-popup @click="onLogout")
                  q-item-section(avatar)
                    q-icon(name="logout" size="xs")
                  q-item-section Disconnect

        q-separator.q-mb-sm

        //- Resource tree
        resource-tree(v-if="conn.active" @select="onResourceSelect")

        //- Version footer
        .text-caption.text-grey-7.q-mt-md PgRestAdmin v{{ version }}

  q-page-container
    router-view

  connection-dialog(v-model="showConnectionDialog")
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { useConnectionStore } from 'src/stores/connection'
import { useSchemaStore } from 'src/stores/schema'
import { useSettingsStore } from 'src/stores/settings'
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

    onMounted(() => {
      conn.initDefaults()
      if (!conn.active) {
        showConnectionDialog.value = true
      } else {
        schema.fetchSchemas()
      }
    })

    function onLogout () {
      conn.logout()
      schema.reset()
    }

    function onRefresh () {
      if (conn.active) schema.fetchSchemas()
    }

    function onResourceSelect (resource) {
      schema.openResourceTab(resource)
    }

    return {
      conn, schema, settings, showConnectionDialog,
      startResize, onLogout, onRefresh, onResourceSelect,
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
