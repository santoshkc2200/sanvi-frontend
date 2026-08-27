import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig, loadEnv } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

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
    plugins: [sveltekit()],
    server: {
      port: 5173,
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  }
})
