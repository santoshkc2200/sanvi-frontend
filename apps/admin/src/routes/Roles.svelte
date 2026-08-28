<script lang="ts">
import { Can, getSession } from '@sanvi/auth'
import {
  createRole,
  deleteRole,
  listPermissions,
  listRolesTenant,
  updateRole,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DangerousAction,
  Dialog,
  Field,
  Input,
  showToast,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type RoleRow = components['schemas']['RoleView']
type PermissionRow = components['schemas']['PermissionView']

const COPY = {
  title: 'Roles',
  description: 'System roles are fixed. Custom roles can only grant permissions you already hold.',
  systemRolesTitle: 'System roles',
  customRolesTitle: 'Custom roles',
  newRole: 'New role',
  newRoleTitle: 'New custom role',
  editRoleTitle: (name: string) => `Edit ${name}`,
  keyLabel: 'Key',
  keyPlaceholder: 'support-lead',
  nameLabel: 'Name',
  namePlaceholder: 'Support lead',
  permissionsLabel: 'Permissions',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  deleteAction: 'Delete',
  deleteTitle: (name: string) => `Delete ${name}`,
  deleteConsequence: (name: string) =>
    `${name} will be removed. Members holding only this role lose the permissions it granted.`,
  permissionCount: (count: number) => `${count} permission${count === 1 ? '' : 's'}`,
  loading: 'Loading',
  genericError: 'Something went wrong. Try again in a moment.',
  denied: "You don't have permission to manage roles.",
  noPermissionTitle: "You don't have this permission",
  escalationBlocked:
    'This role contains permissions you do not hold. You cannot save it — ask an owner to drop those permissions first.',
  roleCreated: 'Role created.',
  roleUpdated: 'Role updated.',
  roleDeleted: 'Role deleted.',
}

let roles = $state<RoleRow[]>([])
let permissions = $state<PermissionRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

const ownPermissions = $derived(
  new Set(
    getSession()?.memberships.find((membership) => membership.tenant_id === getActiveTenantId())
      ?.permissions ?? [],
  ),
)

const grantablePermissions = $derived(
  permissions.filter((permission) => permission.scope !== 'platform'),
)

const groupedPermissions = $derived.by(() => {
  const groups = new Map<string, PermissionRow[]>()
  for (const permission of grantablePermissions) {
    const context = permission.key.split('.')[0] ?? permission.key
    groups.set(context, [...(groups.get(context) ?? []), permission])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
})

const systemRoles = $derived(roles.filter((role) => role.is_system))
const customRoles = $derived(roles.filter((role) => !role.is_system))

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's roles.
let loadSeq = 0

async function loadAll(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [rolesResult, permissionsResult] = await Promise.all([
      listRolesTenant(apiClient),
      listPermissions(apiClient),
    ])
    if (seq !== loadSeq) return
    roles = rolesResult
    permissions = permissionsResult
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
  void loadAll()
})

let formOpen = $state(false)
let formTarget = $state<RoleRow | undefined>(undefined)
let formKey = $state('')
let formName = $state('')
let formPermissions = $state<string[]>([])
let saving = $state(false)

function openCreate(): void {
  formTarget = undefined
  formKey = ''
  formName = ''
  formPermissions = []
  formOpen = true
}

function openEdit(role: RoleRow): void {
  formTarget = role
  formKey = role.key
  formName = role.name
  formPermissions = [...role.permissions]
  formOpen = true
}

function togglePermission(key: string, checked: boolean): void {
  formPermissions = checked ? [...formPermissions, key] : formPermissions.filter((p) => p !== key)
}

// Save-time half of the escalation guard: a role being edited may already
// contain permissions the actor lacks (loaded checked but disabled), and a
// permission checked earlier in the session may have been revoked since.
// Neither may reach the API — the disabled checkbox alone doesn't guarantee it.
const escalatedPermissions = $derived(
  formPermissions.filter((permission) => !ownPermissions.has(permission)),
)

async function handleSaveRole(): Promise<void> {
  if (escalatedPermissions.length > 0) return
  saving = true
  try {
    if (formTarget) {
      await updateRole(apiClient, formTarget.id, { name: formName, permissions: formPermissions })
      showToast({ variant: 'success', title: COPY.roleUpdated })
    } else {
      await createRole(apiClient, { key: formKey, name: formName, permissions: formPermissions })
      showToast({ variant: 'success', title: COPY.roleCreated })
    }
    formOpen = false
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: COPY.genericError })
  } finally {
    saving = false
  }
}

let deleteTarget = $state<RoleRow | undefined>(undefined)
let deleteOpen = $state(false)
let deleting = $state(false)

function startDelete(role: RoleRow): void {
  deleteTarget = role
  deleteOpen = true
}

async function handleConfirmDelete(): Promise<void> {
  if (!deleteTarget) return
  deleting = true
  try {
    await deleteRole(apiClient, deleteTarget.id)
    deleteOpen = false
    showToast({ variant: 'success', title: COPY.roleDeleted })
    await loadAll()
  } catch {
    showToast({ variant: 'error', title: COPY.genericError })
  } finally {
    deleting = false
  }
}
</script>

<Can permission="access.role.read" tenantId={getActiveTenantId()}>
  {#snippet children()}
    <Stack gap="6">
      <div class="sanvi-roles__header">
        <div>
          <h1>{COPY.title}</h1>
          <p>{COPY.description}</p>
        </div>
        <Can permission="access.role.create" tenantId={getActiveTenantId()}>
          {#snippet children()}
            <Button onclick={openCreate}>{COPY.newRole}</Button>
          {/snippet}
        </Can>
      </div>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={COPY.loading} />
      {:else}
        <div>
          <h2>{COPY.systemRolesTitle}</h2>
          <ul class="sanvi-roles__list">
            {#each systemRoles as role (role.id)}
              <li class="sanvi-roles__row">
                <span class="sanvi-roles__name">{role.name}</span>
                <Badge variant="neutral">{COPY.permissionCount(role.permissions.length)}</Badge>
              </li>
            {/each}
          </ul>
        </div>

        <div>
          <h2>{COPY.customRolesTitle}</h2>
          <ul class="sanvi-roles__list">
            {#each customRoles as role (role.id)}
              <li class="sanvi-roles__row">
                <span class="sanvi-roles__name">{role.name}</span>
                <Badge variant="neutral">{COPY.permissionCount(role.permissions.length)}</Badge>
                <span class="sanvi-roles__actions">
                  <Can permission="access.role.update" tenantId={getActiveTenantId()}>
                    {#snippet children()}
                      <Button variant="ghost" size="sm" onclick={() => openEdit(role)}>{COPY.edit}</Button>
                    {/snippet}
                  </Can>
                  <Can permission="access.role.delete" tenantId={getActiveTenantId()}>
                    {#snippet children()}
                      <Button variant="ghost" size="sm" onclick={() => startDelete(role)}>
                        {COPY.deleteAction}
                      </Button>
                    {/snippet}
                  </Can>
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </Stack>
  {/snippet}
  {#snippet fallback()}
    <Alert variant="error">{COPY.denied}</Alert>
  {/snippet}
</Can>

<Dialog
  bind:open={formOpen}
  titleText={formTarget ? COPY.editRoleTitle(formTarget.name) : COPY.newRoleTitle}
>
  {#snippet children()}
    <Stack gap="4">
      {#if !formTarget}
        <Field label={COPY.keyLabel} required>
          {#snippet children({ id })}
            <Input {id} bind:value={formKey} placeholder={COPY.keyPlaceholder} required />
          {/snippet}
        </Field>
      {/if}
      <Field label={COPY.nameLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={formName} placeholder={COPY.namePlaceholder} required />
        {/snippet}
      </Field>
      <fieldset>
        <legend>{COPY.permissionsLabel}</legend>
        {#if escalatedPermissions.length > 0}
          <Alert variant="error">{COPY.escalationBlocked}</Alert>
        {/if}
        <Stack gap="4">
          {#each groupedPermissions as [context, contextPermissions] (context)}
            <div>
              <p class="sanvi-roles__group-label">{context}</p>
              {#each contextPermissions as permission (permission.key)}
                {@const allowed = ownPermissions.has(permission.key)}
                <span title={allowed ? undefined : COPY.noPermissionTitle}>
                  <Checkbox
                    checked={formPermissions.includes(permission.key)}
                    disabled={!allowed}
                    onchange={(event) => togglePermission(permission.key, event.currentTarget.checked)}
                  >
                    {permission.description}{#if !allowed}
                      <span class="sanvi-visually-hidden"> ({COPY.noPermissionTitle})</span>
                    {/if}
                  </Checkbox>
                </span>
              {/each}
            </div>
          {/each}
        </Stack>
      </fieldset>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (formOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={!formName || (!formTarget && !formKey) || escalatedPermissions.length > 0}
      loading={saving}
      onclick={handleSaveRole}
    >
      {COPY.save}
    </Button>
  {/snippet}
</Dialog>

{#if deleteTarget}
  <DangerousAction
    bind:open={deleteOpen}
    titleText={COPY.deleteTitle(deleteTarget.name)}
    consequence={COPY.deleteConsequence(deleteTarget.name)}
    submitting={deleting}
    onConfirm={handleConfirmDelete}
  />
{/if}

<style>
  .sanvi-roles__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-roles__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sanvi-roles__row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-2) 0;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-roles__name {
    flex: 1;
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-roles__actions {
    display: flex;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-roles__group-label {
    margin: 0 0 var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-semibold);
    text-transform: uppercase;
    color: var(--sanvi-color-text-secondary);
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
