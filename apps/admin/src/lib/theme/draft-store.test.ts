import type { LayoutOverride, TenantThemeDraftView, TokenValue } from '@sanvi/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDraft,
  getLastError,
  initDraftStore,
  resetDraftStore,
  setCustomCss,
  switchTheme,
  updateLayoutOverride,
  updateTokenOverride,
} from './draft-store'

function createMockDraft(themeKey = 'base'): TenantThemeDraftView {
  return {
    spec: {
      key: themeKey,
      version: '1.0.0',
      capabilities: ['tokens', 'layouts'],
      fonts: [],
      layouts: {
        'storefront.home': { slots: ['hero', 'footer'] },
      },
      overridable: ['color.brand.primary', 'color.text.primary'],
    },
    theme: {
      revision: 1,
      state: 'draft',
      theme_key: themeKey,
      version: '1.0.0',
      assets: {},
      token_overrides: {},
      layout_overrides: {},
      updated_at: '2026-08-29T12:00:00Z',
    },
  }
}

describe('Theme Draft Store with Autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetDraftStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('updates token override optimistically immediately and calls PUT after debounce', async () => {
    const mockDraft = createMockDraft()
    initDraftStore(mockDraft)

    const putSpy = vi.fn().mockResolvedValue({
      ...mockDraft.theme,
      revision: 2,
      token_overrides: {
        'color.brand.primary': { $value: '#ff0000', $type: 'color' },
      },
    })

    const token: TokenValue = { $value: '#ff0000', $type: 'color' }
    updateTokenOverride('color.brand.primary', token, putSpy)

    // Immediate optimistic update
    expect(getDraft()?.theme.token_overrides['color.brand.primary']).toEqual(token)
    expect(putSpy).not.toHaveBeenCalled()

    // Advance timers past debounce window (300ms)
    await vi.advanceTimersByTimeAsync(350)

    expect(putSpy).toHaveBeenCalledTimes(1)
    expect(putSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        token_overrides: {
          'color.brand.primary': token,
        },
      }),
    )
  })

  it('rolls back optimistic update when PUT fails with 400 error', async () => {
    const mockDraft = createMockDraft()
    initDraftStore(mockDraft)

    const putSpy = vi.fn().mockRejectedValue(new Error('Invalid token color value'))

    const token: TokenValue = { $value: 'not-a-color', $type: 'color' }
    updateTokenOverride('color.brand.primary', token, putSpy)

    // Immediate optimistic update
    expect(getDraft()?.theme.token_overrides['color.brand.primary']).toEqual(token)

    // Advance timers past debounce
    await vi.advanceTimersByTimeAsync(350)

    expect(putSpy).toHaveBeenCalledTimes(1)

    // Should have rolled back to previous state (empty overrides)
    expect(getDraft()?.theme.token_overrides['color.brand.primary']).toBeUndefined()
    expect(getLastError()).toBe('Invalid token color value')
  })

  it('updates layout override and custom CSS', async () => {
    const mockDraft = createMockDraft()
    initDraftStore(mockDraft)

    const putSpy = vi.fn().mockResolvedValue({
      ...mockDraft.theme,
      revision: 2,
      layout_overrides: {
        'storefront.home': { hidden_slots: ['hero'] },
      },
      custom_css: '.hero { display: none; }',
    })

    const layoutOverride: LayoutOverride = { hidden_slots: ['hero'] }
    updateLayoutOverride('storefront.home', layoutOverride, putSpy)
    setCustomCss('.hero { display: none; }', putSpy)

    expect(getDraft()?.theme.layout_overrides['storefront.home']).toEqual(layoutOverride)
    expect(getDraft()?.theme.custom_css).toBe('.hero { display: none; }')

    await vi.advanceTimersByTimeAsync(350)

    expect(putSpy).toHaveBeenCalledTimes(1)
  })

  it('switches theme and triggers update', async () => {
    const mockDraft = createMockDraft('base')
    initDraftStore(mockDraft)

    const putSpy = vi.fn().mockResolvedValue({
      ...mockDraft.theme,
      revision: 2,
      theme_key: 'aurora',
      version: '1.2.0',
    })

    switchTheme('aurora', '1.2.0', putSpy)
    expect(getDraft()?.theme.theme_key).toBe('aurora')

    await vi.advanceTimersByTimeAsync(350)
    expect(putSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        theme_key: 'aurora',
        version: '1.2.0',
      }),
    )
  })

  it('ignores older in-flight save results when a newer save has dispatched', async () => {
    const mockDraft = createMockDraft('base')
    initDraftStore(mockDraft)

    let resolveFirstPut: (val: unknown) => void
    const firstPutPromise = new Promise((resolve) => {
      resolveFirstPut = resolve
    })

    const putSpy = vi
      .fn()
      .mockImplementationOnce(() => firstPutPromise)
      .mockResolvedValueOnce({
        ...mockDraft.theme,
        revision: 3,
        token_overrides: {
          'color.brand.primary': { $value: '#222222', $type: 'color' },
        },
      })

    // First edit
    updateTokenOverride('color.brand.primary', { $value: '#111111', $type: 'color' }, putSpy)
    await vi.advanceTimersByTimeAsync(350)
    expect(putSpy).toHaveBeenCalledTimes(1)

    // Second edit while first is still in flight
    updateTokenOverride('color.brand.primary', { $value: '#222222', $type: 'color' }, putSpy)
    await vi.advanceTimersByTimeAsync(350)
    expect(putSpy).toHaveBeenCalledTimes(2)

    // First PUT rejects after second was dispatched
    resolveFirstPut!(new Error('First save failed'))
    await vi.advanceTimersByTimeAsync(50)

    // Second edit must not be rolled back by the first edit's rejection
    expect(getDraft()?.theme.token_overrides['color.brand.primary']).toEqual({
      $value: '#222222',
      $type: 'color',
    })
  })
})
