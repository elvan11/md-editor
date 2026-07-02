import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import pkg from './package.json'

const deployedAt = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  base: '/md-editor/',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_DEPLOYED_AT__: JSON.stringify(deployedAt),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
