import { t } from '@sanvi/i18n'

export function getDeclineMessage(code: string | null | undefined): string {
  if (!code) {
    return t['storefront.checkout.error.generic']()
  }

  const normalized = code.toLowerCase().trim()

  switch (normalized) {
    case 'card_declined':
    case 'generic_decline':
    case 'do_not_honor':
    case 'transaction_not_allowed':
    case 'revocation_of_authorization':
      return t['storefront.checkout.error.cardDeclined']()

    case 'insufficient_funds':
      return t['storefront.checkout.error.insufficientFunds']()

    case 'expired_card':
      return t['storefront.checkout.error.expiredCard']()

    case 'incorrect_cvc':
    case 'invalid_cvc':
    case 'incorrect_number':
    case 'invalid_number':
    case 'invalid_expiry_month':
    case 'invalid_expiry_year':
      return t['storefront.checkout.error.incorrectCvc']()

    case 'expired':
    case 'session_expired':
      return t['storefront.checkout.error.expiredSession']()

    case 'authentication_required':
    case '3ds_failed':
    case 'sca_failed':
    case 'highest_risk_level':
      return t['storefront.checkout.error.authenticationRequired']()

    case 'connection_not_active':
    case 'cannot_accept_payments':
    case 'restricted':
    case 'payments/connection-not-active':
    case 'payments/cannot-accept-payments':
      return t['storefront.checkout.error.connectionUnavailable']()

    case 'provider_unavailable':
    case 'provider-unavailable':
    case 'payments/provider-unavailable':
      return t['storefront.checkout.error.providerUnavailable']()

    case 'canceled':
      return t['storefront.checkout.canceledNotice']()

    default:
      return t['storefront.checkout.error.generic']()
  }
}
