<template lang="pug">
.q-code(:class="{ 'q-code--readonly': readonly }")
  .q-code__label.text-caption.text-grey-5(v-if="label") {{ label }}
  textarea.q-code__editor(
    ref="editor"
    :value="displayValue"
    @input="onInput"
    :readonly="readonly"
    :disabled="disabled"
    :placeholder="placeholder"
    spellcheck="false"
    @keydown.tab.prevent="onTab"
  )
</template>

<script>
import { defineComponent, ref, computed } from 'vue'

export default defineComponent({
  name: 'QCode',
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
    const editor = ref(null)

    const displayValue = computed(() => {
      const val = props.modelValue
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val, null, 2)
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          return JSON.stringify(parsed, null, 2)
        } catch {
          return val
        }
      }
      return String(val)
    })

    function onInput (e) {
      emit('update:modelValue', e.target.value)
    }

    function onTab (e) {
      if (props.readonly) return
      const el = e.target
      const start = el.selectionStart
      const end = el.selectionEnd
      el.value = el.value.substring(0, start) + '  ' + el.value.substring(end)
      el.selectionStart = el.selectionEnd = start + 2
      emit('update:modelValue', el.value)
    }

    return { editor, displayValue, onInput, onTab }
  }
})
</script>

<style lang="scss">
.q-code {
  &__editor {
    font-family: 'Roboto Mono', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    background: #1a1a2e;
    color: #d4d4d4;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 8px;
    width: 100%;
    min-height: v-bind(minHeight);
    resize: vertical;
    tab-size: 2;
    white-space: pre;
    overflow: auto;

    &:focus {
      outline: none;
      border-color: #1976d2;
    }
  }

  &--readonly .q-code__editor {
    background: #141422;
    cursor: default;
    resize: none;
  }
}
</style>
