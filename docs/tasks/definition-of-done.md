# Definition of Done — per task

Applies to **every** task in `tasks/`, from phase 09 onward. Inherited from the roadmap's
phase-level DoD and tightened to the slice: a task is a thin vertical cut that can be merged,
flagged off, and deployed to staging on its own, so it carries the full DoD by itself rather than
deferring it to the end of the phase.

- [ ] Tests green — unit, component (incl. axe), and the task's own Playwright path.
- [ ] Generated API client regenerated from the merged contract; no hand-written request types.
- [ ] `pnpm check:all` green — lint, typecheck, test, build, i18n, tokens, budget, boundaries.
- [ ] No hardcoded user-facing strings (`@sanvi/i18n`), no hardcoded colors/fonts/spacing
      (`@sanvi/design-tokens`), no `fetch` outside `@sanvi/api-client`.
- [ ] CSP declared through `@sanvi/csp`; no secret keys reachable from a bundle.
- [ ] Accessibility checked — keyboard path, focus order, announced status changes.
- [ ] Docs updated — this task file, plus the phase implementation plan if a decision changed.
- [ ] Feature flag defined and defaulted **off**; rollback plan written.
- [ ] Deployed to staging behind the flag. **Merged ≠ done.**

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

Status is recorded only through the sdlc-planner script, never by hand-editing the task file and
[`backlog.md`](backlog.md) separately:

```bash
python3 ~/.claude/skills/sdlc-planner/scripts/sdlc.py status TASK-00N done --note "<PR or commit>"
```

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

Each task tags a prerelease off the phase branch (`vX.Y.0-alpha.N`, recorded in the task's
`**Prerelease:**` header line) so staging always has a nameable artifact. The phase version
`vX.Y.0` is tagged only by the phase's final task, when every task in the phase is `done` and the
feature flags are on by default.
