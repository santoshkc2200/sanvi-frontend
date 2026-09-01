# TASK-025: 11.6 Status page, degraded banners & restore-in-progress

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1115, NFR-1109
**Depends on:** TASK-023, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-025 (`/system/health`, `/system/ready`)
**Flag:** none

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Three surfaces over the backend's recovery work, each with the same underlying rule: **the page tells
the truth from the same signal the operators are acting on**, never from a separate manual toggle that
someone forgets to flip back.

## Why this shape

Both locales are a requirement rather than a follow-up: a status page that only speaks English fails
half the users during the one event they need it. Incident copy written under pressure is copy written
badly and in one language, so the templates are written now.

The restore-in-progress state exists for a specific failure: during a single-tenant restore, that
tenant's admin would otherwise render an empty dataset, and **an empty dataset reads as data loss**.

One honest limitation. The original task required the status page to be hosted so that a full API
outage still renders it — otherwise it is a page that is unavailable exactly when it matters. There is
no host outside the perimeter. The page is built to be static and to degrade to its last known state,
and **the limitation is documented on the page itself** rather than hidden; the hosting is parked.

## Constraints

- Nothing on these surfaces may expose hostnames, versions, or internal error strings.
- Banners are driven by the operator's signal, not by a second manual toggle.
- Dismissible where informational; **persistent where the user's action would fail**.

## File ownership map

- `apps/marketing/src/routes/status/**` — public status page, incident history
- `packages/ui/**` — maintenance and degraded banner primitives, restore-in-progress state
- `packages/api-client/**` — health, readiness, probe result types
- `apps/admin/**` — restore-in-progress state, banner host
- `packages/i18n` catalogs (`en`, `ja`) — status, incident templates, banner and restore copy

## Steps

### Step 1: Consume the probes

**Files:** Modify `packages/api-client/**`

**Do:** `GET /api/v1/system/health` and `GET /api/v1/system/ready`, both unauthenticated, readiness
reporting **states** only.

**Verify:** a type test asserts the readiness shape carries no hostname, version, or error string
field — the leak is prevented at the type level, not by discipline.

### Step 2: Build the status page in both locales

**Files:** Create `apps/marketing/src/routes/status/**`; Modify `packages/i18n`

**Do:** rendered from live readiness with incident history, in `en` and `ja`, linked from the marketing
footer and from the admin outage screens built in TASK-023. Render statically so it degrades to its
last known state rather than to an error, and state on the page that it is served by the same
infrastructure it reports on.

**Verify:**
- The page renders in both locales with incident history.
- An e2e with the API down asserts the page still renders and shows the degraded state rather than a
  crash.

### Step 3: Write the incident templates before the incident

**Files:** Modify `packages/i18n`

**Do:** one template per SLO journey, in both locales, so an operator publishes rather than composes.

**Verify:** a template exists for every journey in the backend's `docs/slo/budgets.md`, in both
locales, asserted by a test that reads the journey list.

### Step 4: Add maintenance and degraded banners

**Files:** Modify `packages/ui/**`, `apps/admin/**`

**Do:** driven by the same signal operators set. Dismissible where informational, persistent where the
user's action would fail.

**Verify:**
- Setting the signal shows the banner without a second manual action; clearing it removes the banner.
- A test asserts an informational banner is dismissible and a blocking one is not.

### Step 5: Add the restore-in-progress state

**Files:** Modify `apps/admin/**`, `packages/ui/**`

**Do:** when a tenant is being restored, that tenant's admin shows an honest state rather than an empty
dataset.

**Verify:** an e2e puts a tenant into restore and asserts the admin shows the restore state, **never an
empty dataset**.

## Definition of done

- [ ] The status page renders from live readiness in `en` and `ja`, with incident history, reachable
      from the marketing footer and the admin outage screens.
- [ ] With the API down the page still renders, shows the degraded state, and states its own hosting
      limitation.
- [ ] An incident template exists for every SLO journey in both locales.
- [ ] An operator-set signal appears without a second manual action, and clearing it removes the banner.
- [ ] Informational banners are dismissible; blocking ones are not.
- [ ] A tenant under restore sees an honest restore state, never an empty dataset.
- [ ] No hostname, version, or internal error string appears on any of these surfaces, asserted by a
      snapshot test.
- [ ] All strings are in `en` and `ja`; axe passes; `pnpm check:i18n` and `pnpm check:tokens` pass.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm test:e2e --grep status
pnpm test:e2e --grep degraded
```

## Out of scope

Backups, restore drills, PITR, single-tenant restore mechanics, and credential rotation (backend
TASK-025). Error boundaries and per-app outage screens (TASK-023) — this task links to them and supplies
the banner signal.

## Parked

Hosting the status page outside the perimeter, and the backend's external probes that would feed it —
see [`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
