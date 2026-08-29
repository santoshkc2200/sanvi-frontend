import type { BlockSchema } from '@sanvi/theme-runtime'

export const productGridSchema: BlockSchema = {
  name: 'product_grid',
  version: '1.0.0',
  description: 'Product catalog grid displaying items with images, prices, and links',
  category: 'data',
  properties: {
    heading: {
      type: 'text',
      label: 'Heading',
      description: 'Headline for the product grid section',
      default: 'Products',
    },
    subheading: {
      type: 'text',
      label: 'Subheading',
    },
    columns: {
      type: 'number',
      label: 'Grid Columns',
      default: 3,
      options: [
        { label: '2 Columns', value: 2 },
        { label: '3 Columns', value: 3 },
        { label: '4 Columns', value: 4 },
      ],
    },
    products: {
      type: 'array',
      label: 'Products List',
      description: 'Array of product objects supplied by page data',
      default: [],
    },
    emptyMessage: {
      type: 'text',
      label: 'Empty State Message',
      default: 'No products available',
    },
  },
}
