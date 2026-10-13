import { describe, expect, it } from 'vitest'
import { ApiError, apiErrorFromResponse } from '../src/problem'

/**
 * The backend's field-addressable validation errors (TASK-027, sanvi-backend
 * TASK-027): every validation problem carries an additive RFC 9457 `fields`
 * extension member, an array of `{ field, message }` issues whose order the
 * backend pins. The flat `detail` stays; `fields` is what lets a form link
 * each message to its input instead of presenting a position-only blob.
 */
function problemResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 400,
    headers: { 'content-type': 'application/problem+json' },
  })
}

describe('field-addressable validation errors', () => {
  it('exposes the fields member as fieldIssues, in backend order', async () => {
    const error = await apiErrorFromResponse(
      problemResponse({
        type: 'https://sanvi.app/problems/validation-failed',
        title: 'Validation failed',
        status: 400,
        detail: 'Some fields are invalid.',
        fields: [
          { field: 'name', message: 'Campaign name is required.' },
          { field: 'budget_amount_minor', message: 'Enter a whole number.' },
        ],
      }),
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error.fieldIssues).toEqual([
      { field: 'name', message: 'Campaign name is required.' },
      { field: 'budget_amount_minor', message: 'Enter a whole number.' },
    ])
    // Order is the backend's contract — the client must not reorder it, so
    // a summary list renders identically across fetches.
    expect(error.fieldIssues.map((issue) => issue.field)).toEqual(['name', 'budget_amount_minor'])
  })

  it('keeps the flat detail alongside the field issues', async () => {
    const error = await apiErrorFromResponse(
      problemResponse({
        type: 'https://sanvi.app/problems/validation-failed',
        title: 'Validation failed',
        status: 400,
        detail: 'Some fields are invalid.',
        fields: [{ field: 'ad_groups[2].ads[0].creative.id', message: 'Unknown creative.' }],
      }),
    )
    expect(error.detail).toBe('Some fields are invalid.')
    expect(error.fieldIssues).toHaveLength(1)
  })

  it('yields no fieldIssues when the member is absent', async () => {
    const error = await apiErrorFromResponse(
      problemResponse({
        type: 'https://sanvi.app/problems/not-found',
        title: 'Not found',
        status: 404,
      }),
    )
    expect(error.fieldIssues).toEqual([])
  })

  it('drops malformed entries instead of leaking them into the DOM', async () => {
    const error = await apiErrorFromResponse(
      problemResponse({
        type: 'https://sanvi.app/problems/validation-failed',
        title: 'Validation failed',
        status: 400,
        fields: [
          { field: 'name', message: 'Required.' },
          { field: 'no-message' },
          { message: 'no field' },
          { field: '', message: 'empty path' },
          { field: 'ok', message: '' },
          'not-an-object',
          42,
        ],
      }),
    )
    expect(error.fieldIssues).toEqual([{ field: 'name', message: 'Required.' }])
  })

  it('treats a non-array fields member as absent', async () => {
    const error = await apiErrorFromResponse(
      problemResponse({
        type: 'https://sanvi.app/problems/validation-failed',
        title: 'Validation failed',
        status: 400,
        fields: { field: 'name', message: 'Required.' },
      }),
    )
    expect(error.fieldIssues).toEqual([])
  })
})
