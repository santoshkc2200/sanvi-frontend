import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { buildContentSecurityPolicyDirectivesForApp } from '@sanvi/csp'
import { readFileSync } from 'node:fs'

/**
 * The storefront's CSP is emitted by SvelteKit itself (`kit.csp`), not by a
 * hand-set header in `hooks.server.ts`: SvelteKit hashes its own inline
 * hydration/bootstrap scripts per request (mode `'hash'`), which a static
 * header built in a hook cannot know — a static `script-src 'self'` blocks
 * those scripts, killing all client-side behaviour (and spraying console
 * errors). The policy still comes from `@sanvi/csp` — same source of truth
 * as the other three apps — just in the directive-record shape kit wants.
 *
 * The origins here are resolved at *build* time, which would pin
 * `connect-src` to whatever environment produced the build. `hooks.server.ts`
 * therefore rewrites `connect-src` — and only that directive — to the runtime
 * `$env/dynamic/public` origins on the way out, so a build promoted across
 * environments still names the API origin it actually calls. Everything else
 * in the policy, the per-request script hashes included, stays as kit built it.
 */
function loadPublicEnv() {
  const fromProcess = { ...process.env }
  if (fromProcess['PUBLIC_API_ORIGIN']) return fromProcess

  // Dev convenience: `vite dev` loads `.env` after this config module is
  // evaluated, so read the repo-root file directly when the process env is
  // quiet. Never used in a real build pipeline, which sets the env.
  try {
    const rootEnv = readFileSync(new URL('../../../.env', import.meta.url), 'utf8')
    for (const line of rootEnv.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !(match[1] in fromProcess)) {
        fromProcess[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // No .env file — the dev fallbacks below are enough for `vite dev`.
  }
  return fromProcess
}

const env = loadPublicEnv()

// Placeholders, not a promise about production: the server hook replaces
// `connect-src` with the runtime origins before the response leaves. A build
// with no origins set is therefore serveable, not broken.
const apiOrigin = env['PUBLIC_API_ORIGIN'] ?? 'http://localhost:8080'
const mediaOrigin = env['PUBLIC_MEDIA_ORIGIN']
const themeAssetOrigin = env['PUBLIC_THEME_ASSET_ORIGIN']
const kratosOrigin = env['PUBLIC_KRATOS_ORIGIN'] ?? 'http://localhost:4433'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $lib: './src/lib',
    },
    csp: {
      mode: 'hash',
      directives: buildContentSecurityPolicyDirectivesForApp('storefront', {
        apiOrigin,
        mediaOrigin,
        themeAssetOrigin,
        kratosOrigin,
      }),
    },
  },
}

export default config
