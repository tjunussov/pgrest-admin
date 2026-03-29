<template lang="pug">
.data-grid.column.full-height
  //- Table section
  .col(style="overflow: auto")
    q-table(
      :rows="rows"
      :columns="tableColumns"
      :loading="loading"
      row-key="__rowIndex"
      dense flat bordered
      separator="cell"
      selection="single"
      v-model:selected="selected"
      :pagination="pagination"
      @request="onRequest"
      :rows-per-page-options="[25, 50, 100, 250]"
      table-class="datagrid-table"
    )
      template(v-slot:top)
        .full-width
          .row.items-center.q-mb-xs
            q-icon(name="table_chart" color="primary" size="sm" class="q-mr-xs")
            span.text-subtitle2 {{ resource?.name }}
            q-badge.q-ml-sm(v-if="totalCount !== null" :label="`${totalCount} rows`" color="grey-8")
            q-space
            q-btn(icon="add" color="positive" dense flat size="sm" @click="openCreate")
              q-tooltip Insert row
            q-btn(icon="refresh" dense flat size="sm" @click="fetchData" class="q-ml-xs")
            q-btn(icon="settings" dense flat size="sm" @click="showStructure = true" class="q-ml-xs")
              q-tooltip Structure

          //- Inline filters
          .row.items-center.q-gutter-xs
            q-select(
              v-model="filterColumn"
              :options="filterColumnOptions"
              label="Column"
              dense outlined
              style="min-width: 130px; max-width: 160px"
              emit-value map-options
            )
            q-select(
              v-model="filterOp"
              :options="operators"
              dense outlined
              style="min-width: 90px; max-width: 110px"
              emit-value map-options
            )
            q-input(
              v-model="filterValue"
              dense outlined
              placeholder="Value"
              style="min-width: 140px; max-width: 200px"
              @keyup.enter="addFilter"
              :disable="filterOp === 'is.null' || filterOp === 'is.true' || filterOp === 'is.false'"
            )
            q-btn(icon="add" color="primary" dense flat size="sm" @click="addFilter")
            q-btn(icon="clear_all" dense flat size="sm" @click="clearFilters" v-if="filters.length")
            q-chip(
              v-for="(f, i) in filters"
              :key="i"
              removable dense size="sm"
              color="primary" text-color="white"
              @remove="removeFilter(i)"
            )
              | {{ f.column }} {{ f.op }} {{ f.value }}

      //- Custom body with manual checkbox (required when using body slot + selection)
      template(v-slot:body="props")
        q-tr(:props="props" :class="{ 'bg-blue-grey-10': props.selected }")
          q-td(auto-width)
            q-checkbox(v-model="props.selected" dense)
          q-td(v-for="col in props.cols" :key="col.name" :props="props")
            .cell-truncate {{ formatCell(col.value) }}
              q-tooltip(v-if="isLongValue(col.value)") {{ formatCell(col.value) }}

  //- Bottom preview panel — seamless dialog pinned to bottom
  q-dialog(:model-value="true" seamless position="bottom" :persistent="true" no-route-dismiss no-shake)
    q-card.full-width(style="max-height: 40vh" class="bg-dark")
      q-card-section.q-py-xs.q-px-sm
        .row.items-center
          q-icon(:name="selected.length ? 'visibility' : 'info'" size="xs" class="q-mr-xs" color="primary")
          span.text-caption.text-bold {{ selected.length ? 'Row Preview' : 'No row selected' }}
          q-space
          template(v-if="selected.length")
            q-btn(flat dense round icon="edit" size="xs" color="primary" @click="openEdit")
              q-tooltip Edit in dialog
            q-btn(flat dense round icon="delete" size="xs" color="negative" @click="confirmDelete")
              q-tooltip Delete
          q-btn(flat dense round icon="add" size="xs" color="positive" @click="openCreate")
            q-tooltip Insert new row
      q-separator
      q-card-section.q-pa-sm(style="overflow-y: auto; max-height: 35vh")
        template(v-if="selected.length")
          .row.q-col-gutter-xs
            .col-12.col-sm-6.col-md-4(v-for="col in gridColumns" :key="col.column_name")
              .text-caption.text-grey-5 {{ col.column_name }}
                q-badge.q-ml-xs(v-if="col.is_pk" label="PK" color="amber-8" dense)
              pre.preview-value {{ formatPreview(selected[0][col.column_name]) }}
        .text-center.text-grey-6.q-pa-md(v-else)
          | Click a checkbox to preview a row

  //- Structure dialog
  q-dialog(v-model="showStructure")
    q-card(style="min-width: 700px; max-width: 90vw" class="bg-dark")
      q-card-section.row.items-center
        .text-h6 Structure: {{ resource?.name }}
        q-space
        q-btn(flat round dense icon="close" @click="showStructure = false")
      q-separator
      q-card-section.q-pa-sm
        structure-tab

  //- Dialog mode
  crud-dialog(
    v-model="showCrud"
    :mode="crudMode"
    :columns="gridColumns"
    :row="editingRow"
    :resource="resource"
    @saved="fetchData"
  )
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue'
import { useSchemaStore } from 'src/stores/schema'
import { useConnectionStore } from 'src/stores/connection'
import { api } from 'src/boot/axios'
import { useQuasar } from 'quasar'
import CrudDialog from './CrudDialog.vue'
import StructureTab from './StructureTab.vue'

const operators = [
  { label: '=', value: 'eq' },
  { label: '!=', value: 'neq' },
  { label: '>', value: 'gt' },
  { label: '>=', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' },
  { label: '~', value: 'like' },
  { label: '~*', value: 'ilike' },
  { label: 'null', value: 'is.null' },
  { label: 'in', value: 'in' }
]

export default defineComponent({
  name: 'DataGrid',
  components: { CrudDialog, StructureTab },

  setup () {
    const $q = useQuasar()
    const schema = useSchemaStore()
    const conn = useConnectionStore()

    const rows = ref([])
    const loading = ref(false)
    const totalCount = ref(null)
    const showCrud = ref(false)
    const crudMode = ref('create')
    const editingRow = ref(null)
    const showStructure = ref(false)

    // Selection
    const selected = ref([])

    // Filters
    const filterColumn = ref(null)
    const filterOp = ref('eq')
    const filterValue = ref('')
    const filters = ref([])
    const activeFilters = ref({})

    const pagination = ref({
      sortBy: null, descending: false,
      page: 1, rowsPerPage: 50, rowsNumber: 0
    })

    const resource = computed(() => schema.activeResource)

    const gridColumns = computed(() => {
      if (!resource.value) return []
      const key = `${resource.value.schema}.${resource.value.name}`
      return schema.columns[key] || []
    })

    const filterColumnOptions = computed(() => {
      return gridColumns.value.map(c => ({ label: c.column_name, value: c.column_name }))
    })

    const tableColumns = computed(() => {
      return gridColumns.value.map(c => ({
        name: c.column_name,
        label: c.column_name,
        field: c.column_name,
        sortable: true,
        align: 'left',
        headerClasses: c.is_pk ? 'text-amber' : ''
      }))
    })

    function formatCell (value) {
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      return value
    }

    function isLongValue (value) {
      if (value === null || value === undefined) return false
      if (typeof value === 'object') return true
      return String(value).length > 50
    }

    function formatPreview (value) {
      if (value === null || value === undefined) return 'NULL'
      if (typeof value === 'object') return JSON.stringify(value, null, 2)
      return String(value)
    }

    function openCreate () {
      crudMode.value = 'create'
      editingRow.value = null
      showCrud.value = true
    }

    function openEdit () {
      if (!selected.value.length) return
      crudMode.value = 'edit'
      editingRow.value = { ...selected.value[0] }
      showCrud.value = true
    }

    async function fetchData () {
      if (!resource.value || !conn.active) return
      loading.value = true
      try {
        const { schema: s, name } = resource.value
        if (!gridColumns.value.length) await schema.fetchColumns(s, name)

        const params = { ...activeFilters.value }
        if (pagination.value.sortBy) {
          params.order = `${pagination.value.sortBy}.${pagination.value.descending ? 'desc' : 'asc'}`
        }
        const limit = pagination.value.rowsPerPage
        const offset = (pagination.value.page - 1) * limit

        const { data, headers } = await api.get(`${conn.baseUrl}/${name}`, {
          params: { ...params, limit, offset },
          headers: { ...conn.apiHeaders, Prefer: 'count=exact' }
        })
        rows.value = (data || []).map((r, i) => ({ ...r, __rowIndex: i }))
        const range = headers['content-range']
        if (range) {
          const match = range.match(/\/(\d+|\*)/)
          if (match && match[1] !== '*') {
            totalCount.value = parseInt(match[1])
            pagination.value.rowsNumber = totalCount.value
          }
        }
      } catch (err) {
        console.error('Fetch error:', err)
        rows.value = []
      } finally {
        loading.value = false
      }
    }

    function onRequest (props) {
      pagination.value.page = props.pagination.page
      pagination.value.rowsPerPage = props.pagination.rowsPerPage
      pagination.value.sortBy = props.pagination.sortBy
      pagination.value.descending = props.pagination.descending
      fetchData()
    }

    function addFilter () {
      if (!filterColumn.value) return
      if (!filterValue.value && !filterOp.value.startsWith('is.')) return
      let val = filterValue.value
      if (filterOp.value === 'ilike' || filterOp.value === 'like') val = `*${val}*`
      filters.value.push({ column: filterColumn.value, op: filterOp.value, value: val })
      applyFilters()
      filterValue.value = ''
    }

    function removeFilter (i) { filters.value.splice(i, 1); applyFilters() }
    function clearFilters () { filters.value = []; applyFilters() }
    function applyFilters () {
      const params = {}
      filters.value.forEach(f => { params[f.column] = `${f.op}.${f.value}` })
      activeFilters.value = params
      pagination.value.page = 1
      fetchData()
    }

    function confirmDelete () {
      const row = selected.value[0]
      if (!row) return
      $q.dialog({ title: 'Delete Row', message: 'Are you sure?', cancel: true, persistent: true, dark: true })
        .onOk(async () => {
          try {
            const pks = schema.getPrimaryKeys(resource.value.schema, resource.value.name)
            const params = {}
            pks.forEach(pk => { params[pk] = `eq.${row[pk]}` })
            await api.delete(`${conn.baseUrl}/${resource.value.name}`, { params, headers: conn.apiHeaders })
            $q.notify({ type: 'positive', message: 'Row deleted' })
            newRow()
            fetchData()
          } catch (err) {
            $q.notify({ type: 'negative', message: `Delete failed: ${err.message}` })
          }
        })
    }

    watch(resource, (val) => {
      if (val) {
        rows.value = []
        totalCount.value = null
        filters.value = []
        activeFilters.value = {}
        pagination.value.page = 1
        pagination.value.sortBy = null
        selected.value = []
        fetchData()
      }
    }, { immediate: true })

    return {
      rows, loading, totalCount, pagination, resource,
      gridColumns, tableColumns,
      showCrud, crudMode, editingRow, showStructure,
      selected,
      filterColumn, filterOp, filterValue, filters, filterColumnOptions,
      operators,
      formatCell, isLongValue, formatPreview,
      fetchData, onRequest, openCreate, openEdit,
      addFilter, removeFilter, clearFilters, confirmDelete
    }
  }
})
</script>

<style lang="scss">
.datagrid-table {
  table-layout: fixed;
  width: 100%;
}
.cell-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
.preview-value {
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  margin: 0;
  padding: 2px 4px;
  background: #1a1a2e;
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 80px;
  overflow: auto;
}
</style>
