<script lang="ts">
import { Container, Stack, Table, type TableColumn } from '@sanvi/ui'
import { COOKIE_REGISTRY } from '@sanvi/consent'
import type { ProcessingPurpose } from '@sanvi/consent'

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

const COPY = {
  title: 'Cookie policy',
  intro:
    'This table is generated from the registry of cookies the platform actually sets. Essential cookies keep the store working; everything non-essential only runs after you allow it, and each purpose is listed in Your privacy choices.',
  nameColumn: 'Cookie',
  purposeColumn: 'Purpose category',
  setByColumn: 'Set by',
  lifetimeColumn: 'Lifetime',
  lifetimeYear: 'Up to 12 months',
  lifetimeRotating: 'Rolling — replaced at least every 60 days',
  choicesLink: 'Your privacy choices',
}

function purposeLabel(purpose: ProcessingPurpose): string {
  return purpose === 'essential' ? 'Essential' : 'Your choice'
}

const rows: CookieRow[] = COOKIE_REGISTRY.map((entry) => ({
  name: entry.name,
  purposeLabel: purposeLabel(entry.purpose),
  setBy: entry.setBy,
  lifetime: entry.name === 'sanvi_device' ? COPY.lifetimeRotating : COPY.lifetimeYear,
}))

const columns: TableColumn<CookieRow>[] = [
  { key: 'name', header: COPY.nameColumn },
  { key: 'purposeLabel', header: COPY.purposeColumn },
  { key: 'setBy', header: COPY.setByColumn },
  { key: 'lifetime', header: COPY.lifetimeColumn },
]
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>
    <Table rows={rows} getRowId={(row) => row.name} caption={COPY.title} {columns} />
    <a href="/privacy/choices">{COPY.choicesLink}</a>
  </Stack>
</Container>
