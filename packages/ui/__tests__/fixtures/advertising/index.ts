import rawPlatforms from './capability-matrices.json' with { type: 'json' }
import type { AdPlatform } from '../../../src/forms/types'

/**
 * The fake adapter's three capability matrices (TASK-010), committed as the
 * shared form-engine fixtures. Copied verbatim from
 * `sanvi-backend/crates/contexts/advertising/fixtures/capability-matrices.json`
 * so engine tests need no running backend; when the backend's matrices
 * change, re-copy and note it in the task file.
 *
 * The third entry is the deliberately asymmetric "no real platform
 * implements this" network — TASK-013's proof that a new network needs no
 * frontend code renders against it.
 *
 * This file intentionally lives under `__tests__/` and speaks only matrix
 * data: the platform-literal gate scans `src/` trees, but more importantly
 * these identifiers are exactly what test data is allowed to know.
 */

export interface AdPlatformFixture {
  key: string
  display_name: string
  entitlement_key: string
  capability_matrix: AdPlatform['capability_matrix']
}

export const AD_PLATFORM_FIXTURES = rawPlatforms as AdPlatformFixture[]

export function fixturePlatformByKey(key: string): AdPlatformFixture | undefined {
  return AD_PLATFORM_FIXTURES.find((platform) => platform.key === key)
}

/** Builds the catalog view the admin page consumes from a fixture entry. */
export function platformViewFixture(
  fixture: AdPlatformFixture,
  overrides: Partial<AdPlatform> = {},
): AdPlatform {
  return {
    available: true,
    capability_matrix: fixture.capability_matrix,
    connection_state: 'not_connected',
    display_name: fixture.display_name,
    entitlement_key: fixture.entitlement_key,
    key: fixture.key,
    upgrade_required: false,
    ...overrides,
  }
}
