import { readdirSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.svelte-kit',
  'storybook-static',
  'coverage',
  'playwright-report',
  'test-results',
  '.turbo',
  '.git',
  '__fixtures__',
])

/**
 * Recursively yields file paths under `rootDir` whose basename passes
 * `predicate`, skipping build/dependency directories.
 * @param {string} rootDir
 * @param {(name: string) => boolean} predicate
 * @returns {Generator<string>}
 */
export function* walkFiles(rootDir, predicate) {
  let entries
  try {
    entries = readdirSync(rootDir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = join(rootDir, entry.name)

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath, predicate)
    } else if (entry.isFile() && predicate(entry.name)) {
      yield fullPath
    }
  }
}

/** @param {string} path */
export function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * True when the calling module is the process entry point. Must be compared
 * via realpath: pnpm's bin shims exec the symlink under `node_modules/.bin`,
 * so `import.meta.url` (realpath) never string-equals `process.argv[1]`
 * (symlink path) — a plain `import.meta.url === \`file://\${argv[1]}\``
 * comparison silently skips `main()` and makes the gate a no-op exit 0.
 * @param {string} metaUrl
 */
export function isMainEntryPoint(metaUrl) {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === fileURLToPath(metaUrl)
  } catch {
    return false
  }
}
