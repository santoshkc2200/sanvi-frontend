<script lang="ts">
import Select from './Select.svelte'

export interface TenantSwitcherOption {
  tenantId: string
  label: string
}

interface Props {
  options: TenantSwitcherOption[]
  activeTenantId: string | undefined
  /** Visually-hidden label — the switcher has no visible field label in the header. */
  label: string
  onSwitch: (tenantId: string) => void
}

let { options, activeTenantId, label, onSwitch }: Props = $props()

const selectOptions = $derived(
  options.map((option) => ({ value: option.tenantId, label: option.label })),
)
</script>

<label class="sanvi-tenant-switcher">
  <span class="sanvi-visually-hidden">{label}</span>
  <Select
    value={activeTenantId ?? ''}
    options={selectOptions}
    onchange={(event) => onSwitch(event.currentTarget.value)}
  />
</label>

<style>
  .sanvi-tenant-switcher {
    display: inline-block;
    min-inline-size: 10rem;
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
