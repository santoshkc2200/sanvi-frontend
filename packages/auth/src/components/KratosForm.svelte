<script lang="ts">
import { Alert, Button, Checkbox, Field, Input, Stack } from '@sanvi/ui'
import { untrack } from 'svelte'
import type { HTMLInputAttributes } from 'svelte/elements'
import { translateKratosMessage } from '../kratos/messages'
import type { KratosFlow, UiNode } from '../kratos/types'

/**
 * Generic Kratos UI-node renderer — every self-service screen (sign in,
 * sign up, recovery, verification, settings) is `<KratosForm>` plus a
 * per-flow wrapper for layout/copy, per the phase-02 plan's "a generic
 * renderer survives [Kratos node] changes, overrides make it look
 * designed." Pure rendering only: it never calls `fetch` (`@sanvi/ui`'s own
 * import-boundary rule extends here by convention — this lives in
 * `@sanvi/auth`, not `@sanvi/ui`, specifically so it's free to import
 * `@sanvi/api-client`-shaped types without breaking that rule elsewhere,
 * but the component itself stays side-effect-free; the caller owns
 * `startFlow`/`submitFlow`).
 */
interface Props {
  flow: KratosFlow
  /**
   * Fires with the activated submit node and every other field's current
   * value (hidden defaults included) — deliberately *not* merged together:
   * a flow can carry several submit nodes at once (password vs. Google vs.
   * email-code), so only the one actually clicked belongs in the request.
   * Call `submitFlow(client, flow, { ...values, [submitNode.attributes.name!]: submitNode.attributes.value })`.
   */
  onSubmit: (submitNode: UiNode, values: Record<string, string | boolean>) => void
  submitting?: boolean
}

let { flow, onSubmit, submitting = false }: Props = $props()

/** Mirrors `kratos/flow.ts`'s `collectNodeValues` — submit/button nodes are excluded here too, or every method/provider on the flow would leak into whichever one the user actually activates (see that function's doc comment). */
function initialValues(current: KratosFlow): Record<string, string | boolean> {
  const initial: Record<string, string | boolean> = {}
  for (const node of current.ui.nodes) {
    if (node.attributes.node_type !== 'input') continue
    if (node.attributes.type === 'submit' || node.attributes.type === 'button') continue
    const { name, type, value } = node.attributes
    if (!name) continue
    if (type === 'checkbox') initial[name] = Boolean(value)
    else if (typeof value === 'string') initial[name] = value
  }
  return initial
}

// `untrack`: this only reads `flow` for the mount-time initial value — the
// `$effect` below is the intentional re-read on every later change, so the
// `$state` initializer shouldn't itself be a reactive dependency on `flow`.
let values: Record<string, string | boolean> = $state(untrack(() => initialValues(flow)))

// A resubmitted/expired-flow-restarted `flow` prop swaps in new nodes (and
// Kratos's own re-prefilled values, e.g. the identifier the user already
// typed) — resync rather than keep stale local state pointed at nodes that
// may no longer exist.
$effect(() => {
  values = initialValues(flow)
})

function labelFor(node: UiNode): string {
  return node.meta.label ? translateKratosMessage(node.meta.label) : (node.attributes.name ?? '')
}

function errorFor(node: UiNode): string | undefined {
  const message = node.messages.find((candidate) => candidate.type === 'error')
  return message ? translateKratosMessage(message) : undefined
}

function inputType(node: UiNode): 'text' | 'email' | 'password' {
  if (node.attributes.type === 'password') return 'password'
  if (node.attributes.type === 'email') return 'email'
  return 'text'
}

/** Kratos sends valid `autocomplete` tokens (`email`, `current-password`, `one-time-code`, ...) as a plain string; `HTMLInputAttributes` wants the narrower `FullAutoFill` literal union. */
function autocompleteFor(node: UiNode): HTMLInputAttributes['autocomplete'] {
  return node.attributes.autocomplete as HTMLInputAttributes['autocomplete']
}

function handleSubmit(event: MouseEvent, node: UiNode): void {
  event.preventDefault()
  onSubmit(node, values)
}

function nodeKey(node: UiNode): string {
  const attributes = node.attributes
  // `value` is load-bearing, not cosmetic: every OIDC provider's submit node
  // shares `name: 'provider'` and is distinguished only by its value, so a
  // Google + Microsoft flow is two nodes with the same `group:name` — and a
  // keyed `each` on that alone throws a duplicate-key error at render.
  return `${node.group}:${attributes.name ?? attributes.id ?? attributes.href ?? attributes.src ?? ''}:${String(
    attributes.value ?? '',
  )}`
}
</script>

<div class="sanvi-kratos-form">
  {#if flow.ui.messages?.length}
    <Stack gap="2">
      <!-- Unkeyed: Kratos can repeat a message id at the container level, and these Alerts carry no state worth diffing. -->
      {#each flow.ui.messages as message}
        <Alert variant={message.type === 'error' ? 'error' : message.type === 'success' ? 'success' : 'info'}>
          {translateKratosMessage(message)}
        </Alert>
      {/each}
    </Stack>
  {/if}

  <Stack gap="4">
    {#each flow.ui.nodes as node (nodeKey(node))}
      {#if node.attributes.node_type === 'input'}
        {#if node.attributes.type === 'hidden'}
          <input
            type="hidden"
            name={node.attributes.name}
            value={String(
              values[node.attributes.name ?? ''] ?? node.attributes.value ?? '',
            )}
          />
        {:else if node.attributes.type === 'submit'}
          <Button
            type="button"
            variant={node.group === 'oidc' || node.group === 'link' ? 'secondary' : 'primary'}
            fullWidth
            loading={submitting}
            onclick={(event) => handleSubmit(event, node)}
          >
            {labelFor(node)}
          </Button>
        {:else if node.attributes.type === 'checkbox'}
          <Checkbox
            name={node.attributes.name}
            checked={Boolean(values[node.attributes.name ?? ''])}
            disabled={node.attributes.disabled}
            onchange={(event) => {
              if (node.attributes.name) values[node.attributes.name] = event.currentTarget.checked
            }}
          >
            {labelFor(node)}
          </Checkbox>
        {:else}
          <Field label={labelFor(node)} error={errorFor(node)} required={node.attributes.required}>
            {#snippet children({ id, describedBy, invalid })}
              <Input
                {id}
                name={node.attributes.name}
                type={inputType(node)}
                value={String(values[node.attributes.name ?? ''] ?? '')}
                disabled={node.attributes.disabled}
                required={node.attributes.required}
                autocomplete={autocompleteFor(node)}
                {invalid}
                {describedBy}
                oninput={(event) => {
                  if (node.attributes.name) values[node.attributes.name] = event.currentTarget.value
                }}
              />
            {/snippet}
          </Field>
        {/if}
      {:else if node.type === 'text' && node.attributes.text}
        <p class="sanvi-kratos-form__text">{translateKratosMessage(node.attributes.text)}</p>
      {:else if node.type === 'a' && node.attributes.href}
        <a class="sanvi-kratos-form__link" href={node.attributes.href}>{labelFor(node)}</a>
      {:else if node.type === 'img' && node.attributes.src}
        <img class="sanvi-kratos-form__image" src={node.attributes.src} alt={labelFor(node)} />
      {/if}
    {/each}
  </Stack>
</div>

<style>
  .sanvi-kratos-form {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-kratos-form__text {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-kratos-form__link {
    color: var(--sanvi-color-primary-base);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-kratos-form__image {
    max-width: 100%;
    border-radius: var(--sanvi-radius-md);
  }
</style>
