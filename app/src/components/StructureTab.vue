<template lang="pug">
.q-pa-sm(v-if="resource")
  .text-subtitle2.q-mb-sm
    q-icon(name="view_column" size="sm" class="q-mr-xs")
    | Columns
  q-table(
    :rows="columns"
    :columns="colDef"
    dense flat bordered
    row-key="column_name"
    hide-pagination
    :rows-per-page-options="[0]"
  )

  .text-subtitle2.q-mt-md.q-mb-sm
    q-icon(name="speed" size="sm" class="q-mr-xs")
    | Indexes
  q-table(
    :rows="indexes"
    :columns="idxDef"
    dense flat bordered
    row-key="indexname"
    hide-pagination
    :rows-per-page-options="[0]"
  )
    template(v-slot:no-data)
      .text-grey-6 No indexes found

  .text-subtitle2.q-mt-md.q-mb-sm
    q-icon(name="bolt" size="sm" class="q-mr-xs")
    | Triggers
  q-table(
    :rows="triggers"
    :columns="trgDef"
    dense flat bordered
    row-key="trigger_name"
    hide-pagination
    :rows-per-page-options="[0]"
  )
    template(v-slot:no-data)
      .text-grey-6 No triggers found

  .text-subtitle2.q-mt-md.q-mb-sm
    q-icon(name="link" size="sm" class="q-mr-xs")
    | Constraints
  q-table(
    :rows="constraints"
    :columns="conDef"
    dense flat bordered
    row-key="constraint_name"
    hide-pagination
    :rows-per-page-options="[0]"
  )
    template(v-slot:no-data)
      .text-grey-6 No constraints found
</template>

<script>
import { defineComponent, computed, watch } from 'vue'
import { useSchemaStore } from 'src/stores/schema'

const colDef = [
  { name: 'column_name', label: 'Column', field: 'column_name', align: 'left', sortable: true },
  { name: 'data_type', label: 'Type', field: 'data_type', align: 'left' },
  { name: 'is_nullable', label: 'Nullable', field: 'is_nullable', align: 'center' },
  { name: 'column_default', label: 'Default', field: 'column_default', align: 'left' },
  { name: 'is_pk', label: 'PK', field: 'is_pk', align: 'center', format: v => v ? 'YES' : '' }
]

const idxDef = [
  { name: 'indexname', label: 'Name', field: 'indexname', align: 'left' },
  { name: 'indexdef', label: 'Definition', field: 'indexdef', align: 'left' }
]

const trgDef = [
  { name: 'trigger_name', label: 'Name', field: 'trigger_name', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'center' },
  { name: 'trigger_def', label: 'Definition', field: 'trigger_def', align: 'left' }
]

const conDef = [
  { name: 'constraint_name', label: 'Name', field: 'constraint_name', align: 'left' },
  { name: 'constraint_type', label: 'Type', field: 'constraint_type', align: 'left' },
  { name: 'column_name', label: 'Column', field: 'column_name', align: 'left' },
  { name: 'foreign_table_name', label: 'FK Table', field: 'foreign_table_name', align: 'left' },
  { name: 'foreign_column_name', label: 'FK Column', field: 'foreign_column_name', align: 'left' }
]

export default defineComponent({
  name: 'StructureTab',

  setup () {
    const schema = useSchemaStore()
    const resource = computed(() => schema.activeResource)
    const key = computed(() => resource.value ? `${resource.value.schema}.${resource.value.name}` : null)

    const columns = computed(() => key.value ? (schema.columns[key.value] || []) : [])
    const indexes = computed(() => key.value ? (schema.indexes[key.value] || []) : [])
    const triggers = computed(() => key.value ? (schema.triggers[key.value] || []) : [])
    const constraints = computed(() => key.value ? (schema.constraints[key.value] || []) : [])

    watch(resource, async (val) => {
      if (!val) return
      const { schema: s, name } = val
      await Promise.all([
        schema.fetchColumns(s, name),
        schema.fetchIndexes(s, name),
        schema.fetchTriggers(s, name),
        schema.fetchConstraints(s, name)
      ])
    }, { immediate: true })

    return {
      resource,
      columns,
      indexes,
      triggers,
      constraints,
      colDef,
      idxDef,
      trgDef,
      conDef
    }
  }
})
</script>
