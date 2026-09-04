import { describe, expect, it, beforeEach } from 'vitest'
import { readStashedClickIds, stashLandingClickIds } from '../src/lib/tracking/click-ids'

describe('landing click-id stash', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('stashes and reads back ad click ids from the landing URL', () => {
    stashLandingClickIds('?gclid=abc-123&utm_source=google')

    const ids = readStashedClickIds()
    expect(ids?.gclid).toBe('abc-123')
    expect(ids?.gbraid).toBeNull()
    expect(ids?.wbraid).toBeNull()
    expect(ids?.capture_time).toBeTruthy()
  })

  it('stashes web boot attributions alongside gclid', () => {
    stashLandingClickIds('?wbraid=wb-1&gbraid=gb-9')

    const ids = readStashedClickIds()
    expect(ids?.wbraid).toBe('wb-1')
    expect(ids?.gbraid).toBe('gb-9')
    expect(ids?.gclid).toBeNull()
  })

  it('is a no-op without click params — an earlier observation survives', () => {
    stashLandingClickIds('?gclid=first')
    stashLandingClickIds('?utm_campaign=spring')

    expect(readStashedClickIds()?.gclid).toBe('first')
  })

  it('returns undefined when nothing was observed this session', () => {
    stashLandingClickIds('?utm_source=newsletter')

    expect(readStashedClickIds()).toBeUndefined()
  })

  it('tolerates a corrupted stash instead of throwing', () => {
    window.sessionStorage.setItem('sanvi_ads_landing_click_ids', '{not json')

    expect(readStashedClickIds()).toBeUndefined()
  })

  it('an empty stash object reads back as undefined', () => {
    window.sessionStorage.setItem(
      'sanvi_ads_landing_click_ids',
      JSON.stringify({ ids: {}, captured_at: '2026-09-05T00:00:00Z' }),
    )

    expect(readStashedClickIds()).toBeUndefined()
  })
})
