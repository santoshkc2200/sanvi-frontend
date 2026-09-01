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
| TASK-003 | 09 | 09.2 Connect.js loader & embedded onboarding | todo | TASK-002 | |
| TASK-004 | 09 | 09.3 Status, requirements & embedded banner | todo | TASK-003 | |
| TASK-005 | 09 | 09.4 Storefront checkout journey | todo | TASK-004 | |
| TASK-006 | 09 | 09.5 Payments list, detail, refunds & disputes | todo | TASK-005 | |
| TASK-007 | 09 | 09.6 Payouts, tax section & fee disclosure | todo | TASK-004, TASK-005 | |
| TASK-008 | 09 | 09.7 Disconnect, degraded mode & release sweeps | todo | TASK-006, TASK-007 | |
| TASK-009 | 10 | 10.0 Generated client, CSP & advertising shell | todo | phase 09 | |
| TASK-010 | 10 | 10.1 Capability-driven form engine & platform catalog | todo | TASK-009 | |
| TASK-011 | 10 | 10.2 Connection screens, OAuth handoff & health | todo | TASK-010 | |
| TASK-012 | 10 | 10.3 Campaign list, builder, detail & drift | todo | TASK-011 | |
| TASK-013 | 10 | 10.4 Creative management & placement previews | todo | TASK-012 | |
| TASK-014 | 10 | 10.5 Tracking setup, storefront beacon & test event | todo | TASK-011 | |
| TASK-015 | 10 | 10.6 Conversion diagnostics & audience management | todo | TASK-014 | |
| TASK-016 | 10 | 10.7 Chart primitives & ROAS dashboard | todo | TASK-012, TASK-015 | |
| TASK-017 | 10 | 10.8 Budget cap configuration & alert surfaces | todo | TASK-016 | |
| TASK-018 | 10 | 10.9 A11y, visual, export hardening & e2e consolidation | todo | TASK-013, TASK-015, TASK-017 | |
| TASK-019 | 11 | 11.0 Field collection, CI budget harness & baseline capture | todo | phase 10 | |
| TASK-020 | 11 | 11.1 Error tracking, RUM segmentation & user-facing diagnostics | todo | TASK-019 | |
| TASK-021 | 11 | 11.2 Harness re-run & client call-pattern audit | todo | TASK-020 | |
| TASK-022 | 11 | 11.3 Bundles, fonts, images, streaming SSR & INP | todo | TASK-020 | |
| TASK-023 | 11 | 11.4 Error boundaries, outage UX, retry & offline | todo | TASK-021 | |
| TASK-024 | 11 | 11.5 Auth surface review, CSP tightening & bundle secret gate | todo | TASK-019 | |
| TASK-025 | 11 | 11.6 Status page, degraded banners & restore-in-progress | todo | TASK-023 | |
| TASK-026 | 11 | 11.7 429 handling, quota & usage surfaces | todo | TASK-023 | |
| TASK-027 | 11 | 11.8 Accessibility sweep, manual passes & external audit | todo | TASK-022 | |
| TASK-028 | 11 | 11.9 Offboarding, retention & archived-range surfaces | todo | TASK-021 | |
| TASK-029 | 11 | 11.10 Privacy centre re-verification & evidence access | todo | TASK-027, TASK-028 | |
| TASK-030 | 11 | 11.11 E2E completion, browser matrix, visual baseline & rollout | todo | TASK-024, TASK-025, TASK-026, TASK-027, TASK-029 | |
