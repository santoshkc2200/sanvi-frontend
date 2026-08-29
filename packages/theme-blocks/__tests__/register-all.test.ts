import { clearBlockRegistry, getBlock, getRegisteredBlockTypes } from '@sanvi/theme-runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { registerAllBlocks } from '../src/register-all'

describe('registerAllBlocks', () => {
  beforeEach(() => {
    clearBlockRegistry()
  })

  it('registers all canonical theme catalog blocks with valid schemas and components', () => {
    registerAllBlocks()

    const registeredTypes = getRegisteredBlockTypes().sort()
    const expectedTypes = [
      'contact_form',
      'cta',
      'faq',
      'feature_grid',
      'featured',
      'footer',
      'header',
      'hero',
      'image_banner',
      'product_grid',
      'rich_text',
      'spacer',
      'testimonials',
    ].sort()

    expect(registeredTypes).toEqual(expectedTypes)
    expect(registeredTypes).toHaveLength(13)

    for (const type of expectedTypes) {
      const block = getBlock(type)
      expect(block).toBeDefined()
      expect(block?.type).toBe(type)
      expect(block?.component).toBeDefined()
      expect(block?.schema).toBeDefined()
      expect(block?.schema.name).toBeDefined()
    }
  })
})
