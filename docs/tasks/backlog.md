# Backlog — sanvi-frontend

Single source of truth for task status. Maintained by hand, in the same commit as the task file
it describes.

**Recording status.** A status change touches exactly two places, and they must never disagree:

1. the `**Status:**` line at the top of `phase-NN/TASK-0NN-….md`, and
2. that task's row in the table below, with the PR or commit in the **Notes** column.

**Adding a task.** Take the next free `TASK-0NN` — IDs are permanent and never reused — name its
requirement from [`../requirements.md`](../requirements.md), and add it both here and as a file in
the phase's `tasks/phase-NN/` directory. Two invariants hold over the set, and a reviewer checks
them by reading: every requirement is covered by at least one task, and every task names a
requirement.

**Executing a task.** Tasks are executed with the Superpowers workflow — `superpowers:executing-plans`
for inline execution, or `superpowers:subagent-driven-development` for a fresh subagent per task with
review between tasks. The checkboxes inside a task file are the working record of that execution;
this table is the summary.

Each task traces to a numbered requirement in [`../requirements.md`](../requirements.md); the *why*
behind each one lives in that phase's implementation plan
([09](../phase-09-tenant-payments/implementation-plan.md) ·
[10](../phase-10-advertising/implementation-plan.md) ·
[11](../phase-11-hardening-ga/implementation-plan.md)) and the slice order in its
`phase-NN/README.md` ([09](phase-09/README.md) · [10](phase-10/README.md) ·
[11](phase-11/README.md)). Every task must clear
[`definition-of-done.md`](definition-of-done.md).

Statuses: `todo` · `in-progress` · `blocked` · `done`

| ID | Phase | Title | Status | Depends on | Notes |
|---|---|---|---|---|---|
| TASK-001 | 09 | 09.0 Generated client, CSP & settings shell | done | phase 08 | shipped: api-client/payments.ts, csp Stripe preset, PaymentsSettings shell |
| TASK-002 | 09 | 09.1 Provider catalog & provider-card adapter shape | done | TASK-001 | feat(payments): provider catalog & card adapter shape |
| TASK-003 | 09 | 09.2 Connect.js loader & embedded onboarding | done | TASK-002 | feat(payments): connect.js loader & embedded onboarding |
| TASK-004 | 09 | 09.3 Status, requirements & embedded banner | done | TASK-003 | 0e2b538 status/requirements/banner; 2fde99b fix: flaky embedded-component tests (static Connect.js import, distinct retry labels) — e2e not run, needs a live backend |
| TASK-005 | 09 | 09.4 Storefront checkout journey | done | TASK-004 | order summary, checkout initiation, return polling with backoff, confirmation, cancel path, decline code mapping, unit/component tests; e2e/visual snapshots deferred (needs live backend + Stripe sandbox) |
| TASK-006 | 09 | 09.5 Payments list, detail, refunds & disputes | done | TASK-005 | feat(payments): payments list, detail, refunds & disputes |
| TASK-007 | 09 | 09.6 Payouts, tax section & fee disclosure | done | TASK-004, TASK-005 | feat(payments): payouts list, failed-payout notice, tax preflight & toggle dialog, platform fee disclosure; storefront tax-note-reflects-real-setting acceptance criterion NOT met — no customer-safe contract surface exists yet (see task file) |
| TASK-008 | 09 | 09.7 Disconnect, degraded mode & release sweeps | todo | TASK-006, TASK-007 | partial (disconnect flow with typed confirm & blocker mapping, degraded mode in admin/storefront, api-client helper, unit/a11y tests); e2e suite, visual baselines, flag default flip deferred |
| TASK-009 | 10 | 10.0 Generated client, CSP & advertising shell | done | phase 09 | feat(advertising): generated advertising client, CSP `ads()` preset, entitlement-gated shell, metric formatters, extended secret scan; all task acceptance criteria + verification commands green; prerelease tag/staging deploy not run (no pipeline here); `check:budget` red on marketing pre-existing (see task file execution notes) |
| TASK-010 | 10 | 10.1 Capability-driven form engine & platform catalog | done | TASK-009 | feat(advertising): capability-driven form engine (matrix→schema→validation, per-locale limits, field-path violation mapping, `matrix_version` schema cache), `AdPlatformCard` catalog UI, three fake-adapter matrix fixtures, platform-literal grep gate inside `check:boundaries`; prove-it demo in task file; all acceptance criteria + verification commands green; `check:budget` red only by the pre-existing platform-admin failure on this branch's base (main's 15e2a47 fixes it; see task file execution notes) |
| TASK-011 | 10 | 10.2 Connection screens, OAuth handoff & health | done | TASK-010 | feat(advertising): connection screens, OAuth handoff & health — callback/picker routes, server-computed health states, typed-confirm disconnect with step-up (`hasFreshAal2`, admin `/step-up`), reconnect vs. different-account copy; contract deltas + pre-connect scope-list gap in task file notes; gates green except the base's pre-existing `check:budget` (platform-admin) and 4 payments-onboarding e2e failures |
| TASK-012 | 10 | 10.3 Campaign list, builder, detail & drift | done | TASK-011 | feat(advertising): campaign list, builder, detail & drift — capability-stepper builder with autosave, budget-increase confirmation, per-currency bulk confirmations, drift diff with no default resolution, change log with platform attribution; check:budget red only by the pre-existing marketing/platform-admin i18n-chunk overage (red on base, verified); ad review status pending a backend contract field |
| TASK-013 | 10 | 10.4 Creative management & placement previews | todo | TASK-012 | |
| TASK-014 | 10 | 10.5 Tracking setup, storefront beacon & test event | todo | TASK-011 | |
| TASK-015 | 10 | 10.6 Conversion diagnostics & audience management | todo | TASK-014 | |
| TASK-016 | 10 | 10.7 Chart primitives & ROAS dashboard | todo | TASK-012, TASK-015 | |
| TASK-017 | 10 | 10.8 Budget cap configuration & alert surfaces | todo | TASK-016 | |
| TASK-018 | 10 | 10.9 A11y, visual, export hardening & e2e consolidation | todo | TASK-013, TASK-015, TASK-017 | |
| TASK-019 | 11 | 11.0 Telemetry package, release stamping & baseline | todo | TASK-031 | gate half; rewritten 2026-09-01 — live RUM and four-week field p75s parked (docs/release/needs-humans.md), collector still built directive-gated |
| TASK-020 | 11 | 11.1 Error tracking, trace id & user-facing diagnostics | todo | TASK-019 | gate half; RUM segmentation querying parked, dimensions still collected |
| TASK-021 | 11 | 11.2 Harness re-run & client call-pattern audit | todo | TASK-020, phases 09+10 shipped | GA half |
| TASK-022 | 11 | 11.3 Bundles, fonts, images, streaming SSR & long tasks | todo | TASK-021, phases 09+10 shipped | GA half; field p75 targets became pinned-profile lab targets, INP asserted as Total Blocking Time |
| TASK-023 | 11 | 11.4 Error boundaries, outage UX, retry & offline | todo | TASK-021, phases 09+10 shipped | GA half |
| TASK-024 | 11 | 11.5 Auth surface review, CSP tightening & bundle secret gate | todo | TASK-031 | gate half; pen-test remediation parked |
| TASK-025 | 11 | 11.6 Status page, degraded banners & restore-in-progress | todo | TASK-023, phases 09+10 shipped | GA half; out-of-perimeter hosting parked, limitation documented on the page |
| TASK-026 | 11 | 11.7 429 handling, quota & usage surfaces | todo | TASK-023, phases 09+10 shipped | GA half; the phase's only new user-facing capability |
| TASK-027 | 11 | 11.8 Accessibility sweep, manual passes & statement | todo | TASK-022, phases 09+10 shipped | GA half; external audit and NVDA/JAWS parked, statement describes method rather than claiming conformance |
| TASK-028 | 11 | 11.9 Offboarding, retention & archived-range surfaces | todo | TASK-021, phases 09+10 shipped | GA half; two-person purge confirmation became a typed confirmation |
| TASK-029 | 11 | 11.10 Privacy centre re-verification & evidence access | todo | TASK-027, TASK-028, phases 09+10 shipped | GA half |
| TASK-030 | 11 | 11.11 E2E completion, browser matrix, visual baseline & documentation | todo | TASK-024, TASK-025, TASK-026, TASK-027, TASK-029, phases 09+10 shipped | GA half; matrix is engine coverage not vendor builds; unblocks the backend's v1.0.0 tag |
| TASK-031 | 11 | 11.a CI harness truth & pinned profiles | todo | none | gate half; Lighthouse CI, per-route budgets and the axe job do not exist yet — startable today, independent of phases 09 and 10 |
