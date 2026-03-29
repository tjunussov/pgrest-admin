<template lang="pug">
.data-grid
  filter-bar(
    :columns="gridColumns"
    @filter="onFilter"
    ref="filterBar"
  )

  q-table(
    :rows="rows"
    :columns="tableColumns"
    :loading="loading"
    row-key="__rowIndex"
    dense flat bordered
    :pagination="pagination"
    @request="onRequest"
    :rows-per-page-options="[25, 50, 100, 250]"
    class="q-mt-sm"
  )
    template(v-slot:top-left)
      .row.items-center.q-gutter-sm
        q-icon(name="table_chart" color="primary" size="sm")
        span.text-subtitle2 {{ resource?.name }}
        q-badge(v-if="totalCount !== null" :label="`${totalCount} rows`" color="grey-8")

    template(v-slot:top-right)
      q-btn(icon="add" label="Insert" color="positive" dense no-caps flat @click="openCreate")
      q-btn(icon="refresh" dense flat @click="fetchData" class="q-ml-sm")

    template(v-slot:body="props")
      q-tr(:props="props")
        q-td(v-for="col in props.cols" :key="col.name" :props="props")
          template(v-if="col.name === '__actions'")
            q-btn(icon="edit" size="xs" flat round color="primary" @click="openEdit(props.row)")
            q-btn(icon="delete" size="xs" flat round color="negative" @click="confirmDelete(props.row)")
          template(v-else)
            span {{ col.value }}

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
import FilterBar from './FilterBar.vue'
import CrudDialog from './CrudDialog.vue'

export default defineComponent({
  name: 'DataGrid',
  components: { FilterBar, CrudDialog },

  setup () {
    const $q = useQuasar()
    const schema = useSchemaStore()
    const conn = useConnectionStore()

    const rows = ref([])
    const loading = ref(false)
    const totalCount = ref(null)
    const activeFilters = ref({})
    const showCrud = ref(false)
    const crudMode = ref('create')
    const editingRow = ref(null)

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

    async function fetchData () {
      if (!resource.value || !conn.active) return

      loading.value = true
      try {
        const { schema: s, name } = resource.value
        const key = `${s}.${name}`

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
          headers: {
            ...conn.apiHeaders,
            Prefer: 'count=exact'
          }
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

    function onFilter (params) {
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
        message: 'Are you sure you want to delete this row?',
        cancel: true,
        persistent: true,
        dark: true
      }).onOk(async () => {
        try {
          const pks = schema.getPrimaryKeys(resource.value.schema, resource.value.name)
          const params = {}
          pks.forEach(pk => {
            params[pk] = `eq.${row[pk]}`
          })

          await api.delete(`${conn.baseUrl}/${resource.value.name}`, {
            params,
            headers: conn.apiHeaders
          })

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
        pagination.value.page = 1
        pagination.value.sortBy = null
        fetchData()
      }
    }, { immediate: true })

    return {
      rows,
      loading,
      totalCount,
      pagination,
      resource,
      gridColumns,
      tableColumns,
      showCrud,
      crudMode,
      editingRow,
      fetchData,
      onRequest,
      onFilter,
      openCreate,
      openEdit,
      confirmDelete
    }
  }
})
</script>
