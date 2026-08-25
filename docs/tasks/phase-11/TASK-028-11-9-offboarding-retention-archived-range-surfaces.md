# TASK-028: 11.9 Offboarding, retention & archived-range surfaces

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1122, NFR-1109
**Depends on:** TASK-021
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-028 (offboarding endpoints, retention report, archived-range responses)
**Slice:** 11.9 — Data lifecycle at scale, archival & tenant offboarding
**Prerelease:** `v1.0.0-rc.10` · **Flag:** `platform.archival` (backend-owned)

## Context

Three operator- and tenant-facing surfaces over the data-lifecycle work, unified by one rule: **an
absence is never rendered as a zero.**

The archived-range case is the sharpest version of it. A tenant querying advertising metrics or audit
history from an archived period would otherwise see an empty chart, and an empty chart says "you did
nothing that month" rather than "that month has been archived, here is how to get it back". The same
logic drives the restore-in-progress state in TASK-025.

The purge surface goes the other way: it is the one irreversible action in the product, so it is the one
place a two-person confirmation is worth the friction.

## What to do

- [ ] **Contract** — consume `POST` and `GET /api/v1/platform/tenants/{id}/offboarding`
      (`platform.tenant.offboard`), the per-class retention report, and the archived-range response shape
      that read endpoints return instead of a silently-partial result.
- [ ] **Offboarding surface in platform admin** — start, monitor, and download the export; view the purge
      report; **a two-person confirmation for the purge step** because it is irreversible by design.
- [ ] **Purge report presentation** — what was removed per context and what was lawfully retained with
      the reason and retention end date, as two clearly separated lists rather than one mixed table.
- [ ] **Retention reporting surface** — per-class status from the backend report (rule, last run, rows
      affected, oldest surviving row), visible to platform operators and **reused by TASK-029's evidence
      pack rather than rebuilt for it**.
- [ ] **Archived-range messaging** — where a tenant admin queries a period that has been archived
      (advertising metrics and audit history most likely), say so, with the restore path, instead of
      rendering an empty chart that looks like data loss.

## Acceptance criteria

- [ ] An operator can start an offboarding, watch it progress, and download the verified export before
      any purge step is offered.
- [ ] The purge step requires a two-person confirmation and cannot be reached before the export is
      verified.
- [ ] The purge report renders removed and lawfully retained as separate lists, each retained entry
      naming its reason and retention end date.
- [ ] Re-running an offboarding renders the same report without error (idempotent from the UI's view).
- [ ] The retention surface shows every class with its rule, last run, rows affected, and oldest
      surviving row, and visibly flags a class that has not run inside its window.
- [ ] A query over an archived range renders an archived-range state naming the restore path — **never an
      empty chart, a zero, or a spinner**.
- [ ] A partially-archived range is rendered honestly as partial rather than silently truncated.
- [ ] All strings are in `en` and `ja`; axe passes on every new surface; budgets hold.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm test:e2e --grep offboarding
pnpm test:e2e --grep archived
```

## Out of scope

Partitioning, archival policies, the restore path, retention verification, vacuum tuning, and the
offboarding job itself (backend TASK-028). The evidence packs that consume the retention surface
(TASK-029).

## Files likely touched

- `apps/platform-admin/src/routes/tenants/offboarding/**` (start, monitor, download, purge report)
- `apps/platform-admin/src/routes/retention/**` (per-class status)
- `packages/ui/**` (two-person confirmation primitive, archived-range empty-state variant)
- `apps/admin/**` (archived-range messaging on metrics and audit history views)
- `packages/api-client/**` (offboarding, retention report, archived-range types)
- `packages/i18n` catalogs (`en`, `ja`)

## Notes / gotchas

- Rollback: the backend's `platform.archival` off stops the mover; already-archived data stays reachable,
  so the archived-range state remains correct either way. The offboarding purge is **deliberately not
  reversible** — the two-person confirmation and the mandatory verified export are the safety, not an
  undo.
- Build the archived-range state as a variant of the existing empty state rather than a new component, so
  every surface that already handles empty inherits it instead of forgetting it.
- The retention surface is deliberately built once and reused by TASK-029. Rebuilding it there is how the
  evidence pack and the operator view drift apart.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
