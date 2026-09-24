#!/usr/bin/env node
/**
 * The storage-surface gate (phase 11, TASK-024, the "nothing sensitive in
 * `localStorage`" acceptance line): every browser-storage access in shipped
 * source must belong to a reviewed entry in {@link ALLOWED_STORAGE}, each
 * naming what is stored and why it is benign. A new storage access fails
 * the gate until a reviewer adds an entry for it — so the surface grows only
 * through review, and the answer to "what does this app keep client-side?"
 * is this list, not an archaeology project.
 *
 * Cookies included: `document.cookie` writes are the same surface with the
 * SameSite question attached.
 */
import { readFileSync } from 'node:fs'
import { extname, relative } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'
import { stripComments } from './check-platform-literals.mjs'

const STORAGE_PATTERN = /\blocalStorage\b|\bsessionStorage\b|document\.cookie|\.cookie\s*=\s*`/

/**
 * The reviewed storage surface, as `${relativePath}` → reason entries. Key
 * shapes and the audit trail for each live next to the access site; this
 * list is the complete inventory of what the frontend persists client-side.
 */
const ALLOWED_STORAGE = new Map([
  [
    'packages/telemetry/src/logging.ts',
    'sessionStorage flag for the audited session debug logger (a boolean, session-scoped, off by default)',
  ],
  [
    'packages/consent/src/cookie.ts',
    'consent decisions + rotating device-reference cookies, SameSite=Lax, deliberately identifier-free',
  ],
  ['packages/i18n/src/runtime.svelte.ts', 'locale preference cookie, SameSite=Lax'],
  ['packages/tenant/src/store.svelte.ts', 'active tenant id cookie, SameSite=Lax (not auth)'],
  [
    'packages/ui/src/DataTable.svelte',
    'table column visibility preferences under a caller-provided storage key',
  ],
  [
    'packages/ui/src/list-query-state.svelte.ts',
    'user-authored saved list views/filters under a caller-provided storage key',
  ],
  [
    'apps/storefront/src/lib/checkout/idempotency.ts',
    'pending checkout id + idempotency key/payload signature (no PII, no token) for the return-from-Stripe journey',
  ],
  [
    'apps/storefront/src/lib/checkout/conversion.ts',
    'per-order beacon-dedupe flags (order id → "1") in sessionStorage',
  ],
  [
    'apps/storefront/src/lib/tracking/click-ids.ts',
    'ad landing click ids (gclid/fbclid stashes) in sessionStorage, per the ads click attribution design',
  ],
  [
    'apps/storefront/src/routes/checkout/return/+page.ts',
    'reads the pending checkout id written by idempotency.ts above',
  ],
  [
    'apps/admin/src/routes/advertising/CampaignBuilder.svelte',
    'campaign-builder draft autosave (user-authored form content, that tab only)',
  ],
  [
    'apps/admin/src/lib/payments/providerRegistry.ts',
    'Stripe connection id (an identifier, not a secret) — KNOWN GAP: only recoverable from localStorage today, documented in the phase-09 task',
  ],
])

const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.svelte'])

function isTestPath(relativePath) {
  const normalized = relativePath.split('\\').join('/')
  return (
    /(^|\/)(__tests__|tests|e2e)(\/|$)/.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized) ||
    /\.stories\.svelte$/.test(normalized)
  )
}

export function scanWorkspace(root) {
  const violations = []
  for (const file of walkFiles(root, (name) => extensions.has(extname(name)))) {
    const relativePath = relative(root, file).split('\\').join('/')
    if (isTestPath(relativePath)) continue
    // The gate's own source names the patterns it scans for.
    if (relativePath.endsWith('check-storage-surface.mjs')) continue
    // Generated artifacts under dot-directories ship nothing.
    if (relativePath.split('/').some((segment) => segment.startsWith('.'))) continue

    const source = readFileSync(file, 'utf8')
    const stripped = stripComments(source, extname(file) === '.svelte')
    const lines = stripped.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (!STORAGE_PATTERN.test(lines[i])) continue
      if (ALLOWED_STORAGE.has(relativePath)) continue
      violations.push({ file: relativePath, line: i + 1 })
    }
  }
  return violations
}

async function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('Usage: sanvi-check-storage-surface <workspace-root>')
    process.exit(2)
  }

  const violations = scanWorkspace(root)

  if (violations.length === 0) {
    console.log(
      `✓ check:storage-surface — every storage access is on the reviewed list (${ALLOWED_STORAGE.size} files)`,
    )
    return
  }

  console.error(`✗ check:storage-surface — ${violations.length} unreviewed access(es):\n`)
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}\n` +
        `    every browser-storage access needs a reviewed entry in check-storage-surface.mjs's ALLOWED_STORAGE naming what is stored and why it is benign`,
    )
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
