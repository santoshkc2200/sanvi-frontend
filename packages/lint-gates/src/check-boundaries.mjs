#!/usr/bin/env node
/**
 * Enforces the import-boundary rules from `docs/architecture-overview.md`
 * §2: `apps → packages → design-tokens`, never upward, never sideways.
 *
 * Since phase 10 (TASK-010) this CLI also runs the matrix-is-the-only-source
 * gate (`check-platform-literals.mjs`), and since TASK-016 the
 * two-numbers-never-one gate (`check-no-blended-attribution.mjs`):
 * `pnpm check:boundaries` reports every violation kind and fails on any.
 *
 *   - `ui` never imports `api-client` (never fetches, never touches server state).
 *   - Apps never import each other — shared code moves into a package.
 *   - Nothing imports another package's `src/**` internals directly — only
 *     through its declared package entry point (`@sanvi/<pkg>`, not
 *     `@sanvi/<pkg>/src/...` or a relative path reaching across the
 *     package boundary).
 *
 * Import specifiers are extracted with a regex, not a full parser (same
 * trade-off as `check-i18n.mjs`) — reliable for this codebase's plain
 * `import`/`export ... from`/`import()` ES module syntax.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'
import { scanWorkspace as scanPlatformLiterals } from './check-platform-literals.mjs'
import { scanWorkspace as scanBlendedAttribution } from './check-no-blended-attribution.mjs'

const IMPORT_PATTERN =
  /(?:import|export)(?:[^'";]*?from)?\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function extractSpecifiers(source) {
  const specifiers = []
  let match = IMPORT_PATTERN.exec(source)
  while (match !== null) {
    specifiers.push(match[1] ?? match[2])
    match = IMPORT_PATTERN.exec(source)
  }
  return specifiers
}

/** The workspace root's `apps/*` and `packages/*` names, keyed by their `@sanvi/*` package name. */
function loadWorkspaceMap(root) {
  const map = { apps: new Map(), packages: new Map() }
  for (const kind of ['apps', 'packages']) {
    for (const dirName of walkTopLevelDirs(join(root, kind))) {
      const pkgJsonPath = join(root, kind, dirName, 'package.json')
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
        map[kind].set(pkg.name, dirName)
      } catch {
        // no package.json — not a real workspace member, skip
      }
    }
  }
  return map
}

function walkTopLevelDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

/** Which app/package src root a file belongs to, e.g. `apps/admin` or `packages/ui`. */
function ownerOf(filePath, root) {
  const rel = relative(root, filePath)
  const parts = rel.split(sep)
  if (parts.length >= 2 && (parts[0] === 'apps' || parts[0] === 'packages')) {
    return `${parts[0]}/${parts[1]}`
  }
  return null
}

/** @returns {{ file: string, specifier: string, reason: string }[]} */
export function checkWorkspace(root) {
  const violations = []
  const workspace = loadWorkspaceMap(root)

  const files = [
    ...walkFiles(root, (name) => ['.ts', '.svelte', '.mjs'].includes(extname(name))),
  ].filter((f) => {
    const rel = relative(root, f)
    return (
      /^apps\/[^/]+\/(src|e2e|__tests__)\//.test(rel) ||
      /^packages\/[^/]+\/(src|__tests__)\//.test(rel)
    )
  })

  for (const file of files) {
    const owner = ownerOf(file, root)
    if (!owner) continue
    const [ownerKind, ownerDir] = owner.split('/')
    const source = readFileSync(file, 'utf8')

    for (const specifier of extractSpecifiers(source)) {
      // Rule: ui never imports api-client.
      if (owner === 'packages/ui' && /^@sanvi\/api-client(\/|$)/.test(specifier)) {
        violations.push({
          file,
          specifier,
          reason: '`packages/ui` may not import `@sanvi/api-client`',
        })
        continue
      }

      // Rule: nothing imports another package's src/** internals directly.
      const deepImportMatch = specifier.match(/^@sanvi\/([^/]+)\/src\//)
      if (deepImportMatch) {
        violations.push({
          file,
          specifier,
          reason: `reaches into @sanvi/${deepImportMatch[1]}'s internals — import from its package entry point instead`,
        })
        continue
      }

      // Rule: apps never import each other (by @sanvi/<app> specifier).
      if (ownerKind === 'apps' && workspace.apps.has(specifier)) {
        const targetApp = workspace.apps.get(specifier)
        if (targetApp !== ownerDir) {
          violations.push({
            file,
            specifier,
            reason: `app "${ownerDir}" imports app "${targetApp}"`,
          })
        }
        continue
      }

      // Rule: dependencies never point upward — a package importing an app
      // inverts the `apps → packages` direction.
      if (ownerKind === 'packages' && workspace.apps.has(specifier)) {
        violations.push({
          file,
          specifier,
          reason: `package "${ownerDir}" imports app "${workspace.apps.get(
            specifier,
          )}" — dependencies never point upward into apps`,
        })
        continue
      }

      // Relative imports that escape the current package/app root entirely
      // (crossing into a *different* apps/* or packages/* tree via `../..`).
      if (specifier.startsWith('.')) {
        const resolvedNoExt = resolve(dirname(file), specifier)
        const resolvedOwner = ownerOf(resolvedNoExt, root)
        if (resolvedOwner && resolvedOwner !== owner) {
          violations.push({
            file,
            specifier,
            reason: `relative import reaches across the package boundary into ${resolvedOwner}`,
          })
        }
      }
    }
  }

  return violations
}

async function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('Usage: sanvi-check-boundaries <workspace-root>')
    process.exit(2)
  }

  const resolvedRoot = resolve(root)
  const violations = checkWorkspace(resolvedRoot)
  const literalViolations = scanPlatformLiterals(resolvedRoot)
  const blendedViolations = scanBlendedAttribution(resolvedRoot)

  if (
    violations.length === 0 &&
    literalViolations.length === 0 &&
    blendedViolations.length === 0
  ) {
    console.log(
      '✓ check:boundaries — no import-boundary, platform-literal, or blended-attribution violations found',
    )
    return
  }

  if (violations.length > 0) {
    console.error(`✗ check:boundaries — ${violations.length} violation(s):\n`)
    for (const v of violations) {
      console.error(`  ${v.file}\n    imports "${v.specifier}" — ${v.reason}`)
    }
  }
  if (literalViolations.length > 0) {
    console.error(`\n✗ check:platform-literals — ${literalViolations.length} violation(s):\n`)
    for (const v of literalViolations) {
      console.error(
        `  ${v.file}:${v.line}  "${v.literal}" (tier ${v.tier}, ${v.scope})\n` +
          `    platform data belongs to the backend matrix, not to frontend source`,
      )
    }
  }
  if (blendedViolations.length > 0) {
    console.error(`\n✗ check:no-blended-attribution — ${blendedViolations.length} violation(s):\n`)
    for (const v of blendedViolations) {
      console.error(
        `  ${v.file}:${v.line}  "${v.identifier}"\n` +
          `    platform-reported conversion value and Sanvi-observed revenue are separate,` +
          ` separately-labelled numbers — no blended ROAS or conversion value may exist`,
      )
    }
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
