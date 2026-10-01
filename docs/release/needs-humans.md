# Phase 11 — work that needs people, money, devices, or traffic (frontend)

Phase 11 as originally written assumed a team, an external accessibility
auditor, a device lab, a CDN, and a running beta with real users. None of those
exist. This file is where the items that depend on them live, so that the task
graph in `docs/tasks/phase-11/` contains only work that can actually be executed
and verified today.

Nothing here is cancelled. Each item names what unblocks it. When that
precondition arrives, the item becomes a task with an ID; until then it is not a
dependency of anything, and no acceptance criterion anywhere refers to it.

The rule that keeps this file honest: **an acceptance criterion that cannot be
falsified by running a command is not an acceptance criterion.** Items below
fail that test for reasons of resourcing rather than of engineering.

## Needs real traffic

This is the largest deletion, and it changes the shape of the phase. The
original plan's governing invariant is "field data decides" — Core Web Vitals
judged at p75 in RUM over at least a week on the new build, with Lighthouse as
the regression guard only. There is no beta, there are no users, and there is
therefore no field data. Every acceptance criterion phrased as a field p75 was
unsatisfiable as written.

| Item | Was | Unblocked by |
| --- | --- | --- |
| RUM collection live in staging and beta, four weeks of field p75s | TASK-019, FR-1101 | Real traffic and a collector endpoint. The client-side collector is still built, sampled, directive-gated and PII-scrubbed, so turning it on later is configuration rather than a project. |
| Field LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 | TASK-022, NFR-1101, NFR-1102 | Real traffic. Replaced by the same three metrics measured on **pinned throttled profiles** in CI, which regress-guard the same work and are labelled lab everywhere they appear. |
| RUM segmented by route, tenant, locale, device class, theme revision | TASK-020, FR-1105 | Real traffic. The segmentation dimensions are still attached to every event at collection time; only the querying waits. |
| Release health flagging a regression against the previous release | TASK-020 | Two releases with traffic between them. |
| The worst-ten-routes list chosen from field data | TASK-019 | Real traffic. The list is produced from the lab harness instead, and the substitution is recorded next to it — a lab-chosen work queue is a weaker signal than a field-chosen one, and that is a real loss. |

## Needs a vendor or a budget

| Item | Was | Unblocked by |
| --- | --- | --- |
| An error-tracking vendor to receive the tracker's reports, and the private source-map upload that resolves their stack traces | TASK-020, FR-1104 | A vendor account and its upload pipeline. Everything on the way there exists and is gated: the tracker is built, scrubbed, release-tagged and directive-gated; maps are generated and staged privately (`sourcemaps-private/` with an upload manifest) and proven unreachable from any public URL (`check:sourcemaps-not-served`). Until a vendor exists the tracker stays unwired in-app — enabling transmission with nowhere to send it would be collection for collection's sake. |
| External WCAG 2.2 AA audit, findings triaged and remediated before GA | TASK-027, FR-1121, NFR-1110 | Budget and a booked engagement. This is the largest unmitigated gap on the frontend side and is named as such in the GA checklist. Replaced meanwhile by blocking axe across every route × locale × theme, keyboard-only e2e of the critical journeys, a VoiceOver pass, and published-theme contrast gates. |
| Published accessibility statement claiming conformance | TASK-027 | The audit. A statement is still published, but it says what was tested and by what method, and names the missing external audit as a known gap. Claiming AA conformance without an audit would be the one accessibility failure that is also a false statement. |
| NVDA and JAWS screen-reader passes | TASK-027, FR-1119 | A Windows machine and licences. VoiceOver on macOS is run instead and the gap is named in the statement. |
| Frontend penetration-test findings and their remediation | TASK-024 | Budget, shared with the backend engagement. |
| A real CSP report-only staging cycle with a violation collector endpoint, before production enforcement at the edge | TASK-024 | A staging host (see the deploy row below) and a collector for the `securitypolicyviolation` reports. Replaced locally by a full report-only exercise: every app's e2e suite ran with a `securitypolicyviolation` collector under the enforced tightened policy (`apps/*/e2e/csp.spec.ts`) and recorded zero violations; the exercise caught and fixed two real findings (unprotected prerendered marketing pages; the pricing page's client-side API call). What a staging cycle adds that the lab cannot: real third-party integrations, real user extensions, and the production edge's own headers. |
| Dev-dependency advisories with no in-range fix (Lighthouse CI's `extract-zip`, unpatched upstream; `vitest`/`@vitest/mocker` path-traversal, patched only in the v4 major; `uuid@8` under LHCI) | TASK-024 | Upstream releases, or the tooling upgrades (vitest v4 migration is its own task; `@lhci/cli` bump). The production dependency tree is advisory-free and the `pnpm audit --prod --audit-level=moderate` gate is blocking; the full tree is reported, not enforced. |

## Needs devices or infrastructure

| Item | Was | Unblocked by |
| --- | --- | --- |
| Real mid-range Android and iOS Safari testing | TASK-022, TASK-030 | Devices or a device-farm subscription. Pinned Playwright emulation and CPU/network throttling profiles are used instead. An emulated mid-range Android is not a mid-range Android, and INP conclusions drawn from one are weaker than they look. |
| Browser matrix on Edge and on the last two versions of each browser | TASK-030, FR-1124 | A browser grid. Playwright runs Chromium, Firefox and WebKit locally, which covers the three engines but not the vendor builds. |
| CDN image transforms and size caps for tenant uploads | TASK-022, FR-1109 | A CDN. Dimensions, `srcset`, modern formats and lazy-loading are all done in-app regardless; only the server-side transform waits. |
| Public status page hosted outside the perimeter | TASK-025, FR-1115 | A host that survives an API outage. The page is built and reads the backend's `/ready`, but a page served by the infrastructure it reports on is unavailable exactly when it matters — that limitation is documented on the page itself rather than hidden. |
| Backend external probes feeding the status page | TASK-025 | Backend infrastructure — see the backend's own `needs-humans.md`. |
| Deploying each merged task to a staging environment behind its flag | every task's DoD, phases 09–11 | A host and a build pipeline. Neither repository has a git remote, so nothing can be pushed. Replaced in the DoD by `pnpm build` plus the app's `preview` script — a real production build, served — exercised in both flag positions. |
| Security headers on the responses no app process serves — `adapter-node`'s static middleware serves marketing's prerendered pages without running `hooks.server.ts` (and a baked meta CSP cannot carry `frame-ancestors`; browsers ignore it in meta form), and the SPAs' static hosts serve every file they have | TASK-024 | The production edge — the CDN/reverse proxy in front of the Node service, and the SPAs' static host — setting the full `buildSecurityHeaders()` record (`nosniff`, `referrer-policy`, `X-Frame-Options: DENY`, permissions-policy, HSTS for non-localhost) on every static response, from the same builder the hooks and the vite configs already use. Without it the prerendered pages ship with a CSP but no clickjacking or MIME-sniffing protection at all. |
| CI actually running any gate on a pushed branch | TASK-031, and every task's CI claim | A git remote. The workflows are written and self-tested, but no run of them exists; every task that says a gate "blocks CI" means it blocks `pnpm check:all` locally. |

## Needs a second person

| Item | Was | Unblocked by |
| --- | --- | --- |
| Two-person confirmation on the tenant purge step | TASK-028, FR-1122 | A second operator. Replaced by a typed confirmation naming the tenant, gated behind a verified export. |
| Onboarding path verified by a new engineer following it unaided | TASK-030, FR-1126 | A new engineer. The guide is still written and its commands are still executed end to end, but "someone followed it" and "it reads fine" are different claims and only the weaker one is available. |
| Manual accessibility passes with a *named runner* per app | TASK-027, FR-1119 | A second person. The passes are still run and recorded; the runner is the same person every time. |

## What this costs

**Performance confidence.** Lab numbers on pinned profiles catch regressions
between two builds. They do not tell you what a real user on a real mid-range
phone on a real network experiences, and the Japanese storefront with a heavy
CJK font and an expensive published theme is exactly the case where lab and
field diverge most. The work still gets done; the confidence in it is lower than
the original plan implied, and every number says so.

**Accessibility assurance.** Automated axe catches roughly a third of WCAG
issues. Keyboard-only e2e, a VoiceOver pass, and contrast gates over real
published themes catch a good deal more. An external auditor catches the rest,
and there is no substitute for that — which is why the accessibility statement
describes the method rather than asserting conformance.
