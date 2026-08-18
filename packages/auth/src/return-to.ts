/**
 * The open-redirect guard: `return_to` values only ever come from a URL
 * query param an attacker fully controls, so the only safe shape is "a path
 * on this same app" — never a full URL, never protocol-relative (`//evil.com`
 * parses as same-origin-looking but browsers treat it as external), never
 * anything Kratos or our own redirect logic could be tricked into treating
 * as cross-origin. This is the one place that decision is made — every
 * `return_to` read (route guards, `startFlow`, the post-login redirect)
 * should go through this rather than trusting the query param directly.
 */
export function safeReturnTo(candidate: string | null | undefined): string | undefined {
  if (!candidate) return undefined
  if (!candidate.startsWith('/')) return undefined
  if (candidate.startsWith('//')) return undefined
  if (candidate.startsWith('/\\')) return undefined
  return candidate
}
