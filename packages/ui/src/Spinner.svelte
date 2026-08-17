<script lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
  /** Accessible label. Omit when a parent already announces loading state (e.g. Button's aria-busy). */
  label?: string
}

let { size = 'md', label }: Props = $props()
</script>

<span
  class="sanvi-spinner sanvi-spinner--{size}"
  role={label ? 'status' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#if label}<span class="sanvi-visually-hidden">{label}</span>{/if}
</span>

<style>
  .sanvi-spinner {
    display: inline-block;
    border-radius: var(--sanvi-radius-full);
    border: var(--sanvi-border-width-thick) solid currentColor;
    border-inline-end-color: transparent;
    animation: sanvi-spin 0.6s linear infinite;
  }

  .sanvi-spinner--sm {
    inline-size: var(--sanvi-spacing-4);
    block-size: var(--sanvi-spacing-4);
  }
  .sanvi-spinner--md {
    inline-size: var(--sanvi-spacing-6);
    block-size: var(--sanvi-spacing-6);
  }
  .sanvi-spinner--lg {
    inline-size: var(--sanvi-spacing-8);
    block-size: var(--sanvi-spacing-8);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .sanvi-spinner {
      animation-duration: 1.5s;
    }
  }
</style>
