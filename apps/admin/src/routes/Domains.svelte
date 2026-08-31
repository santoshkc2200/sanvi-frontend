<script lang="ts">
import { ApiError, listCustomDomains } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  EmptyState,
  Spinner,
  Stack,
  UpgradePrompt,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type CustomDomainView = components['schemas']['CustomDomainView']

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let domains = $state<CustomDomainView[]>([])

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true

  try {
    const result = await listCustomDomains(apiClient)
    if (seq !== loadSeq) return
    domains = result ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.domains.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})

function getStatusVariant(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'live':
      return 'success'
    case 'verified':
    case 'issuing_cert':
      return 'info'
    case 'degraded':
      return 'warning'
    case 'removed':
      return 'error'
    default:
      return 'neutral'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'live':
      return t['admin.domains.statusLive']()
    case 'verified':
      return t['admin.domains.statusVerified']()
    case 'issuing_cert':
      return t['admin.domains.statusIssuingCert']()
    case 'degraded':
      return t['admin.domains.statusDegraded']()
    case 'removed':
      return t['admin.domains.statusRemoved']()
    case 'verifying':
      return t['admin.domains.statusVerifying']()
    default:
      return t['admin.domains.statusPendingSetup']()
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'primary':
      return t['admin.domains.rolePrimary']()
    case 'redirect':
      return t['admin.domains.roleRedirect']()
    default:
      return t['admin.domains.roleAlias']()
  }
}

function getKindLabel(kind: string): string {
  switch (kind) {
    case 'purchased':
      return t['admin.domains.kindPurchased']()
    default:
      return t['admin.domains.kindConnected']()
  }
}

function certExpiryLabel(domain: CustomDomainView): string {
  if (!domain.cert_expires_at) return t['admin.domains.certExpiryNone']()
  return t['admin.domains.certExpiresOn']({ date: fmt.date(domain.cert_expires_at, 'medium') })
}
</script>

<svelte:head>
  <title>{t['admin.domains.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div class="sanvi-domains__header">
      <Cluster justify="space-between" align="center" gap="4">
        <div>
          <h1>{t['admin.domains.title']()}</h1>
          <p class="sanvi-domains__subtitle">{t['admin.domains.description']()}</p>
        </div>
        {#if entitled && !loading}
          <Cluster gap="3">
            <a class="sanvi-domains__header-action" href="/domains/connect">
              <Button variant="secondary">
                {t['admin.domains.connectButton']()}
              </Button>
            </a>
            <a class="sanvi-domains__header-action" href="/domains/purchase">
              <Button variant="primary">
                {t['admin.domains.purchaseButton']()}
              </Button>
            </a>
          </Cluster>
        {/if}
      </Cluster>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.domains.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        feature="domains.custom"
        title={t['admin.domains.upgradeTitle']()}
        description={t['admin.domains.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else if domains.length === 0}
      <EmptyState
        title={t['admin.domains.empty']()}
        description={t['admin.domains.emptyDescription']()}
      />
    {:else}
      <div class="sanvi-domains__table-wrapper">
        <table class="sanvi-domains__table">
          <thead>
            <tr>
              <th scope="col">{t['admin.domains.colHostname']()}</th>
              <th scope="col">{t['admin.domains.colRole']()}</th>
              <th scope="col">{t['admin.domains.colKind']()}</th>
              <th scope="col">{t['admin.domains.colStatus']()}</th>
              <th scope="col">{t['admin.domains.colCertExpiry']()}</th>
              <th scope="col">{t['admin.domains.colHealth']()}</th>
              <th scope="col" class="sanvi-domains__th--actions">{t['admin.domains.colActions']()}</th>
            </tr>
          </thead>
          <tbody>
            {#each domains as domain (domain.id)}
              <tr>
                <td>
                  <a class="sanvi-domains__domain-link" href={`/domains/${domain.id}`}>
                    <strong>{domain.hostname}</strong>
                  </a>
                </td>
                <td>
                  <Badge variant="neutral">
                    {#snippet children()}
                      {getRoleLabel(domain.role)}
                    {/snippet}
                  </Badge>
                </td>
                <td>
                  <span class="sanvi-domains__muted">{getKindLabel(domain.kind)}</span>
                </td>
                <td>
                  <Badge variant={getStatusVariant(domain.status)}>
                    {#snippet children()}
                      {getStatusLabel(domain.status)}
                    {/snippet}
                  </Badge>
                </td>
                <td>
                  <span class="sanvi-domains__muted">{certExpiryLabel(domain)}</span>
                </td>
                <td>
                  {#if domain.status === 'degraded' || Boolean(domain.failure)}
                    <Badge variant="warning">
                      {#snippet children()}
                        {t['admin.domains.healthDegraded']()}
                      {/snippet}
                    </Badge>
                  {:else}
                    <Badge variant="success">
                      {#snippet children()}
                        {t['admin.domains.healthHealthy']()}
                      {/snippet}
                    </Badge>
                  {/if}
                </td>
                <td class="sanvi-domains__td--actions">
                  <a class="sanvi-domains__action-link" href={`/domains/${domain.id}`}>
                    {t['admin.domains.viewDetails']()}
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-domains__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-domains__subtitle {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-domains__table-wrapper {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-domains__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
    text-align: start;
  }

  .sanvi-domains__table th {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    text-align: start;
  }

  .sanvi-domains__th--actions {
    text-align: end;
  }

  .sanvi-domains__table td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
    vertical-align: middle;
  }

  .sanvi-domains__table tbody tr:last-child td {
    border-block-end: none;
  }

  .sanvi-domains__td--actions {
    text-align: end;
  }

  .sanvi-domains__domain-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
  }

  .sanvi-domains__domain-link:hover {
    text-decoration: underline;
  }

  .sanvi-domains__action-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-domains__action-link:hover {
    text-decoration: underline;
  }

  .sanvi-domains__muted {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-domains__header-action {
    text-decoration: none;
  }
</style>
