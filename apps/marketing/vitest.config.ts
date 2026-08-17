import vitestJsdomConfig from '@sanvi/test-config/jsdom'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(vitestJsdomConfig, {
  plugins: [svelte({ hot: false })],
  resolve: {
    conditions: ['browser'],
  },
})
