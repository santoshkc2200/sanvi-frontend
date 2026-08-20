# TASK-025: 11.6 Status page, degraded banners & restore-in-progress

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1115, NFR-1109
**Depends on:** TASK-023
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-025 (`/system/health`, `/system/ready`, external probes)
**Slice:** 11.6 — Disaster recovery, secret rotation & on-call readiness
**Prerelease:** `v1.0.0-rc.7` · **Flag:** `platform.status_probes` (backend-owned)

## Context

The public face of the disaster-recovery slice. Three surfaces, each with the same underlying rule:
**the page tells the truth from the same signal the operators are acting on**, never from a separate
manual toggle that someone forgets to flip back.

A status page that only speaks English fails half the users during the one event they need it, so both
locales are a requirement rather than a follow-up, and the incident templates are written before the
incident.

The restore-in-progress state exists for a specific failure: during a single-tenant restore, that
tenant's admin would otherwise render an empty dataset, and an empty dataset reads as data loss.

## What to do

- [ ] **Contract** — consume `GET /api/v1/system/health` and `GET /api/v1/system/ready` (both
      unauthenticated, readiness reporting **states** only) plus the probe results feeding the status
      page. Nothing on these surfaces may expose hostnames, versions, or error strings.
- [ ] **Status surface** — a public status page fed by the probes, **in both locales**, with incident
      history; linked from the marketing footer and from the admin outage screens built in TASK-023.
- [ ] **Incident templates** — prepared in both locales ahead of time, covering the six SLO journeys, so
      an operator publishes rather than composes during an incident.
- [ ] **Maintenance and degraded banners** — driven by the same signal operators set, not by a separate
      manual toggle. Dismissible where informational, **persistent where the user's action would fail**.
- [ ] **Restore-in-progress experience** — when a tenant is being restored, that tenant's admin shows an
      honest state rather than an empty dataset that reads as data loss.

## Acceptance criteria

- [ ] The status page renders from live probe results in both `en` and `ja`, with incident history, and
      is reachable from the marketing footer and the admin outage screens.
- [ ] The status page renders correctly **while the API is down** — it does not depend on the system it
      reports on.
- [ ] Incident templates exist for all six SLO journeys in both locales.
- [ ] A degraded or maintenance signal set by an operator appears in the app without a second manual
      action, and clearing it removes the banner.
- [ ] An informational banner is dismissible; a banner warning that the user's action would fail is not.
- [ ] A tenant under restore sees an honest restore-in-progress state, never an empty dataset.
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

Backups, restore drills, PITR, single-tenant restore mechanics, credential rotation, and on-call rotation
(backend TASK-025). Error boundaries and per-app outage screens (TASK-023) — this task links to them and
supplies the banner signal.

## Files likely touched

- `apps/marketing/src/routes/status/**` (public status page, incident history)
- `packages/ui/**` (maintenance and degraded banner primitives, restore-in-progress state)
- `packages/api-client/**` (health, readiness, probe result types)
- `apps/admin/**` (restore-in-progress state, banner host)
- `packages/i18n` catalogs (`en`, `ja`) — status, incident templates, banner and restore copy

## Notes / gotchas

- Rollback: the backend's `platform.status_probes` off silences probe traffic and the page falls back to
  manual updates. The banners degrade to nothing shown, which is the pre-slice behaviour.
- The status page must not be served by the infrastructure it reports on. Host it so that a full API
  outage still renders it — otherwise it is a page that is only unavailable exactly when it matters.
- Incident copy written under pressure is copy written badly and in one language. Write both locales now.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-025 done --note "<PR or commit>"`
