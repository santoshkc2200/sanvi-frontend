import vitestJsdomConfig from '@sanvi/test-config/jsdom'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(vitestJsdomConfig, {
  plugins: [svelte({ hot: false })],
  test: {
    // TASK-032: registers the storefront surface, which carries this
    // package's `themeblocks` shard (appended to the preset's setup by
    // mergeConfig's array concatenation).
    setupFiles: ['./__tests__/setup-i18n.ts'],
  },
})
