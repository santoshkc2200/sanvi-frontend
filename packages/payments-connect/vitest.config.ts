import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, mergeConfig } from 'vitest/config'
import base from '@sanvi/test-config/jsdom'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [svelte()],
    test: {
      include: ['src/**/*.{test,spec}.{ts,js}', '__tests__/**/*.{test,spec}.{ts,js}'],
    },
  }),
)
