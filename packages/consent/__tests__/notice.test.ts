import { describe, expect, it } from 'vitest'
import { currentNoticeVersion, resolveConsentModel } from '../src/notice'

describe('resolveConsentModel', () => {
  const notice = {
    jurisdictions: [
      {
        code: 'eu',
        consent_model: 'opt_in',
        regime: 'gdpr',
        response_days: 30,
        honours_universal_opt_out: false,
      },
      {
        code: 'us-ca',
        consent_model: 'notice_and_opt_out',
        regime: 'us_state',
        response_days: 45,
        honours_universal_opt_out: true,
      },
    ],
  }

  it('returns the model from the backend profile for the directive jurisdiction', () => {
    expect(resolveConsentModel(notice, 'us-ca')).toBe('notice_and_opt_out')
    expect(resolveConsentModel(notice, 'eu')).toBe('opt_in')
  })

  it('fails safe to opt_in when the code is unknown or data is missing', () => {
    expect(resolveConsentModel(notice, 'mx')).toBe('opt_in')
    expect(resolveConsentModel(null, 'us-ca')).toBe('opt_in')
    expect(resolveConsentModel(undefined, undefined)).toBe('opt_in')
  })
})

describe('currentNoticeVersion', () => {
  it('returns the max notice version across directives', () => {
    expect(
      currentNoticeVersion([
        { notice_version: '2026.1' },
        { notice_version: '2026.10' },
        { notice_version: null },
      ]),
    ).toBe('2026.10')
  })

  it('returns null when no directive carries a version', () => {
    expect(currentNoticeVersion([{ notice_version: null }])).toBeNull()
    expect(currentNoticeVersion([])).toBeNull()
  })
})
