<template lang="pug">
.q-pa-md
  q-table(
    :rows="rows"
    :columns="tableColumns"
    :loading="loading"
    row-key="__rowIndex"
    dense flat bordered
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
          q-btn(icon="add" label="Insert" color="positive" dense no-caps flat size="sm" @click="openCreate")
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

    template(v-slot:body="props")
      q-tr(:props="props")
        q-td(v-for="col in props.cols" :key="col.name" :props="props")
          template(v-if="col.name === '__actions'")
            q-btn(icon="edit" size="xs" flat round color="primary" @click="openEdit(props.row)")
            q-btn(icon="delete" size="xs" flat round color="negative" @click="confirmDelete(props.row)")
          template(v-else)
            .cell-truncate {{ formatCell(col.value) }}
              q-tooltip(v-if="isLongValue(col.value)") {{ formatCell(col.value) }}

  crud-dialog(
    v-model="showCrud"
    :mode="crudMode"
    :columns="gridColumns"
    :row="editingRow"
    :resource="resource"
    @saved="fetchData"
  )

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

    // Filters
    const filterColumn = ref(null)
    const filterOp = ref('eq')
    const filterValue = ref('')
    const filters = ref([])
    const activeFilters = ref({})

    const pagination = ref({
      sortBy: null,
      descending: false,
      page: 1,
      rowsPerPage: 50,
      rowsNumber: 0
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
      const cols = gridColumns.value.map(c => ({
        name: c.column_name,
        label: c.column_name,
        field: c.column_name,
        sortable: true,
        align: 'left',
        headerClasses: c.is_pk ? 'text-amber' : ''
      }))
      cols.push({
        name: '__actions',
        label: '',
        field: '__actions',
        sortable: false,
        align: 'center',
        style: 'width: 80px'
      })
      return cols
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

    async function fetchData () {
      if (!resource.value || !conn.active) return
      loading.value = true
      try {
        const { schema: s, name } = resource.value
        if (!gridColumns.value.length) {
          await schema.fetchColumns(s, name)
        }

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
        console.error('Fetch data error:', err)
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
      if (filterOp.value === 'ilike' || filterOp.value === 'like') {
        val = `*${val}*`
      }

      filters.value.push({ column: filterColumn.value, op: filterOp.value, value: val })
      applyFilters()
      filterValue.value = ''
    }

    function removeFilter (index) {
      filters.value.splice(index, 1)
      applyFilters()
    }

    function clearFilters () {
      filters.value = []
      applyFilters()
    }

    function applyFilters () {
      const params = {}
      filters.value.forEach(f => { params[f.column] = `${f.op}.${f.value}` })
      activeFilters.value = params
      pagination.value.page = 1
      fetchData()
    }

    function openCreate () {
      crudMode.value = 'create'
      editingRow.value = null
      showCrud.value = true
    }

    function openEdit (row) {
      crudMode.value = 'edit'
      editingRow.value = { ...row }
      showCrud.value = true
    }

    function confirmDelete (row) {
      $q.dialog({
        title: 'Delete Row',
        message: 'Are you sure?',
        cancel: true,
        persistent: true,
        dark: true
      }).onOk(async () => {
        try {
          const pks = schema.getPrimaryKeys(resource.value.schema, resource.value.name)
          const params = {}
          pks.forEach(pk => { params[pk] = `eq.${row[pk]}` })
          await api.delete(`${conn.baseUrl}/${resource.value.name}`, { params, headers: conn.apiHeaders })
          $q.notify({ type: 'positive', message: 'Row deleted' })
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
        fetchData()
      }
    }, { immediate: true })

    return {
      rows, loading, totalCount, pagination, resource,
      gridColumns, tableColumns, showCrud, crudMode, editingRow,
      showStructure,
      filterColumn, filterOp, filterValue, filters, filterColumnOptions,
      operators,
      formatCell, isLongValue, fetchData, onRequest,
      addFilter, removeFilter, clearFilters,
      openCreate, openEdit, confirmDelete
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
</style>
