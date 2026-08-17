import { defineConfig } from 'vitest/config'

/**
 * Node-environment Vitest config for packages with no DOM (design-tokens'
 * Style Dictionary configs, csp, api-client's request logic, utils).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    restoreMocks: true,
    // See jsdom.ts's comment — keeps Playwright's e2e/*.spec.ts out of Vitest's run.
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.svelte-kit/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
})
