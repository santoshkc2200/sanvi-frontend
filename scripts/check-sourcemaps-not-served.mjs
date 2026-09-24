#!/usr/bin/env node
/**
 * `check:sourcemaps-not-served` — the FR-1104/NFR-1104 gate that source maps
 * are **unreachable from any public URL**, asserted against the built output
 * (TASK-020). Uploaded-and-also-served is the default of most bundler
 * integrations; this is the test that catches it.
 *
 * "Public" means the directories that are actually *served*: for the
 * adapter-node SvelteKit apps that is `build/client` (what the deployed
 * server's static handler exposes); for the SPAs, `dist/`. The adapter's
 * `build/server/` is the SSR server's own *program* — node requires it at
 * runtime, nothing serves it over HTTP, and the adapter re-bundles it with
 * esbuild (`sourcemap: true` hardcoded in `@sveltejs/adapter-node`), so
 * server-side maps are a server-ops artifact rather than a public URL. If a
 * deployment ever mounts static hosting on the whole `build/` directory,
 * that is a deployment misconfiguration this artifact cannot express.
 *
 * For each app it fails when any of these hold:
 *
 *   1. a `.map` file exists anywhere in the public output;
 *   2. any served `.js`/`.mjs`/`.css`/`.html` carries a `sourceMappingURL=`
 *      comment or an inline `data:` source map;
 *   3. the private staging dir (`sourcemaps-private/`, written by
 *      `privateSourceMapsPlugin` in `@sanvi/telemetry/release`) is missing
 *      or empty — maps must exist *somewhere* for the private upload to
 *      resolve stack traces; a build with no maps anywhere has silently
 *      lost the FR-1104 guarantee from the other side.
 *
 * Needs `pnpm build` to have run; missing output is an error, not a pass.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const APPS = [
  { name: 'storefront', publicDirs: ['build/client'] },
  { name: 'marketing', publicDirs: ['build/client'] },
  { name: 'admin', publicDirs: ['dist'] },
  { name: 'platform-admin', publicDirs: ['dist'] },
]

const PRIVATE_DIR = 'sourcemaps-private'
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css', '.html'])

/** @returns {Promise<string[]>} every file under `dir`, as paths relative to `dir`. */
async function walk(dir) {
  const out = []
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await visit(full)
      else out.push(relative(dir, full))
    }
  }
  await visit(dir)
  return out
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const problems = []

for (const app of APPS) {
  const appRoot = join(root, 'apps', app.name)
  const publicRoots = []
  // Per-app snapshot: `problems` is global, so comparing against the count
  // on entry lets each clean app still print its summary after another failed.
  const problemsBefore = problems.length

  for (const dir of app.publicDirs) {
    const full = join(appRoot, dir)
    if (await exists(full)) publicRoots.push([dir, full])
    else problems.push(`${app.name}: public output "${dir}" is missing — run \`pnpm build\` first`)
  }

  let publicFiles = 0
  for (const [dirName, full] of publicRoots) {
    for (const rel of await walk(full)) {
      publicFiles += 1
      if (rel.endsWith('.map')) {
        problems.push(`${app.name}: a source map is publicly served: ${dirName}/${rel}`)
        continue
      }
      if (!TEXT_EXTENSIONS.has(rel.slice(rel.lastIndexOf('.')))) continue
      const content = await readFile(join(full, rel), 'utf8')
      if (content.includes('sourceMappingURL=')) {
        problems.push(
          `${app.name}: served file references a source map: ${dirName}/${rel} (sourceMappingURL=)`,
        )
      }
    }
  }

  const privateDir = join(appRoot, PRIVATE_DIR)
  let privateMaps = 0
  if (await exists(privateDir)) {
    privateMaps = (await walk(privateDir)).filter((rel) => rel.endsWith('.map')).length
  }
  if (privateMaps === 0) {
    problems.push(
      `${app.name}: "${PRIVATE_DIR}/" holds no staged source maps — the private upload has nothing to upload (did the build run through privateSourceMapsPlugin?)`,
    )
  }

  if (problems.length === problemsBefore) {
    console.log(
      `check:sourcemaps-not-served ${app.name}: ${publicFiles} public files clean, ${privateMaps} map(s) staged privately`,
    )
  }
}

if (problems.length > 0) {
  console.error(`check:sourcemaps-not-served failed — ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
