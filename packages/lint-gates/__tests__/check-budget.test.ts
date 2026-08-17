import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runBudgetCheck } from '../src/check-budget.mjs'

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
