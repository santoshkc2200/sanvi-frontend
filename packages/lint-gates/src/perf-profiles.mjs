/**
 * The single reader of `scripts/perf-profiles.json`.
 *
 * Every harness that needs a profile value — throttling, viewport, version
 * pins, the run count — reads it through {@link loadPerfProfiles}, never by
 * hardcoding the value beside its use. The point is comparability (phase 11's
 * central invariant): a pin that lives in the file is one deliberate commit to
 * drift; a pin that lives in three scripts is three silent chances. The
 * `perf-profiles` unit test enforces this — it greps the harness sources for
 * the pinned values and fails when any of them appears outside this file.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROFILE_FILE = join('scripts', 'perf-profiles.json')

/**
 * @typedef {object} PerfProfile
 * @property {string} description
 * @property {string} formFactor
 * @property {number} [cpuSlowdownMultiplier]
 * @property {string} [throttlingMethod]
 * @property {{ requestLatencyMs: number, downloadThroughputKbps: number, uploadThroughputKbps: number }} [network]
 * @property {{ width: number, height: number }} [viewport]
 * @property {number} [deviceScaleFactor]
 * @property {string} [playwrightDevice] Playwright devices-descriptor name (ios-safari profile)
 * @property {string} [engine]
 */

/**
 * @typedef {object} PerfHarness
 * @property {string|null} profile profile name, or null when no runtime profile applies
 * @property {string} [profileNote]
 * @property {number} [runs]
 * @property {string} [runsNote]
 * @property {string[]} [locales]
 * @property {string} [localesNote]
 */

/**
 * @typedef {object} PerfProfiles
 * @property {{ name: string, phase: string, task: string, lab: boolean, emulation: boolean, emulationNote: string, inpNote: string, comparabilityNote: string, localeCoverageNote: string }} meta
 * @property {{ chrome: string, lighthouse: string, lighthouseCi: string, playwright: string }} pins
 * @property {Record<string, PerfProfile>} profiles
 * @property {Record<string, PerfHarness>} harnesses
 */

/**
 * Walks up from `startDir` to the directory containing `pnpm-workspace.yaml`.
 * Harnesses run from varying cwds (turbo per-package runs, root scripts, CI
 * checkout roots), so the workspace root — not the cwd — anchors the path.
 * @param {string} [startDir] defaults to this module's directory
 * @returns {string} absolute path to the workspace root
 */
export function findWorkspaceRoot(startDir = dirname(fileURLToPath(import.meta.url))) {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`perf-profiles: no workspace root above ${startDir}`)
    }
    dir = parent
  }
}

/**
 * Parses and structurally validates `scripts/perf-profiles.json`.
 *
 * Validation is structural (pins present and pinned, profiles referenced by
 * harnesses exist), not a re-declaration of the values: adding or changing a
 * profile is an edit to the JSON alone, and the test only insists that
 * harnesses read *something* from here rather than from themselves.
 *
 * @param {{ root?: string }} [options]
 * @returns {PerfProfiles} the parsed profiles document
 */
export function loadPerfProfiles({ root = findWorkspaceRoot() } = {}) {
  const file = join(root, PROFILE_FILE)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`perf-profiles: ${file} is missing or unparseable (${error.message})`)
  }

  const pins = parsed.pins ?? {}
  for (const pin of ['chrome', 'lighthouse', 'playwright']) {
    const value = pins[pin]
    if (typeof value !== 'string' || value === '' || value === 'latest' || value === '*') {
      throw new Error(
        `perf-profiles: pins.${pin} must be an explicit version, got ${JSON.stringify(value ?? null)}`,
      )
    }
  }

  const profiles = parsed.profiles ?? {}
  for (const [name, config] of Object.entries(parsed.harnesses ?? {})) {
    if (config.profile === undefined) {
      throw new Error(`perf-profiles: harnesses.${name} must declare a profile (or explicit null)`)
    }
    if (config.profile !== null && !Object.hasOwn(profiles, config.profile)) {
      throw new Error(
        `perf-profiles: harnesses.${name} references unknown profile "${config.profile}"`,
      )
    }
  }

  if (!parsed.meta?.emulationNote || !parsed.meta?.inpNote) {
    throw new Error(
      'perf-profiles: meta.emulationNote and meta.inpNote must be present — lab numbers say what they are',
    )
  }

  return parsed
}
