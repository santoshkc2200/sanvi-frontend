import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sanviCspMetaPlugin } from '@sanvi/csp/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolveReleaseStamp } from '@sanvi/telemetry/release'
import { defineConfig, loadEnv } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Dev keeps localhost defaults; a production build without the origins
  // fails loudly here rather than baking `connect-src http://localhost:…`
  // into the CSP meta tag — a policy that would block the real API.
  function cspOrigins() {
    const missing = (name: string) => {
      throw new Error(`${name} must be set for a production build — copy apps/admin/.env.example`)
    }
    return {
      apiOrigin:
        env['VITE_API_ORIGIN'] ??
        (mode === 'production' ? missing('VITE_API_ORIGIN') : 'http://localhost:8080'),
      mediaOrigin: env['VITE_MEDIA_ORIGIN'],
      kratosOrigin:
        env['VITE_KRATOS_ORIGIN'] ??
        (mode === 'production' ? missing('VITE_KRATOS_ORIGIN') : 'http://localhost:4433'),
    }
  }

  return {
    plugins: [
      // svelte() returns an array of sub-plugins — spread it rather than
      // nesting, or svelte-check's vite-config inspector can't find it
      // ("No Svelte configuration found in vite config").
      ...svelte(),
      sanviCspMetaPlugin('admin', cspOrigins()),
    ],
    server: {
      port: 5175,
    },
    preview: {
      port: 4175,
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
    build: {
      // main.ts top-level-awaits session bootstrap — the default `modules`
      // target (es2020 baseline) rejects top-level await at build time.
      target: 'es2022',
      // Emits dist/.vite/manifest.json: source file → chunk file. The
      // per-route budget gate maps routes to chunks through it — component
      // basenames alone are ambiguous (routes/Dashboard.svelte and
      // routes/advertising/Dashboard.svelte both emit `Dashboard-*.js`).
      manifest: true,
      // Route components are already split by dynamic import(); this keeps
      // vendor code (Svelte runtime, @sanvi/ui) in its own cacheable chunk
      // instead of duplicated into every route chunk.
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['svelte'],
            i18n: ['@sanvi/i18n'],
          },
        },
      },
    },
  }
})
