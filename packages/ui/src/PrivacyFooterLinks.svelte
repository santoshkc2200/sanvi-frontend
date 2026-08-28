<script lang="ts">
/**
 * The persistent privacy entry points, rendered by the platform layout on
 * every page and deliberately not theme-overridable (phase 05 plan §Risks:
 * a tenant theme must not be able to bury the opt-out).
 *
 * "Your privacy choices" appears everywhere. In `notice_and_opt_out`
 * jurisdictions the app adds the statutory wordings — the name is part of
 * the obligation, so a generic "cookie settings" label does not satisfy it.
 */
interface Props {
  /** Accessible name for the link group. */
  label: string
  choicesLabel: string
  choicesHref: string
  noticeLabel?: string
  noticeHref?: string
  optOutLabel?: string
  optOutHref?: string
  sensitiveLabel?: string
  sensitiveHref?: string
  /** Hook for SPA routers; storefront/SvelteKit apps can leave it unset. */
  onNavigate?: (href: string, event: MouseEvent) => void
  class?: string
}

let {
  label,
  choicesLabel,
  choicesHref,
  noticeLabel,
  noticeHref,
  optOutLabel,
  optOutHref,
  sensitiveLabel,
  sensitiveHref,
  onNavigate,
  class: className = '',
}: Props = $props()

interface FooterLink {
  href: string
  text: string
}

const links = $derived.by<FooterLink[]>(() => {
  const result: FooterLink[] = [{ href: choicesHref, text: choicesLabel }]
  if (optOutLabel && optOutHref) result.push({ href: optOutHref, text: optOutLabel })
  if (sensitiveLabel && sensitiveHref) result.push({ href: sensitiveHref, text: sensitiveLabel })
  if (noticeLabel && noticeHref) result.push({ href: noticeHref, text: noticeLabel })
  return result
})

function click(link: FooterLink, event: MouseEvent): void {
  if (onNavigate) {
    event.preventDefault()
    onNavigate(link.href, event)
  }
}
</script>

<nav class="sanvi-footer-privacy {className}" aria-label={label}>
  <ul class="sanvi-footer-privacy__list">
    {#each links as link (link.href)}
      <li>
        <a href={link.href} onclick={(event) => click(link, event)}>{link.text}</a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .sanvi-footer-privacy__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sanvi-footer-privacy__list a {
    color: var(--sanvi-color-link-primary);
    font-size: var(--sanvi-font-size-sm);
    text-decoration: underline;
  }

  .sanvi-footer-privacy__list a:hover {
    color: var(--sanvi-color-text-primary);
  }
</style>
