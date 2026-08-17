import { resolveImage } from '../api/media'
import type { CourseApiContext } from '../context'

interface CacheEntry {
  url: string
  width: number
  height: number
  expiresAt: number
  /** In flight, so a lecture with the same image rendered twice resolves it once. */
  pending: Promise<{ url: string; width: number; height: number }> | null
}

const cache = new Map<string, CacheEntry>()

/**
 * Module-level resolved-URL cache (course-ux-phase-10-image-flashcards.md
 * §10a): a lecture with eight images resolves each one once per session, not
 * once per render, and re-resolves on `<img onError>` — what an expired
 * presign looks like from the DOM.
 */
export async function resolveImageUrl(
  ctx: CourseApiContext,
  assetId: string,
  force = false,
): Promise<{ url: string; width: number; height: number }> {
  const now = Date.now()
  const existing = cache.get(assetId)
  if (!force && existing && existing.expiresAt > now) {
    return { url: existing.url, width: existing.width, height: existing.height }
  }
  if (!force && existing?.pending) return existing.pending

  const pending = resolveImage(ctx, assetId).then((resolved) => {
    cache.set(assetId, {
      url: resolved.url,
      width: resolved.width,
      height: resolved.height,
      expiresAt: new Date(resolved.expiresAt).getTime(),
      pending: null,
    })
    return { url: resolved.url, width: resolved.width, height: resolved.height }
  })
  cache.set(assetId, {
    url: existing?.url ?? '',
    width: existing?.width ?? 0,
    height: existing?.height ?? 0,
    expiresAt: existing?.expiresAt ?? 0,
    pending,
  })
  return pending
}

/** Test-only escape hatch — clears every cached/in-flight resolve. */
export function clearImageUrlCache(): void {
  cache.clear()
}
