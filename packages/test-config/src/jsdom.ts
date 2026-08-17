import { fileURLToPath } from 'node:url'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

/**
 * jsdom-environment Vitest config for `ui` and app components. Registers
 * `@testing-library/jest-dom` matchers and the `toHaveNoViolations` axe
 * matcher (see `setup-jsdom.ts`) so every component test can assert
 * accessibility, not just markup.
 *
 * Deliberately self-contained rather than importing `./base` and merging —
 * when Vite loads a workspace package's export via its `exports` map (not a
 * relative path within the same project), it treats that module as
 * "external" and hands it to plain Node ESM resolution, which has no
 * TypeScript-aware extension mapping and can't resolve `./base` (real file:
 * `base.ts`) at all. Duplicating the ~10-line coverage config avoids that
 * resolution boundary entirely instead of fighting it.
 */
export default defineConfig({
  plugins: [svelteTesting()],
  test: {
    environment: 'jsdom',
    globals: false,
    restoreMocks: true,
    // Every app has an `e2e/*.spec.ts` directory for Playwright — without
    // this, Vitest's default include glob (`**/*.{test,spec}.ts`) picks
    // those up too and fails them ("test() did not expect to be called
    // here", since they're Playwright's `test`, not Vitest's).
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.svelte-kit/**', '**/dist/**'],
    setupFiles: [fileURLToPath(new URL('./setup-jsdom.ts', import.meta.url))],
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
