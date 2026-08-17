import { describe, expect, it } from 'vitest'
import {
  formatTimecode,
  formatVttTimestamp,
  parseTimecode,
  parseVttTimestamp,
} from '../src/authoring/timecode'

describe('formatTimecode', () => {
  it('formats under an hour as mm:ss', () => {
    expect(formatTimecode(65_000)).toBe('1:05')
  })

  it('formats at or past an hour as h:mm:ss', () => {
    expect(formatTimecode(3_665_000)).toBe('1:01:05')
  })

  it('clamps negative input to zero', () => {
    expect(formatTimecode(-5_000)).toBe('0:00')
  })
})

describe('parseTimecode', () => {
  it('parses h:mm:ss, mm:ss, and bare seconds', () => {
    expect(parseTimecode('1:01:05')).toBe(3_665_000)
    expect(parseTimecode('1:05')).toBe(65_000)
    expect(parseTimecode('90')).toBe(90_000)
    expect(parseTimecode('90.5')).toBe(90_500)
  })

  it('returns null for unparseable or out-of-range input', () => {
    expect(parseTimecode('')).toBeNull()
    expect(parseTimecode('not a time')).toBeNull()
    expect(parseTimecode('1:60')).toBeNull()
    expect(parseTimecode('1:2:3:4')).toBeNull()
  })

  it('round-trips through formatTimecode for whole seconds', () => {
    const ms = 3_725_000
    expect(parseTimecode(formatTimecode(ms))).toBe(ms)
  })
})

describe('formatVttTimestamp / parseVttTimestamp round trip', () => {
  it('formats to HH:MM:SS.mmm', () => {
    expect(formatVttTimestamp(3_725_500)).toBe('01:02:05.500')
  })

  it('parses both HH:MM:SS.mmm and MM:SS.mmm', () => {
    expect(parseVttTimestamp('01:02:05.500')).toBe(3_725_500)
    expect(parseVttTimestamp('02:05.500')).toBe(125_500)
  })

  it('rejects out-of-range minutes/seconds', () => {
    expect(parseVttTimestamp('00:60:00.000')).toBeNull()
    expect(parseVttTimestamp('00:00:60.000')).toBeNull()
  })

  it('round-trips arbitrary millisecond values', () => {
    const ms = 7_384_921
    expect(parseVttTimestamp(formatVttTimestamp(ms))).toBe(ms)
  })
})
