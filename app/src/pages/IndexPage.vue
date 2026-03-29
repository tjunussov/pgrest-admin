<template lang="pug">
q-page.q-pa-none
  template(v-for="tab in schema.tabs" :key="tab.id")
    data-grid(v-if="tab.type === 'data'" v-show="tab.id === schema.activeTabId" :resource-key="tab.id")
    sql-lab(v-if="tab.type === 'sql'" v-show="tab.id === schema.activeTabId" :tab="tab")

  .text-center.q-pa-xl.text-grey-7(v-if="!schema.tabs.length")
    q-icon(name="table_chart" size="64px")
    .text-h6.q-mt-md Select a table or press +
    .text-caption Open a resource from the tree or start a SQL session
</template>

<script>
import { defineComponent } from 'vue'
import { useSchemaStore } from 'src/stores/schema'
import DataGrid from 'src/components/DataGrid.vue'
import SqlLab from 'src/components/SqlLab.vue'

export default defineComponent({
  name: 'IndexPage',
  components: { DataGrid, SqlLab },

  setup () {
    const schema = useSchemaStore()
    return { schema }
  }
})
</script>
