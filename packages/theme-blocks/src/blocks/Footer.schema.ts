import type { BlockSchema } from '@sanvi/theme-runtime'

export const footerSchema: BlockSchema = {
  name: 'footer',
  version: '1.0.0',
  description: 'Site footer with columns of links, brand information, and copyright',
  category: 'structural',
  properties: {
    brandName: {
      type: 'text',
      label: 'Brand Name',
      description: 'Brand title displayed in footer',
      default: 'Sanvi',
    },
    copyrightText: {
      type: 'text',
      label: 'Copyright Text',
      default: '© 2026 Sanvi Inc. All rights reserved.',
    },
    columns: {
      type: 'array',
      label: 'Footer Columns',
      description: 'List of link columns',
      default: [],
    },
    bottomLinks: {
      type: 'array',
      label: 'Bottom Links',
      description: 'Links displayed beside copyright',
      default: [],
    },
  },
}
