import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sveltekit } from '@sveltejs/kit/vite'
import { resolveReleaseStamp } from '@sanvi/telemetry/release'
import { privateSourceMapsPlugin } from '@sanvi/telemetry/release/sourcemaps'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * TASK-022 (step 3): `font-display: optional` for the CJK web font.
 *
 * `@fontsource-variable/noto-sans-jp` ships `font-display: swap` baked into
 * every `@font-face`, and swap on Japanese is a layout-shift machine: glyph
 * advances differ between the local fallback and Noto, so already-painted
 * text re-wraps when the font lands — measured as the ja CLS 0.1369/0.147
 * on the storefront, concentrated in the consent banner's re-wrap. The
 * metric-compatible fallback face (see `@sanvi/ui`'s reset.css) matches the
 * em box, so painting it permanently costs no layout; `optional` freezes
 * that choice per page load (~100 ms block, then never swaps — the font
 * downloads during the visit and applies from the next one). Mirrored in
 * `apps/marketing/vite.config.ts`; the SPAs keep `swap` (their text renders
 * post-boot, after the font has usually arrived).
 *
 * enforce: 'post' so postcss has already inlined the `@import`ed faces into
 * the ui reset CSS this rewrite targets.
 */
function cjkFontDisplayOptional(): Plugin {
  return {
    name: 'sanvi-cjk-font-display-optional',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.names?.some((n) => n.endsWith('.css'))) continue
        const source =
          typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source)
        if (!source.includes('Noto Sans JP Variable') || !source.includes('font-display')) continue
        const rewritten = source.replace(/font-display:\s*swap/g, 'font-display: optional')
        if (rewritten !== source) file.source = rewritten
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // `$env/dynamic/public` reads `process.env`, which vite's envDir does not
  // populate — pull the workspace-root `.env` in manually (real environment
  // always wins) so `pnpm dev` and any future prerendered route see the same
  // vars the CONTRIBUTING setup flow puts in the root `.env`.
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), 'PUBLIC_')
  for (const [key, value] of Object.entries(rootEnv)) {
    process.env[key] ??= value
  }

  return {
    plugins: [sveltekit(), privateSourceMapsPlugin(), cjkFontDisplayOptional()],
    server: {
      port: 5174,
    },
    // FR-1104/NFR-1104: maps are generated (hidden — no sourceMappingURL
    // comment) and staged into `sourcemaps-private/` by the plugin above,
    // never into `build/client`, which the server serves.
    build: {
      sourcemap: 'hidden',
      // TASK-022: es2022 permits the module-scope top-level await the root
      // layout uses to hold hydration until the lazy ja catalog is in
      // (Chrome 89+/Safari 15+/Firefox 89+, i.e. 2021+). SvelteKit's
      // default targets (chrome87/safari14) predate it.
      target: 'es2022',
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      // FR-1103: the build embeds the same identity `GET /api/v1/system/build`
      // reports — commit, semver, built-at, environment — so any measurement
      // or error report names the exact build that produced it.
      __APP_BUILD__: JSON.stringify(
        resolveReleaseStamp({ appDir: fileURLToPath(new URL('./', import.meta.url)) }),
      ),
    },
  }
})
