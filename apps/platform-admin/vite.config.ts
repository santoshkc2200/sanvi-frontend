import { readFileSync } from 'node:fs'
import { sanviCspMetaPlugin } from '@sanvi/csp/vite'
import { securityHeadersRecord } from '@sanvi/csp/security-headers'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolveReleaseStamp } from '@sanvi/telemetry/release'
import { privateSourceMapsPlugin } from '@sanvi/telemetry/release/sourcemaps'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Dev keeps localhost defaults; a production build without the origins
  // fails loudly here rather than baking `connect-src http://localhost:…`
  // into the CSP meta tag — a policy that would block the real API.
  function cspOrigins() {
    const missing = (name: string) => {
      throw new Error(
        `${name} must be set for a production build — copy apps/platform-admin/.env.example`,
      )
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
      // `devInlineStyles`: `vite dev` injects component CSS as runtime <style>
      // elements; production builds extract CSS to files, so the shipped
      // meta policy stays strict (the e2e suites exercise it).
      sanviCspMetaPlugin('platform-admin', cspOrigins(), {
        devInlineStyles: mode !== 'production',
      }),
      // FR-1104/NFR-1104: stage `.map` files into `sourcemaps-private/`
      // instead of `dist/` — maps are generated but never served.
      privateSourceMapsPlugin(),
    ],
    server: {
      port: 5176,
      // The backend-specified security headers (NFR-1114) on every dev/preview
      // response — a static SPA's only local header surface. HSTS stays off:
      // these servers are localhost by definition and HSTS pins the hostname,
      // not the port. Production sets the same record (plus HSTS) at the
      // static host/CDN, from this same builder.
      headers: securityHeadersRecord(),
    },
    preview: {
      port: 4176,
      headers: securityHeadersRecord(),
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
      // FR-1104/NFR-1104: maps are generated (hidden — no sourceMappingURL
      // comment) and staged into `sourcemaps-private/` by the plugin above,
      // so stack traces stay symbolicable without the maps ever being served.
      sourcemap: 'hidden',
      // Emits dist/.vite/manifest.json: source file → chunk file. The
      // per-route budget gate maps routes to chunks through it — component
      // basenames alone are ambiguous across route subdirectories.
      manifest: true,
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
