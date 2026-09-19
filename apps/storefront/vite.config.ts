import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sveltekit } from '@sveltejs/kit/vite'
import { resolveReleaseStamp } from '@sanvi/telemetry/release'
import { privateSourceMapsPlugin } from '@sanvi/telemetry/release/sourcemaps'
import { defineConfig, loadEnv } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

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
    plugins: [sveltekit(), privateSourceMapsPlugin()],
    server: {
      port: 5174,
    },
    // FR-1104/NFR-1104: maps are generated (hidden — no sourceMappingURL
    // comment) and staged into `sourcemaps-private/` by the plugin above,
    // never into `build/client`, which is what the server serves.
    build: {
      sourcemap: 'hidden',
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
