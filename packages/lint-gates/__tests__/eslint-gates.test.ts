import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

/**
 * Exercises the same two rules `eslint.config.js` enables at the workspace
 * root (`no-restricted-globals: fetch`, `svelte/valid-compile` for a11y)
 * against standalone fixtures, via the ESLint Node API with an inline
 * config — decoupled from the root config's `apps/**`/`packages/**`-
 * relative file globs, which don't match an isolated fixture directory's
 * own paths.
 */
const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

function makeEslint() {
  return new ESLint({
    overrideConfigFile: true,
    // `tseslint.config(...)`'s return type (typescript-eslint's ConfigArray)
    // and the plain `eslint` package's `ESLint.Options['baseConfig']` type
    // disagree on `languageOptions`'s shape — a known type-only friction
    // between the two packages' flat-config typings; `eslint.config.js`
    // hands this same array straight to the ESLint CLI (no type-checking)
    // without issue. Runtime-only cast, not a behavior change.
    //
    // Each file type's `languageOptions.parser` and its rules live in the
    // *same* block, deliberately — see `eslint.config.js`'s docstring for
    // the clobbering bug that happens when they're split across blocks
    // matching an overlapping glob.
    baseConfig: tseslint.config(
      ...svelte.configs['flat/recommended'],
      {
        files: ['**/*.svelte'],
        languageOptions: {
          parser: svelteParser,
          parserOptions: { parser: tseslint.parser },
        },
        // This version of eslint-plugin-svelte has no `svelte/a11y-*` rules —
        // Svelte's own compiler emits a11y warnings, and `valid-compile`
        // (with `ignoreWarnings: false`) is what surfaces them through ESLint.
        rules: {
          'svelte/valid-compile': ['error', { ignoreWarnings: false }],
        },
      },
      {
        files: ['**/*.ts'],
        // Needed so ESLint parses TS syntax (type annotations) at all —
        // without this, espree fails to parse and every rule silently sees
        // zero matches instead of erroring on the syntax.
        languageOptions: { parser: tseslint.parser },
        rules: {
          'no-restricted-globals': ['error', { name: 'fetch', message: 'Use @sanvi/api-client.' }],
        },
      },
    ) as ESLint.Options['baseConfig'],
  })
}

describe('eslint gates (no-restricted-globals fetch, a11y)', () => {
  it('fails on a direct fetch() call outside api-client', async () => {
    const eslint = makeEslint()
    const results = await eslint.lintFiles([`${FIXTURES}eslint-fetch-violation/BadFetch.ts`])
    const messages = results.flatMap((r) => r.messages)
    expect(messages.some((m) => m.ruleId === 'no-restricted-globals')).toBe(true)
  })

  it('passes when the call goes through @sanvi/api-client', async () => {
    const eslint = makeEslint()
    const results = await eslint.lintFiles([`${FIXTURES}eslint-fetch-clean/GoodFetch.ts`])
    const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0)
    expect(errorCount).toBe(0)
  })

  it('fails on an <img> with no alt attribute', async () => {
    const eslint = makeEslint()
    const results = await eslint.lintFiles([`${FIXTURES}eslint-a11y-violation/BadImage.svelte`])
    const messages = results.flatMap((r) => r.messages)
    expect(messages.some((m) => m.ruleId === 'svelte/valid-compile')).toBe(true)
  })

  it('passes when the <img> has an alt attribute', async () => {
    const eslint = makeEslint()
    const results = await eslint.lintFiles([`${FIXTURES}eslint-a11y-clean/GoodImage.svelte`])
    const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0)
    expect(errorCount).toBe(0)
  })
})
