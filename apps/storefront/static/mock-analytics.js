/**
 * A stand-in third-party analytics integration served from this origin.
 * Its only job is to exist as a gated, observable network request: e2e
 * specs assert that this file is fetched only when the `analytics` purpose
 * is allowed, which is the network-level proof the phase-05 plan asks for.
 * Phase 10's storefront beacon replaces it with the real thing.
 */
window.__sanviMockAnalyticsLoaded = true
