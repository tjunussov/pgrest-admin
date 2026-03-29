const { configure } = require('quasar/wrappers')

module.exports = configure(function () {
  return {
    boot: ['axios'],

    css: ['app.scss'],

    extras: [
      'material-icons'
    ],

    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1']
      },
      vueRouterMode: 'history',
      env: {
        DEFAULT_API_URL: process.env.VITE_DEFAULT_API_URL || 'https://pos.imbir.kz/rest',
        DEFAULT_API_NAME: process.env.VITE_DEFAULT_API_NAME || 'SmartPOS'
      }
    },

    devServer: {
      host: '0.0.0.0',
      port: 9000,
      open: false,
      hmr: {
        protocol: 'wss',
        host: 'pgadmin.imbir.dev',
        clientPort: 443
      }
    },

    framework: {
      config: {
        dark: true,
        notify: {
          position: 'top-right',
          timeout: 3000
        }
      },
      plugins: ['Notify', 'Dialog', 'Loading', 'LocalStorage']
    },

    animations: [],
    ssr: { pwa: false },
    pwa: {},
    cordova: {},
    capacitor: {},
    electron: {}
  }
})
