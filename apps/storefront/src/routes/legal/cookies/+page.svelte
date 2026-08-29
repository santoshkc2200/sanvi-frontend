<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, Stack, Table, type TableColumn } from '@sanvi/ui'
import { COOKIE_REGISTRY } from '@sanvi/consent'
import type { ProcessingPurpose } from '@sanvi/consent'
import { localePath } from '$lib/links'

/**
 * The cookie policy, generated from `@sanvi/consent`'s COOKIE_REGISTRY —
 * the same registry the app actually sets cookies from, so the document
 * cannot drift from what the app really does. E2e asserts the cookies this
 * table names are exactly the ones observed in the browser.
 */
type CookieRow = {
  name: string
  purposeLabel: string
  setBy: string
  lifetime: string
}

const COPY = $derived({
  title: t['legal.cookies.title'](),
  intro: t['legal.cookies.intro'](),
  nameColumn: t['legal.cookies.nameColumn'](),
  purposeColumn: t['legal.cookies.purposeColumn'](),
  setByColumn: t['legal.cookies.setByColumn'](),
  lifetimeColumn: t['legal.cookies.lifetimeColumn'](),
  lifetimeYear: t['legal.cookies.lifetimeYear'](),
  lifetimeRotating: t['legal.cookies.lifetimeRotating'](),
})

function purposeLabel(purpose: ProcessingPurpose): string {
  // "Essential" is the same category label the consent surfaces render.
  return purpose === 'essential'
    ? t['consent.purpose.essential.label']()
    : t['legal.cookies.purposeYourChoice']()
}

const rows: CookieRow[] = $derived(
  COOKIE_REGISTRY.map((entry) => ({
    name: entry.name,
    purposeLabel: purposeLabel(entry.purpose),
    setBy: entry.setBy,
    lifetime: entry.name === 'sanvi_device' ? COPY.lifetimeRotating : COPY.lifetimeYear,
  })),
)

const columns: TableColumn<CookieRow>[] = $derived([
  { key: 'name', header: COPY.nameColumn },
  { key: 'purposeLabel', header: COPY.purposeColumn },
  { key: 'setBy', header: COPY.setByColumn },
  { key: 'lifetime', header: COPY.lifetimeColumn },
])
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>
    <Table rows={rows} getRowId={(row) => row.name} caption={COPY.title} {columns} />
    <a href={localePath('/privacy/choices')}>{t['storefront.footer.choices']()}</a>
  </Stack>
</Container>
