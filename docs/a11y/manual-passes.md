# Accessibility manual passes — phase 11 (TASK-027, slice 11.8)

Record of the accessibility passes over the four apps (`storefront`, `marketing`,
`admin`, `platform-admin`), what ran, when, and what was **not** run. The rule
that governs this file is the phase's honesty rule: a pass that was not executed
is recorded as not executed, never implied.

**Execution environment (2026-10-13):** Windows host, Chrome-for-Testing 152
(pinned), Playwright-driven scripted passes. No macOS device, no screen-reader
software, no human assistive-technology tester was available — see "Not run"
below and `docs/release/needs-humans.md`.

## Pass inventory per app

### Keyboard-only

| App | Pass | Date | Evidence |
| --- | --- | --- | --- |
| storefront | Keyboard-only checkout: consent banner accept, Tab walk to the pay control, Enter, redirect, confirmation — no mouse activation anywhere | 2026-10-13 | `apps/storefront/e2e/keyboard-journeys.spec.ts` (chromium, green) |
| admin | Skip link → main region focus; domain-connect wizard end to end (type, Enter-activate each step, poll to live); plan change (Tab to "Change Plan" tab link, Enter, "Change to this plan", portal hand-off) | 2026-10-13 | `apps/admin/e2e/keyboard-journeys.spec.ts` (chromium, green) |
| admin | Campaign connect → build → publish → pause → change log → resume → drift → suppression → budget auto-pause, keyboard-driven throughout | 2026-10-13 | `apps/admin/e2e/advertising-journey.spec.ts` (pre-existing, green) |
| platform-admin | Skip link → main region focus | 2026-10-13 | `apps/platform-admin/e2e/keyboard-journeys.spec.ts` (chromium, green) |
| marketing | Skip link → main focus; footer locale navigation keyboard operable (Enter on 日本語 → `/ja`) | 2026-10-13 | `apps/marketing/e2e/keyboard-journeys.spec.ts` (chromium, green) |

Checklist used (every journey): every control reachable by Tab; focus visible
via programmatic focus assertions; Enter/Space activates; dialogs return focus
to the trigger on close (`packages/ui` Dialog/Drawer unit tests); route changes
move focus to the main region and announce the page title (SPA announcer);
nothing traps focus except native `<dialog>`.

These are **scripted** keyboard passes: a machine walked the journeys the way a
keyboard user would, and asserts focus/activation programmatically. They are
stronger than nothing and weaker than a human pass with real AT — the
difference is recorded rather than smoothed over.

### Zoom 400 % / 320 px reflow

| App | Locales | Date | Evidence |
| --- | --- | --- | --- |
| storefront | en, ja (home + checkout) | 2026-10-13 | `apps/storefront/e2e/reflow.spec.ts` under the `reflow-400` project; screenshots in `docs/a11y/screenshots/storefront-*-reflow-320.png` |
| marketing | en, ja | 2026-10-13 | `apps/marketing/e2e/reflow.spec.ts`; `docs/a11y/screenshots/marketing-*-reflow-320.png` |
| admin | en, ja (home, billing, advertising dashboard) | 2026-10-13 | `apps/admin/e2e/reflow.spec.ts`; `docs/a11y/screenshots/admin-*-reflow-320.png` |
| platform-admin | en, ja (home, tenant detail, audit) | 2026-10-13 | `apps/platform-admin/e2e/reflow.spec.ts`; `docs/a11y/screenshots/platform-admin-*-reflow-320.png` |

Checklist used (every route × locale): no horizontal document scroll at the
320 px viewport (`scrollWidth ≤ innerWidth`); no heading/control text clipped
or spilling its box (deliberate ellipsis truncation excepted); full-page
screenshot captured and reviewed.

### Reduced motion

Date: 2026-10-13. Evidence: `apps/storefront/e2e/assistive.spec.ts` — with
`prefers-reduced-motion: reduce` emulated, the product's one animated surface
(the Spinner) slows to 1.5 s per rotation, exactly as its stylesheet declares.

Motion inventory (what could animate, what actually does): charts carry no
animation; the theme previewer and admin screens carry no animation; the theme
blocks transition only colours (150 ms), which are not vestibular triggers;
the Spinner is the sole animated element and honours the media query.

### Forced colours

Date: 2026-10-13. Evidence: `apps/storefront/e2e/assistive.spec.ts` — with
`forced-colors: active` emulated, the page renders from system colours with no
horizontal overflow (screenshot: `docs/a11y/screenshots/storefront-en-forced-colors.png`).
The product's surfaces are token-driven (`check:tokens` gates raw colours out
of component CSS), which is what keeps forced-colours degradation graceful.

## Not run — recorded as not run

- **VoiceOver (macOS): not run.** The pass environment is Windows; no macOS
  device was available, so the screen-reader pass the phase planned for
  VoiceOver did not happen. This is a gap in every statement published by
  TASK-027 step 10, which names it.
- **NVDA and JAWS: not run** (no Windows screen-reader licences). Long-parked
  in `docs/release/needs-humans.md`.
- **A human assistive-technology user was not part of any pass.** Everything
  above is scripted emulation or programmatic assertion; nothing here replaces
  testing with disabled users.

## Screenshots

`docs/a11y/screenshots/` holds one full-page capture per app per locale at the
320 px reflow width (plus the forced-colours capture), all dated 2026-10-13.
They are evidence, not baselines: no spec compares against them. Reviewer note
for each: check that content columns stack, no text is clipped at the right
edge, and controls remain full-width and tappable.
