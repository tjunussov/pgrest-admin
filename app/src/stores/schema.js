import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'
import { useConnectionStore } from './connection'

export const useSchemaStore = defineStore('schema', {
  state: () => ({
    endpoints: [],
    schemas: [],
    tables: {},
    columns: {},
    indexes: {},
    triggers: {},
    constraints: {},
    views: {},
    functions: [],
    loading: false,
    activeResource: null,
    tabs: [],
    activeTabId: null,
    sqlCounter: 0
  }),

  getters: {
    conn: () => useConnectionStore()
  },

  actions: {
    reqConfig () {
      return { headers: this.conn.apiHeaders }
    },

    async execSql (query) {
      const { data } = await api.post(
        `${this.conn.baseUrl}/rpc/exec_sql`,
        { query },
        this.reqConfig()
      )
      if (data?.error) throw new Error(data.error)
      return data || []
    },

    async fetchEndpoints () {
      try {
        const { data } = await api.get(`${this.conn.baseUrl}/`, this.reqConfig())
        this.endpoints = Object.keys(data?.paths || data?.definitions || data || {})
        return this.endpoints
      } catch {
        this.endpoints = []
        return []
      }
    },

    async fetchSchemas () {
      this.loading = true
      try {
        const rows = await this.execSql(`
          SELECT schema_name
          FROM information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          ORDER BY schema_name
        `)
        this.schemas = rows || []
      } finally {
        this.loading = false
      }
    },

    async fetchTables (schema) {
      const rows = await this.execSql(`
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = '${schema}'
        ORDER BY table_type, table_name
      `)
      this.tables[schema] = rows || []
      this.views[schema] = (rows || []).filter(r => r.table_type === 'VIEW')
    },

    async fetchColumns (schema, table) {
      const key = `${schema}.${table}`
      const rows = await this.execSql(`
        SELECT
          c.column_name,
          c.data_type,
          c.column_default,
          c.is_nullable,
          c.character_maximum_length,
          CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_pk
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_schema = kcu.table_schema
          AND c.table_name = kcu.table_name
          AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
          AND tc.constraint_type = 'PRIMARY KEY'
        WHERE c.table_schema = '${schema}' AND c.table_name = '${table}'
        ORDER BY c.ordinal_position
      `)
      this.columns[key] = rows || []
    },

    async fetchIndexes (schema, table) {
      const key = `${schema}.${table}`
      const rows = await this.execSql(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = '${schema}' AND tablename = '${table}'
        ORDER BY indexname
      `)
      this.indexes[key] = rows || []
    },

    async fetchTriggers (schema, table) {
      const key = `${schema}.${table}`
      const rows = await this.execSql(`
        SELECT
          t.tgname as trigger_name,
          pg_get_triggerdef(t.oid) as trigger_def,
          CASE t.tgenabled
            WHEN 'O' THEN 'enabled'
            WHEN 'D' THEN 'disabled'
            ELSE t.tgenabled::text
          END as status
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = '${schema}' AND c.relname = '${table}'
          AND NOT t.tgisinternal
        ORDER BY t.tgname
      `)
      this.triggers[key] = rows || []
    },

    async fetchConstraints (schema, table) {
      const key = `${schema}.${table}`
      const rows = await this.execSql(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = '${schema}' AND tc.table_name = '${table}'
        ORDER BY tc.constraint_type, tc.constraint_name
      `)
      this.constraints[key] = rows || []
    },

    async fetchFunctions () {
      const rows = await this.execSql(`
        SELECT
          n.nspname as schema_name,
          p.proname as function_name,
          pg_get_function_arguments(p.oid) as arguments,
          pg_get_function_result(p.oid) as return_type
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, p.proname
      `)
      this.functions = rows || []
    },

    openResourceTab (resource) {
      const id = `${resource.type}:${resource.schema}.${resource.name}`
      const existing = this.tabs.find(t => t.id === id)
      if (existing) {
        this.activeTabId = id
      } else {
        this.tabs.push({
          id,
          type: 'data',
          schema: resource.schema,
          name: resource.name,
          resourceType: resource.type,
          label: resource.name
        })
        this.activeTabId = id
      }
      this.activeResource = resource
    },

    openSqlTab () {
      this.sqlCounter++
      const id = `sql:${this.sqlCounter}`
      this.tabs.push({ id, type: 'sql', label: `SQL ${this.sqlCounter}`, query: '' })
      this.activeTabId = id
      this.activeResource = null
    },

    activateTab (id) {
      const tab = this.tabs.find(t => t.id === id)
      if (!tab) return
      this.activeTabId = id
      if (tab.type === 'data') {
        this.activeResource = { type: tab.resourceType, schema: tab.schema, name: tab.name }
      } else {
        this.activeResource = null
      }
    },

    closeTab (id) {
      const idx = this.tabs.findIndex(t => t.id === id)
      if (idx < 0) return
      this.tabs.splice(idx, 1)
      if (this.activeTabId === id) {
        const next = this.tabs[Math.min(idx, this.tabs.length - 1)]
        if (next) {
          this.activateTab(next.id)
        } else {
          this.activeTabId = null
          this.activeResource = null
        }
      }
    },

    getActiveTab () {
      return this.tabs.find(t => t.id === this.activeTabId) || null
    },

    getPrimaryKeys (schema, table) {
      const key = `${schema}.${table}`
      return (this.columns[key] || []).filter(c => c.is_pk).map(c => c.column_name)
    },

    reset () {
      this.endpoints = []
      this.schemas = []
      this.tables = {}
      this.columns = {}
      this.indexes = {}
      this.triggers = {}
      this.constraints = {}
      this.views = {}
      this.functions = []
      this.activeResource = null
      this.tabs = []
      this.activeTabId = null
    }
  },

  persist: {
    pick: ['tabs', 'activeTabId', 'activeResource', 'sqlCounter']
  }
})
