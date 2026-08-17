/**
 * The manifest/segment credential split (course-ux-phase-9b-media.md's 9b.3
 * section): master and variant playlists are served from our own API origin
 * and require `Authorization`/`X-Tenant-ID`; segment URIs inside a variant
 * playlist are already-presigned, credential-free storage URLs. The test for
 * "does this request need auth" is "is this our own API origin", not "is
 * this the top-level manifest" — both master and variant requests hit our
 * origin, only the leaf segments don't.
 */
export function needsMediaAuth(url: string, apiBaseUrl: string): boolean {
  return url.startsWith(apiBaseUrl)
}

export interface AuthHeaders {
  Authorization: string
  'X-Tenant-ID'?: string
  [header: string]: string | undefined
}

export function buildAuthHeaders(token: string, tenantId: string | null): AuthHeaders {
  const headers: AuthHeaders = { Authorization: `Bearer ${token}` }
  if (tenantId) headers['X-Tenant-ID'] = tenantId
  return headers
}

/** One `#EXT-X-STREAM-INF` variant's URI line, resolved to an absolute URL. */
export interface VariantRef {
  index: number
  uri: string
  height: number
  bitrate: number
}

/**
 * Falls back to the rendition height baked into the variant path itself
 * (".../{height}p/index.m3u8" or ".../{height}p", both real conventions —
 * see `courseauthoring`'s ffmpeg transcoder and its mock) for a manifest
 * whose `#EXT-X-STREAM-INF` line has no (or a zero) `RESOLUTION` attribute.
 * Returns 0, same as an unparseable RESOLUTION, when the path doesn't
 * follow that convention either.
 */
export function heightFromVariantUri(uri: string): number {
  const match = /\/(\d+)p(?:\/|$)/.exec(uri)
  return match ? Number(match[1]) : 0
}

/**
 * Extracts each variant playlist's absolute URI from a master playlist's
 * text. A `#EXT-X-STREAM-INF` tag is always immediately followed by its
 * URI on the next non-blank line, per the HLS spec. Resolution and bandwidth
 * are retained so native-HLS browsers can expose the same quality menu as
 * hls.js browsers.
 */
export function parseVariantUris(masterText: string, masterUrl: string): VariantRef[] {
  const lines = masterText.split('\n').map((line) => line.trim())
  const variants: VariantRef[] = []
  for (let i = 0; i < lines.length; i++) {
    const streamInfo = lines[i] ?? ''
    if (!streamInfo.startsWith('#EXT-X-STREAM-INF')) continue
    const resolution = /(?:^|,)RESOLUTION=\d+x(\d+)(?:,|$)/.exec(streamInfo)
    const bandwidth = /(?:^|[:,])BANDWIDTH=(\d+)(?:,|$)/.exec(streamInfo)
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j] ?? ''
      if (candidate.length === 0) continue
      if (candidate.startsWith('#')) break
      const uri = new URL(candidate, masterUrl).toString()
      variants.push({
        index: variants.length,
        uri,
        height: Number(resolution?.[1] ?? 0) || heightFromVariantUri(uri),
        bitrate: Number(bandwidth?.[1] ?? 0),
      })
      break
    }
  }
  return variants
}

/**
 * Replaces each variant's URI line in a master playlist's text with its
 * corresponding blob URL, so a native `<video>` element following the
 * rewritten master never issues a second, un-authenticated request for a
 * variant playlist. Segment URIs inside a variant are untouched — they're
 * already-presigned, credential-free storage URLs and stay as-is.
 */
export function rewriteMasterPlaylist(
  masterText: string,
  masterUrl: string,
  variantBlobUrls: Map<string, string>,
): string {
  const lines = masterText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!(lines[i] ?? '').trim().startsWith('#EXT-X-STREAM-INF')) continue
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = (lines[j] ?? '').trim()
      if (candidate.length === 0) continue
      if (candidate.startsWith('#')) break
      const absolute = new URL(candidate, masterUrl).toString()
      const blobUrl = variantBlobUrls.get(absolute)
      if (blobUrl) lines[j] = blobUrl
      break
    }
  }
  return lines.join('\n')
}

export class MediaManifestError extends Error {
  constructor(public readonly status: number) {
    super(`media manifest request failed: ${status}`)
    this.name = 'MediaManifestError'
  }
}

async function fetchText(url: string, headers: AuthHeaders): Promise<string> {
  const response = await fetch(url, { headers: headers as Record<string, string> })
  if (!response.ok) {
    throw new MediaManifestError(response.status)
  }
  return response.text()
}

/**
 * Builds a fully authenticated, native-`<video>`-playable source for
 * browsers with no `hls.js` (Safari/iOS): fetches the master playlist and
 * every variant playlist it references ourselves (both need
 * `Authorization`/`X-Tenant-ID`, neither the native engine can send), then
 * rewrites the master's variant URIs to point at the fetched variants'
 * `Blob` URLs. Segment URIs inside each variant are left untouched — they
 * carry their own presigned credentials and the native engine fetches them
 * directly, no rewriting needed.
 *
 * Returns a `revoke()` that must be called on unmount/reload to release the
 * blob URLs — the caller owns the object URL lifecycle, mirroring how
 * `MultipartUploader`'s consumer owns the abort controller lifecycle.
 */
export async function buildNativeHlsSource(
  masterUrl: string,
  headers: AuthHeaders,
  selectedVariantIndex = -1,
): Promise<{ src: string; revoke: () => void; levels: VariantRef[] }> {
  const masterText = await fetchText(masterUrl, headers)
  const variants = parseVariantUris(masterText, masterUrl)

  const blobUrls: string[] = []
  if (selectedVariantIndex >= 0) {
    const selected = variants.find((variant) => variant.index === selectedVariantIndex)
    if (!selected) throw new MediaManifestError(400)
    const variantText = await fetchText(selected.uri, headers)
    const variantBlobUrl = URL.createObjectURL(
      new Blob([variantText], { type: 'application/vnd.apple.mpegurl' }),
    )
    blobUrls.push(variantBlobUrl)
    return {
      src: variantBlobUrl,
      levels: variants,
      revoke: () => URL.revokeObjectURL(variantBlobUrl),
    }
  }

  const variantBlobUrls = new Map<string, string>()
  const seenVariantUris = new Set<string>()
  const uniqueVariants: VariantRef[] = []
  for (const variant of variants) {
    if (seenVariantUris.has(variant.uri)) continue
    seenVariantUris.add(variant.uri)
    uniqueVariants.push(variant)
  }
  const variantTexts = await Promise.all(
    uniqueVariants.map(async (variant) => ({
      variant,
      text: await fetchText(variant.uri, headers),
    })),
  )
  for (const { variant, text } of variantTexts) {
    const variantText = text
    const blob = new Blob([variantText], { type: 'application/vnd.apple.mpegurl' })
    const blobUrl = URL.createObjectURL(blob)
    blobUrls.push(blobUrl)
    variantBlobUrls.set(variant.uri, blobUrl)
  }

  const rewritten = rewriteMasterPlaylist(masterText, masterUrl, variantBlobUrls)
  const masterBlob = new Blob([rewritten], { type: 'application/vnd.apple.mpegurl' })
  const masterBlobUrl = URL.createObjectURL(masterBlob)
  blobUrls.push(masterBlobUrl)

  return {
    src: masterBlobUrl,
    levels: variants,
    revoke: () => {
      for (const url of blobUrls) URL.revokeObjectURL(url)
    },
  }
}
