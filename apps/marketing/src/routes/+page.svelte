<script lang="ts">
import { t } from '@sanvi/i18n'
import { Button, Cluster, Container, Stack } from '@sanvi/ui'
import { localePath } from '$lib/links'

// A relative `/login` link is a placeholder: marketing has no tenant of
// its own to sign in to (it's the org-level landing page, not a
// storefront) — this becomes a real cross-app URL once phase 08 (custom
// domains/tenant subdomain routing) decides that shape.
</script>

<svelte:head>
  <title>{t['marketing.home.title']()}</title>
  <meta name="description" content={t['marketing.home.description']()} />
  <meta property="og:title" content={t['marketing.home.ogTitle']()} />
  <meta property="og:description" content={t['marketing.home.description']()} />
  <meta property="og:type" content="website" />
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6" align="center">
    <h1>{t['marketing.home.heading']()}</h1>
    <p>{t['marketing.home.lead']()}</p>
    <Cluster gap="4" justify="center">
      <Button variant="primary">{t['marketing.home.cta']()}</Button>
      <!-- rel="external" keeps the prerender crawler (and the SvelteKit
           client router) off this placeholder until phase 08 replaces it
           with the real cross-app URL. -->
      <a href="/login" rel="external">{t['marketing.home.signIn']()}</a>
    </Cluster>
    <Cluster gap="4" justify="center">
      <a href={localePath('/pricing')}>{t['marketing.nav.pricing']()}</a>
    </Cluster>
  </Stack>
</Container>
