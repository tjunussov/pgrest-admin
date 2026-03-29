<template lang="pug">
q-dialog(:model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)")
  q-card(style="min-width: 550px; max-width: 90vw" class="bg-dark")
    q-card-section.row.items-center
      q-icon(:name="mode === 'create' ? 'add' : 'edit'" size="sm" class="q-mr-sm" color="primary")
      .text-h6 {{ mode === 'create' ? 'Insert Row' : 'Edit Row' }}
      q-space
      q-btn(flat round dense icon="close" @click="$emit('update:modelValue', false)")

    q-separator

    q-card-section(style="max-height: 70vh; overflow-y: auto")
      q-form(@submit.prevent="onSave" class="q-gutter-sm")
        template(v-for="col in editableColumns" :key="col.column_name")
          //- JSON/JSONB fields — code editor
          template(v-if="isJsonColumn(col)")
            q-code(
              v-model="formData[col.column_name]"
              :label="`${col.column_name} (${col.data_type})${col.is_pk ? ' PK' : ''}`"
              :disabled="mode === 'edit' && col.is_pk"
              min-height="120px"
            )
          //- Regular fields
          q-input(
            v-else
            v-model="formData[col.column_name]"
            :label="`${col.column_name} (${col.data_type})${col.is_pk ? ' PK' : ''}`"
            dense outlined
            :disable="mode === 'edit' && col.is_pk"
            :hint="col.column_default ? `Default: ${col.column_default}` : ''"
          )

    q-card-actions(align="right")
      q-btn(flat label="Cancel" @click="$emit('update:modelValue', false)")
      q-btn(
        :label="mode === 'create' ? 'Insert' : 'Save'"
        color="primary"
        :loading="saving"
        @click="onSave"
        no-caps
      )
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue'
import { useConnectionStore } from 'src/stores/connection'
import { useSchemaStore } from 'src/stores/schema'
import { api } from 'src/boot/axios'
import { Notify } from 'quasar'
import QCode from './ui/QCode.vue'

const JSON_TYPES = ['json', 'jsonb', 'ARRAY', 'USER-DEFINED']

export default defineComponent({
  name: 'CrudDialog',
  components: { QCode },
  props: {
    modelValue: Boolean,
    mode: { type: String, default: 'create' },
    columns: { type: Array, default: () => [] },
    row: { type: Object, default: null },
    resource: { type: Object, default: null }
  },
  emits: ['update:modelValue', 'saved'],

  setup (props, { emit }) {
    const conn = useConnectionStore()
    const schema = useSchemaStore()
    const formData = ref({})
    const saving = ref(false)

    const editableColumns = computed(() => {
      return props.columns.filter(c => {
        if (props.mode === 'create' && c.column_default?.startsWith('nextval')) return false
        return true
      })
    })

    function isJsonColumn (col) {
      return JSON_TYPES.includes(col.data_type)
    }

    function stringify (val) {
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val, null, 2)
      return String(val)
    }

    function parseJsonField (val, col) {
      if (!isJsonColumn(col)) return val
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return val }
      }
      return val
    }

    watch(() => props.modelValue, (val) => {
      if (val) {
        formData.value = {}
        if (props.mode === 'edit' && props.row) {
          editableColumns.value.forEach(c => {
            const v = props.row[c.column_name]
            formData.value[c.column_name] = isJsonColumn(c) ? stringify(v) : v
          })
        } else {
          editableColumns.value.forEach(c => {
            formData.value[c.column_name] = null
          })
        }
      }
    })

    async function onSave () {
      if (!props.resource) return
      saving.value = true

      try {
        const { name } = props.resource
        const payload = {}
        editableColumns.value.forEach(c => {
          const val = formData.value[c.column_name]
          if (val !== null && val !== '' && val !== undefined) {
            payload[c.column_name] = parseJsonField(val, c)
          }
        })

        if (props.mode === 'create') {
          await api.post(`${conn.baseUrl}/${name}`, payload, {
            headers: { ...conn.apiHeaders, Prefer: 'return=representation' }
          })
          Notify.create({ type: 'positive', message: 'Row inserted' })
        } else {
          const pks = schema.getPrimaryKeys(props.resource.schema, name)
          const params = {}
          pks.forEach(pk => { params[pk] = `eq.${props.row[pk]}` })
          await api.patch(`${conn.baseUrl}/${name}`, payload, {
            params,
            headers: { ...conn.apiHeaders, Prefer: 'return=representation' }
          })
          Notify.create({ type: 'positive', message: 'Row updated' })
        }

        emit('saved')
        emit('update:modelValue', false)
      } catch (err) {
        Notify.create({ type: 'negative', message: `Save failed: ${err.response?.data?.message || err.message}` })
      } finally {
        saving.value = false
      }
    }

    return { formData, saving, editableColumns, isJsonColumn, onSave }
  }
})
</script>
