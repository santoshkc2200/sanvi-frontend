<script lang="ts">
import { Button, Cluster, Container, Stack } from '@sanvi/ui'

// Concentrated here, not inline in the template, so swapping this object
// for a `@sanvi/i18n` message lookup in phase 06 touches one place.
const COPY = {
  title: 'Sanvi — Build, launch, and run your course platform',
  description:
    'Sanvi is a multi-tenant course platform: your own storefront, billing, and admin console.',
  ogTitle: 'Sanvi',
  heading: 'Sanvi',
  lead: 'The foundations phase is up — this page is a placeholder for the real marketing site.',
  cta: 'Get started',
  signIn: 'Sign in',
}

// A relative `/login` link is a placeholder: marketing has no tenant of its
// own to sign in to (it's the org-level landing page, not a storefront) —
// this becomes a real cross-app URL once phase 08 (custom domains/tenant
// subdomain routing) decides that shape.
</script>

<svelte:head>
  <title>{COPY.title}</title>
  <meta name="description" content={COPY.description} />
  <meta property="og:title" content={COPY.ogTitle} />
  <meta property="og:description" content={COPY.description} />
  <meta property="og:type" content="website" />
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6" align="center">
    <h1>{COPY.heading}</h1>
    <p>{COPY.lead}</p>
    <Cluster gap="4" justify="center">
      <Button variant="primary">{COPY.cta}</Button>
      <a href="/login">{COPY.signIn}</a>
    </Cluster>
  </Stack>
</Container>
