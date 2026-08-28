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
 * CSP origins are therefore resolved at *build* time (from the environment,
 * falling back to this repo's `.env` for dev). Deploy pipelines that build a
 * release must build with the same PUBLIC_* origins they serve with; the
 * runtime `$env/dynamic/public` values remain what the client code reads.
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
const apiOrigin = env['PUBLIC_API_ORIGIN'] ?? 'http://localhost:8080'
const mediaOrigin = env['PUBLIC_MEDIA_ORIGIN']
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
        kratosOrigin,
      }),
    },
  },
}

export default config
