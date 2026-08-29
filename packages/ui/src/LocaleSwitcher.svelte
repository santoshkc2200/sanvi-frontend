<script lang="ts">
import Select from './Select.svelte'

export interface LocaleSwitcherOption {
  code: string
  label: string
}

interface Props {
  options: LocaleSwitcherOption[]
  current: string
  /** Visually-hidden label — the switcher has no visible field label in the header. */
  label: string
  onSwitch: (code: string) => void
}

/**
 * The locale switcher for the SPA consoles (phase 06). SSR apps render
 * crawlable `<a hreflang>` links instead — a `<select>` is invisible to the
 * prerender crawler and to SEO, which is exactly backwards for the apps
 * whose locale URLs are canonical.
 */
let { options, current, label, onSwitch }: Props = $props()

const selectOptions = $derived(
  options.map((option) => ({ value: option.code, label: option.label })),
)
</script>

<label class="sanvi-locale-switcher">
  <span class="sanvi-visually-hidden">{label}</span>
  <Select value={current} options={selectOptions} onchange={(event) => onSwitch(event.currentTarget.value)} />
</label>

<style>
  .sanvi-locale-switcher {
    display: inline-block;
    /* Form-field sizing, not a design-tokens value. */
    min-inline-size: 8rem; /* sanvi-tokens-ignore */
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
</style>
