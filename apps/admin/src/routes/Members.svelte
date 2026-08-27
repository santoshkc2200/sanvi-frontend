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

type RoleView = Awaited<ReturnType<typeof listRolesTenant>>[number]
type MemberRow = Awaited<ReturnType<typeof listMembers>>[number]
type InvitationRow = Awaited<ReturnType<typeof listInvitations>>[number]

const COPY = {
  membersTitle: 'Members',
  invitationsTitle: 'Invitations',
  inviteTitle: 'Invite a member',
  bulkInviteTitle: 'Bulk invite via CSV',
  bulkInviteHint:
    'One row per invite: email, then an optional second column of role keys separated by "|" (e.g. alice@example.com,owner|billing).',
  bulkInviteAction: 'Upload CSV',
  bulkInviteResult: (invited: number, failed: number) =>
    failed > 0 ? `${invited} invited, ${failed} failed.` : `${invited} invited.`,
  emailLabel: 'Email',
  rolesLabel: 'Roles',
  inviteAction: 'Send invitation',
  removeAction: 'Remove',
  resendAction: 'Resend',
  revokeAction: 'Revoke',
  changeRolesAction: 'Change roles',
  changeRolesTitle: (email: string) => `Change roles for ${email}`,
  save: 'Save',
  cancel: 'Cancel',
  statusHeader: 'Status',
  actionsHeader: 'Actions',
  loading: 'Loading',
  genericError: 'Something went wrong. Try again in a moment.',
  denied: "You don't have permission to view this tenant's members.",
  noMembers: 'No members yet.',
  noInvitations: 'No pending invitations.',
  rolesUpdated: 'Roles updated.',
  memberRemoved: 'Member removed.',
  invitationSent: 'Invitation sent.',
  invitationResent: 'Invitation resent.',
  invitationRevoked: 'Invitation revoked.',
}

let members = $state<MemberRow[]>([])
let invitations = $state<InvitationRow[]>([])
let roles = $state<RoleView[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

let inviteEmail = $state('')
let inviteRoleIds = $state<string[]>([])
let inviting = $state(false)

async function loadAll(): Promise<void> {
  loading = true
  error = undefined
  try {
    const [membersResult, invitationsResult, rolesResult] = await Promise.all([
      listMembers(apiClient),
      listInvitations(apiClient),
      listRolesTenant(apiClient),
    ])
    members = membersResult
    invitations = invitationsResult
    roles = rolesResult
  } catch {
    error = COPY.genericError
  } finally {
    loading = false
  }
}

$effect(() => {
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
    await inviteMember(apiClient, { email: inviteEmail, role_ids: inviteRoleIds })
    inviteEmail = ''
    inviteRoleIds = []
    showToast({ variant: 'success', title: COPY.invitationSent })
    await loadAll()
  } finally {
    inviting = false
  }
}

async function handleRemove(userId: string): Promise<void> {
  await removeMember(apiClient, userId)
  showToast({ variant: 'success', title: COPY.memberRemoved })
  await loadAll()
}

async function handleResend(invitationId: string): Promise<void> {
  await resendInvitation(apiClient, invitationId)
  showToast({ variant: 'success', title: COPY.invitationResent })
  await loadAll()
}

async function handleRevoke(invitationId: string): Promise<void> {
  await revokeInvitation(apiClient, invitationId)
  showToast({ variant: 'success', title: COPY.invitationRevoked })
  await loadAll()
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
    showToast({ variant: 'success', title: COPY.rolesUpdated })
    await loadAll()
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
    for (const row of rows) {
      const roleIds = row.roleKeys
        .map((key) => roles.find((role) => role.key === key)?.id)
        .filter((id): id is string => Boolean(id))
      try {
        await inviteMember(apiClient, { email: row.email, role_ids: roleIds })
        invited += 1
      } catch {
        failed += 1
      }
    }

    showToast({
      variant: failed > 0 ? 'warning' : 'success',
      title: COPY.bulkInviteResult(invited, failed),
    })
    await loadAll()
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
    <Can permission="identity.member.grant">
      {#snippet children()}
        <Button variant="ghost" size="sm" onclick={() => openChangeRoles(member)}>
          {COPY.changeRolesAction}
        </Button>
      {/snippet}
    </Can>
    <Can permission="identity.member.remove">
      {#snippet children()}
        <Button variant="ghost" size="sm" onclick={() => handleRemove(member.user_id)}>
          {COPY.removeAction}
        </Button>
      {/snippet}
    </Can>
  </Stack>
{/snippet}

{#snippet invitationActionsCell(invitation: InvitationRow)}
  <Can permission="identity.invitation.manage">
    {#snippet children()}
      <Stack gap="2" align="start">
        <Button variant="ghost" size="sm" onclick={() => handleResend(invitation.invitation_id)}>
          {COPY.resendAction}
        </Button>
        <Button variant="ghost" size="sm" onclick={() => handleRevoke(invitation.invitation_id)}>
          {COPY.revokeAction}
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

<Can permission="identity.member.read">
  {#snippet children()}
    <Stack gap="8">
      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={COPY.loading} />
      {:else}
        <div>
          <h1>{COPY.membersTitle}</h1>
          <DataTable
            columns={[
              { key: 'email', header: COPY.emailLabel, alwaysVisible: true },
              { key: 'role_ids', header: COPY.rolesLabel, cell: rolesCell },
              { key: 'status', header: COPY.statusHeader, cell: statusCell },
              { key: 'actions', header: COPY.actionsHeader, cell: memberActionsCell, alwaysVisible: true },
            ]}
            rows={members}
            getRowId={(row) => row.user_id}
            emptyMessage={COPY.noMembers}
          />
        </div>

        <div>
          <h2>{COPY.invitationsTitle}</h2>
          <DataTable
            columns={[
              { key: 'email', header: COPY.emailLabel, alwaysVisible: true },
              { key: 'status', header: COPY.statusHeader, cell: statusCell },
              {
                key: 'actions',
                header: COPY.actionsHeader,
                cell: invitationActionsCell,
                alwaysVisible: true,
              },
            ]}
            rows={invitations}
            getRowId={(row) => row.invitation_id}
            emptyMessage={COPY.noInvitations}
          />
        </div>

        <Can permission="identity.member.invite">
          {#snippet children()}
            <Stack gap="6">
              <div>
                <h2>{COPY.inviteTitle}</h2>
                <Stack gap="3">
                  <Field label={COPY.emailLabel}>
                    {#snippet children({ id })}
                      <Input {id} type="email" bind:value={inviteEmail} required />
                    {/snippet}
                  </Field>
                  <fieldset>
                    <legend>{COPY.rolesLabel}</legend>
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
                    {COPY.inviteAction}
                  </Button>
                </Stack>
              </div>

              <div>
                <h2>{COPY.bulkInviteTitle}</h2>
                <Stack gap="2" align="start">
                  <p class="sanvi-members__hint">{COPY.bulkInviteHint}</p>
                  <input
                    bind:this={fileInput}
                    type="file"
                    accept=".csv"
                    disabled={bulkInviting}
                    onchange={handleBulkInviteFile}
                  />
                  {#if bulkInviting}<Spinner size="sm" label={COPY.loading} />{/if}
                </Stack>
              </div>
            </Stack>
          {/snippet}
        </Can>
      {/if}
    </Stack>
  {/snippet}
  {#snippet fallback()}
    <Alert variant="error">{COPY.denied}</Alert>
  {/snippet}
</Can>

<Dialog
  bind:open={changeRolesOpen}
  titleText={changeRolesTarget ? COPY.changeRolesTitle(changeRolesTarget.email) : COPY.changeRolesAction}
>
  {#snippet children()}
    <fieldset>
      <legend>{COPY.rolesLabel}</legend>
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
    <Button variant="ghost" onclick={() => (changeRolesOpen = false)}>{COPY.cancel}</Button>
    <Button loading={savingRoles} onclick={handleSaveRoles}>{COPY.save}</Button>
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
