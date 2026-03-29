import { boot } from 'quasar/wrappers'
import axios from 'axios'
import { Notify } from 'quasar'

const api = axios.create()

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const data = error.response?.data

    if (status === 401) {
      Notify.create({ type: 'negative', message: 'Unauthorized — check your token or re-login' })
    } else if (status === 403) {
      Notify.create({ type: 'negative', message: 'Forbidden — insufficient permissions' })
    } else if (status === 404) {
      Notify.create({ type: 'warning', message: `Not found: ${data?.message || error.config?.url}` })
    } else if (data?.message || data?.details) {
      Notify.create({ type: 'negative', message: data.message || data.details })
    }

    return Promise.reject(error)
  }
)

export default boot(({ app }) => {
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
})

export { api }
