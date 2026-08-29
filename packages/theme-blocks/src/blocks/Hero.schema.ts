import type { BlockSchema } from '@sanvi/theme-runtime'

export const heroSchema: BlockSchema = {
  name: 'hero',
  version: '1.0.0',
  description: 'Prominent hero banner with heading, call-to-action buttons, and showcase image',
  category: 'marketing',
  properties: {
    title: {
      type: 'text',
      label: 'Hero Title',
      description: 'Primary headline for the page',
      default: 'Welcome to Our Store',
    },
    subtitle: {
      type: 'text',
      label: 'Subtitle',
      description: 'Supporting text underneath the headline',
    },
    primaryCta: {
      type: 'object',
      label: 'Primary Button',
      description: 'Primary call to action button',
    },
    secondaryCta: {
      type: 'object',
      label: 'Secondary Button',
      description: 'Optional secondary button',
    },
    imageUrl: {
      type: 'image',
      label: 'Hero Image URL',
      description: 'Showcase image asset URL',
    },
    imageAlt: {
      type: 'text',
      label: 'Image Alt Text',
      default: 'Hero banner',
    },
    align: {
      type: 'string',
      label: 'Alignment',
      default: 'left',
      options: [
        { label: 'Left aligned', value: 'left' },
        { label: 'Center aligned', value: 'center' },
      ],
    },
  },
}
