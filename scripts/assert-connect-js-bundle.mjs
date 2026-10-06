#!/usr/bin/env node
/**
 * Bundle assertion for 09.2: Connect.js appears in the admin bundle only.
 * Scans build outputs after `pnpm build`:
 * - admin/dist must contain at least one reference to Connect.js
 *   (`@stripe/connect-js` or `loadConnectAndInitialize` or `connect-js.stripe`).
 * - storefront/build/client must contain zero references.
 * Exits non-zero on violation so CI fails.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not URL.pathname: on Windows the pathname keeps a leading
// `/C:/` that existsSync cannot resolve, so the gate read every build as
// "not found" and passed vacuously-by-failing.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p)
  }
  return out
}

function containsConnect(jsFiles) {
  const markers = [
    'connect-js',
    'loadConnectAndInitialize',
    'account_onboarding',
    '@stripe/connect-js',
  ]
  let hits = 0
  for (const file of jsFiles) {
    const content = readFileSync(file, 'utf8')
    if (markers.some((m) => content.includes(m))) hits += 1
  }
  return hits
}

const adminDir = join(ROOT, 'apps/admin/dist')
const storefrontDir = join(ROOT, 'apps/storefront/build/client')
const adminFiles = walk(adminDir)
const storefrontFiles = walk(storefrontDir)

if (adminFiles.length === 0) {
  console.error('assert-connect-js-bundle: admin/dist not found — run pnpm build first')
  process.exit(1)
}

if (storefrontFiles.length === 0) {
  console.error(
    'assert-connect-js-bundle: apps/storefront/build/client not found — run pnpm build first',
  )
  process.exit(1)
}

const adminHits = containsConnect(adminFiles)
const storefrontHits = containsConnect(storefrontFiles)

console.log(`assert-connect-js-bundle: admin hits=${adminHits} files=${adminFiles.length}`)
console.log(
  `assert-connect-js-bundle: storefront hits=${storefrontHits} files=${storefrontFiles.length}`,
)

if (adminHits === 0) {
  console.error(
    'FAIL: Connect.js not found in admin/dist — expected at least one JS chunk to contain Stripe Connect',
  )
  process.exit(1)
}
if (storefrontHits !== 0) {
  console.error(
    `FAIL: Connect.js found in storefront/build/client (${storefrontHits} files) — must be admin-only`,
  )
  process.exit(1)
}
console.log('assert-connect-js-bundle: OK — Connect.js in admin only')
