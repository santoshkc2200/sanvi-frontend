import type { BlockSchema } from '@sanvi/theme-runtime'

export const contactFormSchema: BlockSchema = {
  name: 'contact_form',
  version: '1.0.0',
  description: 'Contact form with name, email, message fields and accessible submission',
  category: 'interactive',
  properties: {
    heading: {
      type: 'text',
      label: 'Heading',
      default: 'Contact Us',
    },
    description: {
      type: 'text',
      label: 'Description',
    },
    nameLabel: {
      type: 'text',
      label: 'Name Field Label',
      default: 'Your Name',
    },
    emailLabel: {
      type: 'text',
      label: 'Email Field Label',
      default: 'Email Address',
    },
    messageLabel: {
      type: 'text',
      label: 'Message Field Label',
      default: 'Message',
    },
    submitButtonText: {
      type: 'text',
      label: 'Submit Button Label',
      default: 'Send Message',
    },
    successMessage: {
      type: 'text',
      label: 'Success Message',
      default: 'Thank you for reaching out. We will get back to you soon.',
    },
  },
}
