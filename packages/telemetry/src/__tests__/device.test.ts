import { describe, expect, it } from 'vitest'
import { detectDeviceClass } from '../device'

describe('detectDeviceClass', () => {
  it('trusts UA-CH when it speaks', () => {
    expect(detectDeviceClass({ userAgent: '', userAgentData: { mobile: true } })).toBe('mobile')
    expect(detectDeviceClass({ userAgent: '', userAgentData: { mobile: false } })).toBe('desktop')
  })

  it('falls back to the UA string, tablets included', () => {
    expect(detectDeviceClass({ userAgent: '… iPad; CPU OS 17_0 …' })).toBe('tablet')
    expect(detectDeviceClass({ userAgent: '… iPhone …' })).toBe('mobile')
    expect(detectDeviceClass({ userAgent: '… Android … Mobile …' })).toBe('mobile')
  })

  it('a multi-touch Macintosh is an iPad in desktop clothing', () => {
    expect(detectDeviceClass({ userAgent: '… Macintosh …', maxTouchPoints: 5 })).toBe('tablet')
  })

  it('defaults to desktop when nothing is known — no node navigator, no guess', () => {
    expect(detectDeviceClass(undefined)).toBe('desktop')
    expect(detectDeviceClass({ userAgent: 'Mozilla/5.0 …' })).toBe('desktop')
  })
})
