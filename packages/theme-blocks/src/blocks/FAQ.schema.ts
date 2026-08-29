import type { BlockSchema } from '@sanvi/theme-runtime'

export const faqSchema: BlockSchema = {
  name: 'faq',
  version: '1.0.0',
  description: 'Accordion disclosure list for frequently asked questions',
  category: 'interactive',
  properties: {
    heading: {
      type: 'text',
      label: 'Heading',
      default: 'Frequently Asked Questions',
    },
    subheading: {
      type: 'text',
      label: 'Subheading',
    },
    items: {
      type: 'array',
      label: 'FAQ Items',
      description: 'List of question and answer pairs',
      default: [],
    },
  },
}
