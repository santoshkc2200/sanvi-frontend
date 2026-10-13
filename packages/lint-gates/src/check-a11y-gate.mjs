/**
 * The axe sweep's blocking rule (TASK-027), as a pure function so the gate
 * is unit-testable without a browser. `scripts/check-a11y.mjs` calls this
 * with the sweep artifact; CI blocks on `ok: false`.
 * @param {object} artifact the sweep artifact
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function evaluateGate(artifact) {
  const failures = []
  if (artifact.totals.critical > 0)
    failures.push(`${artifact.totals.critical} critical axe finding(s)`)
  if (artifact.totals.serious > 0)
    failures.push(`${artifact.totals.serious} serious axe finding(s)`)
  if (artifact.totals.errors > 0)
    failures.push(
      `${artifact.totals.errors} page(s) whose axe run errored — a missing entry is not a pass`,
    )
  if (artifact.totals.uncovered > 0)
    failures.push(`${artifact.totals.uncovered} route(s) with no axe sweep entry`)
  return { ok: failures.length === 0, failures }
}
