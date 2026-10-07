import { ensureLocaleLoaded } from '@sanvi/i18n'
import type { LayoutLoad } from './$types'

/**
 * TASK-022: hydration does not render until the negotiated locale's catalog
 * shards are loaded. The ja catalog is a lazy chunk (TASK-032); without this
 * await, hydration recomputes every `t()`-derived string against the empty
 * ja catalog and falls back to English — the SSR'd Japanese banner visibly
 * flipped to English and re-flowed (the ja CLS 0.1369/0.14–0.18 in the
 * rc.1/rc.3 baselines, measured as one ~28 px consent-banner shift right at
 * hydration), and the same en-flash sat behind the storefront locale e2e
 * failures every task since TASK-014 has reproduced and re-recorded. On the
 * server this is an instant no-op (the surface registrar loads shards at
 * module scope); on the client it serialises one small chunk fetch ahead of
 * the first client render, which is exactly the trade worth making: a
 * marginally later hydration that agrees with the document it hydrates.
 */
export const load: LayoutLoad = async ({ data }) => {
  await ensureLocaleLoaded(data.locale)
  // Pass the server layout's data through untouched — a `+layout.ts` return
  // replaces what the component sees, and this load exists only to sequence
  // the catalog ahead of hydration, not to add data of its own.
  return data
}
