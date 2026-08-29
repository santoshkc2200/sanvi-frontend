<script lang="ts">
import { Can } from '@sanvi/auth'
import {
  inviteMember,
  listInvitations,
  listMembers,
  listRolesTenant,
  removeMember,
  resendInvitation,
  revokeInvitation,
  updateMemberRoles,
} from '@sanvi/api-client'
import { fmt, normalizeEmail, t } from '@sanvi/i18n'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  Field,
  Input,
  showToast,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { getActiveTenantId } from '@sanvi/tenant'

type RoleView = Awaited<ReturnType<typeof listRolesTenant>>[number]
type MemberRow = Awaited<ReturnType<typeof listMembers>>[number]
type InvitationRow = Awaited<ReturnType<typeof listInvitations>>[number]

let members = $state<MemberRow[]>([])
let invitations = $state<InvitationRow[]>([])
let roles = $state<RoleView[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

let inviteEmail = $state('')
let inviteRoleIds = $state<string[]>([])
let inviting = $state(false)

// Sequencing token: a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's rows.
let loadSeq = 0

async function loadAll(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [membersResult, invitationsResult, rolesResult] = await Promise.all([
      listMembers(apiClient),
      listInvitations(apiClient),
      listRolesTenant(apiClient),
    ])
    if (seq !== loadSeq) return
    members = membersResult
    invitations = invitationsResult
    roles = rolesResult
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.members.genericError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void loadAll()
})

function roleNames(roleIds: string[]): string {
  return roleIds.map((id) => roles.find((role) => role.id === id)?.name ?? id).join(', ')
}

function toggleInviteRole(roleId: string, checked: boolean): void {
  inviteRoleIds = checked ? [...inviteRoleIds, roleId] : inviteRoleIds.filter((id) => id !== roleId)
}

async function handleInvite(): Promise<void> {
  inviting = true
  try {
    // NFKC-normalize what we *submit* (full-width ＠ etc.); the input keeps
    // the raw text for display.
    await inviteMember(apiClient, { email: normalizeEmail(inviteEmail), role_ids: inviteRoleIds })
    inviteEmail = ''
    inviteRoleIds = []
    showToast({ variant: 'success', title: t['admin.members.invitationSent']() })
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: t['admin.members.genericError']() })
  } finally {
    inviting = false
  }
}

async function handleRemove(userId: string): Promise<void> {
  try {
    await removeMember(apiClient, userId)
    showToast({ variant: 'success', title: t['admin.members.memberRemoved']() })
    await loadAll()
  } catch {
    // e.g. the last-owner guard rejects, or the actor lost the permission
    showToast({ variant: 'error', title: t['admin.members.genericError']() })
  }
}

async function handleResend(invitationId: string): Promise<void> {
  try {
    await resendInvitation(apiClient, invitationId)
    showToast({ variant: 'success', title: t['admin.members.invitationResent']() })
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: t['admin.members.genericError']() })
  }
}

async function handleRevoke(invitationId: string): Promise<void> {
  try {
    await revokeInvitation(apiClient, invitationId)
    showToast({ variant: 'success', title: t['admin.members.invitationRevoked']() })
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: t['admin.members.genericError']() })
  }
}

// Change-roles dialog
let changeRolesOpen = $state(false)
let changeRolesTarget = $state<MemberRow | undefined>(undefined)
let changeRolesSelected = $state<string[]>([])
let savingRoles = $state(false)

function openChangeRoles(member: MemberRow): void {
  changeRolesTarget = member
  changeRolesSelected = [...member.role_ids]
  changeRolesOpen = true
}

function toggleChangeRole(roleId: string, checked: boolean): void {
  changeRolesSelected = checked
    ? [...changeRolesSelected, roleId]
    : changeRolesSelected.filter((id) => id !== roleId)
}

async function handleSaveRoles(): Promise<void> {
  if (!changeRolesTarget) return
  savingRoles = true
  try {
    await updateMemberRoles(apiClient, changeRolesTarget.user_id, { role_ids: changeRolesSelected })
    changeRolesOpen = false
    showToast({ variant: 'success', title: t['admin.members.rolesUpdated']() })
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: t['admin.members.genericError']() })
  } finally {
    savingRoles = false
  }
}

// Bulk invite via CSV
let bulkInviting = $state(false)
let fileInput: HTMLInputElement | undefined = $state()

function parseCsvRow(line: string): { email: string; roleKeys: string[] } | undefined {
  const trimmed = line.trim()
  if (!trimmed) return undefined
  const [emailPart, rolesPart] = trimmed.split(',')
  const email = emailPart?.trim() ?? ''
  if (!email.includes('@')) return undefined
  const roleKeys = rolesPart
    ? rolesPart
        .trim()
        .split('|')
        .map((key) => key.trim())
        .filter(Boolean)
    : []
  return { email, roleKeys }
}

async function handleBulkInviteFile(
  event: Event & { currentTarget: HTMLInputElement },
): Promise<void> {
  const file = event.currentTarget.files?.[0]
  if (!file) return
  bulkInviting = true
  try {
    const text = await file.text()
    const rows = text
      .split('\n')
      .map(parseCsvRow)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    let invited = 0
    let failed = 0
    const unknownRoleKeys = new Set<string>()
    for (const row of rows) {
      const roleIds: string[] = []
      for (const key of row.roleKeys) {
        const role = roles.find((candidate) => candidate.key === key)
        if (role) roleIds.push(role.id)
        else unknownRoleKeys.add(key)
      }
      try {
        // Same NFKC normalization as the single-invite form — CSV cells pasted
        // from CJK sources carry the same full-width hazards.
        await inviteMember(apiClient, { email: normalizeEmail(row.email), role_ids: roleIds })
        invited += 1
      } catch {
        failed += 1
      }
    }

    showToast({
      variant: failed > 0 ? 'warning' : 'success',
      title:
        failed > 0
          ? t['admin.members.bulkInviteResultPartial']({ invited, failed })
          : t['admin.members.bulkInviteResultAll']({ invited }),
    })
    if (unknownRoleKeys.size > 0) {
      showToast({
        variant: 'warning',
        title: t['admin.members.unknownRolesIgnored']({
          keys: [...unknownRoleKeys].sort(fmt.collator().compare).join(', '),
        }),
      })
    }
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: t['admin.members.genericError']() })
  } finally {
    bulkInviting = false
    if (fileInput) fileInput.value = ''
  }
}
</script>

{#snippet rolesCell(member: MemberRow)}
  {roleNames(member.role_ids)}
{/snippet}

{#snippet memberActionsCell(member: MemberRow)}
  <Stack gap="2" align="start">
    <Can permission="identity.member.grant" tenantId={getActiveTenantId()}>
      {#snippet children()}
        <Button variant="ghost" size="sm" onclick={() => openChangeRoles(member)}>
          {t['admin.members.changeRolesAction']()}
        </Button>
      {/snippet}
    </Can>
    <Can permission="identity.member.remove" tenantId={getActiveTenantId()}>
      {#snippet children()}
        <Button variant="ghost" size="sm" onclick={() => handleRemove(member.user_id)}>
          {t['admin.members.removeAction']()}
        </Button>
      {/snippet}
    </Can>
  </Stack>
{/snippet}

{#snippet invitationActionsCell(invitation: InvitationRow)}
  <Can permission="identity.invitation.manage" tenantId={getActiveTenantId()}>
    {#snippet children()}
      <Stack gap="2" align="start">
        <Button variant="ghost" size="sm" onclick={() => handleResend(invitation.invitation_id)}>
          {t['admin.members.resendAction']()}
        </Button>
        <Button variant="ghost" size="sm" onclick={() => handleRevoke(invitation.invitation_id)}>
          {t['admin.members.revokeAction']()}
        </Button>
      </Stack>
    {/snippet}
  </Can>
{/snippet}

{#snippet statusCell(row: MemberRow | InvitationRow)}
  <Badge variant={row.status === 'active' || row.status === 'accepted' ? 'success' : 'neutral'}>
    {row.status}
  </Badge>
{/snippet}

<Can permission="identity.member.read" tenantId={getActiveTenantId()}>
  {#snippet children()}
    <Stack gap="8">
      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.members.loading']()} />
      {:else}
        <div>
          <h1>{t['admin.members.membersTitle']()}</h1>
          <DataTable
            columns={[
              { key: 'email', header: t['admin.members.emailLabel'](), alwaysVisible: true },
              { key: 'role_ids', header: t['admin.members.rolesLabel'](), cell: rolesCell },
              { key: 'status', header: t['admin.members.statusHeader'](), cell: statusCell },
              {
                key: 'actions',
                header: t['admin.members.actionsHeader'](),
                cell: memberActionsCell,
                alwaysVisible: true,
              },
            ]}
            rows={members}
            getRowId={(row) => row.user_id}
            emptyMessage={t['admin.members.noMembers']()}
          />
        </div>

        <div>
          <h2>{t['admin.members.invitationsTitle']()}</h2>
          <DataTable
            columns={[
              { key: 'email', header: t['admin.members.emailLabel'](), alwaysVisible: true },
              { key: 'status', header: t['admin.members.statusHeader'](), cell: statusCell },
              {
                key: 'actions',
                header: t['admin.members.actionsHeader'](),
                cell: invitationActionsCell,
                alwaysVisible: true,
              },
            ]}
            rows={invitations}
            getRowId={(row) => row.invitation_id}
            emptyMessage={t['admin.members.noInvitations']()}
          />
        </div>

        <Can permission="identity.member.invite" tenantId={getActiveTenantId()}>
          {#snippet children()}
            <Stack gap="6">
              <div>
                <h2>{t['admin.members.inviteTitle']()}</h2>
                <Stack gap="3">
                  <Field label={t['admin.members.emailLabel']()}>
                    {#snippet children({ id })}
                      <Input {id} type="email" bind:value={inviteEmail} required />
                    {/snippet}
                  </Field>
                  <fieldset>
                    <legend>{t['admin.members.rolesLabel']()}</legend>
                    {#each roles as role (role.id)}
                      <Checkbox
                        checked={inviteRoleIds.includes(role.id)}
                        onchange={(event) => toggleInviteRole(role.id, event.currentTarget.checked)}
                      >
                        {role.name}
                      </Checkbox>
                    {/each}
                  </fieldset>
                  <Button
                    loading={inviting}
                    disabled={!inviteEmail || inviteRoleIds.length === 0}
                    onclick={handleInvite}
                  >
                    {t['admin.members.inviteAction']()}
                  </Button>
                </Stack>
              </div>

              <div>
                <h2>{t['admin.members.bulkInviteTitle']()}</h2>
                <Stack gap="2" align="start">
                  <p class="sanvi-members__hint">{t['admin.members.bulkInviteHint']()}</p>
                  <input
                    bind:this={fileInput}
                    type="file"
                    accept=".csv"
                    aria-label={t['admin.members.bulkInviteAction']()}
                    disabled={bulkInviting}
                    onchange={handleBulkInviteFile}
                  />
                  {#if bulkInviting}<Spinner size="sm" label={t['admin.members.loading']()} />{/if}
                </Stack>
              </div>
            </Stack>
          {/snippet}
        </Can>
      {/if}
    </Stack>
  {/snippet}
  {#snippet fallback()}
    <Alert variant="error">{t['admin.members.denied']()}</Alert>
  {/snippet}
</Can>

<Dialog
  bind:open={changeRolesOpen}
  titleText={changeRolesTarget
    ? t['admin.members.changeRolesTitle']({ email: changeRolesTarget.email })
    : t['admin.members.changeRolesAction']()}
>
  {#snippet children()}
    <fieldset>
      <legend>{t['admin.members.rolesLabel']()}</legend>
      {#each roles as role (role.id)}
        <Checkbox
          checked={changeRolesSelected.includes(role.id)}
          onchange={(event) => toggleChangeRole(role.id, event.currentTarget.checked)}
        >
          {role.name}
        </Checkbox>
      {/each}
    </fieldset>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (changeRolesOpen = false)}>{t['admin.members.cancel']()}</Button>
    <Button loading={savingRoles} onclick={handleSaveRoles}>{t['admin.members.save']()}</Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-members__hint {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    max-width: 60ch;
  }
</style>
