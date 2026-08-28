/**
 * Stand-in for SvelteKit's `$env/dynamic/public` virtual module in tests.
 */
export const env: Record<string, string | undefined> = {
  PUBLIC_API_ORIGIN: 'https://api.example.test',
  PUBLIC_MEDIA_ORIGIN: '',
}
