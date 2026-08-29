import type { BlockSchema } from '@sanvi/theme-runtime'

export const headerSchema: BlockSchema = {
  name: 'header',
  version: '1.0.0',
  description: 'Site header with brand logo or text and primary navigation',
  category: 'structural',
  properties: {
    brandName: {
      type: 'text',
      label: 'Brand Name',
      description: 'Brand title displayed in the header',
      default: 'Sanvi',
    },
    brandLogoUrl: {
      type: 'image',
      label: 'Brand Logo URL',
      description: 'Image URL for brand logo',
    },
    navItems: {
      type: 'array',
      label: 'Navigation Items',
      description: 'List of navigation links',
      default: [
        { label: 'Home', href: '/' },
        { label: 'Catalog', href: '/products' },
      ],
    },
    sticky: {
      type: 'boolean',
      label: 'Sticky Header',
      description: 'Fix the header at the top of the viewport when scrolling',
      default: false,
    },
    navAriaLabel: {
      type: 'string',
      label: 'Navigation Accessible Label',
      default: 'Main navigation',
    },
  },
}
