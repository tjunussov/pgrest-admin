<template lang="pug">
q-layout(view="hHh lpR fFf")
  q-header.bg-dark(bordered)
    q-toolbar
      q-btn(flat dense round icon="menu" @click="drawer = !drawer")
      q-toolbar-title.text-subtitle1
        q-icon(name="storage" size="sm" class="q-mr-sm")
        | PgRestAdmin
      q-space
      template(v-if="conn.active")
        q-chip(dense color="positive" text-color="white" icon="cloud_done" size="sm")
          | {{ conn.active.name }}
        q-btn(flat dense round icon="logout" @click="onLogout" size="sm")
          q-tooltip Disconnect
      q-btn(flat dense round icon="link" @click="showConnectionDialog = true")
        q-tooltip Connections
      q-btn(flat dense round icon="refresh" @click="onRefresh")
        q-tooltip Refresh

  q-drawer(v-model="drawer" side="left" bordered :width="280" class="bg-dark")
    q-scroll-area.fit
      .q-pa-sm
        .text-caption.text-grey-6.q-mb-xs EXPLORER
        resource-tree(
          v-if="conn.active"
          @select="onResourceSelect"
        )
        .text-center.q-pa-lg.text-grey-7(v-else)
          q-icon(name="link_off" size="xl")
          .q-mt-sm Not connected
          q-btn(
            flat dense no-caps
            label="Connect"
            color="primary"
            @click="showConnectionDialog = true"
          )

  q-page-container
    router-view

  q-footer.footer-bar.bg-dark(bordered)
    app-footer

  connection-dialog(v-model="showConnectionDialog")
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useConnectionStore } from 'src/stores/connection'
import { useSchemaStore } from 'src/stores/schema'
import ConnectionDialog from 'src/components/ConnectionDialog.vue'
import ResourceTree from 'src/components/ResourceTree.vue'
import AppFooter from 'src/components/AppFooter.vue'

export default defineComponent({
  name: 'MainLayout',
  components: { ConnectionDialog, ResourceTree, AppFooter },

  setup () {
    const conn = useConnectionStore()
    const schema = useSchemaStore()
    const drawer = ref(true)
    const showConnectionDialog = ref(false)

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
      if (conn.active) {
        schema.fetchSchemas()
      }
    }

    function onResourceSelect (resource) {
      schema.setActiveResource(resource)
    }

    return {
      conn,
      schema,
      drawer,
      showConnectionDialog,
      onLogout,
      onRefresh,
      onResourceSelect
    }
  }
})
</script>
