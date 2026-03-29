<template lang="pug">
.q-code
  .q-code__label.text-caption.text-grey-5(v-if="label")
    | {{ label }}
    q-btn.q-ml-xs(flat dense round icon="edit" size="xs" @click="showEditor = true" v-if="!disabled")
      q-tooltip Edit in editor

  //- Inline display: monospace readonly text
  pre.q-code__readonly(@click="showEditor = true" :class="{ 'cursor-pointer': !disabled }") {{ displayValue || '(empty)' }}

  //- Ace editor dialog
  q-dialog(v-model="showEditor" maximized)
    q-card.bg-dark.column.full-height
      q-card-section.q-py-xs.row.items-center
        q-icon(name="code" size="xs" class="q-mr-xs")
        span.text-caption.text-bold {{ label || 'JSON Editor' }}
        q-space
        q-btn(flat dense no-caps label="Format" icon="auto_fix_high" size="sm" @click="formatJson")
        q-btn(flat dense round icon="done" color="positive" size="sm" @click="applyAndClose" class="q-ml-sm")
          q-tooltip Apply
        q-btn(flat dense round icon="close" size="sm" @click="showEditor = false" class="q-ml-xs")
      q-separator
      .col
        v-ace-editor(
          v-model:value="editorValue"
          lang="json"
          theme="one_dark"
          :options="aceOptions"
          style="width: 100%; height: 100%"
        )
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue'
import { VAceEditor } from 'vue3-ace-editor'
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-one_dark'

export default defineComponent({
  name: 'QCode',
  components: { VAceEditor },
  props: {
    modelValue: { type: [String, Object, Array, null], default: null },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    minHeight: { type: String, default: '60px' }
  },
  emits: ['update:modelValue'],

  setup (props, { emit }) {
    const showEditor = ref(false)
    const editorValue = ref('')

    const displayValue = computed(() => {
      const val = props.modelValue
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val, null, 2)
      if (typeof val === 'string') {
        try { return JSON.stringify(JSON.parse(val), null, 2) } catch { return val }
      }
      return String(val)
    })

    const aceOptions = {
      showPrintMargin: false,
      fontSize: 13,
      tabSize: 2,
      useWorker: false,
      showGutter: true,
      highlightActiveLine: true,
      wrap: true
    }

    // Load value into editor when dialog opens
    watch(showEditor, (val) => {
      if (val) editorValue.value = displayValue.value
    })

    function formatJson () {
      try {
        const parsed = JSON.parse(editorValue.value)
        editorValue.value = JSON.stringify(parsed, null, 2)
      } catch { /* ignore parse errors */ }
    }

    function applyAndClose () {
      emit('update:modelValue', editorValue.value)
      showEditor.value = false
    }

    return { showEditor, editorValue, displayValue, aceOptions, formatJson, applyAndClose }
  }
})
</script>

<style lang="scss">
.q-code {
  &__readonly {
    font-family: 'Roboto Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    background: #1a1a2e;
    color: #d4d4d4;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 4px 6px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 80px;
    overflow: auto;

    &.cursor-pointer:hover {
      border-color: #1976d2;
    }
  }
}
</style>
