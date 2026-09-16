import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findWorkspaceRoot, loadPerfProfiles } from '../src/perf-profiles.mjs'

const ROOT = findWorkspaceRoot(fileURLToPath(new URL('../', import.meta.url)))

/**
 * The harnesses that consume profile data. The invariant under test — no
 * harness reads a profile value from anywhere else — is enforced here as two
 * falsifiable assertions per file: every harness that needs profile values
 * goes through the loader, and none of the pinned values or throttling
 * numbers appear in *any* harness source. The only file allowed to contain
 * them is `scripts/perf-profiles.json` itself.
 */
const HARNESS_SOURCES = [
  'packages/lint-gates/src/check-budget.mjs',
  'packages/lint-gates/src/routes.mjs',
  'scripts/check-lighthouse.mjs',
  'scripts/check-a11y.mjs',
  'scripts/bench-run.mjs',
  'scripts/bench-compare.mjs',
  'lighthouserc.cjs',
]

const PROFILES = loadPerfProfiles({ root: ROOT })

describe('perf-profiles.json', () => {
  it('exists at the workspace root under scripts/', () => {
    expect(() => readFileSync(join(ROOT, 'scripts', 'perf-profiles.json'), 'utf8')).not.toThrow()
  })

  it('pins explicit tool versions — never "latest"', () => {
    for (const [tool, version] of Object.entries(PROFILES.pins)) {
      expect(version, `pins.${tool}`).toMatch(/^\d+\.\d+/)
    }
  })

  it('records that profiles are emulation and that INP is not lab-measurable', () => {
    expect(PROFILES.meta.emulation).toBe(true)
    expect(PROFILES.meta.emulationNote).toContain('EMULATION')
    expect(PROFILES.meta.inpNote).toContain('Total Blocking Time')
  })

  it('references only profiles that exist', () => {
    for (const [name, config] of Object.entries(PROFILES.harnesses)) {
      if (config.profile === null) continue
      expect(Object.keys(PROFILES.profiles), `harnesses.${name}`).toContain(config.profile)
    }
  })

  it('pins a throttled mobile profile with CPU slowdown and a network shape', () => {
    const profile = PROFILES.profiles['midrange-android']
    expect(profile).toBeDefined()
    expect(profile?.cpuSlowdownMultiplier).toBeGreaterThan(1)
    expect(profile?.network?.downloadThroughputKbps).toBeLessThan(2000)
    expect(profile?.network?.requestLatencyMs).toBeGreaterThan(0)
  })

  it('records the runs-per-URL Lighthouse uses so medians are stable', () => {
    expect(PROFILES.harnesses['lighthouse']?.runs).toBeGreaterThanOrEqual(3)
  })

  it('covers both shipped locales in the axe sweep', () => {
    expect(PROFILES.harnesses['axe']?.locales).toEqual(expect.arrayContaining(['en', 'ja']))
  })
})

describe('profile values live only in perf-profiles.json', () => {
  const pinnedValues = Object.values(PROFILES.pins)
  const throttleNumbers = Object.values(PROFILES.profiles['midrange-android']?.network ?? {})
  const forbiddenLiterals = [...pinnedValues, ...throttleNumbers].map(String)

  it.each(HARNESS_SOURCES)('%s does not hardcode any pin or throttle value', (relPath) => {
    const source = readFileSync(join(ROOT, relPath), 'utf8')
    for (const literal of forbiddenLiterals) {
      expect(source, `${relPath} embeds profile value "${literal}"`).not.toContain(literal)
    }
  })

  it.each([
    'scripts/check-lighthouse.mjs',
    'scripts/check-a11y.mjs',
    'scripts/bench-run.mjs',
    'scripts/bench-compare.mjs',
  ])('%s reads profiles through the shared loader', (relPath) => {
    const source = readFileSync(join(ROOT, relPath), 'utf8')
    expect(source).toMatch(/loadPerfProfiles|perf-profiles/)
  })
})

describe('findWorkspaceRoot', () => {
  it('anchors at the pnpm workspace regardless of cwd depth', () => {
    expect(findWorkspaceRoot(fileURLToPath(new URL('../src', import.meta.url)))).toBe(ROOT)
  })

  it('throws outside a workspace instead of guessing', () => {
    expect(() => findWorkspaceRoot('/')).toThrow(/no workspace root/)
  })
})
