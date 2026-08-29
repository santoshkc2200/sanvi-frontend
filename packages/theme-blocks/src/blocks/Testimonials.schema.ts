import type { BlockSchema } from '@sanvi/theme-runtime'

export const testimonialsSchema: BlockSchema = {
  name: 'testimonials',
  version: '1.0.0',
  description: 'Customer testimonials showcase with quotes, author names, roles, and avatars',
  category: 'marketing',
  properties: {
    heading: {
      type: 'text',
      label: 'Section Heading',
      description: 'Headline for the testimonials section',
    },
    subheading: {
      type: 'text',
      label: 'Section Subheading',
    },
    testimonials: {
      type: 'array',
      label: 'Testimonials List',
      description: 'List of testimonial items',
      default: [],
    },
  },
}
