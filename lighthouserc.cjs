/**
 * Lighthouse CI — base configuration (TASK-031).
 *
 * Every throttling number, viewport value, and tool pin comes from
 * `scripts/perf-profiles.json` — the single source the `perf-profiles` unit
 * test guards. The profile makes runs *comparable*: change it in a deliberate
 * commit or every stored artifact stops meaning anything.
 *
 * One LHCI collect runs against one server, so the runner
 * (`scripts/check-lighthouse.mjs`) invokes `lhci collect` once per app with
 * the per-app config from `apps/<app>/lighthouserc.cjs`, which extends this
 * file's `forApp()`. The harness is reporting-only here; budgets and
 * Lighthouse assertions start blocking in TASK-022.
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

  return {
    ci: {
      collect: {
        startServerCommand: previewScript,
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

module.exports = { profiles, APPS, forApp }
// A valid default config for a bare `lhci autorun --config=lighthouserc.cjs`
// (the storefront is the app the phase's targets are written against).
module.exports.default = forApp('storefront')
