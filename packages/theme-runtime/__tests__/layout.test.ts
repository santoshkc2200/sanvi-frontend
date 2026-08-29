import type { Component } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearBlockRegistry,
  getBlock,
  hasBlock,
  registerBlock,
  renderLayout,
  unregisterBlock,
} from '../src/registry'
import type { BlockSchema, ResolvedTheme } from '../src/types'

// Mock Svelte components for testing
const MockHeroComponent = (() => {}) as unknown as Component
const MockFeatureGridComponent = (() => {}) as unknown as Component
const MockCtaComponent = (() => {}) as unknown as Component
const MockSummaryComponent = (() => {}) as unknown as Component
const MockPaymentComponent = (() => {}) as unknown as Component

const heroSchema: BlockSchema = {
  name: 'Hero',
  version: '1.0.0',
  description: 'Hero block with headline, subheadline and background',
  properties: {
    title: { type: 'string', required: true },
    subtitle: { type: 'string' },
  },
}

const featureGridSchema: BlockSchema = {
  name: 'FeatureGrid',
  version: '1.0.0',
  description: 'Grid of product features',
}

const ctaSchema: BlockSchema = {
  name: 'CTA',
  version: '1.0.0',
  description: 'Call to action section',
}

const summarySchema: BlockSchema = {
  name: 'OrderSummary',
  version: '1.0.0',
  description: 'Checkout order summary',
}

const paymentSchema: BlockSchema = {
  name: 'PaymentForm',
  version: '1.0.0',
  description: 'Checkout payment form',
}

function makeMockTheme(layouts: ResolvedTheme['layouts']): ResolvedTheme {
  return {
    theme_key: 'test-theme',
    theme_version: '1.0.0',
    theme_api: '^1.0.0',
    capabilities: [],
    tokens: {},
    css_vars: '',
    layouts,
    fonts: [],
    theme_assets: { screenshots: [] },
    brand_assets: {},
    revision: 1,
    locale: 'en',
    etag: '"etag-layout-1"',
  }
}

describe('BlockRegistry and renderLayout', () => {
  beforeEach(() => {
    clearBlockRegistry()
    registerBlock('hero', MockHeroComponent, heroSchema)
    registerBlock('feature-grid', MockFeatureGridComponent, featureGridSchema)
    registerBlock('cta', MockCtaComponent, ctaSchema)
    registerBlock('summary', MockSummaryComponent, summarySchema)
    registerBlock('payment', MockPaymentComponent, paymentSchema)
  })

  afterEach(() => {
    clearBlockRegistry()
    vi.restoreAllMocks()
  })

  describe('BlockRegistry', () => {
    it('registers and retrieves blocks', () => {
      expect(hasBlock('hero')).toBe(true)
      expect(getBlock('hero')?.component).toBe(MockHeroComponent)
      expect(getBlock('hero')?.schema).toEqual(heroSchema)
    })

    it('unregisters blocks', () => {
      expect(unregisterBlock('hero')).toBe(true)
      expect(hasBlock('hero')).toBe(false)
    })

    it('throws error when registering with invalid type', () => {
      expect(() =>
        // @ts-expect-error testing runtime validation
        registerBlock('', MockHeroComponent, heroSchema),
      ).toThrow('Block type must be a non-empty string')
    })
  })

  describe('Slot resolution', () => {
    it('resolves named slots from theme manifest and matches registered blocks', () => {
      const theme = makeMockTheme({
        'storefront.home': {
          slots: ['hero', 'feature-grid', 'cta'],
        },
      })

      const tree = renderLayout('storefront.home', { theme })

      expect(tree.layout).toBe('storefront.home')
      expect(tree.slots).toHaveLength(3)
      expect(tree.blocks).toHaveLength(3)

      expect(tree.slots[0]?.name).toBe('hero')
      expect(tree.slots[0]?.blocks[0]?.type).toBe('hero')
      expect(tree.slots[0]?.blocks[0]?.component).toBe(MockHeroComponent)

      expect(tree.slots[1]?.name).toBe('feature-grid')
      expect(tree.slots[1]?.blocks[0]?.type).toBe('feature-grid')

      expect(tree.slots[2]?.name).toBe('cta')
      expect(tree.slots[2]?.blocks[0]?.type).toBe('cta')
    })

    it('resolves custom block overrides and props from PageData slots', () => {
      const theme = makeMockTheme({
        'storefront.home': {
          slots: ['hero'],
        },
      })

      const tree = renderLayout('storefront.home', {
        theme,
        slots: {
          hero: {
            type: 'hero',
            props: { title: 'Welcome to Sanvi', subtitle: 'Learn anywhere' },
          },
        },
      })

      expect(tree.blocks).toHaveLength(1)
      expect(tree.blocks[0]?.props).toEqual({
        title: 'Welcome to Sanvi',
        subtitle: 'Learn anywhere',
      })
    })
  })

  describe('Locked slot enforcement', () => {
    it('rejects attempt to override a locked slot in checkout layout', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const theme = makeMockTheme({
        'storefront.checkout': {
          slots: ['summary', 'payment'],
        },
      })

      // Caller attempts to replace the locked 'summary' slot with an arbitrary promotional block
      const tree = renderLayout('storefront.checkout', {
        theme,
        slots: {
          summary: {
            type: 'cta',
            props: { title: 'Buy extra stuff' },
          },
        },
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Attempted override of locked slot "summary" in layout "storefront.checkout" was rejected',
        ),
      )

      expect(tree.slots[0]?.name).toBe('summary')
      expect(tree.slots[0]?.locked).toBe(true)
      // The locked slot resolved to canonical 'summary' block, NOT the injected 'cta'
      expect(tree.slots[0]?.blocks[0]?.type).toBe('summary')
      expect(tree.slots[0]?.blocks[0]?.component).toBe(MockSummaryComponent)
    })

    it('rejects attempt to override slots when theme layout spec marks locked: true', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const theme = makeMockTheme({
        'custom.locked': {
          slots: ['summary'],
          // @ts-expect-error testing runtime locked property
          locked: true,
        },
      })

      const tree = renderLayout('custom.locked', {
        theme,
        slots: {
          summary: { type: 'cta' },
        },
      })

      expect(warnSpy).toHaveBeenCalled()
      expect(tree.slots[0]?.locked).toBe(true)
      expect(tree.slots[0]?.blocks[0]?.type).toBe('summary')
    })
  })

  describe('Unknown-block tolerance', () => {
    it('tolerates unknown block types gracefully without throwing and renders remaining known blocks', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const theme = makeMockTheme({
        'storefront.home': {
          // 'future-block-v2' is not registered in this runtime version
          slots: ['hero', 'future-block-v2', 'cta'],
        },
      })

      expect(() => {
        const tree = renderLayout('storefront.home', { theme })

        // Did not throw, warning logged
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown block type "future-block-v2" in slot "future-block-v2"'),
        )

        // Known blocks are still fully rendered
        expect(tree.blocks).toHaveLength(2)
        expect(tree.blocks.map((b) => b.type)).toEqual(['hero', 'cta'])
      }).not.toThrow()
    })
  })
})
