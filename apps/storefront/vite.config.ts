import { readFileSync } from 'node:fs'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5174,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
