#!/usr/bin/env node
/**
 * CI gate, started in phase 09 (docs/phase-09-tenant-payments/09.0-contract-
 * and-foundations.md) and extended in phase 10
 * (docs/phase-10-advertising/implementation-plan.md § TASK-009): no server-
 * only credential pattern may ever appear in a built frontend bundle.
 *
 * Phase 09 — Stripe: the Connect RAK (`rk_`) and any platform secret key
 * (`sk_`) are server-only; if one shows up in `dist/`, a `VITE_`-prefixed
 * env var (or similar) leaked it into client code, and that's a build that
 * must not ship.
 *
 * Phase 10 — ad platforms (TASK-009, from the start of the phase, not the
 * end): a Google OAuth client secret has the `GOCSPX-` prefix, and a Google
 * Ads developer token leaks as a `developerToken`-shaped key/value pair in
 * minified code. Meta user/system access tokens (`EAAB…`-style `EAA…`) are
 * also matched; Meta's *app secret* is deliberately not pattern-matched —
 * it is bare 32-hex, indistinguishable from every hash in a bundle, so the
 * gate for it is "never put it in frontend-reaching code", reviewed, not a
 * regex.
 *
 *   node scripts/check-no-secret-keys-in-bundle.mjs             # scan every app's build output
 *   node scripts/check-no-secret-keys-in-bundle.mjs --self-test # prove it catches a violation
 *
 * Stripe's *publishable* key (`pk_`) and OAuth *client IDs* are meant to
 * ship to the browser and are deliberately not matched.
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
const PATTERNS = [
  { name: 'stripe secret/restricted key', pattern: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'google oauth client secret', pattern: /\bGOCSPX-[A-Za-z0-9_-]{10,}/ },
  {
    name: 'google ads developer token',
    // No stable prefix to match on — the token is bare base62 — so match the
    // value only where a `developerToken`-shaped key names it (object literal
    // or assignment, quoted value), which is how a bundler would emit a leak.
    pattern: /developer_?[Tt]oken["']?\s*[:=]\s*["'][A-Za-z0-9_-]{10,}["']/,
  },
  {
    name: 'meta access token',
    // Same contextual rule: a bare `EA…` prefix inside minified code would
    // false-positive on base64 blobs (inlined images), so the token only
    // counts where an `access_token`-shaped key or query param carries it.
    pattern: /access_?[Tt]oken["']?\s*[:=]\s*["']?EA[A-Za-z0-9_-]{20,}/,
  },
  // ── TASK-024: every secret class the backend's threat model names ──
  {
    name: 'aws access key id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'private key material (PEM)',
    pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY( BLOCK)?-----/,
  },
  {
    name: 'signing key assignment',
    // Contextual, like the Google Ads token: a signing/signing-key-shaped
    // name carrying a secret-shaped value. Bare hex is indistinguishable
    // from a hash in a bundle, so only a named assignment counts.
    pattern: /signing_?[Kk]ey["']?\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}["']/,
  },
  {
    name: 'internal hostname',
    // RFC 1918 and `.internal`/`cluster.local` hosts must never appear in a
    // public bundle: they leak topology (a frontend that could *reach* them
    // would be a worse bug, and the CSP `connect-src` gate would block it —
    // this catches the leak before the CSP report does). `localhost` and
    // `*.localhost` are the documented local dev/e2e origins and don't match.
    pattern:
      /https?:\/\/[a-z0-9][a-z0-9.-]*\.(internal|cluster\.local)\b|https?:\/\/(?:10\.\d{1,3}|192\.168\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?\b/,
  },
]

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
      for (const { name, pattern } of PATTERNS) {
        const match = content.match(pattern)
        if (match) {
          violations.push({ file, kind: name, match: match[0] })
        }
      }
    }
  }
  return violations
}

function report(violations) {
  for (const { file, kind, match } of violations) {
    console.error(`${kind.toUpperCase()} IN BUNDLE VIOLATION: ${file}`)
    console.error(`  matched: ${match.slice(0, 7)}…`)
  }
}

function selfTest() {
  const fixtureDir = join(ROOT, 'apps', '__bundle_scan_fixture__', 'dist')
  mkdirSync(fixtureDir, { recursive: true })
  const fixtureFile = join(fixtureDir, 'index.js')

  const caught = (fixture, label) => {
    writeFileSync(fixtureFile, fixture)
    if (scan([fixtureDir]).length === 0) {
      console.error(`SELF-TEST FAILED: ${label} was not detected`)
      process.exit(1)
    }
    console.log(`self-test OK: ${label} detected`)
  }
  const ignored = (fixture, label) => {
    writeFileSync(fixtureFile, fixture)
    if (scan([fixtureDir]).length > 0) {
      console.error(`SELF-TEST FAILED: ${label} must never be flagged`)
      process.exit(1)
    }
    console.log(`self-test OK: ${label} ignored`)
  }

  try {
    caught('const stripeKey = "sk_live_abcdefghijklmnop";\n', 'sk_live_ literal')
    caught('const connectKey = "rk_test_abcdefghijklmnop";\n', 'rk_test_ literal')
    caught(
      'const googleSecret = "GOCSPX-abcdefghijklmnopqrstu";\n',
      'google oauth client secret literal',
    )
    caught(
      'const cfg = { developerToken: "1aBcD2eFg3hIj4K5l6mNo" };\n',
      'google ads developer token key/value pair',
    )
    caught(
      'const mt = { accessToken: "EAABsbCDi1Q5B7vzW1234567890abcdefghij" };\n',
      'meta access token assignment',
    )
    caught(
      'const url = "https://graph.facebook.com/me?access_token=EAAGsbCDi1Q5B7vzW1234567890abcdefghij";\n',
      'meta access token in a query string',
    )
    // TASK-024: one planted credential per class — a scan that has never
    // caught anything is a scan nobody has tested.
    caught('const awsKey = "AKIAIOSFODNN7EXAMPLE";\n', 'aws access key id literal')
    caught(
      'const pem = "-----BEGIN RSA PRIVATE KEY-----\\nMIIB";\n',
      'PEM private key header',
    )
    caught(
      'const cfg = { signingKey: "1aBcD2eFg3hIj4K5l6mNoPQr" };\n',
      'signing key assignment',
    )
    caught(
      'const svc = "http://auth.internal.example/oauth";\n',
      'internal hostname (.internal)',
    )
    caught(
      'const svc = "http://10.0.14.7:8080/api";\n',
      'internal hostname (RFC 1918)',
    )
    caught(
      'const svc = "http://sanvi-api.default.cluster.local/health";\n',
      'internal hostname (cluster.local)',
    )
    ignored('const publishableKey = "pk_live_abcdefghijklmnop";\n', 'the publishable key (pk_)')
    ignored(
      'const clientId = "1234567890-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com";\n',
      'the oauth client id',
    )
    ignored(
      'const cfg = { developerMode: true };\n',
      'a developer-prefixed key with no secret-shaped value',
    )
    ignored(
      'const blob = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAEAAYABA3EAAB/+wKG";\n',
      'a base64 blob that merely contains an EA… run',
    )
    // Non-secrets the new patterns must not flag:
    ignored(
      'const site = "https://acme.localhost:4174";\n',
      'a *.localhost dev/e2e origin',
    )
    ignored(
      'const cfg = { signingKeyAlgo: "Ed25519" };\n',
      'a signing-key name with a non-secret algorithm value',
    )
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
  console.error('A server-only credential pattern was found in a built bundle.')
  console.error(
    'See docs/phase-09-tenant-payments/09.0-contract-and-foundations.md and',
    'docs/phase-10-advertising/implementation-plan.md (TASK-009).',
  )
  process.exit(1)
}
console.log(
  `no-secret-keys-in-bundle: OK (scanned ${dirs.length} build output director${dirs.length === 1 ? 'y' : 'ies'})`,
)
