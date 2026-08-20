# TASK-021: 11.2 Harness re-run & client call-pattern audit

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1103, NFR-1107
**Depends on:** TASK-020
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-021 (profiling, query review, N+1 removal)
**Slice:** 11.2 — Backend performance, load testing & capacity model (frontend obligations)
**Prerelease:** `v1.0.0-rc.3` · **Flag:** none

## Context

The backend owns all the work in slice 11.2. This repo owns two obligations that would otherwise fall
between the two tracks and be done by neither.

The first is a measurement: SSR latency feeds LCP, so a 50 ms server improvement is a real field
improvement, and it belongs in the same benchmark file as everything else rather than being invisible
because nobody re-ran the harness. The second is a diagnosis: **an N+1 is often a client pattern.** A
projection built to serve a loop the client should not be running is a permanent cost paid to avoid a
one-line fix.

This is a deliberately small task. Its value is that it happens at all.

## What to do

- [ ] **Contract** — none. No shape changes on either side of slice 11.2.
- [ ] **Re-run the harness** — all three TASK-019 harnesses across four apps × two locales after the
      backend's changes land, committed as `benchmarks/frontend/rc.3.json` and compared against `rc.1`.
      Server-side improvements that move LCP are recorded here, attributed to the backend slice.
- [ ] **Client call-pattern audit** — during the backend's profiling sweep, walk the frontend's call
      sites and flag every endpoint called in a loop, per-row, or once per rendered item. Each one is
      either a legitimate batch candidate for the backend or a client fix for TASK-022's prefetch and
      batching work. Produce the list with a disposition per entry — **an unassigned finding is the one
      that gets fixed by adding a projection nobody needed.**
- [ ] **Waterfall review** — for the worst-ten routes from TASK-019, capture the request waterfall and
      identify serialised requests that could be parallel or hoisted into the SSR pass.

## Acceptance criteria

- [ ] `benchmarks/frontend/rc.3.json` is committed and compared against `rc.1`, with any LCP movement
      attributable to the backend slice noted.
- [ ] No frontend budget regressed against `rc.1`.
- [ ] Every endpoint the frontend calls in a loop, per-row, or once per rendered item is listed with a
      disposition: backend batch candidate, TASK-022 client fix, or accepted with a reason.
- [ ] Waterfalls for the worst-ten routes are captured, with serialised requests identified.
- [ ] The list is handed to the backend track before its projection work starts, not after.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:budget --report-only
pnpm check:lighthouse --report-only
```

## Out of scope

Fixing anything. The client-side fixes land in TASK-022; the backend-side batching lands in backend
TASK-021. This task measures and diagnoses only.

## Files likely touched

- `benchmarks/frontend/rc.3.json`
- `docs/perf/call-pattern-audit.md` (the list with dispositions)
- no source changes expected

## Notes / gotchas

- Rollback: nothing deployed changes.
- Timing matters more than content here. The audit is only useful **before** the backend decides which
  projections to build; delivered afterwards it is an interesting document about work already done.
- If this task finds nothing, say so explicitly in the audit file rather than leaving it empty. An empty
  file reads as "not done" to the next session.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-021 done --note "<PR or commit>"`
