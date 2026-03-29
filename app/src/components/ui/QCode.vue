<template lang="pug">
.q-code
  .q-code__label.text-caption.text-grey-5(v-if="label") {{ label }}
  //- Editable: ace editor
  template(v-if="!readonly")
    v-ace-editor(
      v-model:value="localValue"
      lang="json"
      :theme="'one_dark'"
      :options="aceOptions"
      :style="{ minHeight: minHeight, width: '100%' }"
      @change="onAceChange"
    )
  //- Readonly: simple pre
  pre.q-code__readonly(v-else) {{ displayValue }}
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
    readonly: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    minHeight: { type: String, default: '100px' }
  },
  emits: ['update:modelValue'],

  setup (props, { emit }) {
    const localValue = ref('')

    const displayValue = computed(() => {
      const val = props.modelValue
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val, null, 2)
      if (typeof val === 'string') {
        try { return JSON.stringify(JSON.parse(val), null, 2) } catch { return val }
      }
      return String(val)
    })

    const aceOptions = computed(() => ({
      showPrintMargin: false,
      fontSize: 12,
      tabSize: 2,
      readOnly: props.disabled,
      useWorker: false,
      showGutter: true,
      highlightActiveLine: true,
      wrap: true
    }))

    watch(() => props.modelValue, (val) => {
      const formatted = val === null || val === undefined
        ? ''
        : typeof val === 'object'
          ? JSON.stringify(val, null, 2)
          : String(val)
      if (formatted !== localValue.value) {
        localValue.value = formatted
      }
    }, { immediate: true })

    function onAceChange (val) {
      emit('update:modelValue', val)
    }

    return { localValue, displayValue, aceOptions, onAceChange }
  }
})
</script>

<style lang="scss">
.q-code {
  &__readonly {
    font-family: 'Roboto Mono', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    background: #141422;
    color: #d4d4d4;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 8px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow: auto;
  }
}
</style>
