import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sveltekit } from '@sveltejs/kit/vite'
import { resolveReleaseStamp } from '@sanvi/telemetry/release'
import { privateSourceMapsPlugin } from '@sanvi/telemetry/release/sourcemaps'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * TASK-022 (step 3): `font-display: optional` for the CJK web font — the
 * same rewrite `apps/storefront/vite.config.ts` documents in full. Swap on
 * Japanese re-wraps painted text when the font lands (glyph advances differ
 * from the local fallback) and that was the ja CLS; the metric-compatible
 * fallback makes painting it permanently free.
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
  // always wins) so a fresh `turbo build`'s prerender and `pnpm dev` see the
  // same vars the CONTRIBUTING setup flow puts in the root `.env`.
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), 'PUBLIC_')
  for (const [key, value] of Object.entries(rootEnv)) {
    process.env[key] ??= value
  }

  return {
    plugins: [sveltekit(), privateSourceMapsPlugin(), cjkFontDisplayOptional()],
    server: {
      port: 5173,
    },
    // FR-1104/NFR-1104: maps are generated (hidden) and staged into
    // `sourcemaps-private/` — never into the served `build/client`.
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
