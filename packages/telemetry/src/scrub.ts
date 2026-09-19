import type { TelemetrySegmentation } from './types'

/**
 * Payload hygiene (NFR-1104): no PII and no full URLs with query strings
 * reach any telemetry destination. Scrubbing happens here, once, before an
 * event is built — sources never get to decide what counts as clean.
 */

function defaultBase(): string {
  return typeof location !== 'undefined' && location.href ? location.href : 'http://localhost/'
}

/**
 * Strips the query string and fragment from a URL. Same-origin relative
 * paths collapse to their pathname; absolute URLs keep only origin +
 * pathname. Unparseable input degrades to the literal text before the first
 * `?` or `#` — a mangled URL never becomes an excuse to emit a query string.
 */
export function scrubUrl(raw: string, base: string = defaultBase()): string {
  // The literal text before the first `?` or `#`; `search` is -1 (whole input
  // is the fallback) when neither appears.
  const cut = raw.search(/[?#]/)
  const fallback = cut === -1 ? raw : raw.slice(0, cut)
  try {
    // Same-origin relative path → pathname only.
    if (raw.startsWith('/')) {
      return new URL(raw, base).pathname
    }
    // Absolute URL → origin + pathname. `new URL` alone is too lenient to
    // gate on: junk like "not a url?token=abc" parses as a relative path
    // against the base, so the scheme check decides what counts as absolute.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      const url = new URL(raw)
      return `${url.origin}${url.pathname}`
    }
  } catch {
    // Malformed beyond saving — degrade below.
  }
  return fallback
}

/**
 * A tenant id is an opaque token in telemetry, never an identifier a human
 * typed. Anything outside id-shaped characters (including anything carrying
 * `@`) is demoted to null — a misconfigured segmentation getter must not
 * turn into a PII leak.
 */
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

export function sanitizeSegmentation(segmentation: TelemetrySegmentation): TelemetrySegmentation {
  return {
    route: scrubUrl(segmentation.route),
    tenantId:
      segmentation.tenantId && OPAQUE_ID_PATTERN.test(segmentation.tenantId)
        ? segmentation.tenantId
        : null,
    locale: segmentation.locale.slice(0, 15),
    deviceClass: segmentation.deviceClass,
    themeRevision:
      typeof segmentation.themeRevision === 'number' ? segmentation.themeRevision : null,
  }
}

/**
 * Free-text scrubbing for error reports, breadcrumbs, and log lines
 * (NFR-1104: no email, no session token). Error messages and stacks are the
 * one payload a source controls verbatim, so they pass through here before
 * they can reach a transport — the same "scrub before send, not at the
 * destination" rule the URL scrubber enforces, one dimension over.
 */
const EMAIL_PATTERN = /[^\s<>,;"']+@[^\s<>,;"']+\.[A-Za-z]{2,}/g
const BEARER_PATTERN = /[Bb]earer\s+[\w.~+/=-]{8,}/g
/** `field: value` / `field=value` for the credential-shaped field names a stack or message might quote. */
const SECRET_FIELD_PATTERN =
  /(?:session[_-]?token|access[_-]?token|auth(?:orization)?|api[_-]?key|password|ory_kratos_session)\s*[=:]\s*"?[\w.~+/=-]{6,}"?/gi

export function scrubText(raw: string, maxLength = 2048): string {
  return raw
    .replace(BEARER_PATTERN, '[removed-token]')
    .replace(SECRET_FIELD_PATTERN, '[removed-secret]')
    .replace(EMAIL_PATTERN, '[removed-email]')
    .slice(0, maxLength)
}
