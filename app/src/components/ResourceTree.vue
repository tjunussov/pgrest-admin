<template lang="pug">
div.resource-tree
  q-input(
    v-model="filter"
    dense outlined
    placeholder="Filter..."
    class="q-mb-sm"
    clearable
  )
    template(v-slot:prepend)
      q-icon(name="search" size="xs")

  q-spinner(v-if="schema.loading" color="primary" size="sm" class="q-ma-md")

  q-tree(
    v-else
    ref="treeRef"
    :nodes="treeNodes"
    node-key="id"
    :filter="filter"
    dense
    :default-expand-all="false"
    :expanded="expandedKeys"
    @update:expanded="expandedKeys = $event"
    @lazy-load="onLazyLoad"
    selected-color="primary"
    :selected="selectedId"
    @update:selected="onNodeSelect"
  )
    template(v-slot:default-header="prop")
      .row.items-center.no-wrap(@dblclick.stop="onNodeDblClick(prop.node.id)")
        q-icon(:name="prop.node.icon" :color="prop.node.iconColor || 'grey-6'" size="xs" class="q-mr-xs")
        span.text-caption {{ prop.node.label }}
        q-badge(v-if="prop.node.badge" :label="prop.node.badge" color="grey-8" class="q-ml-xs" dense)
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import { useSchemaStore } from 'src/stores/schema'

export default defineComponent({
  name: 'ResourceTree',
  emits: ['select', 'select-new'],

  setup (props, { emit }) {
    const schema = useSchemaStore()
    const filter = ref('')
    const selectedId = ref(null)
    const expandedKeys = ref([])
    const treeRef = ref(null)

    const treeNodes = computed(() => {
      return schema.schemas.map(s => ({
        id: `schema:${s.schema_name}`,
        label: s.schema_name,
        icon: 'folder',
        iconColor: 'amber-6',
        lazy: true,
        selectable: false,
        children: buildSchemaChildren(s.schema_name)
      }))
    })

    function buildSchemaChildren (schemaName) {
      const tables = schema.tables[schemaName]
      if (!tables) return []

      const baseTables = tables.filter(t => t.table_type === 'BASE TABLE')
      const views = tables.filter(t => t.table_type === 'VIEW')

      const nodes = []

      if (baseTables.length) {
        nodes.push({
          id: `tables:${schemaName}`,
          label: `Tables (${baseTables.length})`,
          icon: 'table_chart',
          iconColor: 'blue-4',
          selectable: false,
          children: baseTables.map(t => ({
            id: `table:${schemaName}.${t.table_name}`,
            label: t.table_name,
            icon: 'table_chart',
            iconColor: 'blue-4',
            lazy: true,
            children: buildTableChildren(schemaName, t.table_name)
          }))
        })
      }

      if (views.length) {
        nodes.push({
          id: `views:${schemaName}`,
          label: `Views (${views.length})`,
          icon: 'visibility',
          iconColor: 'green-4',
          selectable: false,
          children: views.map(v => ({
            id: `view:${schemaName}.${v.table_name}`,
            label: v.table_name,
            icon: 'visibility',
            iconColor: 'green-4'
          }))
        })
      }

      const funcs = schema.functions.filter(f => f.schema_name === schemaName)
      if (funcs.length) {
        nodes.push({
          id: `functions:${schemaName}`,
          label: `Functions (${funcs.length})`,
          icon: 'functions',
          iconColor: 'purple-4',
          selectable: false,
          children: funcs.map(f => ({
            id: `func:${schemaName}.${f.function_name}`,
            label: `${f.function_name}(${f.arguments || ''})`,
            icon: 'functions',
            iconColor: 'purple-4'
          }))
        })
      }

      return nodes
    }

    function buildTableChildren (schemaName, tableName) {
      const key = `${schemaName}.${tableName}`
      const cols = schema.columns[key]
      if (!cols) return []

      const nodes = []

      nodes.push({
        id: `cols:${key}`,
        label: `Columns (${cols.length})`,
        icon: 'view_column',
        iconColor: 'cyan-4',
        selectable: false,
        children: cols.map(c => ({
          id: `col:${key}.${c.column_name}`,
          label: c.column_name,
          icon: c.is_pk ? 'key' : 'remove',
          iconColor: c.is_pk ? 'amber' : 'grey-6',
          badge: c.data_type,
          selectable: false
        }))
      })

      const idxs = schema.indexes[key]
      if (idxs?.length) {
        nodes.push({
          id: `idxs:${key}`,
          label: `Indexes (${idxs.length})`,
          icon: 'speed',
          iconColor: 'orange-4',
          selectable: false,
          children: idxs.map(i => ({
            id: `idx:${key}.${i.indexname}`,
            label: i.indexname,
            icon: 'speed',
            iconColor: 'orange-4',
            selectable: false
          }))
        })
      }

      const trgs = schema.triggers[key]
      if (trgs?.length) {
        nodes.push({
          id: `trgs:${key}`,
          label: `Triggers (${trgs.length})`,
          icon: 'bolt',
          iconColor: 'red-4',
          selectable: false,
          children: trgs.map(t => ({
            id: `trg:${key}.${t.trigger_name}`,
            label: t.trigger_name,
            icon: 'bolt',
            iconColor: 'red-4',
            selectable: false
          }))
        })
      }

      return nodes
    }

    async function onLazyLoad ({ node, done, fail }) {
      try {
        if (node.id.startsWith('schema:')) {
          const schemaName = node.id.replace('schema:', '')
          await Promise.all([
            schema.fetchTables(schemaName),
            schema.fetchFunctions()
          ])
        } else if (node.id.startsWith('table:')) {
          const [schemaName, tableName] = node.id.replace('table:', '').split('.')
          await Promise.all([
            schema.fetchColumns(schemaName, tableName),
            schema.fetchIndexes(schemaName, tableName),
            schema.fetchTriggers(schemaName, tableName),
            schema.fetchConstraints(schemaName, tableName)
          ])
        }
        done([])
      } catch (err) {
        console.error('Tree lazy load error:', err)
        fail()
      }
    }

    function parseResourceId (id) {
      if (!id) return null
      if (id.startsWith('table:') || id.startsWith('view:')) {
        const type = id.startsWith('table:') ? 'table' : 'view'
        const [schemaName, name] = id.replace(/^(table|view):/, '').split('.')
        return { type, schema: schemaName, name }
      }
      return null
    }

    function onNodeSelect (id) {
      selectedId.value = id
      const resource = parseResourceId(id)
      if (resource) emit('select', resource)
    }

    function onNodeDblClick (id) {
      const resource = parseResourceId(id)
      if (resource) emit('select-new', resource)
    }

    // Sync tree selection when active tab changes
    watch(() => schema.activeResource, (res) => {
      if (!res) return
      const id = `${res.type}:${res.schema}.${res.name}`
      selectedId.value = id

      // Expand parent nodes
      const parents = [
        `schema:${res.schema}`,
        `${res.type === 'view' ? 'views' : 'tables'}:${res.schema}`
      ]
      parents.forEach(p => {
        if (!expandedKeys.value.includes(p)) {
          expandedKeys.value.push(p)
        }
      })
    }, { immediate: true })

    // When schemas load: fetch tables for all schemas, expand schema+tables nodes
    watch(() => schema.schemas, async (val) => {
      if (!val?.length) return

      // Fetch tables for all schemas and expand them
      await Promise.all(val.map(async (s) => {
        if (!schema.tables[s.schema_name]) {
          await schema.fetchTables(s.schema_name)
        }
        // Expand schema node and tables group
        const schemaKey = `schema:${s.schema_name}`
        const tablesKey = `tables:${s.schema_name}`
        if (!expandedKeys.value.includes(schemaKey)) expandedKeys.value.push(schemaKey)
        if (!expandedKeys.value.includes(tablesKey)) expandedKeys.value.push(tablesKey)
      }))

      // Also fetch functions once
      if (!schema.functions.length) {
        await schema.fetchFunctions()
      }
    })

    return {
      schema,
      filter,
      selectedId,
      expandedKeys,
      treeRef,
      treeNodes,
      onLazyLoad,
      onNodeSelect,
      onNodeDblClick
    }
  }
})
</script>
