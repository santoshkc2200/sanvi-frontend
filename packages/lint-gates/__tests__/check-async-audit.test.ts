import { describe, expect, it } from 'vitest'
import { compareAuditWithRoutes, parseAuditRoutes } from '../src/check-async-audit.mjs'

describe('check:async-audit (TASK-023 step 1)', () => {
  const DOC = `# Async-state audit

Intro prose that mentions \`/not-a-heading\` but is not a route entry.

## storefront

### \`/\`
states noted here

### \`/checkout\`
states noted here

## admin

### \`/\`
states noted here

### \`/payments/:id\`
states noted here
`

  it('parses every route heading under its app section, and nothing else', () => {
    const parsed = parseAuditRoutes(DOC)
    expect(parsed).toEqual({
      storefront: ['/', '/checkout'],
      admin: ['/', '/payments/:id'],
    })
  })

  it('returns an empty entry for an app section without route headings', () => {
    const parsed = parseAuditRoutes('# x\n\n## marketing\n\nno routes yet\n')
    expect(parsed).toEqual({ marketing: [] })
  })

  it('passes when the audit covers exactly the enumerated routes', () => {
    const result = compareAuditWithRoutes(
      { storefront: ['/', '/checkout'], admin: ['/'] },
      { storefront: ['/', '/checkout'], admin: ['/'] },
    )
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual({})
    expect(result.stale).toEqual({})
  })

  it('fails and names every route the audit is missing — enumerate, not sample', () => {
    const result = compareAuditWithRoutes(
      { storefront: ['/'] },
      { storefront: ['/', '/checkout', '/legal/cookies'] },
    )
    expect(result.ok).toBe(false)
    expect(result.missing.storefront).toEqual(['/checkout', '/legal/cookies'])
  })

  it('fails on audit entries that no longer exist in the manifest', () => {
    const result = compareAuditWithRoutes({ admin: ['/', '/removed-route'] }, { admin: ['/'] })
    expect(result.ok).toBe(false)
    expect(result.stale.admin).toEqual(['/removed-route'])
  })

  it('fails on an app with routes but no audit section at all', () => {
    const result = compareAuditWithRoutes({}, { admin: ['/'] })
    expect(result.ok).toBe(false)
    expect(result.missing.admin).toEqual(['/'])
  })
})
