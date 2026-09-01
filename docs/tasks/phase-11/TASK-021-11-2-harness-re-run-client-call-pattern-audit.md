# TASK-021: 11.2 Harness re-run & client call-pattern audit

**Phase:** 11 · **Status:** todo · **Size:** S
**Requirement(s):** FR-1103, NFR-1107
**Depends on:** TASK-020, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-021 (profiling, query review, N+1 removal)
**Flag:** none

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Two obligations that would otherwise fall between the two repositories and be done by neither: record
what the backend's performance slice did to frontend numbers, and diagnose which N+1s are actually
client patterns.

## Why this shape

The backend owns all the work in slice 11.2. This task is deliberately small; **its value is that it
happens at all.**

The measurement matters because SSR latency feeds LCP: a 50 ms server improvement is a real frontend
improvement, and it belongs in the same benchmark file as everything else rather than being invisible
because nobody re-ran the harness.

The audit matters because **an N+1 is often a client pattern.** A projection built to serve a loop the
client should not be running is a permanent cost paid to avoid a one-line fix. Timing is the whole
point: the audit is only useful **before** the backend decides which projections to build. Delivered
afterwards it is an interesting document about work already done.

## Constraints

- **Fix nothing.** This task measures and diagnoses. Client fixes land in TASK-022; backend batching
  lands in backend TASK-021.
- Every finding gets a disposition. **An unassigned finding is the one that gets fixed by adding a
  projection nobody needed.**

## File ownership map

- `benchmarks/frontend/rc.3.json`
- `docs/perf/call-pattern-audit.md` — the list with dispositions
- no source changes expected

## Steps

### Step 1: Re-run all three harnesses

**Files:** Create `benchmarks/frontend/rc.3.json`

**Do:** all three TASK-031 harnesses across four apps × two locales, after the backend's changes land,
on the same pinned profile.

**Verify:** `pnpm bench:compare rc.1 rc.3` runs and no frontend budget regressed. Any LCP movement is
noted and attributed to the backend slice.

### Step 2: Walk every call site for loop patterns

**Files:** Create `docs/perf/call-pattern-audit.md`

**Do:** during the backend's profiling sweep, find every endpoint called in a loop, per-row, or once
per rendered item. Give each one a disposition: **backend batch candidate**, **TASK-022 client fix**,
or **accepted with a reason**.

**Verify:** every entry has a disposition; none is blank.

### Step 3: Capture waterfalls for the worst ten routes

**Files:** Modify `docs/perf/call-pattern-audit.md`

**Do:** for each route in `docs/perf/worst-ten.md`, capture the request waterfall and identify
serialised requests that could be parallel or hoisted into the SSR pass.

**Verify:** a waterfall is recorded per route with serialised requests marked.

### Step 4: Hand the list over before the projection work starts

**Files:** `docs/perf/call-pattern-audit.md`

**Do:** deliver the list to the backend track. **If the audit finds nothing, say so explicitly in the
file** rather than leaving it empty — an empty file reads as "not done" to the next session.

**Verify:** the file has a dated handover note, or an explicit "no findings" statement.

## Definition of done

- [ ] `benchmarks/frontend/rc.3.json` is committed and compared against `rc.1`.
- [ ] No frontend budget regressed against `rc.1`.
- [ ] Every endpoint called in a loop, per-row, or once per rendered item is listed with a disposition.
- [ ] Waterfalls for the worst-ten routes are captured with serialised requests identified.
- [ ] The list was handed to the backend track **before** its projection work started, with a date.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:budget --report-only
pnpm check:lighthouse --report-only
pnpm bench:compare rc.1 rc.3
```

## Out of scope

Fixing anything.

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
