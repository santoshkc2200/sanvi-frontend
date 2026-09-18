# Definition of Done — per task

Applies to **every** task in `tasks/`, from phase 09 onward. Inherited from the roadmap's
phase-level DoD and tightened to the slice: a task is a thin vertical cut that can be merged,
flagged off, and exercised against a local production build on its own, so it carries the full DoD by
itself rather than deferring it to the end of the phase.

**Every line below is falsifiable by running a command on this machine.** There is no deployment
target and no git remote, so the lines that used to require one have moved to
[`../release/needs-humans.md`](../release/needs-humans.md) with the local check that replaces each. A
line that cannot be falsified by a command does not belong here.

- [ ] Tests green — unit, component (incl. axe), and the task's own Playwright path.
- [ ] Generated API client regenerated from the merged contract; no hand-written request types.
- [ ] `pnpm check:all` green — lint, typecheck, test, build, i18n, tokens, budget, boundaries.
- [ ] No hardcoded user-facing strings (`@sanvi/i18n`), no hardcoded colors/fonts/spacing
      (`@sanvi/design-tokens`), no `fetch` outside `@sanvi/api-client`.
- [ ] CSP declared through `@sanvi/csp`; no secret keys reachable from a bundle.
- [ ] Accessibility checked — keyboard path, focus order, announced status changes.
- [ ] Docs updated — this task file, plus the phase implementation plan if a decision changed.
- [ ] Feature flag defined and defaulted **off**; rollback plan written.
- [ ] The flagged path exercised against a **production build**, not the dev server — `pnpm build`
      then that app's `preview` script — in **both** flag positions, with the commands recorded in
      the task file. A dev-server-only check misses SSR, CSP and bundle-split failures, which is the
      class of bug this line exists to catch. **Merged ≠ exercised.**

### Phase 11 additions — hardening tasks

A hardening task ships a number, a recorded manual pass, or a published statement rather than a feature,
so from phase 11 onward these three lines are added to the list above:

- [ ] **Evidence artifact committed** — a benchmark JSON, an audit checklist with a named runner, a
      published statement, or a review record with a date. **A task with no artifact did not happen.**
- [ ] Numbers compared against the stored `rc.1` baseline in the same harness, on the pinned device and
      tooling profiles; a regression is explained or reverted.
- [ ] Every new user-facing string in `en` and `ja`, and every new state axe-clean — including states
      that only appear during an outage, a limit, or an archived range.

The flag line is read as "*if* the task ships behaviour": several phase 11 tasks ship tooling or
evidence, or sit behind a backend-owned flag, and have no flag of their own. Those say so in their
header rather than inventing one.

Status is recorded by hand in two places **in the same commit** — the `**Status:**` line at the top
of the task file, and that task's row in [`backlog.md`](backlog.md), with the PR or commit as the
note. Updating one without the other is the failure mode this rule exists to prevent.

## Contract first

Backend and frontend run concurrently against the OpenAPI contract, which is written and merged
**before** either track starts. Every task's first checklist item is therefore its **Contract**
item; that item is the handshake with the other repo.

Where a task is blocked on work in `sanvi-backend`, it says so in a `**Blocked by (cross-repo):**`
line in its header. Those lines are the only cross-track coordination there is — there is no shared
schedule document to consult. Frontend task IDs are independent of backend task IDs, so a cross-repo
blocker always names the repository explicitly.

Concurrency is only real when the backend ships a **fake provider adapter** alongside the contract:
it lets these screens be built and tested before sandbox credentials exist in every developer's
environment, and it doubles as the proof that the provider abstraction holds.

## Release convention

Phases 09–10: each task tags a prerelease off the phase branch (`vX.Y.0-alpha.N`, recorded in the
task's `**Prerelease:**` header line) so a measurement can name the exact build it ran against. The
phase version `vX.Y.0` is tagged only by the phase's final task, when every task in the phase is
`done` and the feature flags are on by default.

Phase 11 overrides this, and its README is authoritative: GA-half tasks tag a release candidate off
the phase branch; **gate-half tasks tag nothing** — they change CI and tooling, not product
behaviour, so they carry no `**Prerelease:**` line and none should be invented for them.
