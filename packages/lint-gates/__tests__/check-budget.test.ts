import { fileURLToPath } from 'node:url'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  fontPreloadResult,
  formatAppReport,
  runBudgetCheck,
  spaInitialKb,
} from '../src/check-budget.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

describe('check:budget gate', () => {
  it('fails on its violation fixture — a ~2.5 KB chunk against a 1 KB budget', () => {
    const result = runBudgetCheck({
      dir: `${FIXTURES}budget-violation`,
      initialKb: 1,
      chunkKb: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.oversizedChunks.length).toBeGreaterThan(0)
  })

  it('identifies entry+chunks as initial JS for a SvelteKit-shaped build', () => {
    const result = runBudgetCheck({
      dir: `${FIXTURES}budget-violation`,
      initialKb: 1,
      chunkKb: 1,
    })
    expect(result.svelteKit).toBe(true)
    expect(result.initialKbTotal).toBeGreaterThan(1)
  })

  it('passes on its clean fixture — tiny files well under generous budgets', () => {
    const result = runBudgetCheck({ dir: `${FIXTURES}budget-clean`, initialKb: 50, chunkKb: 50 })
    expect(result.ok).toBe(true)
    expect(result.oversizedChunks).toEqual([])
  })

  it('skips gracefully — exit ok — when the build output does not exist yet', () => {
    const result = runBudgetCheck({
      dir: `${FIXTURES}this-directory-does-not-exist`,
      initialKb: 100,
      chunkKb: 50,
    })
    expect(result.ok).toBe(true)
    expect(result.skipped).toBe(true)
  })
})

describe('formatAppReport — the --app/--all path', () => {
  const failingSpaResult = {
    ok: false,
    skipped: false,
    name: 'admin',
    dir: 'apps/admin/dist',
    totalKb: 300,
    initialKbTotal: null,
    initialKb: 250,
    chunkKb: 5,
    oversizedChunks: [{ file: 'apps/admin/dist/assets/Dashboard-Cj2_.js', kb: 42.7 }],
    svelteKit: false,
    routes: [],
    routeKb: 16,
    routesMissing: 0,
    routeOk: true,
  }

  it('names the oversized chunks on a failing SPA — initial JS is unmeasured there, so this listing is the only blocking output', () => {
    const report = formatAppReport(failingSpaResult)
    expect(report).toContain('1 chunk(s) over the 5 KB budget:')
    expect(report).toContain('Dashboard-Cj2_.js: 42.7 KB')
  })

  it('lists them for the sveltekit shape too — `ok` counts oversized chunks for both shapes', () => {
    const report = formatAppReport({ ...failingSpaResult, svelteKit: true, initialKbTotal: 120 })
    expect(report).toContain('1 chunk(s) over the 5 KB budget:')
    expect(report).toContain('Dashboard-Cj2_.js: 42.7 KB')
  })
})

describe('spaInitialKb — the TASK-022 SPA initial convention', () => {
  function writeSpaFixture(manifest) {
    const dir = join(tmpdir(), `sanvi-spa-initial-${Math.random().toString(36).slice(2)}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(join(dir, 'assets'), { recursive: true })
    mkdirSync(join(dir, '.vite'), { recursive: true })
    writeFileSync(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest))
    return dir
  }

  it('measures the entry plus its transitive static import closure, nothing else', () => {
    const dir = writeSpaFixture({
      'src/main.ts': { isEntry: true, file: 'assets/entry.js', imports: ['src/shared.ts'] },
      'src/shared.ts': { file: 'assets/shared.js', imports: ['src/vendor.ts'] },
      'src/vendor.ts': { file: 'assets/vendor.js' },
      'src/lazy-route.ts': { file: 'assets/lazy.js', isDynamicEntry: true },
    })
    writeFileSync(join(dir, 'assets', 'entry.js'), 'x'.repeat(10_000))
    writeFileSync(join(dir, 'assets', 'shared.js'), 'y'.repeat(5_000))
    writeFileSync(join(dir, 'assets', 'vendor.js'), 'z'.repeat(2_000))
    writeFileSync(join(dir, 'assets', 'lazy.js'), 'l'.repeat(50_000))

    const kb = spaInitialKb(dir)
    expect(kb).not.toBeNull()
    // The three closure chunks (17 KB raw of repeated characters) must be
    // well under 1 KB gzipped; the excluded 50 KB lazy chunk would push the
    // total over that bound — this is the "closure, not directory" claim.
    expect(kb).toBeLessThan(1)
    expect(kb).toBeGreaterThan(0)
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns null without a manifest or without an entry — unmeasured, never guessed', () => {
    expect(spaInitialKb(join(tmpdir(), 'definitely-not-here'))).toBeNull()
    const dir = writeSpaFixture({ 'src/a.ts': { file: 'assets/a.js' } })
    expect(spaInitialKb(dir)).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('fontPreloadResult — the Japanese font budget line', () => {
  const root = fileURLToPath(new URL('../__fixtures__/', import.meta.url))
  const config = {
    label: 'test preloads',
    budgetKb: 1,
    files: ['fonts/tiny.woff2'],
  }

  it('sums raw woff2 bytes and enforces the cap', () => {
    mkdirSync(join(root, 'fonts'), { recursive: true })
    writeFileSync(join(root, 'fonts', 'tiny.woff2'), Buffer.alloc(512))
    const result = fontPreloadResult({ config, root })
    expect(result.totalKb).toBeCloseTo(0.5, 5)
    expect(result.ok).toBe(true)
    writeFileSync(join(root, 'fonts', 'tiny.woff2'), Buffer.alloc(4096))
    expect(fontPreloadResult({ config, root }).ok).toBe(false)
    rmSync(join(root, 'fonts'), { recursive: true, force: true })
  })

  it('reports a missing file as unmeasured and fails the budget', () => {
    const result = fontPreloadResult({
      config: { ...config, files: ['fonts/absent.woff2'] },
      root,
    })
    expect(result.totalKb).toBeNull()
    expect(result.ok).toBe(false)
  })
})
