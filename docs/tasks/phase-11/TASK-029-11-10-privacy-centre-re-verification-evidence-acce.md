# TASK-029: 11.10 Privacy centre re-verification & evidence access

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1123, NFR-1109
**Depends on:** TASK-027, TASK-028, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-029 (evidence pack generator, notice diff generator)
**Flag:** none — evidence slice

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Re-verify every phase-05 privacy surface **against the system as it is now** rather than as it was when
those surfaces were written, and expose the generated evidence artifacts without letting anyone publish
an unreviewed notice by clicking through.

## Why this shape

Phase 05 built the privacy surfaces; phases 08, 09, and 10 changed the system underneath them. Custom
domains, tenant payments, and the advertising tracking endpoint all arrived **after** the privacy centre
did, so the surfaces were verified against a system that no longer exists.

Two rules govern the new surfaces. **Publishing an unreviewed notice takes a deliberate action**: the
console shows the generated notice, its approval state, and the diff since last approval. And **an
evidence pack carries its provenance**: the generating build and period are stamped on the artifact,
because a pack that cannot say which build produced it is not evidence.

It depends on TASK-027 because these are the screens most likely to be read by someone using assistive
technology under stress, and they inherit that task's gates rather than being exempted from them.

## Constraints

- **Never hand-edit a generated pack or notice to make it look right.** The artifact's whole value is
  that it cannot describe a system other than the one running.
- A gap this task exposes is a defect in the phase it came from and is fixed there, not papered over.
- No exemption for "internal" console screens that a DPO will read.

## File ownership map

- `apps/storefront/**` and `apps/admin/**` privacy centre routes — re-verification, no rewrite expected
- `apps/platform-admin/src/routes/privacy/**` — notice diff, approval state, evidence pack download
- `packages/api-client/**` — evidence pack, notice diff types
- `packages/i18n` catalogs (`en`, `ja`) — notice approval and evidence copy
- e2e specs per consent mode and per jurisdiction

## Steps

### Step 1: Re-verify consent and opt-out in both modes

**Files:** Modify e2e specs

**Do:** the EU opt-in mode and the US notice-and-opt-out mode, each end to end against the current
system.

**Verify:** an e2e **per mode** proves consent and opt-out behave correctly.

### Step 2: Verify GPC on a tenant custom domain

**Files:** Modify e2e specs

**Do:** **this is the case most likely to be quietly broken.** The signal arrives on the tenant's own
domain, which is a code path phase 05 never saw.

**Verify:** an e2e sends GPC to a storefront on a tenant custom domain and asserts tracking is
suppressed on the **very first request**, verified from the UI as well as in the backend's own check.

### Step 3: Prove the preference centre reaches the tracking endpoint

**Files:** Modify e2e specs

**Do:** a preference change in the privacy centre must change what the phase-10 tracking endpoint
accepts.

**Verify:** an end-to-end test changes a preference and asserts the tracking endpoint's behaviour
changes accordingly.

### Step 4: Re-verify DSR submission per jurisdiction

**Files:** Modify `apps/storefront/**`, `apps/admin/**` privacy routes as needed

**Do:** each jurisdiction gets its own flow and copy.

**Verify:** an e2e per jurisdiction submits a DSR and asserts the jurisdiction-appropriate flow.

### Step 5: Surface the notice diff and its approval state

**Files:** Create `apps/platform-admin/src/routes/privacy/**`

**Do:** show the generated notice, its approval state, and the diff since last approval.

**Verify:** an e2e asserts **publishing without reviewing the diff is not reachable in a single click**.

### Step 6: Expose evidence pack download, audited

**Files:** Modify `apps/platform-admin/src/routes/privacy/**`

**Do:** download packs with the generating build sha and period visible **on the artifact and in the
UI**. Access itself is audited.

**Verify:** an e2e downloads a pack, asserts build and period are visible in both places, and asserts an
audit entry is produced.

### Step 7: Re-use, do not rebuild, the retention surface

**Files:** Modify `apps/platform-admin/src/routes/privacy/**`

**Do:** import TASK-028's retention component rather than building a second one.

**Verify:** a check asserts there is exactly one retention status component in the workspace.

## Definition of done

- [ ] Consent and opt-out behave correctly in both modes, proven by an e2e per mode.
- [ ] GPC on a tenant custom domain suppresses tracking on the very first request, verified from the UI.
- [ ] A preference change alters what the tracking endpoint accepts, proven end to end.
- [ ] DSR submission works per jurisdiction with the jurisdiction-appropriate flow and copy.
- [ ] The console shows the generated notice, its approval state, and the diff since last approval;
      publishing without reviewing the diff is not reachable in a single click.
- [ ] Evidence packs download with build sha and period visible on the artifact and in the UI, and each
      access produces an audit entry.
- [ ] There is exactly one retention status component in the workspace.
- [ ] Every privacy surface passes axe with zero serious or critical findings in both locales and is
      operable by keyboard alone.
- [ ] All strings are in `en` and `ja`; `pnpm check:i18n` and `pnpm check:tokens` pass.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm check:a11y
pnpm test:e2e --grep privacy
pnpm test:e2e --grep gpc
```

## Out of scope

The evidence pack generator, DSR path assertions, the provider completeness test, erasure propagation,
and the notice generator (backend TASK-029). Fixing a gap this task exposes.

## Parked

Counsel's approval of the notice diff — the approval-state UI is built and shows "not approved" until
there is someone to approve it. See [`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
