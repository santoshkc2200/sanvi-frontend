<script lang="ts">
import { Can } from '@sanvi/auth'
import {
  inviteMember,
  listInvitations,
  listMembers,
  removeMember,
  resendInvitation,
  revokeInvitation,
} from '@sanvi/api-client'
import { Alert, Button, Checkbox, Field, Input, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type RoleView = { id: string; key: string; name: string }
type MemberRow = Awaited<ReturnType<typeof listMembers>>[number]
type InvitationRow = Awaited<ReturnType<typeof listInvitations>>[number]

const COPY = {
  membersTitle: 'Members',
  invitationsTitle: 'Invitations',
  inviteTitle: 'Invite a member',
  emailLabel: 'Email',
  rolesLabel: 'Roles',
  inviteAction: 'Send invitation',
  removeAction: 'Remove',
  resendAction: 'Resend',
  revokeAction: 'Revoke',
  statusHeader: 'Status',
  loading: 'Loading',
  genericError: 'Something went wrong. Try again in a moment.',
  denied: "You don't have permission to view this tenant's members.",
  noMembers: 'No members yet.',
  noInvitations: 'No pending invitations.',
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
      apiClient.GET('/api/v1/tenant/roles'),
    ])
    members = membersResult
    invitations = invitationsResult
    roles = rolesResult as unknown as RoleView[]
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
    await loadAll()
  } finally {
    inviting = false
  }
}

async function handleRemove(userId: string): Promise<void> {
  await removeMember(apiClient, userId)
  await loadAll()
}

async function handleResend(invitationId: string): Promise<void> {
  await resendInvitation(apiClient, invitationId)
  await loadAll()
}

async function handleRevoke(invitationId: string): Promise<void> {
  await revokeInvitation(apiClient, invitationId)
  await loadAll()
}
</script>

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
          <table class="sanvi-members-table">
            <thead>
              <tr>
                <th scope="col">{COPY.emailLabel}</th>
                <th scope="col">{COPY.rolesLabel}</th>
                <th scope="col">{COPY.statusHeader}</th>
                <th scope="col"><span class="sanvi-visually-hidden">{COPY.removeAction}</span></th>
              </tr>
            </thead>
            <tbody>
              {#each members as member (member.user_id)}
                <tr>
                  <td>{member.email}</td>
                  <td>{roleNames(member.role_ids)}</td>
                  <td>{member.status}</td>
                  <td>
                    <Can permission="identity.member.remove">
                      {#snippet children()}
                        <Button variant="ghost" size="sm" onclick={() => handleRemove(member.user_id)}>
                          {COPY.removeAction}
                        </Button>
                      {/snippet}
                    </Can>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="4">{COPY.noMembers}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div>
          <h2>{COPY.invitationsTitle}</h2>
          <table class="sanvi-members-table">
            <thead>
              <tr>
                <th scope="col">{COPY.emailLabel}</th>
                <th scope="col">{COPY.statusHeader}</th>
                <th scope="col"><span class="sanvi-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {#each invitations as invitation (invitation.invitation_id)}
                <tr>
                  <td>{invitation.email}</td>
                  <td>{invitation.status}</td>
                  <td>
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
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="3">{COPY.noInvitations}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <Can permission="identity.member.invite">
          {#snippet children()}
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
          {/snippet}
        </Can>
      {/if}
    </Stack>
  {/snippet}
  {#snippet fallback()}
    <Alert variant="error">{COPY.denied}</Alert>
  {/snippet}
</Can>

<style>
  .sanvi-members-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-members-table th,
  .sanvi-members-table td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    text-align: start;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
