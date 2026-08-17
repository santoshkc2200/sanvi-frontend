/**
 * Server-only entry point (`@sanvi/tenant/server`) — kept out of the
 * package's default export map because `resolve-host.ts` imports `node:http`
 * directly (see its top comment for why `fetch` can't do this job). Only
 * `apps/storefront/src/hooks.server.ts` should import from here.
 */
export type {
  FetchTenantContextOptions,
  TenantHostCacheOptions,
  TenantResolution,
} from './resolve-host'
export {
  fetchTenantContext,
  resolveTenantForHost,
  TenantHostCache,
  TenantResolutionError,
} from './resolve-host'
export type { TenantContext, TenantRuntimeStatus } from './types'
