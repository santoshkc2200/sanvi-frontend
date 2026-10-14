import { ApiError } from './problem'

/**
 * The machine-readable `reason` a read returns when its requested window
 * overlaps archived storage (TASK-028, FR-1129; sanvi-backend TASK-028): a
 * `409` conflict that says "this window is in cold storage, restore it first"
 * instead of answering with a silently-partial result. An absence must never
 * render as a zero — the caller shows the archived-range state instead.
 */
export const ARCHIVED_RANGE_REASON = 'archived-range'

/** What the wire gives a surface to name the situation — the requested window comes from the surface's own query state. */
export interface ArchivedRangeInfo {
  /** The problem's trace id — what support quotes; undefined when absent. */
  readonly traceId: string | undefined
}

/**
 * A ranged read's result: the data, or the statement that the window is
 * archived. The two variants are deliberately opaque to each other — the
 * archived variant carries no `data` member, so a caller that forgets to
 * branch fails to compile rather than rendering an empty chart or a zero.
 */
export type RangedResult<T> =
  | { readonly archived: false; readonly data: T }
  | { readonly archived: true; readonly info: ArchivedRangeInfo }

/**
 * Narrows an unknown throw to the archived-range case — the sibling of
 * {@link isRateLimited}: prefer this over `error.reason === 'archived-range'`
 * at call sites, so a network failure or a server error never renders as an
 * archived state.
 */
export function isArchivedRange(
  error: unknown,
): error is ApiError & { readonly status: 409; readonly reason: typeof ARCHIVED_RANGE_REASON } {
  return error instanceof ApiError && error.status === 409 && error.reason === ARCHIVED_RANGE_REASON
}

/**
 * Runs one ranged read and folds the archived-range refusal into the result
 * instead of the throw path. Every other failure rethrows — a `500` is an
 * error state, not an archived one.
 */
export async function rangedRead<T>(read: () => Promise<T>): Promise<RangedResult<T>> {
  try {
    return { archived: false, data: await read() }
  } catch (error) {
    if (isArchivedRange(error)) {
      return { archived: true, info: { traceId: error.traceId } }
    }
    throw error
  }
}
