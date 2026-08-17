import '../src/styles/reset.css'
import type { Preview } from '@storybook/svelte'

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    a11y: {
      // Fail the a11y addon's check on violation, not just report it — a
      // component landing in Storybook with an axe failure should be
      // impossible to miss in review.
      test: 'error',
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#020617' },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme ?? 'light'
      return Story()
    },
  ],
}

export default preview
