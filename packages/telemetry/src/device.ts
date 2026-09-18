import type { DeviceClass } from './types'

/**
 * Coarse device class for the segmentation dimensions. Deliberately crude:
 * UA-CH when available, UA-string heuristics as the fallback, desktop as
 * the honest default. An emulated or ambiguous device reporting "desktop"
 * is a weaker signal than a confidently wrong class.
 */
export function detectDeviceClass(
  navigatorRef?: Pick<Navigator, 'userAgent'> & {
    userAgentData?: { mobile?: boolean }
    maxTouchPoints?: number
  },
): DeviceClass {
  const nav =
    navigatorRef ??
    (typeof navigator !== 'undefined'
      ? (navigator as Pick<Navigator, 'userAgent'> & {
          userAgentData?: { mobile?: boolean }
          maxTouchPoints?: number
        })
      : undefined)
  if (!nav) return 'desktop'

  const uaData = nav.userAgentData
  if (uaData?.mobile === true) return 'mobile'
  if (uaData?.mobile === false) return 'desktop'

  const ua = nav.userAgent ?? ''
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|Android.*Mobile|Windows Phone/i.test(ua)) return 'mobile'
  // Android tablets (e.g. SM-X710) carry no `Mobile` and no `Tablet` token —
  // whatever says `Android` past the phone test above is a tablet, and
  // falling through to desktop would misclassify every one of them.
  if (/Android/i.test(ua)) return 'tablet'
  // iPadOS 13+ masquerades as desktop Mac; a multi-touch "Mac" is a tablet.
  if (/Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return 'tablet'
  return 'desktop'
}
