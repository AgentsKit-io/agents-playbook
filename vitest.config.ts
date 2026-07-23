import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    exclude: ['tests/e2e/**', 'packages/playbook/test/**', 'node_modules/**', '.next/**'],
  },
})
