<template lang="pug">
q-toolbar(dense class="footer-bar")
  .text-caption.text-grey-6
    | PgRestAdmin v{{ version }}
  q-space
  .text-caption.text-grey-7(v-if="conn.active")
    q-icon(name="cloud" size="xs" class="q-mr-xs")
    | {{ conn.active.url }}
</template>

<script>
import { defineComponent } from 'vue'
import { useConnectionStore } from 'src/stores/connection'
import pkg from 'app/package.json'

export default defineComponent({
  name: 'AppFooter',
  setup () {
    const conn = useConnectionStore()
    return {
      conn,
      version: pkg.version
    }
  }
})
</script>
