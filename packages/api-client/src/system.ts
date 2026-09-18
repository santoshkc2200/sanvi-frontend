import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

/** Release stamp of the running backend (`GET /api/v1/system/build`). */
export type BuildDetails = components['schemas']['BuildDetails']

/**
 * `GET /api/v1/system/build` — the build probe (FR-1102). Unauthenticated
 * and `Cache-Control: public, max-age=60`, so any client can name the exact
 * deployment a measurement belongs to; the response carries the four stamp
 * fields and nothing else — no tenant data by contract. This is the release
 * tag TASK-019's collector and TASK-020's error tracker stamp every payload
 * with.
 */
export function getSystemBuild(
  client: TypedApiClient,
  signal?: AbortSignal,
): Promise<BuildDetails> {
  return client.GET('/api/v1/system/build', signal ? { signal } : undefined)
}
