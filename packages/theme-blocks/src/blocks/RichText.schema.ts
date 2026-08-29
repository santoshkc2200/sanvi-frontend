import type { BlockSchema } from '@sanvi/theme-runtime'

export const richTextSchema: BlockSchema = {
  name: 'rich_text',
  version: '1.0.0',
  description: 'Heading and multi-paragraph formatted text section',
  category: 'structural',
  properties: {
    heading: {
      type: 'text',
      label: 'Heading',
      description: 'Optional section heading',
    },
    body: {
      type: 'text',
      label: 'Body Text',
      description: 'Text content (supports multiple paragraphs separated by blank lines)',
      default: '',
    },
    align: {
      type: 'string',
      label: 'Text Alignment',
      default: 'left',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
  },
}
