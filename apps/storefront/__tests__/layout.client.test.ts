import { describe, expect, it, vi } from 'vitest'
import { load } from '../src/routes/+layout'

const ensureLocaleLoaded = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@sanvi/i18n', () => ({ ensureLocaleLoaded }))

describe('layout locale hydration', () => {
  it('preserves the original error path when server layout data is null', async () => {
    ensureLocaleLoaded.mockClear()
    await expect(load({ data: null } as never)).resolves.toBeNull()
    expect(ensureLocaleLoaded).not.toHaveBeenCalled()
  })

  it('loads the negotiated locale before returning server layout data', async () => {
    const data = { locale: 'ja' }
    await expect(load({ data } as never)).resolves.toBe(data)
    expect(ensureLocaleLoaded).toHaveBeenCalledWith('ja')
  })
})
