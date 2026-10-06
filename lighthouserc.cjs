/**
 * Lighthouse CI — base configuration (TASK-031).
 *
 * Every throttling number, viewport value, and tool pin comes from
 * `scripts/perf-profiles.json` — the single source the `perf-profiles` unit
 * test guards. The profile makes runs *comparable*: change it in a deliberate
 * commit or every stored artifact stops meaning anything.
 *
 * One LHCI collect runs against one server, so there is no runnable config at
 * this file's top level — invoke it per app through the runner
 * (`pnpm check:lighthouse`, which calls `lhci collect
 * --config=apps/<app>/lighthouserc.cjs`) or directly with that same per-app
 * config path; a bare `lhci autorun --config=lighthouserc.cjs` would find no
 * `.ci` key here and collect nothing. Reporting-only; assertions start
 * blocking in TASK-022.
 */
const profiles = require('./scripts/perf-profiles.json')

const midrange = profiles.profiles['midrange-android']

/** Per-app server shape. Ports match each app's preview/e2e setup. */
const APPS = {
  storefront: { type: 'sveltekit', port: 4174, urls: ['/', '/ja/'] },
  marketing: { type: 'sveltekit', port: 4173, urls: ['/', '/ja/'] },
  admin: { type: 'spa', port: 4175, urls: ['/'] },
  'platform-admin': { type: 'spa', port: 4176, urls: ['/'] },
}

/**
 * Splits a POSIX env-prefix command (`PORT=4174 … node build`) into its env
 * assignments and the bare command. On Windows, lhci runs startServerCommand
 * through cmd.exe, which can neither parse the env-prefix syntax nor reliably
 * quote a `C:\Program Files\…` bash path — so the per-app config hands lhci
 * the bare command and `APP_SERVER_ENV` carries the assignments for the
 * runner to inject into the lhci process env (server children inherit them).
 * @param {string} script
 */
function splitEnvPrefix(script) {
  const env = {}
  const parts = script.split(/\s+/)
  const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/
  let i = 0
  while (i < parts.length && assignment.test(parts[i])) {
    const match = /** @type {RegExpExecArray} */ (assignment.exec(parts[i]))
    env[match[1]] = match[2]
    i += 1
  }
  return { env, command: parts.slice(i).join(' ') }
}

/** Per-app start-server env for the runner to inject on Windows (null = none). */
const APP_SERVER_ENV = Object.fromEntries(
  Object.keys(APPS).map((name) => {
    const script = JSON.parse(
      require('node:fs').readFileSync(
        require('node:path').join(__dirname, 'apps', name, 'package.json'),
        'utf8',
      ),
    ).scripts.preview
    const { env } = splitEnvPrefix(script)
    return [name, Object.keys(env).length > 0 ? env : null]
  }),
)

/**
 * A complete LHCI config for one app. `startServerCommand` is the app's own
 * `preview` script so the harness serves exactly what a developer serves —
 * no parallel serving convention to drift. (Read with plain JSON `require`:
 * this file is `.cjs` and must not depend on `require()`-ing workspace ESM.)
 *
 * @param {keyof typeof APPS} name
 */
function forApp(name) {
  const app = APPS[name]
  if (!app)
    throw new Error(`lighthouserc: unknown app "${name}" — known: ${Object.keys(APPS).join(', ')}`)

  // __dirname is the repo root (this file is committed there), so the path is
  // cwd-independent — lhci runs with the app directory as its cwd.
  const previewScript = JSON.parse(
    require('node:fs').readFileSync(
      require('node:path').join(__dirname, 'apps', name, 'package.json'),
      'utf8',
    ),
  ).scripts.preview

  // POSIX keeps the app's own script verbatim; Windows gets the bare command
  // with the env prefix split out (see splitEnvPrefix / APP_SERVER_ENV).
  const startServerCommand =
    process.platform === 'win32' ? splitEnvPrefix(previewScript).command : previewScript

  return {
    ci: {
      collect: {
        startServerCommand,
        // adapter-node prints "Listening on …"; vite preview prints "➜  Local: …"
        startServerReadyPattern: 'Listening|Local:|ready',
        // LHCI wants absolute URLs — the list in APPS is path-shaped.
        url: app.urls.map((path) => `http://localhost:${app.port}${path}`),
        numberOfRuns: profiles.harnesses.lighthouse.runs,
        chromePath: process.env.CHROME_PATH || undefined,
        settings: {
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          throttlingMethod: midrange.throttlingMethod,
          throttling: {
            rttMs: midrange.network.requestLatencyMs,
            throughputKbps: midrange.network.downloadThroughputKbps,
            requestLatencyMs: midrange.network.requestLatencyMs,
            downloadThroughputKbps: midrange.network.downloadThroughputKbps,
            uploadThroughputKbps: midrange.network.uploadThroughputKbps,
            cpuSlowdownMultiplier: midrange.cpuSlowdownMultiplier,
          },
          screenEmulation: {
            mobile: true,
            width: midrange.viewport.width,
            height: midrange.viewport.height,
            deviceScaleFactor: midrange.deviceScaleFactor,
            disabled: false,
          },
          formFactor: midrange.formFactor,
        },
      },
      upload: {
        target: 'filesystem',
        // Resolved from the app directory (the runner's cwd for lhci).
        outputDir: `../../benchmarks/frontend/lhci/${name}`,
      },
    },
  }
}

module.exports = { profiles, APPS, APP_SERVER_ENV, forApp }
