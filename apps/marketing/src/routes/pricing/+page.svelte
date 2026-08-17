<script lang="ts">
import { Container, Stack } from '@sanvi/ui'

const COPY = {
  title: 'Pricing — Sanvi',
  metaDescription: 'Sanvi pricing plans.',
  heading: 'Pricing',
  body: 'Plans land in phase 04 (Pricing, Checkout & Billing UI). This route is a placeholder.',
}
</script>

<svelte:head>
  <title>{COPY.title}</title>
  <meta name="description" content={COPY.metaDescription} />
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="4">
    <h1>{COPY.heading}</h1>
    <p>{COPY.body}</p>
  </Stack>
</Container>
