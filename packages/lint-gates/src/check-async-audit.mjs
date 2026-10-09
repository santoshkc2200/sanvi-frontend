/**
 * `check:async-audit` — the route-coverage gate for
 * `docs/ux/async-state-audit.md` (TASK-023 step 1).
 *
 * The audit is a deliverable, not scaffolding: it enumerates **every** route
 * of every app with its async surfaces, states, and timeout, and TASK-027
 * inherits the list as its route inventory. What keeps the enumeration
 * honest is this comparison against the routes **enumerated live from each
 * app's route definitions** (`@sanvi/lint-gates/routes` — the built server
 * manifest for the SvelteKit apps, the `App.svelte` route table for the
 * SPAs). A route that lands without an audit entry fails the gate; an audit
 * entry whose route no longer exists fails the same way. Sampling is
 * structurally impossible: the check compares the whole set, both
 * directions.
 */
import { readFileSync } from 'node:fs'

const ROUTE_HEADING = /^###\s+`([^`]+)`\s*$/gm
const APP_HEADING = /^##\s+(?!`)([A-Za-z0-9_-]+)\s*$/gm

/**
 * Parses the audit document into `{ app: [routeId, …] }`. An app section
 * without route headings parses to an empty list — which the comparison
 * then reports as "every route missing", the honest verdict.
 * @param {string} markdown
 * @returns {Record<string, string[]>}
 */
export function parseAuditRoutes(markdown) {
  /** @type {Record<string, string[]>} */
  const byApp = {}
  /** @type {{ index: number, app: string }[]} */
  const apps = []
  for (const match of markdown.matchAll(APP_HEADING)) {
    apps.push({ index: match.index, app: match[1] })
    byApp[match[1]] ??= []
  }
  for (const match of markdown.matchAll(ROUTE_HEADING)) {
    if (match.index === undefined) continue
    const section = apps.filter((entry) => entry.index < match.index).at(-1)
    if (section) byApp[section.app].push(match[1])
  }
  return byApp
}

/**
 * Set-compares the audit against the live route enumeration, both
 * directions.
 * @param {Record<string, string[]>} audited app → route ids in the audit doc
 * @param {Record<string, string[]>} enumerated app → route ids from the manifests
 * @returns {{ ok: boolean, missing: Record<string, string[]>, stale: Record<string, string[]> }}
 */
export function compareAuditWithRoutes(audited, enumerated) {
  /** @type {Record<string, string[]>} */
  const missing = {}
  /** @type {Record<string, string[]>} */
  const stale = {}
  for (const [app, routes] of Object.entries(enumerated)) {
    const auditedSet = new Set(audited[app] ?? [])
    const missingRoutes = routes.filter((route) => !auditedSet.has(route))
    if (missingRoutes.length > 0) missing[app] = missingRoutes
  }
  for (const [app, routes] of Object.entries(audited)) {
    const enumeratedSet = new Set(enumerated[app] ?? [])
    const staleRoutes = routes.filter((route) => !enumeratedSet.has(route))
    if (staleRoutes.length > 0) stale[app] = staleRoutes
  }
  const ok =
    Object.keys(missing).length === 0 &&
    Object.keys(stale).length === 0
  return { ok, missing, stale }
}

/** Reads the audit document, or throws with the message a human needs. */
export function readAuditDoc(path) {
  return readFileSync(path, 'utf8')
}
