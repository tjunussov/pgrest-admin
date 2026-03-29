<template lang="pug">
q-dialog(:model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)")
  q-card(style="min-width: 500px" class="bg-dark")
    q-card-section.row.items-center
      q-icon(:name="mode === 'create' ? 'add' : 'edit'" size="sm" class="q-mr-sm" color="primary")
      .text-h6 {{ mode === 'create' ? 'Insert Row' : 'Edit Row' }}
      q-space
      q-btn(flat round dense icon="close" @click="$emit('update:modelValue', false)")

    q-separator

    q-card-section
      q-form(@submit.prevent="onSave" class="q-gutter-sm")
        template(v-for="col in editableColumns" :key="col.column_name")
          q-input(
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

export default defineComponent({
  name: 'CrudDialog',
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

    watch(() => props.modelValue, (val) => {
      if (val) {
        if (props.mode === 'edit' && props.row) {
          formData.value = { ...props.row }
          delete formData.value.__rowIndex
        } else {
          formData.value = {}
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
            payload[c.column_name] = val
          }
        })

        if (props.mode === 'create') {
          await api.post(`${conn.baseUrl}/${name}`, payload, {
            headers: {
              ...conn.apiHeaders,
              Prefer: 'return=representation'
            }
          })
          Notify.create({ type: 'positive', message: 'Row inserted' })
        } else {
          const pks = schema.getPrimaryKeys(props.resource.schema, name)
          const params = {}
          pks.forEach(pk => {
            params[pk] = `eq.${props.row[pk]}`
          })

          await api.patch(`${conn.baseUrl}/${name}`, payload, {
            params,
            headers: {
              ...conn.apiHeaders,
              Prefer: 'return=representation'
            }
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

    return {
      formData,
      saving,
      editableColumns,
      onSave
    }
  }
})
</script>
