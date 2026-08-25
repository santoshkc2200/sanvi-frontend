# TASK-029: 11.10 Privacy centre re-verification & evidence access

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1123, NFR-1109
**Depends on:** TASK-027, TASK-028
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-029 (evidence pack generator, notice diff generator)
**Slice:** 11.10 — Compliance evidence packs & jurisdiction drills
**Prerelease:** `v1.0.0-rc.11` · **Flag:** none — evidence slice

## Context

Phase 05 built the privacy surfaces; phases 08, 09, and 10 changed the system underneath them. This task
re-verifies every one of those surfaces **against the system as it is now** rather than as it was when
they were written — custom domains, tenant payments, and the advertising tracking endpoint all arrived
after the privacy centre did.

Two rules govern the new surfaces. **Publishing an unreviewed notice takes a deliberate action**: the
console shows the generated notice, its approval state, and the diff since last approval, so nobody
publishes by clicking through. And **an evidence pack carries its provenance**: the generating build and
period are stamped on the artifact, because a pack that cannot say which build produced it is not
evidence.

It depends on TASK-027 because these are the screens most likely to be read by someone using assistive
technology under stress, and they inherit that task's gates rather than being exempted from them.

## What to do

- [ ] **Contract** — consume the backend's generated evidence packs (stamped with build sha and period)
      and the generated notice diff. No new public endpoints.
- [ ] **Privacy centre re-verification** — every phase-05 surface re-tested against the current system:
      consent and opt-out flows in both modes, GPC handling **on custom domains**, the preference
      centre's effect on the phase-10 tracking endpoint, and DSR submission per jurisdiction.
- [ ] **Notice diff surfacing** — the platform console shows the generated notice, its approval state,
      and the diff since last approval, so publishing an unreviewed notice takes a deliberate action.
- [ ] **Evidence pack access** — download packs from the platform console with the generating build and
      period stamped on the artifact; **access itself is audited**.
- [ ] **Accessibility and locale check on privacy surfaces** — these inherit TASK-027's gates and are
      verified in both locales, with no exemption for "internal" console screens that a DPO will read.

## Acceptance criteria

- [ ] Consent and opt-out flows behave correctly in **both** the opt-in and the notice-and-opt-out modes,
      proven by an e2e per mode.
- [ ] GPC on a tenant custom domain suppresses tracking on the very first request, verified from the UI
      as well as in the backend's drill.
- [ ] A preference change in the privacy centre changes what the phase-10 tracking endpoint accepts,
      proven end to end.
- [ ] DSR submission works per jurisdiction, with the jurisdiction-appropriate flow and copy.
- [ ] The console shows the generated notice, its approval state, and the diff since last approval;
      publishing without reviewing the diff is not reachable in a single click.
- [ ] Evidence packs download from the console with the generating build sha and period visible on the
      artifact **and** in the UI, and each access produces an audit entry.
- [ ] Every privacy surface passes axe with zero serious or critical findings in both locales, and is
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

The evidence pack generator, DSR live-fire drills, the provider completeness test, the breach tabletop,
erasure propagation, and the notice generator (backend TASK-029). Fixing a gap this task exposes: a gap
found here is a defect in the phase it came from and is fixed there.

## Files likely touched

- `apps/storefront/**` and `apps/admin/**` privacy centre routes (re-verification, no rewrite expected)
- `apps/platform-admin/src/routes/privacy/**` (notice diff and approval state, evidence pack download)
- `packages/api-client/**` (evidence pack, notice diff types)
- `packages/i18n` catalogs (`en`, `ja`) — notice approval and evidence copy
- e2e specs per consent mode and per jurisdiction

## Notes / gotchas

- Rollback: nothing here changes user-facing privacy behaviour — it verifies it and exposes generated
  artifacts. If a verification fails, the fix belongs in the phase that broke it.
- Never hand-edit a generated pack or notice to make it look right. The artifact's whole value is that it
  cannot describe a system other than the one running.
- The GPC-on-a-custom-domain case is the one most likely to be quietly broken: the signal arrives on the
  tenant's own domain, which is a code path phase 05 never saw.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
