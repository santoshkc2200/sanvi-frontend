<script lang="ts">
import Button from './Button.svelte'

/**
 * The notice-at-collection surface (US `notice_and_opt_out` mode). A
 * *non-blocking* region — never a modal, never a consent recorder: US law
 * asks for notice plus an honoured refusal, and a button that pretends to
 * record "consent" the law did not ask for is a dark pattern. The two links
 * lead to the preference centre and the notice; acknowledging only records
 * that the notice was served.
 */
interface Props {
  open: boolean
  title: string
  body: string
  /** Data categories collected, one string each (already localized by the app). */
  categories: string[]
  /** Plain sentence about whether data is sold/shared — from the backend notice, verbatim. */
  saleShareNote: string
  choicesLabel: string
  choicesHref: string
  noticeLabel: string
  noticeHref: string
  acknowledgeLabel: string
  onAcknowledge: () => void
  class?: string
}

let {
  open,
  title,
  body,
  categories,
  saleShareNote,
  choicesLabel,
  choicesHref,
  noticeLabel,
  noticeHref,
  acknowledgeLabel,
  onAcknowledge,
  class: className = '',
}: Props = $props()

const uid = $props.id()
const headingId = `sanvi-notice-collection-${uid}`
</script>

{#if open}
  <section class="sanvi-notice-collection {className}" aria-labelledby={headingId}>
    <div class="sanvi-notice-collection__text">
      <h2 class="sanvi-notice-collection__title" id={headingId}>{title}</h2>
      <p class="sanvi-notice-collection__body">{body}</p>
      <p class="sanvi-notice-collection__meta">
        <span class="sanvi-notice-collection__meta-label">{categories.join(' · ')}</span>
      </p>
      <p class="sanvi-notice-collection__meta">{saleShareNote}</p>
    </div>
    <div class="sanvi-notice-collection__actions">
      <a class="sanvi-notice-collection__link" href={choicesHref}>{choicesLabel}</a>
      <a class="sanvi-notice-collection__link" href={noticeHref}>{noticeLabel}</a>
      <Button variant="ghost" size="sm" onclick={onAcknowledge}>{acknowledgeLabel}</Button>
    </div>
  </section>
{/if}

<style>
  .sanvi-notice-collection {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-4);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
  }

  .sanvi-notice-collection__text {
    min-width: 0;
    flex: 1 1 60%;
  }

  .sanvi-notice-collection__title {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-notice-collection__body {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    line-height: var(--sanvi-line-height-base);
  }

  .sanvi-notice-collection__meta {
    margin: 0 0 var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-notice-collection__meta-label {
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-notice-collection__actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-notice-collection__link {
    color: var(--sanvi-color-link-primary);
    font-size: var(--sanvi-font-size-sm);
    text-decoration: underline;
  }

  .sanvi-notice-collection__link:hover {
    color: var(--sanvi-color-text-primary);
  }
</style>
