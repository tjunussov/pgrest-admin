<template lang="pug">
q-page.q-pa-none
  template(v-if="activeTab")
    data-grid(v-if="activeTab.type === 'data'" :key="activeTab.id")
    sql-lab(v-else-if="activeTab.type === 'sql'" :tab="activeTab" :key="activeTab.id")

  .text-center.q-pa-xl.text-grey-7(v-else)
    q-icon(name="table_chart" size="64px")
    .text-h6.q-mt-md Select a table or press +
    .text-caption Open a resource from the tree or start a SQL session
</template>

<script>
import { defineComponent, computed } from 'vue'
import { useSchemaStore } from 'src/stores/schema'
import DataGrid from 'src/components/DataGrid.vue'
import SqlLab from 'src/components/SqlLab.vue'

export default defineComponent({
  name: 'IndexPage',
  components: { DataGrid, SqlLab },

  setup () {
    const schema = useSchemaStore()
    const activeTab = computed(() => schema.getActiveTab())
    return { activeTab }
  }
})
</script>
