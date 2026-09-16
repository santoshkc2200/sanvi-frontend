/**
 * Route enumeration shared by the phase-11 harnesses: the per-route budget
 * table (`check-budget --report-only`) and the axe sweep's route-coverage
 * assertion (`scripts/check-a11y.mjs`).
 *
 * Coverage is the property that makes the a11y gate survive phases 09 and 10:
 * routes are *enumerated* from each app's route definitions, so a new route
 * with no axe entry shows up as uncovered rather than passing silently. The
 * SvelteKit apps enumerate from the built server manifest — the same list the
 * running server actually serves, param segments included — and the SPAs from
 * the `routes` map in `src/App.svelte`, the single place CONTRIBUTING.md says
 * a SPA route is declared.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MANIFEST_RELPATH = join('.svelte-kit', 'output', 'server', 'manifest-full.js')

/**
 * A route as the harnesses see it.
 * @typedef {object} RouteEntry
 * @property {string} id route pattern — `/privacy/requests/[id]/appeal`
 * @property {number|null} leaf SvelteKit leaf-node index (per-route chunk); null when unknown
 * @property {string|null} component SPA route component name, e.g. `Dashboard`
 */

/**
 * SvelteKit routes from the built server manifest. `page: null` entries are
 * endpoint-only (no UI to sweep, nothing to budget per-route) and are
 * excluded. Returns null when the app hasn't been built — callers decide
 * whether that is a skip or a failure.
 * @param {string} appRoot absolute path to the app directory
 * @returns {RouteEntry[]|null}
 */
export function listSvelteKitRoutes(appRoot) {
  let source
  try {
    source = readFileSync(join(appRoot, MANIFEST_RELPATH), 'utf8')
  } catch {
    return null
  }

  /** @type {RouteEntry[]} */
  const routes = []
  // Entries are `id: "…"` objects; split on the id boundaries and inspect each
  // record — a per-record parse can't bleed one route's leaf into the next the
  // way a whole-file lazy regex would across `page: null` endpoint routes.
  const records = source.split(/\bid:\s*/).slice(1)
  for (const record of records) {
    const id = /^["']([^"']+)["']/.exec(record)?.[1]
    if (!id) continue
    const pageBlock = /page:\s*\{[^}]*\}/.exec(record)?.[0]
    if (!pageBlock) continue
    const leaf = Number(/\bleaf:\s*(\d+)/.exec(pageBlock)?.[1])
    routes.push({ id, leaf: Number.isNaN(leaf) ? null : leaf })
  }
  return routes
}

const SPA_PATH_RE = /\bpath:\s*'([^']*)'/g
const SPA_COMPONENT_RE = /import\('\.\/routes\/([A-Za-z0-9_]+)\.svelte'\)/

/**
 * SPA routes from the `routes` map in `src/App.svelte`. Each `path:` record
 * runs to the next `path:` (or end of file) and must carry its own lazy
 * `import()`; records without one are skipped rather than allowed to steal
 * the next entry's component.
 * @param {string} appRoot absolute path to the app directory
 * @returns {RouteEntry[]|null}
 */
export function listSpaRoutes(appRoot) {
  let source
  try {
    source = readFileSync(join(appRoot, 'src', 'App.svelte'), 'utf8')
  } catch {
    return null
  }

  const marks = [...source.matchAll(SPA_PATH_RE)]
  /** @type {RouteEntry[]} */
  const routes = []
  for (const [index, mark] of marks.entries()) {
    const recordEnd = index + 1 < marks.length ? marks[index + 1].index : source.length
    const record = source.slice(mark.index, recordEnd)
    const component = SPA_COMPONENT_RE.exec(record)?.[1]
    if (!component) continue
    const path = mark[1]
    routes.push({ id: path === '' ? '/' : `/${path}`, leaf: null, component })
  }
  return routes
}

/**
 * Unified enumeration by app type (`sveltekit` | `spa`), as declared in
 * `scripts/budgets.json`.
 * @param {string} appRoot absolute path to the app directory
 * @param {'sveltekit'|'spa'} type
 * @returns {RouteEntry[]|null}
 */
export function listRoutes(appRoot, type) {
  return type === 'sveltekit' ? listSvelteKitRoutes(appRoot) : listSpaRoutes(appRoot)
}

/**
 * A concrete URL path to sweep for a route pattern — `[param]` segments
 * (SvelteKit) and `:param` segments (SPA router) get a fixed probe value. The
 * page behind it usually renders not-found or an error state without a
 * matching record; for coverage purposes what matters is that the route was
 * *attempted* and axe ran on whatever it rendered.
 * @param {string} id route pattern
 */
export function sweepPath(id) {
  return id.replace(/\[[^\]]+\]/g, 'probe').replace(/:([A-Za-z0-9_]+)/g, 'probe')
}
