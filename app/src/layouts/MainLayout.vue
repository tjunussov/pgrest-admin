<template lang="pug">
q-layout(view="hHh lpR fFf")
  q-header.bg-dark
    q-toolbar.q-px-sm(style="min-height: 40px")
      //- Drawer toggle
      q-btn(flat dense round :icon="settings.drawerCollapsed ? 'chevron_right' : 'chevron_left'" size="sm" @click="settings.toggleDrawer")
        q-tooltip {{ settings.drawerCollapsed ? 'Show explorer' : 'Hide explorer' }}

      //- Logo with connection dropdown
      q-btn-dropdown(flat no-caps dense size="sm" menu-anchor="bottom left" menu-self="top left")
        template(v-slot:label)
          q-icon(name="storage" size="xs" class="q-mr-xs")
          span.text-caption {{ conn.active ? conn.active.name : 'PgRestAdmin' }}
        q-list(dense style="min-width: 180px")
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

      q-separator.q-mx-xs(vertical inset)

      //- Session tabs (left-aligned)
      q-tabs(
        :model-value="schema.activeTabId"
        @update:model-value="schema.activateTab"
        dense shrink no-caps
        active-color="white"
        indicator-color="primary"
        class="text-grey-6"
      )
        q-tab(v-for="tab in schema.tabs" :key="tab.id" :name="tab.id" no-caps)
          .row.items-center.no-wrap
            q-icon(:name="tab.type === 'sql' ? 'code' : 'table_chart'" size="14px" class="q-mr-xs")
            span.text-caption {{ tab.label }}
            q-btn.q-ml-xs(flat round dense icon="close" size="8px" @click.stop="schema.closeTab(tab.id)")

      q-btn(flat dense round icon="add" size="sm" @click="addTab")
        q-tooltip New tab

  q-drawer(
    :model-value="!settings.drawerCollapsed"
    side="left"
    :width="settings.drawerWidth"
    class="bg-dark"
    :breakpoint="0"
    bordered
  )
    //- Resize handle
    .drawer-resize-handle(@mousedown="startResize")
    q-scroll-area.fit
      .q-pa-sm
        resource-tree(v-if="conn.active" @select="onResourceSelect")
        .text-caption.text-grey-6.q-mt-md
          | PgRestAdmin v{{ version }}

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

    // Drawer resize
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

    function addTab () {
      schema.openSqlTab()
    }

    return {
      conn,
      schema,
      settings,
      showConnectionDialog,
      startResize,
      onLogout,
      onRefresh,
      onResourceSelect,
      addTab,
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

  &:hover {
    background: rgba(25, 118, 210, 0.4);
  }
}
</style>
