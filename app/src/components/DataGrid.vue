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
      :rows-per-page-options="[20, 50, 100, 250]"
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

      template(v-slot:body="props")
        q-tr(:props="props" :class="{ 'bg-blue-grey-10': props.selected }")
          q-td(auto-width)
            q-checkbox(v-model="props.selected" dense)
          q-td(v-for="col in props.cols" :key="col.name" :props="props")
            .cell-truncate {{ formatCell(col.value) }}
              q-tooltip(v-if="isLongValue(col.value)") {{ formatCell(col.value) }}

  //- Bottom inline editor panel (same width as table, directly editable)
  .inline-editor.bg-dark.q-pa-sm(style="flex-shrink: 0; max-height: 40vh; overflow-y: auto")
    .row.items-center.q-mb-xs
      q-icon(:name="selected.length ? 'edit' : 'add_circle'" size="xs" class="q-mr-xs" color="primary")
      span.text-caption.text-bold {{ selected.length ? 'Edit Row' : 'New Row' }}
      q-space
      template(v-if="selected.length")
        q-btn(flat dense round icon="delete" size="xs" color="negative" @click="confirmDelete")
          q-tooltip Delete
      q-btn(flat dense round icon="save" size="xs" color="positive" @click="saveInline" :loading="saving")
        q-tooltip Save
      q-btn(flat dense round icon="clear" size="xs" @click="clearSelection" v-if="selected.length")
        q-tooltip Clear
    .row.q-col-gutter-xs
      .col-12.col-sm-6.col-md-4(v-for="col in editableColumns" :key="col.column_name")
        template(v-if="isJsonColumn(col)")
          q-code(
            v-model="inlineForm[col.column_name]"
            :label="`${col.column_name} (${col.data_type})`"
            :disabled="editMode === 'edit' && col.is_pk"
            min-height="60px"
          )
        q-input(
          v-else
          v-model="inlineForm[col.column_name]"
          :label="`${col.column_name} (${col.data_type})`"
          dense outlined
          :disable="editMode === 'edit' && col.is_pk"
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
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useSchemaStore } from 'src/stores/schema'
import { useConnectionStore } from 'src/stores/connection'
import { api } from 'src/boot/axios'
import { useQuasar, Notify } from 'quasar'
import StructureTab from './StructureTab.vue'
import QCode from './ui/QCode.vue'

const JSON_TYPES = ['json', 'jsonb', 'ARRAY', 'USER-DEFINED']

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
  components: { StructureTab, QCode },

  setup () {
    const $q = useQuasar()
    const schema = useSchemaStore()
    const conn = useConnectionStore()

    const rows = ref([])
    const loading = ref(false)
    const totalCount = ref(null)
    const showStructure = ref(false)
    const saving = ref(false)

    const selected = ref([])
    const inlineForm = ref({})
    const editMode = ref('create')

    const filterColumn = ref(null)
    const filterOp = ref('eq')
    const filterValue = ref('')
    const filters = ref([])
    const activeFilters = ref({})

    const pagination = ref({
      sortBy: null, descending: false,
      page: 1, rowsPerPage: 20, rowsNumber: 0
    })

    const resource = computed(() => schema.activeResource)

    const gridColumns = computed(() => {
      if (!resource.value) return []
      const key = `${resource.value.schema}.${resource.value.name}`
      return schema.columns[key] || []
    })

    const editableColumns = computed(() => {
      return gridColumns.value.filter(c => {
        if (editMode.value === 'create' && c.column_default?.startsWith('nextval')) return false
        return true
      })
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

    function isJsonColumn (col) { return JSON_TYPES.includes(col.data_type) }

    function stringify (val) {
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val, null, 2)
      return String(val)
    }

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

    function populateForm (row) {
      const form = {}
      gridColumns.value.forEach(c => {
        const v = row ? row[c.column_name] : null
        form[c.column_name] = isJsonColumn(c) ? stringify(v) : v
      })
      inlineForm.value = form
    }

    // Watch selection from checkbox
    watch(selected, (val) => {
      if (val.length) {
        editMode.value = 'edit'
        populateForm(val[0])
      } else {
        editMode.value = 'create'
        populateForm(null)
      }
    })

    function clearSelection () {
      selected.value = []
    }

    function openCreate () {
      selected.value = []
      editMode.value = 'create'
      populateForm(null)
    }

    function parseJsonField (val, col) {
      if (!isJsonColumn(col)) return val
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return val }
      }
      return val
    }

    async function saveInline () {
      if (!resource.value) return
      saving.value = true
      try {
        const { name } = resource.value
        const payload = {}
        editableColumns.value.forEach(c => {
          const val = inlineForm.value[c.column_name]
          if (val !== null && val !== '' && val !== undefined) {
            payload[c.column_name] = parseJsonField(val, c)
          }
        })

        if (editMode.value === 'create') {
          await api.post(`${conn.baseUrl}/${name}`, payload, {
            headers: { ...conn.apiHeaders, Prefer: 'return=representation' }
          })
          Notify.create({ type: 'positive', message: 'Row inserted' })
        } else {
          const row = selected.value[0]
          if (!row) return
          const pks = schema.getPrimaryKeys(resource.value.schema, name)
          const params = {}
          pks.forEach(pk => { params[pk] = `eq.${row[pk]}` })
          await api.patch(`${conn.baseUrl}/${name}`, payload, {
            params, headers: { ...conn.apiHeaders, Prefer: 'return=representation' }
          })
          Notify.create({ type: 'positive', message: 'Row updated' })
        }
        clearSelection()
        fetchData()
      } catch (err) {
        Notify.create({ type: 'negative', message: `Save failed: ${err.response?.data?.message || err.message}` })
      } finally {
        saving.value = false
      }
    }

    // Keyboard navigation
    function onKeyDown (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIdx = selected.value.length ? selected.value[0].__rowIndex : -1
        let nextIdx
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < rows.value.length - 1 ? currentIdx + 1 : currentIdx
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : 0
        }
        const nextRow = rows.value.find(r => r.__rowIndex === nextIdx)
        if (nextRow) selected.value = [nextRow]
      }
    }

    onMounted(() => document.addEventListener('keydown', onKeyDown))
    onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown))

    function selectFirstRow () {
      if (rows.value.length) selected.value = [rows.value[0]]
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
        selectFirstRow()
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
            clearSelection()
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
      rows, loading, totalCount, pagination, resource, saving,
      gridColumns, tableColumns, editableColumns,
      showStructure,
      selected, inlineForm, editMode,
      filterColumn, filterOp, filterValue, filters, filterColumnOptions,
      operators,
      isJsonColumn, formatCell, isLongValue,
      fetchData, onRequest, openCreate, clearSelection, saveInline,
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
.inline-editor {
  border-top: 2px solid #1976d2;
}
</style>
