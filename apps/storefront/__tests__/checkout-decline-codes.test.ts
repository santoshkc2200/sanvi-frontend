import { describe, expect, it } from 'vitest'
import { initI18n, setLocale } from '@sanvi/i18n'
import { getDeclineMessage } from '../src/lib/checkout/decline-codes'

describe('getDeclineMessage', () => {
  initI18n({ locale: 'en' })

  it('maps card decline codes to specific message', () => {
    expect(getDeclineMessage('card_declined')).toContain('card was declined')
    expect(getDeclineMessage('generic_decline')).toContain('card was declined')
    expect(getDeclineMessage('do_not_honor')).toContain('card was declined')
  })

  it('maps insufficient funds code', () => {
    expect(getDeclineMessage('insufficient_funds')).toContain('insufficient funds')
  })

  it('maps expired card code', () => {
    expect(getDeclineMessage('expired_card')).toContain('card has expired')
  })

  it('maps incorrect CVC code', () => {
    expect(getDeclineMessage('incorrect_cvc')).toContain('security code (CVC) is incorrect')
    expect(getDeclineMessage('invalid_cvc')).toContain('security code (CVC) is incorrect')
  })

  it('maps expired session code', () => {
    expect(getDeclineMessage('expired')).toContain('session has expired')
    expect(getDeclineMessage('session_expired')).toContain('session has expired')
  })

  it('maps 3DS / SCA authentication failure codes', () => {
    expect(getDeclineMessage('authentication_required')).toContain('Card authentication failed')
    expect(getDeclineMessage('3ds_failed')).toContain('Card authentication failed')
    expect(getDeclineMessage('sca_failed')).toContain('Card authentication failed')
  })

  it('maps cannot accept payments / connection not active codes', () => {
    expect(getDeclineMessage('connection_not_active')).toContain('cannot accept payments right now')
    expect(getDeclineMessage('cannot_accept_payments')).toContain(
      'cannot accept payments right now',
    )
    expect(getDeclineMessage('restricted')).toContain('cannot accept payments right now')
  })

  it('maps provider unavailable code', () => {
    expect(getDeclineMessage('provider_unavailable')).toContain(
      'Payments are temporarily unavailable',
    )
    expect(getDeclineMessage('payments/provider-unavailable')).toContain(
      'Payments are temporarily unavailable',
    )
  })

  it('maps cancel code', () => {
    expect(getDeclineMessage('canceled')).toContain('canceled')
  })

  it('falls back to generic error message honestly', () => {
    expect(getDeclineMessage('unknown_error_xyz')).toContain("couldn't process your payment")
    expect(getDeclineMessage(null)).toContain("couldn't process your payment")
    expect(getDeclineMessage(undefined)).toContain("couldn't process your payment")
  })

  it('translates messages in Japanese', async () => {
    await setLocale('ja')
    expect(getDeclineMessage('card_declined')).toBe(
      'カードが拒否されました。別のお支払い方法をお試しください。',
    )
    expect(getDeclineMessage('insufficient_funds')).toBe(
      'カードの残高が不足しています。別のカードをお試しください。',
    )
    expect(getDeclineMessage('cannot_accept_payments')).toBe(
      'このストアは現在お支払いを受け付けることができません。後でもう一度お試しください。',
    )
    expect(getDeclineMessage('payments/provider-unavailable')).toBe(
      '決済サービスは一時的に利用できません。しばらくしてからもう一度お試しください。',
    )
    await setLocale('en')
  })
})
