import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
