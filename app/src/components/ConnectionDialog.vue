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
          hide-selected
          fill-input
          input-debounce="0"
          new-value-mode="add-unique"
          @input-value="onUrlInput"
          @filter="onUrlFilter"
          :rules="[v => !!v || 'URL is required']"
        )
          template(v-slot:option="scope")
            q-item(v-bind="scope.itemProps")
              q-item-section
                q-item-label {{ scope.opt }}
              q-item-section(side)
                q-btn(
                  flat dense round
                  icon="delete"
                  size="xs"
                  color="negative"
                  @click.stop="removeUrl(scope.opt)"
                )
          template(v-slot:after)
            q-btn(
              flat dense round
              icon="sync"
              :loading="fetchingSpec"
              @click="fetchLoginSpec"
            )
              q-tooltip Load login form

        //- No login function found
        .text-grey-6.text-caption(v-if="specLoaded && !loginParams.length")
          | No rpc/login function found on this server

        //- Dynamic login fields from swagger
        template(v-if="loginParams.length")
          template(v-for="param in loginParams" :key="param.name")
            q-input(
              v-model="formFields[param.name]"
              :label="param.name + (param.required ? ' *' : '')"
              :type="isSecretField(param.name) ? (showPass ? 'text' : 'password') : 'text'"
              dense outlined
              :autocomplete="fieldAutocomplete(param.name)"
              :rules="param.required ? [v => !!v || param.name + ' is required'] : []"
              :hint="param.format !== 'character varying' ? param.format : ''"
            )
              template(v-if="isSecretField(param.name)" v-slot:append)
                q-icon(:name="showPass ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPass = !showPass")

        .text-negative.text-caption(v-if="loginError") {{ loginError }}

        q-btn(
          type="submit"
          label="Connect"
          color="primary"
          :loading="conn.loginLoading"
          :disable="!loginParams.length"
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
import { defineComponent, ref, computed, watch } from 'vue'
import { api } from 'src/boot/axios'
import { useConnectionStore } from 'src/stores/connection'
import { useSchemaStore } from 'src/stores/schema'
import { Notify, copyToClipboard } from 'quasar'

const SECRET_FIELDS = ['pass', 'password', 'secret', 'token']

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
    const fetchingSpec = ref(false)
    const specLoaded = ref(false)
    const loginParams = ref([])
    const formFields = ref({})

    const defaultUrl = process.env.DEFAULT_API_URL || ''

    const form = ref({
      url: defaultUrl
    })

    const savedUrls = computed(() => {
      const urls = conn.connections.map(c => c.url)
      if (defaultUrl && !urls.includes(defaultUrl)) {
        urls.unshift(defaultUrl)
      }
      return [...new Set(urls)]
    })

    const urlOptions = ref(savedUrls.value)

    function onUrlInput (val) {
      form.value.url = val
    }

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

    function removeUrl (url) {
      const toRemove = conn.connections.filter(c => c.url === url)
      toRemove.forEach(c => conn.removeConnection(c.id))
      urlOptions.value = savedUrls.value
    }

    async function fetchLoginSpec () {
      const url = form.value.url?.replace(/\/+$/, '')
      if (!url) return

      fetchingSpec.value = true
      specLoaded.value = false
      loginParams.value = []
      formFields.value = {}

      try {
        const { data } = await api.get(`${url}/`)
        const loginPath = data?.paths?.['/rpc/login']
        const postSpec = loginPath?.post

        if (postSpec?.parameters) {
          const bodyParam = postSpec.parameters.find(p => p.in === 'body')
          if (bodyParam?.schema?.properties) {
            const props = bodyParam.schema.properties
            const required = bodyParam.schema.required || []
            loginParams.value = Object.keys(props).map(name => ({
              name,
              format: props[name].format || props[name].type || 'text',
              required: required.includes(name)
            }))
          }
        }

        // Init form fields with empty values
        loginParams.value.forEach(p => {
          formFields.value[p.name] = ''
        })

        specLoaded.value = true

        if (!loginParams.value.length) {
          Notify.create({ type: 'warning', message: 'No rpc/login function found' })
        }
      } catch (err) {
        Notify.create({ type: 'negative', message: `Failed to fetch spec: ${err.message}` })
      } finally {
        fetchingSpec.value = false
      }
    }

    function isSecretField (name) {
      return SECRET_FIELDS.includes(name.toLowerCase())
    }

    function fieldAutocomplete (name) {
      const n = name.toLowerCase()
      if (n === 'email' || n === 'username' || n === 'user') return 'username'
      if (SECRET_FIELDS.includes(n)) return 'current-password'
      return 'off'
    }

    async function onLogin () {
      loginError.value = ''
      const url = form.value.url?.replace(/\/+$/, '')
      const res = await conn.login(url, formFields.value)
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

    // Auto-fetch spec when dialog opens
    watch(() => props.modelValue, (val) => {
      if (val && form.value.url && !loginParams.value.length) {
        fetchLoginSpec()
      }
    })

    return {
      conn,
      showPass,
      loginError,
      fetchingSpec,
      specLoaded,
      loginParams,
      formFields,
      form,
      urlOptions,
      onUrlInput,
      onUrlFilter,
      removeUrl,
      fetchLoginSpec,
      isSecretField,
      fieldAutocomplete,
      onLogin,
      copySqlSnippet
    }
  }
})
</script>
