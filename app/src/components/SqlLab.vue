<template lang="pug">
div
  .row.q-gutter-sm.items-end.q-mb-sm
    .col
      textarea.sql-editor(
        v-model="query"
        placeholder="SELECT * FROM your_table LIMIT 100;"
        @keydown.ctrl.enter="executeQuery"
        @keydown.meta.enter="executeQuery"
      )
    .col-auto
      q-btn(
        icon="play_arrow"
        label="Run"
        color="positive"
        :loading="loading"
        @click="executeQuery"
        no-caps
        dense
      )
      .text-caption.text-grey-6.q-mt-xs Ctrl+Enter

  q-banner.bg-negative.text-white.q-mb-sm(v-if="error" rounded dense)
    template(v-slot:avatar)
      q-icon(name="error")
    | {{ error }}

  .text-caption.text-grey-6.q-mb-xs(v-if="resultTime !== null")
    | {{ resultRows.length }} rows returned in {{ resultTime }}ms

  q-table(
    v-if="resultRows.length"
    :rows="resultRows"
    :columns="resultColumns"
    dense flat bordered
    row-key="__idx"
    :rows-per-page-options="[50, 100, 250, 0]"
    virtual-scroll
  )
</template>

<script>
import { defineComponent, ref } from 'vue'
import { useSchemaStore } from 'src/stores/schema'

export default defineComponent({
  name: 'SqlLab',

  setup () {
    const schema = useSchemaStore()
    const query = ref('SELECT 1 as test;')
    const loading = ref(false)
    const error = ref(null)
    const resultRows = ref([])
    const resultColumns = ref([])
    const resultTime = ref(null)

    async function executeQuery () {
      if (!query.value.trim()) return
      loading.value = true
      error.value = null
      resultRows.value = []
      resultColumns.value = []

      const start = Date.now()
      try {
        const data = await schema.execSql(query.value)
        resultTime.value = Date.now() - start

        if (data?.error) {
          error.value = `${data.error}${data.detail ? ` (${data.detail})` : ''}${data.hint ? ` — ${data.hint}` : ''}`
          return
        }

        const rows = Array.isArray(data) ? data : []
        if (rows.length === 0) {
          resultRows.value = []
          resultColumns.value = []
          return
        }

        const keys = Object.keys(rows[0])
        resultColumns.value = keys.map(k => ({
          name: k,
          label: k,
          field: k,
          align: 'left',
          sortable: true
        }))

        resultRows.value = rows.map((r, i) => ({ ...r, __idx: i }))
      } catch (err) {
        error.value = err.response?.data?.message || err.message
        resultTime.value = Date.now() - start
      } finally {
        loading.value = false
      }
    }

    return {
      query,
      loading,
      error,
      resultRows,
      resultColumns,
      resultTime,
      executeQuery
    }
  }
})
</script>
