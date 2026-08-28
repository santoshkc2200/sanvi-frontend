<script lang="ts">
import {
  getTenantContext,
  getTenantSettings,
  listInvitations,
  listMembers,
  listTenantEntitlements,
} from '@sanvi/api-client'
import { handleLinkClick } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Badge, Button, Container, EmptyState, Spinner, Stack, StatCard } from '@sanvi/ui'
import { apiClient } from '../lib/api'

interface ChecklistItem {
  id: string
  label: string
  done: boolean
  actionLabel: string
  actionHref: string
}

const COPY = {
  title: 'Dashboard',
  statusLabel: 'Status',
  regionLabel: 'Region',
  membersStat: 'Members',
  pendingInvitesStat: 'Pending invitations',
  checklistTitle: 'Getting started',
  goTo: 'Go',
  inviteTeammate: 'Invite a teammate',
  setTimezone: 'Set your timezone',
  loading: 'Loading',
  genericError: 'Could not load the dashboard. Try again in a moment.',
}

let tenant = $state<Awaited<ReturnType<typeof getTenantContext>> | undefined>(undefined)
let memberCount = $state(0)
let pendingInviteCount = $state(0)
let quotaEntitlements = $state<Awaited<ReturnType<typeof listTenantEntitlements>>>([])
let timezoneSet = $state(false)
let loading = $state(true)
let error = $state<string | undefined>(undefined)

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [tenantResult, members, invitations, entitlements, settings] = await Promise.all([
      getTenantContext(apiClient),
      listMembers(apiClient),
      listInvitations(apiClient),
      listTenantEntitlements(apiClient),
      getTenantSettings(apiClient),
    ])
    if (seq !== loadSeq) return
    tenant = tenantResult
    memberCount = members.length
    pendingInviteCount = invitations.filter((invitation) => invitation.status === 'pending').length
    quotaEntitlements = entitlements
      .filter((entitlement) => entitlement.kind === 'quota')
      .slice(0, 2)
    const storedTimezone = settings.settings['timezone']
    timezoneSet = typeof storedTimezone === 'string' && storedTimezone.length > 0
  } catch {
    if (seq !== loadSeq) return
    error = COPY.genericError
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})

// A small, deliberately extensible registry — each item declares its own
// completion check from data this page already has. Later phases (04
// billing, 07 theming, 08 domains, 09 payments) register their own items
// here as their capabilities land; nothing is stubbed ahead of that.
const checklist: ChecklistItem[] = $derived([
  {
    id: 'invite-teammate',
    label: COPY.inviteTeammate,
    done: memberCount > 1,
    actionLabel: COPY.goTo,
    actionHref: '/members',
  },
  {
    id: 'set-timezone',
    label: COPY.setTimezone,
    done: timezoneSet,
    actionLabel: COPY.goTo,
    actionHref: '/settings',
  },
])
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <h1>{COPY.title}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={COPY.loading} />
    {:else if tenant}
      <div>
        <h2>{tenant.display_name}</h2>
        <p class="sanvi-dashboard__meta">
          {COPY.statusLabel}: <Badge variant={tenant.status === 'active' ? 'success' : 'warning'}>{tenant.status}</Badge>
          &nbsp;·&nbsp;{COPY.regionLabel}: {tenant.region}
        </p>
      </div>

      <div class="sanvi-dashboard__stats">
        <StatCard label={COPY.membersStat} value={String(memberCount)} />
        <StatCard label={COPY.pendingInvitesStat} value={String(pendingInviteCount)} />
        {#each quotaEntitlements as entitlement (entitlement.feature)}
          <StatCard
            label={entitlement.feature}
            value={entitlement.limit === null || entitlement.limit === undefined ? '—' : String(entitlement.limit)}
          />
        {/each}
      </div>

      <div>
        <h2>{COPY.checklistTitle}</h2>
        <Stack gap="2">
          {#each checklist as item (item.id)}
            <div class="sanvi-dashboard__checklist-row">
              <Badge variant={item.done ? 'success' : 'neutral'}>{item.done ? '✓' : '○'}</Badge>
              <span class="sanvi-dashboard__checklist-label">{item.label}</span>
              {#if !item.done}
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={(event) => handleLinkClick(event, item.actionHref)}
                >
                  {item.actionLabel}
                </Button>
              {/if}
            </div>
          {/each}
        </Stack>
      </div>
    {:else}
      <EmptyState title={COPY.genericError} />
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-dashboard__meta {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-dashboard__stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-48), 1fr));
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-dashboard__checklist-row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-dashboard__checklist-label {
    flex: 1;
  }
</style>
