import type { BlockSchema } from '@sanvi/theme-runtime'

export const ctaSchema: BlockSchema = {
  name: 'cta',
  version: '1.0.0',
  description: 'Call to action section with heading, supporting text, and action buttons',
  category: 'marketing',
  properties: {
    heading: {
      type: 'text',
      label: 'Heading',
      description: 'Call to action headline',
      default: 'Ready to get started?',
    },
    description: {
      type: 'text',
      label: 'Description',
      description: 'Supporting text for the call to action',
    },
    buttonText: {
      type: 'text',
      label: 'Button Label',
      default: 'Get Started',
    },
    buttonHref: {
      type: 'string',
      label: 'Button Link URL',
      default: '/',
    },
    secondaryButtonText: {
      type: 'text',
      label: 'Secondary Button Label',
    },
    secondaryButtonHref: {
      type: 'string',
      label: 'Secondary Button Link URL',
    },
    variant: {
      type: 'string',
      label: 'Section Style',
      default: 'primary',
      options: [
        { label: 'Default Primary', value: 'primary' },
        { label: 'Subtle Background', value: 'subtle' },
        { label: 'Accent Background', value: 'accent' },
      ],
    },
  },
}
