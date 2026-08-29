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
})
