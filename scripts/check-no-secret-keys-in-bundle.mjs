#!/usr/bin/env node
/**
 * The phase-09 CI gate (docs/phase-09-tenant-payments/09.0-contract-and-foundations.md):
 * no Stripe secret/restricted key pattern may ever appear in a built frontend
 * bundle. The Connect RAK (`rk_`) and any platform secret key (`sk_`) are
 * server-only; if one shows up in `dist/`, a `VITE_`-prefixed env var (or
 * similar) leaked it into client code, and that's a build that must not ship.
 *
 *   node scripts/check-no-secret-keys-in-bundle.mjs             # scan every app's build output
 *   node scripts/check-no-secret-keys-in-bundle.mjs --self-test # prove it catches a violation
 *
 * Stripe's *publishable* key (`pk_`) is meant to ship to the browser and is
 * deliberately not matched.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BUILD_DIR_NAMES = ['dist', 'build', '.svelte-kit/output']
const PATTERN = /\b(sk|rk)_(live|test)_[A-Za-z0-9]{10,}/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      walk(path, out)
    } else if (stats.isFile()) {
      out.push(path)
    }
  }
  return out
}

function findBuildDirs() {
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) return []
  const dirs = []
  for (const app of readdirSync(appsDir)) {
    for (const buildDirName of BUILD_DIR_NAMES) {
      const candidate = join(appsDir, app, buildDirName)
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        dirs.push(candidate)
      }
    }
  }
  return dirs
}

function scan(dirs) {
  const violations = []
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const content = readFileSync(file, 'latin1')
      const match = content.match(PATTERN)
      if (match) {
        violations.push({ file, match: match[0] })
      }
    }
  }
  return violations
}

function report(violations) {
  for (const { file, match } of violations) {
    console.error(`SECRET-KEY-IN-BUNDLE VIOLATION: ${file}`)
    console.error(`  matched: ${match.slice(0, 7)}…`)
  }
}

function selfTest() {
  const fixtureDir = join(ROOT, 'apps', '__bundle_scan_fixture__', 'dist')
  mkdirSync(fixtureDir, { recursive: true })
  try {
    const fixtureFile = join(fixtureDir, 'index.js')

    writeFileSync(fixtureFile, 'const stripeKey = "sk_live_abcdefghijklmnop";\n')
    if (scan([join(ROOT, 'apps', '__bundle_scan_fixture__', 'dist')]).length === 0) {
      console.error('SELF-TEST FAILED: sk_live_ literal was not detected')
      process.exit(1)
    }
    console.log('self-test OK: sk_live_ literal detected')

    writeFileSync(fixtureFile, 'const connectKey = "rk_test_abcdefghijklmnop";\n')
    if (scan([join(ROOT, 'apps', '__bundle_scan_fixture__', 'dist')]).length === 0) {
      console.error('SELF-TEST FAILED: rk_test_ literal was not detected')
      process.exit(1)
    }
    console.log('self-test OK: rk_test_ literal detected')

    writeFileSync(fixtureFile, 'const publishableKey = "pk_live_abcdefghijklmnop";\n')
    if (scan([join(ROOT, 'apps', '__bundle_scan_fixture__', 'dist')]).length > 0) {
      console.error('SELF-TEST FAILED: the publishable key (pk_) must never be flagged')
      process.exit(1)
    }
    console.log('self-test OK: publishable key (pk_) ignored')
  } finally {
    rmSync(join(ROOT, 'apps', '__bundle_scan_fixture__'), { recursive: true, force: true })
  }
}

if (process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

const dirs = findBuildDirs()
if (dirs.length === 0) {
  console.error(
    'no build output found under apps/*/{dist,build,.svelte-kit/output} — run the build first',
  )
  process.exit(1)
}

const violations = scan(dirs)
if (violations.length > 0) {
  report(violations)
  console.error('')
  console.error('A Stripe secret/restricted key pattern was found in a built bundle.')
  console.error('See docs/phase-09-tenant-payments/09.0-contract-and-foundations.md.')
  process.exit(1)
}
console.log(
  `no-secret-keys-in-bundle: OK (scanned ${dirs.length} build output director${dirs.length === 1 ? 'y' : 'ies'})`,
)
