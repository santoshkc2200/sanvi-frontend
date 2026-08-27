import vitestJsdomConfig from '@sanvi/test-config/jsdom'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(vitestJsdomConfig, {
  plugins: [svelte({ hot: false })],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    // Marketing has no unit tests yet (its shell is covered by build +
    // Playwright e2e) — without this, `vitest run` exits 1 on "no test
    // files" and breaks `turbo test` for the whole workspace.
    passWithNoTests: true,
  },
})
