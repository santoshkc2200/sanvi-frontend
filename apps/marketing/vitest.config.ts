import { fileURLToPath } from 'node:url'
import vitestJsdomConfig from '@sanvi/test-config/jsdom'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(vitestJsdomConfig, {
  plugins: [svelte({ hot: false })],
  test: {
    // TASK-032: registers this app's catalog shards (appended to the
    // preset's setup by mergeConfig's array concatenation).
    setupFiles: ['./__tests__/setup-i18n.ts'],
  },
  resolve: {
    conditions: ['browser'],
    alias: {
      '$env/dynamic/public': fileURLToPath(
        new URL('./__tests__/mocks/env-dynamic-public.ts', import.meta.url),
      ),
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
})
