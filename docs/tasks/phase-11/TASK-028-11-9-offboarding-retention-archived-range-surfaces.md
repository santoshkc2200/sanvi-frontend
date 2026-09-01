# TASK-028: 11.9 Offboarding, retention & archived-range surfaces

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1122, NFR-1109
**Depends on:** TASK-021, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-028 (offboarding endpoints, retention report, archived-range responses)
**Flag:** `platform.archival` (backend-owned)

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Three operator- and tenant-facing surfaces over the data-lifecycle work, unified by one rule: **an
absence is never rendered as a zero.**

## Why this shape

The archived-range case is the sharpest version of the rule. A tenant querying advertising metrics or
audit history from an archived period would otherwise see an empty chart, and **an empty chart says
"you did nothing that month" rather than "that month has been archived, here is how to get it back".**
The same logic drives the restore-in-progress state in TASK-025.

The purge surface goes the other way: it is the one irreversible action in the product. The original
plan protected it with a two-person confirmation; there is one person, so the protection becomes a
verified-export precondition plus a typed confirmation naming the tenant. That is weaker and is
recorded as such.

## Constraints

- The purge step is unreachable before the export verifies. That precondition is the safety, not an
  undo.
- Build the archived-range state as a **variant of the existing empty state** rather than a new
  component, so every surface that already handles empty inherits it instead of forgetting it.
- The retention surface is built once here and **reused** by TASK-029. Rebuilding it there is how the
  evidence pack and the operator view drift apart.

## File ownership map

- `apps/platform-admin/src/routes/tenants/offboarding/**` — start, monitor, download, purge report
- `apps/platform-admin/src/routes/retention/**` — per-class status
- `packages/ui/**` — typed-confirmation primitive, archived-range empty-state variant
- `apps/admin/**` — archived-range messaging on metrics and audit history views
- `packages/api-client/**` — offboarding, retention report, archived-range types
- `packages/i18n` catalogs (`en`, `ja`)

## Steps

### Step 1: Consume the three backend shapes

**Files:** Modify `packages/api-client/**`

**Do:** the offboarding endpoints, the per-class retention report, and the archived-range response shape
that read endpoints return instead of a silently-partial result.

**Verify:** a type test asserts an archived-range response is not assignable to the normal result type
— so a caller that forgets to handle it fails to compile rather than rendering a zero.

### Step 2: Build the archived-range state as an empty-state variant

**Files:** Modify `packages/ui/**`, `apps/admin/**`

**Do:** where a tenant queries an archived period, say so with the restore path. Handle the
partially-archived case honestly as partial rather than silently truncated.

**Verify:** an e2e queries an archived range and asserts the archived state renders — **never an empty
chart, a zero, or a spinner** — and a partially-archived range renders as partial.

### Step 3: Build the offboarding console

**Files:** Create `apps/platform-admin/src/routes/tenants/offboarding/**`; Modify `packages/ui/**`

**Do:** start, monitor, and download the verified export. The purge step is offered only after the
export verifies, behind a typed confirmation naming the tenant.

**Verify:** an e2e proves the purge step is unreachable before the export verifies, and that the
confirmation requires the tenant name typed exactly.

### Step 4: Present the purge report as two lists

**Files:** Modify `apps/platform-admin/src/routes/tenants/offboarding/**`

**Do:** what was removed per context and what was lawfully retained with the reason and retention end
date, as **two clearly separated lists rather than one mixed table**.

**Verify:** a test asserts each retained entry names its reason and end date, and that re-running an
offboarding renders the same report without error.

### Step 5: Build the retention surface once

**Files:** Create `apps/platform-admin/src/routes/retention/**`

**Do:** per-class status from the backend report — rule, last run, rows affected, oldest surviving row —
visibly flagging a class that has not run inside its window.

**Verify:** an e2e asserts a stalled class is visibly flagged; the component is exported for TASK-029 to
reuse rather than copied.

## Definition of done

- [ ] An operator can start an offboarding, watch it progress, and download the verified export before
      any purge step is offered.
- [ ] The purge step requires a typed confirmation naming the tenant and is unreachable before the
      export verifies.
- [ ] The purge report renders removed and lawfully retained as separate lists, each retained entry
      naming its reason and retention end date.
- [ ] Re-running an offboarding renders the same report without error.
- [ ] The retention surface shows every class with rule, last run, rows affected, and oldest surviving
      row, and visibly flags a class that has not run inside its window.
- [ ] A query over an archived range renders an archived-range state naming the restore path — never an
      empty chart, a zero, or a spinner.
- [ ] A partially-archived range renders honestly as partial.
- [ ] The archived-range state is a variant of the shared empty state, not a new component.
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

Partitioning, archival policies, the restore path, retention verification, and the offboarding job
itself (backend TASK-028). The evidence packs that consume the retention surface (TASK-029).

## Parked

Two-person confirmation on the purge step — see
[`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
