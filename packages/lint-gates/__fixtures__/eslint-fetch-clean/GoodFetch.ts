// Routes through @sanvi/api-client instead of calling fetch directly.
import { createApiClient } from '@sanvi/api-client'

export function getCourses(apiOrigin: string) {
  const client = createApiClient({ baseUrl: apiOrigin })
  return client.get('/v1/courses')
}
