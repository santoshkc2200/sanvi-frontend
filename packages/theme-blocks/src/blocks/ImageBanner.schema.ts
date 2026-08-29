import type { BlockSchema } from '@sanvi/theme-runtime'

export const imageBannerSchema: BlockSchema = {
  name: 'image_banner',
  version: '1.0.0',
  description: 'Full-width image banner with optional heading, subheading, and CTA overlay',
  category: 'marketing',
  properties: {
    imageUrl: {
      type: 'image',
      label: 'Banner Image URL',
      description: 'Banner image asset URL',
      required: true,
    },
    imageAlt: {
      type: 'text',
      label: 'Image Alt Text',
      default: 'Promotional banner',
    },
    heading: {
      type: 'text',
      label: 'Overlay Heading',
    },
    subheading: {
      type: 'text',
      label: 'Overlay Subheading',
    },
    cta: {
      type: 'object',
      label: 'Call to Action',
    },
    height: {
      type: 'string',
      label: 'Banner Height',
      default: 'md',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
      ],
    },
  },
}
