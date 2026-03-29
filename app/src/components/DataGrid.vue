<template lang="pug">
.data-grid.column.full-height
  //- Table section
  .col(style="overflow: auto")
    q-table(
      :rows="rows"
      :columns="tableColumns"
      :loading="loading"
      row-key="__rowIndex"
      dense flat
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
            //- Active filter chips
            q-chip(
              v-for="(f, i) in filters"
              :key="i"
              removable dense size="sm"
              color="primary" text-color="white"
              @remove="removeFilter(i)"
            )
              | {{ f.column }} {{ f.op }} {{ f.value }}
            q-btn(icon="clear_all" dense flat size="xs" @click="clearFilters" v-if="filters.length")
            q-btn(icon="refresh" dense flat size="sm" @click="fetchData" class="q-ml-xs")
            q-btn(icon="settings" dense flat size="sm" @click="showStructure = true" class="q-ml-xs")
              q-tooltip Structure

      template(v-slot:header="props")
        q-tr(:props="props")
          q-th(auto-width)
            q-btn(flat dense round icon="add" size="xs" color="positive" @click="openCreate")
              q-tooltip Insert row
          q-th.col-header(v-for="col in props.cols" :key="col.name" :props="props")
            | {{ col.label }}
            q-icon.col-filter-icon(
              name="filter_list"
              size="12px"
              :color="hasFilter(col.name) ? 'primary' : 'grey-7'"
            )
            //- Filter menu on column
            q-menu(anchor="bottom left" self="top left")
              .bg-dark.q-pa-sm(style="min-width: 240px")
                .text-caption.text-grey-5.q-mb-xs {{ col.label }}
                //- Existing filters for this column
                .row.items-center.q-mb-xs(v-for="(f, i) in getColumnFilters(col.name)" :key="i")
                  q-chip(dense removable size="sm" color="blue-grey-8" text-color="white" @remove="removeFilter(filters.indexOf(f))")
                    | {{ f.op }} {{ f.value }}
                //- New filter input
                q-input(
                  v-model="colFilterVal[col.name]"
                  dense outlined
                  placeholder="Value"
                  @keyup.enter="addColumnFilter(col.name)"
                  :disable="(colFilterOp[col.name] || 'eq').startsWith('is.')"
                )
                  template(v-slot:prepend)
                    q-btn-dropdown(flat dense no-caps size="sm" :label="opLabel(col.name)" style="min-width: 32px")
                      q-list(dense)
                        q-item(
                          v-for="op in operators"
                          :key="op.value"
                          clickable v-close-popup
                          dense
                          @click="colFilterOp[col.name] = op.value"
                          :active="(colFilterOp[col.name] || 'eq') === op.value"
                        )
                          q-item-section {{ op.label }}
                  template(v-slot:append)
                    q-btn(flat dense round icon="add" size="xs" @click="addColumnFilter(col.name)")

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

    // Per-column filters
    const colFilterOp = ref({})
    const colFilterVal = ref({})
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

    function hasFilter (colName) {
      return filters.value.some(f => f.column === colName)
    }

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

    function getColumnFilters (colName) {
      return filters.value.filter(f => f.column === colName)
    }

    function opLabel (colName) {
      const op = colFilterOp.value[colName] || 'eq'
      const found = operators.find(o => o.value === op)
      return found ? found.label : '='
    }

    function addColumnFilter (colName) {
      const op = colFilterOp.value[colName] || 'eq'
      const val = colFilterVal.value[colName] || ''
      if (!val && !op.startsWith('is.')) return
      let filterVal = val
      if (op === 'ilike' || op === 'like') filterVal = `*${val}*`
      filters.value.push({ column: colName, op, value: filterVal })
      colFilterVal.value[colName] = ''
      applyFilters()
    }

    function clearColumnFilter (colName) {
      filters.value = filters.value.filter(f => f.column !== colName)
      delete colFilterOp.value[colName]
      delete colFilterVal.value[colName]
      applyFilters()
    }

    function removeFilter (i) { filters.value.splice(i, 1); applyFilters() }
    function clearFilters () {
      filters.value = []
      colFilterOp.value = {}
      colFilterVal.value = {}
      applyFilters()
    }
    function applyFilters () {
      const params = {}
      // Group by column — multiple filters on same column use last one
      // (PostgREST doesn't support duplicate query keys)
      const grouped = {}
      filters.value.forEach(f => {
        if (!grouped[f.column]) grouped[f.column] = []
        grouped[f.column].push(f)
      })
      Object.entries(grouped).forEach(([col, arr]) => {
        if (arr.length === 1) {
          params[col] = `${arr[0].op}.${arr[0].value}`
        } else {
          // Multiple: use the last filter (PostgREST limitation)
          const last = arr[arr.length - 1]
          params[col] = `${last.op}.${last.value}`
        }
      })
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
      colFilterOp, colFilterVal, filters,
      operators,
      isJsonColumn, formatCell, isLongValue, hasFilter, getColumnFilters, opLabel,
      fetchData, onRequest, openCreate, clearSelection, saveInline,
      addColumnFilter, clearColumnFilter, removeFilter, clearFilters, confirmDelete
    }
  }
})
</script>

<style lang="scss">
.datagrid-table {
  table-layout: fixed;
  width: 100%;
}
.col-filter-icon {
  opacity: 0;
  transition: opacity 0.15s;
  margin-left: 2px;
  cursor: pointer;
}
.col-header:hover .col-filter-icon {
  opacity: 1;
}
.col-filter-icon.text-primary {
  opacity: 1;
}
.cell-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
.inline-editor {
  border-top: 1px solid #333;
}
.inline-editor .q-field--outlined .q-field__control:before {
  border-color: #333;
}
</style>
