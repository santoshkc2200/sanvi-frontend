/**
 * Framework-free timecode helpers shared by `ChapterEditor` and
 * `CaptionEditor` — parsing/formatting has no React dependency so it's
 * testable in isolation, same rationale as `MultipartUploader`.
 */

/** `mm:ss` under an hour, `h:mm:ss` at or past one — compact, for chapter rows. */
export function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Accepts `h:mm:ss`, `mm:ss`, or a bare integer/decimal number of seconds —
 * the tolerant form for hand-typed chapter timestamps (the doc's "slow
 * path", not the default one, but still needs to work). Returns `null` for
 * anything unparseable rather than throwing, so callers can show an inline
 * error instead of crashing on a keystroke.
 */
export function parseTimecode(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 1000)
  }
  const parts = trimmed.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  if (!parts.every((part) => /^\d+(\.\d+)?$/.test(part))) return null
  const numeric = parts.map(Number)
  const seconds = numeric.pop()
  const minutes = numeric.pop() ?? 0
  const hours = numeric.pop() ?? 0
  if (seconds === undefined || minutes >= 60 || seconds >= 60) return null
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
}

/** Always `HH:MM:SS.mmm` — the exact WebVTT cue-timing format. */
export function formatVttTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.round(ms))
  const hours = Math.floor(clamped / 3_600_000)
  const minutes = Math.floor((clamped % 3_600_000) / 60_000)
  const seconds = Math.floor((clamped % 60_000) / 1000)
  const millis = clamped % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

/** `HH:MM:SS.mmm` or `MM:SS.mmm` — WebVTT's two legal cue-timestamp widths. */
export function parseVttTimestamp(raw: string): number | null {
  const match = raw.trim().match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/)
  if (!match) return null
  const hours = match[1] ? Number(match[1]) : 0
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const millis = Number(match[4])
  if (minutes >= 60 || seconds >= 60) return null
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + millis
}
