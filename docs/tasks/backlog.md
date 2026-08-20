# Backlog — sanvi-frontend

Single source of truth for task status. Generated and updated by the sdlc-planner
script — don't hand-edit rows or hand-number IDs; the script keeps this table and
the task files in sync, and `check` flags it when they drift.

```bash
SDLC="python3 ~/.claude/skills/sdlc-planner/scripts/sdlc.py"

$SDLC check                                     # traceability + status drift (run from this repo root)
$SDLC status TASK-002 in-progress               # updates the task file AND the row below
$SDLC status TASK-002 done --note "PR #123"
$SDLC new-task 09 "<title>" --requirement FR-903 --depends TASK-002
```

Each task traces to a numbered requirement in [`../requirements.md`](../requirements.md); the *why*
behind each one lives in [`../phase-09-tenant-payments/implementation-plan.md`](../phase-09-tenant-payments/implementation-plan.md)
and the cross-track slice docs in [`../../../docs/phase-09-tenant-payments/`](../../../docs/phase-09-tenant-payments/README.md).

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
