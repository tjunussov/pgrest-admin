<template lang="pug">
q-page.q-pa-none.column(:style-fn="pageFn")
  //- Tabs bar
  .row.items-center.bg-dark.q-px-xs(style="min-height: 34px; flex-shrink: 0" v-if="schema.tabs.length")
    q-tabs(
      :model-value="schema.activeTabId"
      @update:model-value="schema.activateTab"
      dense shrink no-caps
      active-color="white"
      indicator-color="primary"
      class="text-grey-6"
    )
      q-tab.tab-item(v-for="tab in schema.tabs" :key="tab.id" :name="tab.id" no-caps)
        .row.items-center.no-wrap
          q-icon(:name="tab.type === 'sql' ? 'code' : 'table_chart'" size="14px" class="q-mr-xs")
          span.text-caption {{ tab.label }}
          q-btn.q-ml-xs.tab-close-btn(flat round dense icon="close" size="8px" @click.stop="schema.closeTab(tab.id)")

    q-btn(flat dense round icon="add" size="sm" @click="schema.openSqlTab()")
      q-tooltip New SQL tab

  q-separator(v-if="schema.tabs.length")

  //- Tab content (v-show for keep-alive)
  .col.column
    template(v-for="tab in schema.tabs" :key="tab.id")
      data-grid.col(v-if="tab.type === 'data'" v-show="tab.id === schema.activeTabId")
      sql-lab.col(v-if="tab.type === 'sql'" v-show="tab.id === schema.activeTabId" :tab="tab")

    .col.flex.flex-center.text-grey-7(v-if="!schema.tabs.length")
      .text-center
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

    function pageFn (offset) {
      return { minHeight: offset ? `calc(100vh - ${offset}px)` : '100vh' }
    }

    return { schema, pageFn }
  }
})
</script>

<style lang="scss">
.tab-close-btn {
  opacity: 0;
  transition: opacity 0.15s;
}
.tab-item:hover .tab-close-btn {
  opacity: 1;
}
</style>
