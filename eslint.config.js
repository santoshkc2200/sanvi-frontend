import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'

/**
 * ESLint covers what Biome doesn't for Svelte: a11y checks (error level —
 * `docs/architecture-overview.md` §7 makes accessibility a build gate, not
 * a phase) and `no-restricted-globals: fetch` outside `@sanvi/api-client`
 * (the one place `fetch` is allowed — `packages/api-client/src/client.ts`
 * is the only file that calls it, everything else goes through the typed
 * client). Biome still owns general lint/format; this file does not
 * duplicate rules Biome already enforces.
 *
 * a11y comes from `svelte/valid-compile`, not a list of `svelte/a11y-*`
 * rules — this version of eslint-plugin-svelte doesn't ship those; Svelte's
 * own compiler emits a11y warnings (missing `alt`, invalid ARIA roles,
 * `<label>` with no control, ...) and `valid-compile` surfaces them as
 * ESLint problems. `ignoreWarnings: false` is what makes that include a11y
 * (a compiler *warning*, not error) rather than only hard compile errors.
 *
 * Exactly ONE block sets `languageOptions.parser` for `.svelte` files, and
 * it matches every `.svelte` file unconditionally (not scoped to `src/**`).
 * Two lessons learned wiring this up, both caught by
 * `packages/lint-gates/__tests__/eslint-gates.test.ts`:
 *   - A later block also matching `.svelte` (e.g. a `*.{ts,svelte}` glob)
 *     that sets `languageOptions.parser` again silently clobbers this one —
 *     flat config merges same-key options across matching blocks in array
 *     order — breaking template parsing entirely ("'>' expected" on every
 *     `.svelte` file).
 *   - Scoping the parser block to `src/**` misses `.svelte` files
 *     elsewhere (test fixtures, stories) — svelte.configs['flat/recommended']
 *     alone parses the tag structure but not `<script lang="ts">` content,
 *     so those fail with "the keyword 'interface' is reserved" the moment
 *     they use any TS syntax.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.turbo/**',
      '**/__fixtures__/**',
      // Pre-existing packages phase 00 rescopes (@hitox → @sanvi) but does
      // not fully retrofit to every new gate — see docs/README.md "Existing
      // packages: what changes in phase 00". `course-media` in particular
      // has its own established fetch/auth-header handling that predates
      // @sanvi/api-client and isn't a drop-in swap; billing-elements is
      // clean today but excluded for the same reason if that changes.
      'packages/course-media/**',
      'packages/billing-elements/**',
    ],
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  ...svelte.configs['flat/prettier'], // turns off stylistic rules Biome owns
  {
    // `no-undef` false-positives on every DOM/browser global (fetch, window,
    // document, ...) without a `languageOptions.globals` list — TypeScript's
    // own compiler already catches genuinely undefined identifiers more
    // accurately, so this follows typescript-eslint's own documented
    // guidance and turns it off instead of maintaining a globals list.
    //
    // `no-unused-vars` (the plain JS rule, not @typescript-eslint's) doesn't
    // understand TS-only contexts — a named parameter in a type signature
    // (`onclick?: (event: MouseEvent) => void`) or an ambient `.d.ts`
    // augmentation (`interface ImportMeta {...}`) both read as "unused" to
    // it. Biome's `noUnusedVariables`/`noUnusedImports` already cover this
    // correctly; this avoids the duplicate, wrong-context check.
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    // Universal — every `.svelte` file, anywhere (src, tests, stories).
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      'svelte/valid-compile': ['error', { ignoreWarnings: false }],
    },
  },
  {
    // Shipped source only — `fetch` in a test file's own setup isn't the
    // "an app called fetch instead of the typed client" mistake this guards.
    files: ['apps/**/src/**/*.svelte', 'packages/**/src/**/*.svelte'],
    ignores: ['packages/api-client/src/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Import from @sanvi/api-client instead — no direct fetch outside that package.',
        },
      ],
    },
  },
  {
    files: ['apps/**/src/**/*.ts', 'packages/**/src/**/*.ts'],
    ignores: ['packages/api-client/src/**'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Import from @sanvi/api-client instead — no direct fetch outside that package.',
        },
      ],
    },
  },
)
