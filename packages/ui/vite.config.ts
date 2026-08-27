import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Storybook's `@storybook/svelte-vite` framework expects the project's own
// vite config to bring `@sveltejs/vite-plugin-svelte` — without it `.svelte`
// modules reach the docgen plugin uncompiled and the preview build fails.
export default defineConfig({
  plugins: [svelte()],
})
