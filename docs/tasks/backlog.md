# Backlog — sanvi-frontend

Single source of truth for task status. Generated and updated by the sdlc-planner
script — don't hand-edit rows or hand-number IDs; the script keeps this table and
the task files in sync, and `check` flags it when they drift.

```bash
SDLC="python3 ~/.claude/skills/sdlc-planner/scripts/sdlc.py"

$SDLC check                                     # traceability + status drift (run from this repo root)
$SDLC status TASK-002 in-progress               # updates the task file AND the row below
$SDLC status TASK-002 done --note "PR #123"
$SDLC new-task 10 "<title>" --requirement FR-1003 --depends TASK-010
```

Each task traces to a numbered requirement in [`../requirements.md`](../requirements.md); the *why*
behind each one lives in that phase's implementation plan
([09](../phase-09-tenant-payments/implementation-plan.md) ·
[10](../phase-10-advertising/implementation-plan.md)) and the slice order in its
`phase-NN/README.md` ([09](phase-09/README.md) · [10](phase-10/README.md)). Every task must clear
[`definition-of-done.md`](definition-of-done.md).

Statuses: `todo` · `in-progress` · `blocked` · `done`

| ID | Phase | Title | Status | Depends on | Notes |
|---|---|---|---|---|---|
| TASK-001 | 09 | 09.0 Generated client, CSP & settings shell | done | phase 08 | shipped: api-client/payments.ts, csp Stripe preset, PaymentsSettings shell |
| TASK-002 | 09 | 09.1 Provider catalog & provider-card adapter shape | todo | TASK-001 | |
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
