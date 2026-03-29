<template lang="pug">
.row.q-gutter-sm.items-end
  q-select(
    v-model="column"
    :options="columnOptions"
    label="Column"
    dense outlined
    style="min-width: 150px"
    emit-value
    map-options
  )
  q-select(
    v-model="operator"
    :options="operators"
    label="Operator"
    dense outlined
    style="min-width: 120px"
    emit-value
    map-options
  )
  q-input(
    v-model="value"
    label="Value"
    dense outlined
    style="min-width: 200px"
    @keyup.enter="applyFilter"
    :disable="operator === 'is.null' || operator === 'is.true' || operator === 'is.false'"
  )
  q-btn(icon="add" color="primary" dense flat @click="applyFilter")
    q-tooltip Add filter
  q-btn(icon="clear_all" dense flat @click="clearFilters" v-if="filters.length")
    q-tooltip Clear all

  q-chip(
    v-for="(f, i) in filters"
    :key="i"
    removable
    dense
    color="primary"
    text-color="white"
    @remove="removeFilter(i)"
  )
    | {{ f.column }} {{ f.op }} {{ f.value }}
</template>

<script>
import { defineComponent, ref } from 'vue'

const operators = [
  { label: '= equals', value: 'eq' },
  { label: '!= not equal', value: 'neq' },
  { label: '> greater', value: 'gt' },
  { label: '>= greater or eq', value: 'gte' },
  { label: '< less', value: 'lt' },
  { label: '<= less or eq', value: 'lte' },
  { label: '~ like', value: 'like' },
  { label: '~* ilike', value: 'ilike' },
  { label: 'is null', value: 'is.null' },
  { label: 'is true', value: 'is.true' },
  { label: 'is false', value: 'is.false' },
  { label: 'in', value: 'in' }
]

export default defineComponent({
  name: 'FilterBar',
  props: {
    columns: { type: Array, default: () => [] }
  },
  emits: ['filter'],

  setup (props, { emit }) {
    const column = ref(null)
    const operator = ref('eq')
    const value = ref('')
    const filters = ref([])

    const columnOptions = ref([])

    function updateColumnOptions () {
      columnOptions.value = props.columns.map(c => ({
        label: c.column_name || c,
        value: c.column_name || c
      }))
    }

    function applyFilter () {
      if (!column.value || (!value.value && !operator.value.startsWith('is.'))) return

      let filterValue = value.value
      if (operator.value === 'ilike' || operator.value === 'like') {
        filterValue = `*${value.value}*`
      }

      filters.value.push({
        column: column.value,
        op: operator.value,
        value: filterValue
      })

      emitFilters()
      value.value = ''
    }

    function removeFilter (index) {
      filters.value.splice(index, 1)
      emitFilters()
    }

    function clearFilters () {
      filters.value = []
      emitFilters()
    }

    function emitFilters () {
      const params = {}
      filters.value.forEach(f => {
        params[f.column] = `${f.op}.${f.value}`
      })
      emit('filter', params)
    }

    return {
      column,
      operator,
      value,
      filters,
      columnOptions,
      operators,
      applyFilter,
      removeFilter,
      clearFilters,
      updateColumnOptions
    }
  },

  watch: {
    columns: {
      handler () {
        this.updateColumnOptions()
      },
      immediate: true
    }
  }
})
</script>
