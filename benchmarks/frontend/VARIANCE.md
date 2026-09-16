# Run-to-run variance on a fixed build — the record TASK-031's DoD asks for

Three consecutive `check:lighthouse` invocations against the **same build**
(commit `9948d66`), pinned profile (`scripts/perf-profiles.json`:
midrange-android, devtools throttling, Chrome 152.0.7977.8, Lighthouse
12.6.1, 3 runs per URL, median recorded). Raw artifacts:
`/tmp/lh-var-run{1,2,3}.json` at measurement time; the medians below are the
record.

## Medians per invocation, and their spread across invocations

| URL | LCP medians (ms) | LCP spread | TBT medians (ms) | TBT spread | Perf medians | Perf spread |
|---|---|---|---|---|---|---|
| storefront/ [en] | 1411 / 1470 / 1432 | 59 ms | 2 / 0 / 3 | 3 ms | 1.00 / 0.98 / 1.00 | 0.02 |
| storefront/ja/ [ja] | 1994 / 2130 / 2003 | 136 ms | 0 / 0 / 103 | 103 ms | 0.92 / 0.92 / 0.92 | 0 |
| marketing/ [en] | 2004 / 1990 / 1997 | 14 ms | 0 / 0 / 0 | 0 ms | 0.98 / 0.98 / 0.98 | 0 |
| marketing/ja/ [ja] | 2591 / 2602 / 2529 | 73 ms | 0 / 11 / 0 | 11 ms | 0.92 / 0.92 / 0.93 | 0.01 |
| admin/ [en] | 2937 / 2812 / 2800 | 137 ms | 0 / 0 / 0 | 0 ms | 0.90 / 0.91 / 0.91 | 0.01 |
| platform-admin/ [en] | 2838 / 2788 / 2797 | 50 ms | 0 / 0 / 0 | 0 ms | 0.91 / 0.91 / 0.91 | 0 |

Within a single invocation, individual runs (before the median) are noisier:
one storefront/ja/ invocation saw per-run TBT spread of ±765 ms and
performance spread of ±0.19. The median-of-3 absorbs that; the
across-invocation medians above are what stayed stable.

## What this means for TASK-022's thresholds

- **Median LCP is stable to within ~6 %** (worst case 137 ms) on a fixed
  build. A regression gate on median LCP below ~10 % would be gating noise.
- **Median TBT is stable on every URL except storefront/ja/**, where one
  invocation's median jumped to 103 ms. The phase target is TBT ≤ 200 ms;
  gating TBT on medians needs either more runs per URL or a threshold wide
  enough for this outlier — TASK-022 should decide with this record in hand.
- **Category scores are stable to ±0.02**; a 0.05-score gate is safe.

## Lab findings for TASK-022's work queue (not remediated here)

`marketing/ja` (LCP ≈ 2.6 s) and the SPAs (LCP ≈ 2.8–2.9 s) already miss the
phase's 2.0 s LCP target before any optimisation work starts; the Japanese
storefront pays the predicted font/layout cost (LCP +40 % vs English,
CLS 0.14). Every number here is a **lab** number under emulation — see
`scripts/perf-profiles.json`'s meta notes.
