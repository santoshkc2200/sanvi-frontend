/**
 * Serving helpers shared by the phase-11 harness runners
 * (`check-lighthouse.mjs`, `check-a11y.mjs`, `bench-run.mjs`).
 *
 * The harnesses measure *build output*, not dev servers — a number from a dev
 * server is not a number about the product. Each app's preview command (the
 * same one e2e uses) serves the build. The storefront additionally needs a
 * backend to resolve tenants against: without one every SSR request 500s and
 * there is nothing to measure. Its e2e fixture `mock-api-server.mjs` is
 * exactly that backend (port 8090, matching the preview script's
 * PUBLIC_API_ORIGIN), so the harnesses start it rather than growing a second
 * fake backend to drift against.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@sanvi/lint-gates/perf-profiles'

const ROOT = findWorkspaceRoot()
const MOCK_HEALTH_URL = 'http://localhost:8090/__health'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'never attempted'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return
      lastError = `status ${response.status}`
    } catch (error) {
      lastError = error?.message ?? String(error)
    }
    await sleep(250)
  }
  throw new Error(
    `harness: ${label} did not become ready within ${timeoutMs}ms (last: ${lastError})`,
  )
}

/**
 * Starts the storefront e2e mock API (port 8090). Idempotent per process:
 * callers with overlapping app runs share one handle.
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startStorefrontMockApi() {
  const child = spawn(process.execPath, [join('e2e', 'fixtures', 'mock-api-server.mjs')], {
    cwd: join(ROOT, 'apps', 'storefront'),
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  try {
    await waitFor(MOCK_HEALTH_URL, 15_000, 'storefront mock API')
  } catch (error) {
    child.kill('SIGTERM')
    throw error
  }
  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      child.kill('SIGTERM')
    },
  }
}

/**
 * A built app served by its own preview command, ready to answer requests.
 * The command is spawned through plain `sh` (no pnpm in the middle to orphan
 * on stop), so the workspace's and the app's `node_modules/.bin` are
 * prepended to PATH for binaries like `vite` to resolve.
 * @param {string} app
 * @returns {Promise<{ stop: () => void, url: string }>}
 */
export async function serveApp(app, port) {
  const cwd = join(ROOT, 'apps', app)
  const command = readAppPackageJson(app).scripts.preview
  const pathPrefix = [
    join(ROOT, 'node_modules', '.bin'),
    join(cwd, 'node_modules', '.bin'),
    process.env.PATH ?? '',
  ].join(':')
  const child = spawn('sh', ['-c', command], {
    cwd,
    env: { ...process.env, PATH: pathPrefix },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const url = `http://localhost:${port}/`
  try {
    await waitFor(url, 30_000, `${app} preview (${command})`)
  } catch (error) {
    child.kill('SIGTERM')
    throw error
  }
  let stopped = false
  return {
    url,
    stop() {
      if (stopped) return
      stopped = true
      child.kill('SIGTERM')
    },
  }
}

function readAppPackageJson(app) {
  return JSON.parse(readFileSync(join(ROOT, 'apps', app, 'package.json'), 'utf8'))
}
