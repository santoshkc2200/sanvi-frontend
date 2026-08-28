<script lang="ts">
import { ApiError, listPaymentProviders } from '@sanvi/api-client'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Container, EmptyState, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'

// 09.0 ships only the envelope: the catalog is empty until 09.1 adds real
// providers, and Stripe Connect isn't wired in until 09.2. This page's job
// right now is just to prove the route is reachable and correctly gated —
// not to render a provider list yet.
const COPY = {
  title: 'Payments',
  description: 'Connect a payment provider to accept checkout on your storefront.',
  loading: 'Loading',
  empty: 'No payment providers connected yet.',
  emptyDescription: 'Provider connections are coming in a later release.',
  upgradeTitle: 'Upgrade required',
  upgradeDescription:
    'Accepting payments needs a plan with Stripe Connect. Ask a tenant owner to upgrade.',
  genericError: 'Could not load payment providers. Try again in a moment.',
}

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  try {
    await listPaymentProviders(apiClient)
  } catch (err) {
    // 403 with the entitlement key named (never a bare 404) is how the
    // backend tells us to render the upgrade prompt instead of an error —
    // a 404 means the `payments.enabled` phase flag itself is off, which
    // reads the same way to a tenant admin: not available yet.
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = COPY.genericError
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{COPY.title}</h1>
      <p>{COPY.description}</p>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={COPY.loading} />
    {:else if !entitled}
      <EmptyState title={COPY.upgradeTitle} description={COPY.upgradeDescription} />
    {:else if !error}
      <EmptyState title={COPY.empty} description={COPY.emptyDescription} />
    {/if}
  </Stack>
</Container>
