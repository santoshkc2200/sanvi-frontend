import { formatVttTimestamp, parseVttTimestamp } from './timecode'

export interface VttCue {
  /** 1-based, in file order — what a validation error names, matching how an instructor counts cues. */
  index: number
  startMs: number
  endMs: number
  text: string
}

export interface VttValidationError {
  /** `null` for a header-level problem, otherwise the offending cue's 1-based position. */
  cueIndex: number | null
  message: string
}

/**
 * Lenient WebVTT parser: only pulls out cue timing + text, ignores
 * `NOTE`/`STYLE`/`REGION` blocks and cue identifier lines. Never throws —
 * unparseable blocks are skipped and surfaced by `validateWebVtt` instead,
 * so a single malformed cue doesn't stop the rest from being editable.
 */
export function parseWebVtt(text: string): { hasHeader: boolean; cues: VttCue[] } {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const blocks = normalized.split(/\n{2,}/)
  const firstLine = (blocks[0] ?? '').split('\n')[0]?.trim()
  const hasHeader = firstLine === 'WEBVTT'

  const cues: VttCue[] = []
  for (const block of hasHeader ? blocks.slice(1) : blocks) {
    const lines = block.split('\n').filter((line) => line.trim().length > 0)
    if (lines.length === 0) continue
    const firstBlockLine = lines[0] ?? ''
    if (firstBlockLine.startsWith('NOTE') || firstBlockLine.startsWith('STYLE')) continue
    const timingLineIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingLineIndex === -1) continue
    const [startRaw, endRaw] = (lines[timingLineIndex] ?? '')
      .split('-->')
      .map((part) => part.trim())
    const startMs = parseVttTimestamp(startRaw?.split(/\s+/)[0] ?? '')
    const endMs = parseVttTimestamp(endRaw?.split(/\s+/)[0] ?? '')
    if (startMs === null || endMs === null) continue
    cues.push({
      index: cues.length + 1,
      startMs,
      endMs,
      text: lines.slice(timingLineIndex + 1).join('\n'),
    })
  }
  return { hasHeader, cues }
}

/**
 * Mirrors the server's `validateWebVTT` rejection rules (`internal/media/
 * application/service.go`) so a malformed file is caught before the round
 * trip, with the one thing the server's generic `400` can't give: which
 * cue. Header must be exactly `WEBVTT`; every cue needs `start < end`; cues
 * must be non-overlapping and in non-decreasing start order (`start >=
 * previous end`) — the server enforces the same monotonic rule, not just
 * "sorted".
 */
export function validateWebVtt(cues: VttCue[], hasHeader: boolean): VttValidationError[] {
  const errors: VttValidationError[] = []
  if (!hasHeader) errors.push({ cueIndex: null, message: 'missing the WEBVTT header line' })
  if (cues.length === 0) errors.push({ cueIndex: null, message: 'no cues found' })

  let lastEnd = -1
  for (const cue of cues) {
    if (cue.text.trim().length === 0) {
      errors.push({ cueIndex: cue.index, message: 'cue text is empty' })
    }
    if (cue.startMs >= cue.endMs) {
      errors.push({ cueIndex: cue.index, message: 'start must be before end' })
      continue
    }
    if (cue.startMs < lastEnd) {
      errors.push({ cueIndex: cue.index, message: 'overlaps the previous cue' })
    }
    lastEnd = cue.endMs
  }
  return errors
}

/** Cues -> a serializable `WEBVTT` document, cue order = array order. */
export function serializeWebVtt(cues: VttCue[]): string {
  const body = cues
    .map(
      (cue) =>
        `${formatVttTimestamp(cue.startMs)} --> ${formatVttTimestamp(cue.endMs)}\n${cue.text}`,
    )
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}

/**
 * SRT -> WebVTT: comma decimal separators become periods and a `WEBVTT`
 * header is prepended. SRT's numeric cue-index lines are harmless inside a
 * VTT file (they parse as an ignorable cue-identifier line), so they're
 * left in place rather than stripped — genuinely the doc's "15-line
 * transform", not a full reimplementation of SRT parsing.
 */
export function convertSrtToVtt(srtText: string): string {
  const body = srtText
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim()
  return `WEBVTT\n\n${body}\n`
}
