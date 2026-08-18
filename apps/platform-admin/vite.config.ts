import { readFileSync } from 'node:fs'
import { sanviCspMetaPlugin } from '@sanvi/csp/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, loadEnv } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      // svelte() returns an array of sub-plugins — spread it rather than
      // nesting, or svelte-check's vite-config inspector can't find it
      // ("No Svelte configuration found in vite config").
      ...svelte(),
      sanviCspMetaPlugin('platform-admin', {
        apiOrigin: env['VITE_API_ORIGIN'] || 'http://localhost:8080',
        mediaOrigin: env['VITE_MEDIA_ORIGIN'],
        kratosOrigin: env['VITE_KRATOS_ORIGIN'] || 'http://localhost:4433',
      }),
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
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['svelte'],
          },
        },
      },
    },
  }
})
