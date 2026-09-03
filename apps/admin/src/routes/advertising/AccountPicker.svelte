<script lang="ts">
import { ApiError, createAdConnection } from '@sanvi/api-client'
import type { AdAccountView } from '@sanvi/api-client'
import { hasFreshAal2, getSession } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import {
  AdAccountPicker,
  Alert,
  Button,
  Container,
  showToast,
  Spinner,
  Stack,
  type AdPickerLabels,
} from '@sanvi/ui'
import {
  clearPendingAdConnection,
  peekPendingAdConnection,
} from '../../lib/advertising-connect.svelte'
import { apiClient } from '../../lib/api'

/**
 * The account picker route (`/advertising/connect/:platform`, phase 10,
 * TASK-011). The OAuth callback handed over a pending connection and the
 * ad accounts it can reach; here the tenant picks **the** account and
 * declares its currency and timezone — the values every platform-reported
 * number is read in — and the connection goes live.
 *
 * The pending connection lives only in module state (there is no
 * accounts-list endpoint to refetch), so a reload or a stale tab lands on
 * the restart state rather than a picker full of accounts the backend has
 * already discarded.
 */
let { platform }: { platform: string } = $props()

let loading = $state(true)
let pendingMissing = $state(false)
let accounts = $state<AdAccountView[]>([])
let submitting = $state(false)
let errorMessage = $state<string | undefined>(undefined)

const labels: AdPickerLabels = $derived({
  searchLabel: t['admin.advertising.pickerSearchLabel'](),
  searchPlaceholder: t['admin.advertising.pickerSearchPlaceholder'](),
  accountsGroupLabel: t['admin.advertising.pickerAccountsGroup'](),
  noMatches: t['admin.advertising.pickerNoMatches'](),
  currencyLabel: t['admin.advertising.pickerCurrencyLabel'](),
  currencyHint: t['admin.advertising.pickerCurrencyHint'](),
  currencyPlaceholder: t['admin.advertising.pickerCurrencyPlaceholder'](),
  timezoneLabel: t['admin.advertising.pickerTimezoneLabel'](),
  timezoneHint: t['admin.advertising.pickerTimezoneHint'](),
  timezonePlaceholder: t['admin.advertising.pickerTimezonePlaceholder'](),
  timezoneConsequence: t['admin.advertising.pickerTimezoneConsequence'](),
  confirmLabel: t['admin.advertising.pickerConfirm'](),
  cancelLabel: t['common.cancel'](),
})

function backToConnections(): void {
  clearPendingAdConnection()
  navigate('/advertising/connections')
}

$effect(() => {
  // The pending connection is read once per mount — it exists by the time
  // this route resolves (the callback navigated here in the same SPA
  // session) or it does not exist at all.
  const pending = peekPendingAdConnection(platform)
  accounts = pending?.accounts ?? []
  loading = false
  pendingMissing = pending === null
})

async function handleConfirm(choice: {
  externalAccountId: string
  displayName: string
  currency: string
  timezone: string
}): Promise<void> {
  const pending = peekPendingAdConnection(platform)
  if (!pending || submitting) return

  submitting = true
  errorMessage = undefined
  try {
    await createAdConnection(apiClient, {
      connectionId: pending.connectionId,
      externalAccountId: choice.externalAccountId,
      currency: choice.currency,
      timezone: choice.timezone,
    })
    clearPendingAdConnection()
    showToast({
      title: t['admin.advertising.connectSuccessTitle']({
        account: choice.displayName,
      }),
      variant: 'success',
    })
    navigate('/advertising/connections')
  } catch (err) {
    submitting = false
    if (err instanceof ApiError && err.status === 403 && hasFreshAal2(getSession()) === false) {
      // Freshness lapsed between the picker opening and confirming — the
      // same step-up path the connections screen uses.
      navigate(
        `/step-up?return_to=${encodeURIComponent(`/advertising/connections?connect=${platform}`)}`,
      )
      return
    }
    if (err instanceof ApiError && err.status === 400) {
      errorMessage = t['admin.advertising.pickerInvalidAccount']()
    } else {
      errorMessage = t['admin.advertising.pickerFailed']()
    }
  }
}
</script>

<svelte:head>
  <title>{t['admin.advertising.connectionsTitle']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.pickerTitle']()}</h1>
      <p>{t['admin.advertising.pickerDescription']()}</p>
    </div>

    {#if loading}
      <Spinner label={t['common.loading']()} />
    {:else if pendingMissing}
      <Alert variant="warning">{t['admin.advertising.pickerPendingMissing']()}</Alert>
      <Button variant="primary" onclick={backToConnections}>
        {t['admin.advertising.backToConnections']()}
      </Button>
    {:else}
      <AdAccountPicker {accounts} {labels} {submitting} {errorMessage} onConfirm={handleConfirm} onCancel={backToConnections} />
    {/if}
  </Stack>
</Container>
