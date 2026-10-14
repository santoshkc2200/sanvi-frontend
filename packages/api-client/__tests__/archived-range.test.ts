import { describe, expect, it, expectTypeOf } from 'vitest'
import { ApiError } from '../src/problem'
import {
  ARCHIVED_RANGE_REASON,
  isArchivedRange,
  rangedRead,
  type RangedResult,
} from '../src/archived-range'

function archivedRangeError(): ApiError {
  return new ApiError(
    409,
    {
      type: 'https://sanvi.app/problems/conflict',
      title: 'Conflict',
      status: 409,
      detail: 'the requested window overlaps archived storage',
      reason: 'archived-range',
      trace_id: 'trace-123',
    },
    'req-1',
  )
}

describe('isArchivedRange', () => {
  it('narrows a 409 whose reason is archived-range', () => {
    const error = archivedRangeError()
    expect(isArchivedRange(error)).toBe(true)
    if (isArchivedRange(error)) {
      expect(error.status).toBe(409)
      expect(error.traceId).toBe('trace-123')
    }
  })

  it('rejects a conflict with a different reason', () => {
    const error = new ApiError(
      409,
      {
        type: 'https://sanvi.app/problems/conflict',
        title: 'Conflict',
        status: 409,
        detail: 'offboarding conflict',
        reason: 'offboarding-conflict',
      },
      'req-1',
    )
    expect(isArchivedRange(error)).toBe(false)
  })

  it('rejects the same reason on a non-409 status', () => {
    const error = new ApiError(
      423,
      {
        type: 'https://sanvi.app/problems/tenant-locked',
        title: 'Locked',
        status: 423,
        detail: 'tenant is archived',
        reason: 'archived-range',
      },
      'req-1',
    )
    expect(isArchivedRange(error)).toBe(false)
  })

  it('rejects non-ApiError throws', () => {
    expect(isArchivedRange(new Error('nope'))).toBe(false)
    expect(isArchivedRange(undefined)).toBe(false)
  })
})

describe('rangedRead', () => {
  it('returns the data with archived: false on success', async () => {
    const result = await rangedRead(async () => ({ rows: [1, 2, 3] }))
    expect(result).toEqual({ archived: false, data: { rows: [1, 2, 3] } })
  })

  it('returns the archived variant — never throws — when the read refuses with archived-range', async () => {
    const result = await rangedRead<never>(async () => {
      throw archivedRangeError()
    })
    expect(result.archived).toBe(true)
    if (result.archived) {
      expect(result.info.traceId).toBe('trace-123')
      expect(ARCHIVED_RANGE_REASON).toBe('archived-range')
    }
  })

  it('rethrows every other failure — a 500 must not render as an archived state', async () => {
    const serverError = new ApiError(
      500,
      { type: 'about:blank', title: 'Internal', status: 500, detail: 'boom' },
      'req-1',
    )
    await expect(
      rangedRead(async () => {
        throw serverError
      }),
    ).rejects.toBe(serverError)
  })

  it('the archived variant carries no data — a caller that forgets to branch fails to compile', async () => {
    const result = await rangedRead(async () => ({ rows: [1] }))
    if (result.archived) {
      // @ts-expect-error — the archived variant must not be assignable to the
      // normal result type; if this assignment ever compiles, a caller can
      // render an absence as a zero without the compiler stopping it.
      const data: { rows: number[] } = result
      expect(data).toBeUndefined()
    }
    expectTypeOf<RangedResult<{ rows: number[] }>>().not.toMatchTypeOf<{ rows: number[] }>()
    if (!result.archived) {
      expectTypeOf(result.data).toEqualTypeOf<{ rows: number[] }>()
    }
  })
})
