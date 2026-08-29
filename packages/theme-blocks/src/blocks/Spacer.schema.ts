import type { BlockSchema } from '@sanvi/theme-runtime'

export const spacerSchema: BlockSchema = {
  name: 'spacer',
  version: '1.0.0',
  description: 'Vertical or horizontal whitespace divider',
  category: 'structural',
  properties: {
    size: {
      type: 'string',
      label: 'Spacing Size',
      description: 'Spacing token step (e.g. 2, 4, 6, 8, 12, 16, 24)',
      default: '6',
      options: [
        { label: 'Extra Small (1)', value: '1' },
        { label: 'Small (2)', value: '2' },
        { label: 'Medium (4)', value: '4' },
        { label: 'Large (6)', value: '6' },
        { label: 'X-Large (8)', value: '8' },
        { label: '2X-Large (12)', value: '12' },
        { label: '3X-Large (16)', value: '16' },
        { label: '4X-Large (24)', value: '24' },
      ],
    },
    axis: {
      type: 'string',
      label: 'Axis',
      default: 'block',
      options: [
        { label: 'Vertical (block)', value: 'block' },
        { label: 'Horizontal (inline)', value: 'inline' },
      ],
    },
  },
}
