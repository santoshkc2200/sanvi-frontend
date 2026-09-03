import { readFileSync } from 'node:fs'
import { sanviCspMetaPlugin } from '@sanvi/csp/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, loadEnv } from 'vite'

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
      sanviCspMetaPlugin('platform-admin', cspOrigins()),
    ],
    server: {
      port: 5176,
    },
    preview: {
      port: 4176,
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      // main.ts top-level-awaits session bootstrap — the default `modules`
      // target (es2020 baseline) rejects top-level await at build time.
      target: 'es2022',
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
