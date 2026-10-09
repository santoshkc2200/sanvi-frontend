import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { buildContentSecurityPolicyDirectivesForApp } from '@sanvi/csp'
import { readFileSync } from 'node:fs'

/**
 * Marketing's CSP, from the same `@sanvi/csp` builders as every other app.
 * Configuring `kit.csp` matters for one reason above the hooks-set header:
 * **prerendered pages**. `adapter-node` serves them from its static
 * middleware, which never runs `hooks.server.ts` — without `kit.csp`, the
 * pages that make up most of the site would ship with no policy at all.
 * SvelteKit bakes a `<meta http-equiv>` equivalent into prerendered HTML
 * and emits the real header for server-rendered routes.
 *
 * Like the storefront's config, the origins here resolve at *build* time;
 * `hooks.server.ts` rewrites the header with runtime origins on the way out
 * for non-prerendered responses. The one client-side API caller on a
 * prerendered page is the status page's readiness poll (TASK-025): the baked
 * meta's `connect-src` covers the runtime API origin only while the two are
 * the same value — every current config (dev, e2e, CI) sets them identically,
 * and a skew would pin the page to its honest `unknown` state rather than
 * failing loudly (the `zero violations` e2e below visits `/status` in both
 * locales, so a blocked poll fails that gate before it ships).
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

// TASK-024: no inline style allowance reaches a built policy. The dev-only
// exception: `vite dev` injects component CSS as runtime `<style>` elements;
// production extracts CSS to files.
const isDev = process.env.NODE_ENV !== 'production'
const directives = buildContentSecurityPolicyDirectivesForApp('marketing', {
  apiOrigin,
  mediaOrigin,
})
if (isDev && directives['style-src']) {
  directives['style-src'] = [...directives['style-src'], "'unsafe-inline'"] // sanvi-csp: dev-only
}

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
      directives,
    },
  },
}

export default config
