import { describe, expect, it } from 'vitest'
// The sweep script exports the blocking rule as a pure function so the
// gate is unit-testable without a browser (TASK-027 step 1).
import { evaluateGate } from '../src/check-a11y-gate.mjs'

function artifact(overrides: Record<string, unknown> = {}): Parameters<typeof evaluateGate>[0] {
  return {
    totals: { critical: 0, serious: 0, moderate: 0, minor: 0, uncovered: 0, errors: 0 },
    apps: {},
    ...overrides,
  } as Parameters<typeof evaluateGate>[0]
}

describe('check:a11y blocking rule (TASK-027)', () => {
  it('passes a clean, fully covered sweep', () => {
    expect(evaluateGate(artifact())).toEqual({ ok: true, failures: [] })
  })

  it('fails on a route with no axe entry — the throwaway-route case', () => {
    const gate = evaluateGate(
      artifact({
        totals: { critical: 0, serious: 0, moderate: 0, minor: 0, uncovered: 1, errors: 0 },
      }),
    )
    expect(gate.ok).toBe(false)
    expect(gate.failures.join(' ')).toMatch(/1 route\(s\) with no axe sweep entry/)
  })

  it('fails on serious and critical findings', () => {
    const gate = evaluateGate(
      artifact({
        totals: { critical: 2, serious: 5, moderate: 0, minor: 0, uncovered: 0, errors: 0 },
      }),
    )
    expect(gate.ok).toBe(false)
    expect(gate.failures.join(' ')).toMatch(/2 critical/)
    expect(gate.failures.join(' ')).toMatch(/5 serious/)
  })

  it('treats a page whose sweep errored as a missing entry, not a pass', () => {
    const gate = evaluateGate(
      artifact({
        totals: { critical: 0, serious: 0, moderate: 0, minor: 0, uncovered: 0, errors: 3 },
      }),
    )
    expect(gate.ok).toBe(false)
    expect(gate.failures.join(' ')).toMatch(/3 page\(s\) whose axe run errored/)
  })
})
