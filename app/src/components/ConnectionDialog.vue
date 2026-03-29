<template lang="pug">
q-dialog(:model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" persistent)
  q-card(style="min-width: 420px" class="bg-dark")
    q-card-section.row.items-center
      .text-h6 Connect to PostgREST
      q-space
      q-btn(flat round dense icon="close" @click="$emit('update:modelValue', false)")

    q-separator

    q-card-section
      q-form(@submit.prevent="onLogin" class="q-gutter-sm")
        q-select(
          v-model="form.url"
          :options="urlOptions"
          label="PostgREST URL"
          dense outlined
          use-input
          input-debounce="0"
          new-value-mode="add-unique"
          @filter="onUrlFilter"
          :rules="[v => !!v || 'URL is required']"
        )
        q-input(
          v-model="form.email"
          label="Email / Username"
          dense outlined
          autocomplete="username"
          :rules="[v => !!v || 'Required']"
        )
        q-input(
          v-model="form.pass"
          label="Password"
          :type="showPass ? 'text' : 'password'"
          dense outlined
          autocomplete="current-password"
          :rules="[v => !!v || 'Required']"
        )
          template(v-slot:append)
            q-icon(:name="showPass ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPass = !showPass")

        .text-negative.text-caption(v-if="loginError") {{ loginError }}

        q-btn(
          type="submit"
          label="Connect"
          color="primary"
          :loading="conn.loginLoading"
          no-caps
          class="full-width"
        )

    q-separator

    q-expansion-item(
      label="Setup: exec_sql function"
      icon="info"
      header-class="text-caption text-grey-6"
      dense
    )
      q-card-section.q-pt-none
        .text-caption.text-grey-5.q-mb-xs Run this SQL on your database to enable metadata browsing and SQL Lab:
        .exec-sql-snippet
          | CREATE OR REPLACE FUNCTION public.exec_sql(query text)
          |   RETURNS json AS $$
          | DECLARE
          |     result json;
          | BEGIN
          |     EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t' INTO result;
          |     RETURN coalesce(result, '[]'::json);
          | EXCEPTION WHEN OTHERS THEN
          |     RETURN json_build_object(
          |         'error', SQLERRM,
          |         'detail', SQLSTATE,
          |         'hint', 'Ensure the query is a valid SELECT or returns a result set.'
          |     );
          | END;
          | $$ LANGUAGE plpgsql SECURITY DEFINER;
        q-btn(
          flat dense no-caps
          label="Copy to clipboard"
          icon="content_copy"
          size="sm"
          class="q-mt-sm"
          @click="copySqlSnippet"
        )
</template>

<script>
import { defineComponent, ref, computed } from 'vue'
import { useConnectionStore } from 'src/stores/connection'
import { useSchemaStore } from 'src/stores/schema'
import { Notify, copyToClipboard } from 'quasar'

const EXEC_SQL = `CREATE OR REPLACE FUNCTION public.exec_sql(query text)
  RETURNS json AS $$
DECLARE
    result json;
BEGIN
    EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t' INTO result;
    RETURN coalesce(result, '[]'::json);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE,
        'hint', 'Ensure the query is a valid SELECT or returns a result set.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`

export default defineComponent({
  name: 'ConnectionDialog',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],

  setup (props, { emit }) {
    const conn = useConnectionStore()
    const schema = useSchemaStore()
    const showPass = ref(false)
    const loginError = ref('')

    const defaultUrl = process.env.DEFAULT_API_URL || ''

    const form = ref({
      url: defaultUrl,
      email: '',
      pass: ''
    })

    const savedUrls = computed(() => {
      const urls = conn.connections.map(c => c.url)
      if (defaultUrl && !urls.includes(defaultUrl)) {
        urls.unshift(defaultUrl)
      }
      return [...new Set(urls)]
    })

    const urlOptions = ref(savedUrls.value)

    function onUrlFilter (val, update) {
      update(() => {
        if (!val) {
          urlOptions.value = savedUrls.value
        } else {
          const needle = val.toLowerCase()
          urlOptions.value = savedUrls.value.filter(u => u.toLowerCase().includes(needle))
        }
      })
    }

    async function onLogin () {
      loginError.value = ''
      const res = await conn.login(form.value.url, form.value.email, form.value.pass)
      if (res.success) {
        emit('update:modelValue', false)
        schema.reset()
        schema.fetchSchemas()
        Notify.create({ type: 'positive', message: 'Connected successfully' })
      } else {
        loginError.value = res.error
      }
    }

    function copySqlSnippet () {
      copyToClipboard(EXEC_SQL)
        .then(() => Notify.create({ type: 'positive', message: 'Copied to clipboard' }))
    }

    return {
      conn,
      showPass,
      loginError,
      form,
      urlOptions,
      onUrlFilter,
      onLogin,
      copySqlSnippet
    }
  }
})
</script>
