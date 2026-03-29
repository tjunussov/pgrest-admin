import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.js'],
    globals: true,
    testTimeout: 15000
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
      app: resolve(__dirname, '.')
    }
  }
})
