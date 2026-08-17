// Violates `no-restricted-globals: fetch` — direct fetch outside
// @sanvi/api-client. See eslint.config.js.
export async function getCourses(apiOrigin: string) {
  const response = await fetch(`${apiOrigin}/v1/courses`)
  return response.json()
}
