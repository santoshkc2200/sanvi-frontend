<script lang="ts">
import { listPermissions, listRolesPlatform } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { Badge, EmptyState, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type RoleRow = components['schemas']['RoleView']
type PermissionRow = components['schemas']['PermissionView']

const COPY = {
  title: 'Roles & permissions',
  description: 'Platform-scope roles and the full permission registry, grouped by bounded context.',
  rolesTitle: 'Platform roles',
  rolesDescription:
    'Read-only — platform roles are seeded, not authored here. Custom role authoring is scoped to tenants (the admin console).',
  keyHeader: 'Key',
  nameHeader: 'Name',
  permissionsHeader: 'Permissions',
  systemBadge: 'System',
  customBadge: 'Custom',
  noRoles: 'No platform roles defined.',
  registryTitle: 'Permission registry',
  registryDescription: 'Every permission the backend enforces, browsable by scope and context.',
  scopePlatform: 'Platform',
  scopeTenant: 'Tenant',
  scopeAuthenticated: 'Authenticated',
  loading: 'Loading',
  errorMessage: 'Could not load roles and permissions.',
}

const SCOPE_ORDER = ['platform', 'tenant', 'authenticated'] as const
const SCOPE_LABEL: Record<(typeof SCOPE_ORDER)[number], string> = {
  platform: COPY.scopePlatform,
  tenant: COPY.scopeTenant,
  authenticated: COPY.scopeAuthenticated,
}

let roles = $state<RoleRow[]>([])
let permissions = $state<PermissionRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    const [roleList, permissionList] = await Promise.all([
      listRolesPlatform(apiClient),
      listPermissions(apiClient),
    ])
    roles = roleList
    permissions = permissionList
  } catch {
    error = COPY.errorMessage
  } finally {
    loading = false
  }
}

$effect(() => {
  void load()
})

function contextOf(permissionKey: string): string {
  return permissionKey.split('.')[0] ?? permissionKey
}

const groupedRegistry = $derived.by(() => {
  const byScope = new Map<string, Map<string, PermissionRow[]>>()
  for (const scope of SCOPE_ORDER) byScope.set(scope, new Map())
  for (const permission of permissions) {
    const scopeGroup = byScope.get(permission.scope) ?? new Map<string, PermissionRow[]>()
    byScope.set(permission.scope, scopeGroup)
    const context = contextOf(permission.key)
    const contextGroup = scopeGroup.get(context) ?? []
    contextGroup.push(permission)
    scopeGroup.set(context, contextGroup)
  }
  return SCOPE_ORDER.map((scope) => ({
    scope,
    label: SCOPE_LABEL[scope],
    contexts: [...(byScope.get(scope) ?? new Map<string, PermissionRow[]>()).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([context, items]) => ({
        context,
        items: items.sort((a, b) => a.key.localeCompare(b.key)),
      })),
  })).filter((group) => group.contexts.length > 0)
})
</script>

<!-- Read-only by design: platform roles are seeded (no create/update/delete
     endpoint exists for platform-scope roles), and the permission registry
     is a browser, not an editor. -->
<Stack gap="8">
  <div>
    <h1>{COPY.title}</h1>
    <p>{COPY.description}</p>
  </div>

  {#if loading}
    <Spinner label={COPY.loading} />
  {:else if error}
    <EmptyState title={error} />
  {:else}
    <section>
      <h2>{COPY.rolesTitle}</h2>
      <p class="sanvi-operators__hint">{COPY.rolesDescription}</p>
      {#if roles.length === 0}
        <EmptyState title={COPY.noRoles} />
      {:else}
        <table class="sanvi-operators__table">
          <thead>
            <tr>
              <th scope="col">{COPY.keyHeader}</th>
              <th scope="col">{COPY.nameHeader}</th>
              <th scope="col">{COPY.permissionsHeader}</th>
              <th scope="col"><span class="sanvi-visually-hidden">Type</span></th>
            </tr>
          </thead>
          <tbody>
            {#each roles as role (role.id)}
              <tr>
                <td>{role.key}</td>
                <td>{role.name}</td>
                <td>{role.permissions.length}</td>
                <td>
                  <Badge variant={role.is_system ? 'neutral' : 'info'}>
                    {role.is_system ? COPY.systemBadge : COPY.customBadge}
                  </Badge>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section>
      <h2>{COPY.registryTitle}</h2>
      <p class="sanvi-operators__hint">{COPY.registryDescription}</p>
      <Stack gap="4">
        {#each groupedRegistry as scopeGroup (scopeGroup.scope)}
          <div>
            <h3>{scopeGroup.label}</h3>
            <Stack gap="2">
              {#each scopeGroup.contexts as contextGroup (contextGroup.context)}
                <details class="sanvi-operators__context">
                  <summary>{contextGroup.context} ({contextGroup.items.length})</summary>
                  <ul class="sanvi-operators__permission-list">
                    {#each contextGroup.items as permission (permission.key)}
                      <li>
                        <code>{permission.key}</code>
                        <span class="sanvi-operators__permission-description">{permission.description}</span>
                      </li>
                    {/each}
                  </ul>
                </details>
              {/each}
            </Stack>
          </div>
        {/each}
      </Stack>
    </section>
  {/if}
</Stack>

<style>
  .sanvi-operators__hint {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-operators__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-operators__table th,
  .sanvi-operators__table td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    text-align: start;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-operators__context > summary {
    cursor: pointer;
    font-weight: var(--sanvi-font-weight-medium);
    padding: var(--sanvi-spacing-2) 0;
  }

  .sanvi-operators__permission-list {
    list-style: none;
    margin: 0;
    padding: 0 0 0 var(--sanvi-spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-operators__permission-list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-operators__permission-description {
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
