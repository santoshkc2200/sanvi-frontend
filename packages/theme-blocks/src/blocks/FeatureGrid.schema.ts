import type { BlockSchema } from '@sanvi/theme-runtime'

export const featureGridSchema: BlockSchema = {
  name: 'feature_grid',
  version: '1.0.0',
  description: 'Grid of feature cards with titles, descriptions, and optional icons',
  category: 'marketing',
  properties: {
    heading: {
      type: 'text',
      label: 'Section Heading',
      description: 'Headline for the features section',
    },
    subheading: {
      type: 'text',
      label: 'Section Subheading',
      description: 'Supporting text for the features section',
    },
    columns: {
      type: 'number',
      label: 'Number of Columns',
      default: 3,
      options: [
        { label: '2 Columns', value: 2 },
        { label: '3 Columns', value: 3 },
        { label: '4 Columns', value: 4 },
      ],
    },
    features: {
      type: 'array',
      label: 'Features List',
      description: 'Array of feature card objects',
      default: [],
    },
  },
}
