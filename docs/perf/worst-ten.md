# Worst ten routes per app — the TASK-022 work queue

**This list is lab-derived.** It comes from `benchmarks/frontend/rc.1.json` — the first full run of
the three TASK-031 harnesses (per-route bundle budgets, Lighthouse under the pinned
`midrange-android` profile, axe sweep) across four apps × two locales, on pinned Chrome
`152.0.7977.8`. There is no field data and no traffic; a lab-chosen work queue is a weaker signal
than a field-chosen one, and that substitution is recorded in
[`../release/needs-humans.md`](../release/needs-humans.md) ("Needs real traffic"). It ranks where
the bytes and lab milliseconds are, not where real users hurt.

**Method.** Routes are ranked by their per-route first-party JS (gzip KB) from the artifact's
`budget.<app>.routes[]` — the one metric the harness records for *every* route. Lighthouse covers
only the representative URLs the harness serves (SvelteKit apps per locale via the `/{locale}`
prefix; the SPAs' locale signal is a cookie Lighthouse cannot set, so their entries are the default
locale — recorded honestly in the artifact, not hidden); where a route has a Lighthouse entry, its
numbers are quoted beside the payload. Every figure below is traceable to a metric in
`rc.1.json` (`profile` block embedded). axe found **0 critical / 0 serious** findings across all
85 routes × both locales; the moderate findings are TASK-027's inventory, not TASK-022's.

Apps with fewer than ten routes list all of them.

## storefront (initial 167.8 / budget 180 KB — all routes inside their 6 KB budget)

| Route | Route JS (gzip) | Lighthouse (lab, midrange-android) |
|---|---|---|
| `/checkout/return` | 4.54 KB | — |
| `/privacy/choices` | 2.91 KB | — |
| `/privacy/requests` | 2.51 KB | — |
| `/privacy/requests/[id]` | 2.17 KB | — |
| `/privacy/erasure` | 2.14 KB | — |
| `/privacy/agent` | 2.03 KB | — |
| `/privacy` | 1.99 KB | — |
| `/link` | 1.67 KB | — |
| `/settings/security` | 1.63 KB | — |
| `/legal/privacy-notice` | 1.55 KB | — |

Representative URLs (not route-ranked): `/` perf 1.00, LCP 1451 ms; `/ja/` perf 0.93, LCP 1977 ms,
CLS 0.1369 — the Japanese home page is the storefront's weakest lab number and the one the
implementation plan warns about (CJK font weight + published theme).

## marketing (initial 138.8 / budget 150 KB — only three routes exist; all listed)

| Route | Route JS (gzip) | Lighthouse (lab, midrange-android) |
|---|---|---|
| `/pricing` | 8.80 KB | — |
| `/` | 1.74 KB | perf 0.97, LCP 2125 ms |
| `/signup` | 1.05 KB | — |

`/ja/` (not route-ranked): perf 0.93, LCP 2534 ms, CLS 0.0034 — the slowest LCP in the artifact.

## admin (45 routes; per-route budget 16 KB — all inside it)

| Route | Route JS (gzip) |
|---|---|
| `/payments/settings` | 12.78 KB |
| `/advertising/dashboard` | 12.10 KB |
| `/advertising/creatives` | 11.20 KB |
| `/advertising/campaigns/new` | 11.18 KB |
| `/advertising/campaigns/:id/edit` | 11.18 KB |
| `/domains/purchase` | 8.32 KB |
| `/advertising/budget` | 8.03 KB |
| `/advertising/diagnostics` | 7.41 KB |
| `/payments/:id` | 7.02 KB |
| `/domains/connect` | 6.61 KB |

Lighthouse (`/`, default locale — the SPA cookie limitation): perf 0.90, LCP 2891 ms.

## platform-admin (13 routes; per-route budget 9 KB — all inside it)

| Route | Route JS (gzip) |
|---|---|
| `/tenants/:id` | 7.04 KB |
| `/privacy` | 7.03 KB |
| `/impersonations` | 2.96 KB |
| `/features` | 2.89 KB |
| `/` | 2.49 KB |
| `/translations` | 2.05 KB |
| `/roles` | 1.91 KB |
| `/approvals` | 1.89 KB |
| `/audit` | 1.49 KB |
| `/settings/security` | 1.46 KB |

Lighthouse (`/`, default locale): perf 0.91, LCP 2779 ms.

## What this queue says (and what it cannot)

The heavy routes are the phase 09/10 surfaces — payments, advertising, domains — exactly the screens
built since the last budget attention, and the SPAs' LCP figures (~2.8–2.9 s) sit above the 2.0 s
storefront target even though they ship no marketing payload. But these are lab numbers on pinned
emulation: they catch regressions between builds, and they do not say what a real mid-range phone on
a real network experiences. TASK-022 scopes its optimisation work from this list; when traffic
exists, the list is re-derived from field data per
[`../release/needs-humans.md`](../release/needs-humans.md).
