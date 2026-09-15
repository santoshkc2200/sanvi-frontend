import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Bundle assertions for the advertising surface (phase 10, TASK-018): the
 * advertising routes — dashboard and builder included, charts inside — stay
 * lazy-loaded. A static route import would pull every chart and screen into
 * the admin's initial bundle, and `check:budget`'s per-chunk cap is the
 * performance budget the chart layer is held to once it is a lazy chunk.
 *
 * This is a source assertion, not a build measurement: the build-level
 * number is `check:budget`'s job. Here we hold the one thing a later edit
 * could quietly break — the dynamism of the route imports themselves.
 */

const appSource = readFileSync('src/App.svelte', 'utf8')

describe('advertising routes stay lazy (phase 10, TASK-018)', () => {
  it('loads every advertising route through a dynamic import', () => {
    // Every reference to an advertising route module in the router must be
    // inside a dynamic `import()` — a static top-level import of any of
    // these files defeats the code split.
    const references = appSource.match(/['"][^'"]*routes\/advertising\/[^'"]*['"]/g) ?? []
    expect(references.length).toBeGreaterThan(0)

    const dynamic =
      appSource.match(/import\(\s*['"][^'"]*routes\/advertising\/[^'"]*['"]\s*\)/g) ?? []
    expect(dynamic.length).toBe(references.length)
  })

  it('never imports an advertising route module statically', () => {
    const staticImports =
      appSource.match(/^import\s[^;]*from\s*['"][^'"]*routes\/advertising\//gm) ?? []
    expect(staticImports).toEqual([])
  })
})
