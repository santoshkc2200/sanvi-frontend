# @sanvi/billing-elements for Svelte

Svelte/SvelteKit replacements for the former React Stripe wrappers. They use
browser-only Stripe.js inside `onMount`, so the components remain safe to
render from a SvelteKit route.

```svelte
<script lang="ts">
  import { PaymentMethodForm } from '@sanvi/billing-elements'
</script>

<PaymentMethodForm
  clientSecret={setupIntentClientSecret}
  publishableKey={publicStripeKey}
  returnUrl="https://app.example.com/billing/return"
  labels={{ submit: 'Save card', submitting: 'Saving…', genericError: 'Try again.' }}
  onConfirmed={(setupIntentId) => confirmOnOurApi(setupIntentId)}
/>
```

`CheckoutPaymentForm` expects a Checkout Session client secret compatible with
Stripe Checkout Elements. Its `returnUrl` is supplied when confirmation runs,
matching the former React wrapper.
