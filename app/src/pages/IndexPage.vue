<template lang="pug">
q-page.q-pa-sm
  template(v-if="schema.activeResource")
    q-tabs(v-model="schema.activeTab" dense align="left" class="bg-dark text-grey-5" active-color="primary" indicator-color="primary")
      q-tab(name="data" label="Data" icon="table_chart")
      q-tab(name="structure" label="Structure" icon="schema")
      q-tab(name="sql" label="SQL Lab" icon="code")

    q-separator

    q-tab-panels(v-model="schema.activeTab" animated class="bg-transparent")
      q-tab-panel(name="data" class="q-pa-none")
        data-grid

      q-tab-panel(name="structure" class="q-pa-none")
        structure-tab

      q-tab-panel(name="sql" class="q-pa-none q-pt-sm")
        sql-lab

  .text-center.q-pa-xl.text-grey-7(v-else)
    q-icon(name="table_chart" size="64px")
    .text-h6.q-mt-md Select a table or view
    .text-caption Use the explorer on the left to browse your database
</template>

<script>
import { defineComponent } from 'vue'
import { useSchemaStore } from 'src/stores/schema'
import DataGrid from 'src/components/DataGrid.vue'
import StructureTab from 'src/components/StructureTab.vue'
import SqlLab from 'src/components/SqlLab.vue'

export default defineComponent({
  name: 'IndexPage',
  components: { DataGrid, StructureTab, SqlLab },

  setup () {
    const schema = useSchemaStore()
    return { schema }
  }
})
</script>
