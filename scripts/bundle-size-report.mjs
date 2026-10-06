#!/usr/bin/env node
/**
 * Renders a Markdown table of each app's `check:budget` result, for the PR
 * comment/step-summary CI posts on every PR — bundle budgets are reported
 * on every PR, not just checked silently.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBudgetCheck } from '../packages/lint-gates/src/check-budget.mjs'

// fileURLToPath, not URL.pathname — see assert-connect-js-bundle.mjs.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const APPS = [
  { name: 'marketing', dir: 'build/client', initialKb: 100, chunkKb: 50 },
  { name: 'storefront', dir: 'build/client', initialKb: 100, chunkKb: 50 },
  { name: 'admin', dir: 'dist', initialKb: 250, chunkKb: 50 },
  { name: 'platform-admin', dir: 'dist', initialKb: 250, chunkKb: 50 },
]

function readVersion(app) {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'apps', app, 'package.json'), 'utf8')).version
  } catch {
    return '?'
  }
}

const rows = APPS.map((app) => {
  const result = runBudgetCheck({
    dir: join(ROOT, 'apps', app.name, app.dir),
    initialKb: app.initialKb,
    chunkKb: app.chunkKb,
  })

  if (result.skipped) {
    return `| ${app.name} | ${readVersion(app.name)} | _not built_ | — | — |`
  }

  const initial =
    result.initialKbTotal === null
      ? `${result.totalKb.toFixed(1)} KB total (not separable)`
      : `${result.initialKbTotal.toFixed(1)} / ${app.initialKb} KB`
  const status = result.ok ? '✅' : '❌'
  const oversized = result.oversizedChunks.length
  return `| ${app.name} | ${readVersion(app.name)} | ${initial} | ${oversized} chunk(s) over ${app.chunkKb} KB | ${status} |`
})

console.log('## Bundle size report\n')
console.log('| App | Version | Initial JS (gzip) | Oversized chunks | Status |')
console.log('|---|---|---|---|---|')
console.log(rows.join('\n'))
