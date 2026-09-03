/**
 * GENERATED FILE — do not edit by hand.
 * Produced by `pnpm generate:api` (`scripts/generate-openapi.mjs`) from
 * `sanvi-cli openapi`'s merged document. Regenerate after any backend
 * contract change; CI's `api-types-drift` job fails on staleness.
 */
export interface paths {
  '/api/v1/access/permissions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/access/permissions` — the central permission registry,
     *     for the admin/UI contracts. Readable by any authenticated subject.
     */
    get: operations['list_permissions']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/link/challenge': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/auth/link/challenge` — start the account-linking challenge. */
    post: operations['start_link_challenge']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/link/complete': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/auth/link/complete` — complete the linking challenge
     *     (authenticated: the browser holds the nonce, the session proves
     *     ownership of the existing account).
     */
    post: operations['complete_link_challenge']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/me': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/me` — the signed-in user's profile. */
    get: operations['get_me']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/me/sessions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/me/sessions` — the current session (self-management scope
     *     in phase 02).
     */
    get: operations['list_sessions']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/me/sessions/{session_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/me/sessions/{session_id}` — revoke the current session. */
    delete: operations['revoke_session']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/admin/tenants': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/admin/tenants` — operator tenant search. */
    get: operations['search_tenant_admin_views']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/admin/tenants/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/admin/tenants/{id}` — one tenant admin view. */
    get: operations['get_tenant_admin_view']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/ads/health': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_platform_ads_health']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/approvals': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/approvals` — pending four-eyes requests. */
    get: operations['list_pending_approvals']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/approvals/{id}/approve': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/approvals/{id}/approve` — approve (executes the
     *     recorded action) and record both identities.
     */
    post: operations['approve_request']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/approvals/{id}/reject': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/approvals/{id}/reject` — reject a request. */
    post: operations['reject_request']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/audit': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List the platform audit trail (operator console).
     * @description Supports filters (`tenant_id`, `actor_id`, `action`, `since`, `until`)
     *     and cursor pagination (`after` = the `seq` of the last entry of the
     *     previous page).
     */
    get: operations['list_audit']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/domains': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/domains`. */
    get: operations['list_platform_domains']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/domains/{id}/release': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/domains/{id}/release`. */
    post: operations['release_platform_domain']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/features': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/features` — the feature catalog. */
    get: operations['list_features']
    put?: never
    /** `POST /api/v1/platform/features` — define a new feature. */
    post: operations['define_feature']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/features/{key}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /**
     * `DELETE /api/v1/platform/features/{key}` — deprecate a feature (it stays
     *     resolvable; it stops appearing in tenant-facing catalogs).
     */
    delete: operations['deprecate_feature']
    options?: never
    head?: never
    /** `PATCH /api/v1/platform/features/{key}` — update a feature's defaults. */
    patch: operations['update_feature']
    trace?: never
  }
  '/api/v1/platform/impersonations': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/impersonations` — active grants. */
    get: operations['list_impersonations']
    put?: never
    /**
     * `POST /api/v1/platform/impersonations` — create a time-boxed grant
     *     (requires fresh MFA). Exchange the returned id via the
     *     `x-sanvi-impersonate` header.
     */
    post: operations['create_impersonation']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/impersonations/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/platform/impersonations/{id}` — revoke (immediate). */
    delete: operations['revoke_impersonation']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/localization/translations': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/localization/translations`. */
    get: operations['get_platform_translations']
    /** `PUT /api/v1/platform/localization/translations`. */
    put: operations['put_platform_translations']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/plans': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/plans` — the operator catalog (hidden plans too). */
    get: operations['list_plans']
    put?: never
    /**
     * `POST /api/v1/platform/plans` — create a plan (the Stripe Product must
     *     exist in the Dashboard first; its id goes into `stripe_product_id`).
     */
    post: operations['create_plan']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/plans/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /** `PATCH /api/v1/platform/plans/{id}` — update a plan's mutable fields. */
    patch: operations['update_plan']
    trace?: never
  }
  '/api/v1/platform/plans/{id}/entitlements': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    /**
     * `PUT /api/v1/platform/plans/{id}/entitlements` — replace the plan's
     *     entitlement map. Pricing changes never require a deploy; tenants get the
     *     new map on their next entitlement recompute.
     */
    put: operations['set_plan_entitlements']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/plans/{id}/prices': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/plans/{id}/prices` — attach a Stripe Price
     *     (billing variant of the plan).
     */
    post: operations['add_plan_price']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/activities': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/activities` — Art. 30 records. */
    get: operations['list_activities']
    put?: never
    /**
     * `POST /api/v1/platform/privacy/activities` — record a processing
     *     activity.
     */
    post: operations['upsert_activity']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/appeals': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/appeals` — open appeals. */
    get: operations['list_appeals']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/appeals/{id}/decision': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/privacy/appeals/{id}/decision` — second-operator
     *     review.
     */
    post: operations['decide_appeal']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/assessments': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/platform/privacy/assessments` — risk assessments (DPIA +
     *     US state data-protection assessments).
     */
    get: operations['list_assessments']
    put?: never
    /** `POST /api/v1/platform/privacy/assessments` — record an assessment. */
    post: operations['upsert_assessment']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/holds': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/holds` — legal holds. */
    get: operations['list_holds']
    put?: never
    /**
     * `POST /api/v1/platform/privacy/holds` — apply a legal hold (blocks
     *     erasure; audited).
     */
    post: operations['apply_hold']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/holds/{id}/release': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/privacy/holds/{id}/release` — release a hold. */
    post: operations['release_hold']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/incidents': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/incidents` — breach incidents. */
    get: operations['list_incidents']
    put?: never
    /**
     * `POST /api/v1/platform/privacy/incidents` — record an incident; the
     *     response includes the computed per-jurisdiction obligations.
     */
    post: operations['record_incident']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/incidents/{id}/notify': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/privacy/incidents/{id}/notify` — record a
     *     discharged obligation.
     */
    post: operations['mark_obligation_notified']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/incidents/{id}/obligations': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/platform/privacy/incidents/{id}/obligations` — computed
     *     obligations.
     */
    get: operations['list_obligations']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/jurisdictions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/jurisdictions` — profiles. */
    get: operations['list_jurisdictions']
    /**
     * `PUT /api/v1/platform/privacy/jurisdictions` — upsert a profile (audited
     *     configuration; a new state law is this call plus a matrix-test row).
     */
    put: operations['upsert_jurisdiction']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/requests': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/requests` — operator view. */
    get: operations['list_dsrs']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/requests/{id}/extend': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/privacy/requests/{id}/extend` — one deadline
     *     extension (jurisdiction rules apply).
     */
    post: operations['extend_dsr']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/requests/{id}/reject': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/privacy/requests/{id}/reject` — reject with
     *     reason (US subjects get the appeal route in the response).
     */
    post: operations['reject_dsr']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/retention-rules': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/platform/privacy/retention-rules` — retention rules (the
     *     notice's retention table comes from these rows).
     */
    get: operations['list_retention_rules']
    /**
     * `PUT /api/v1/platform/privacy/retention-rules` — adjust a rule (counsel
     *     changes periods without a release).
     */
    put: operations['upsert_retention_rule']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/subprocessors': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/privacy/subprocessors` — registry (incl. removed). */
    get: operations['list_subprocessors']
    put?: never
    /**
     * `POST /api/v1/platform/privacy/subprocessors` — upsert (role is
     *     required: it decides what is a "sale" under US law).
     */
    post: operations['upsert_subprocessor']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/privacy/subprocessors/{name}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/platform/privacy/subprocessors/{name}` — remove. */
    delete: operations['remove_subprocessor']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/roles': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/roles` — the full role catalog (operator console). */
    get: operations['list_roles_platform']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/tenants` — list tenants (cursor pagination). */
    get: operations['list_tenants']
    put?: never
    /** `POST /api/v1/platform/tenants` — provision a new tenant. */
    post: operations['provision_tenant']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/tenants/{id}` — tenant detail. */
    get: operations['get_tenant']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/activate': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/tenants/{id}/activate` — provisioning → active. */
    post: operations['activate_tenant']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/application-fee': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/platform/tenants/{id}/application-fee` — the stored
     *     configuration. A never-configured tenant renders the disabled default
     *     so the console has one shape to bind.
     */
    get: operations['get_application_fee']
    /**
     * `PUT /api/v1/platform/tenants/{id}/application-fee` — create or update
     *     the per-tenant fee configuration. Audited with actor + reason; takes
     *     effect on the next checkout creation with no deploy (rollback is a
     *     `DELETE` away).
     */
    put: operations['set_application_fee']
    post?: never
    /**
     * `DELETE /api/v1/platform/tenants/{id}/application-fee` — disable (the
     *     rollback path: data, no deploy; the numbers are retained for review).
     */
    delete: operations['disable_application_fee']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/archive': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/tenants/{id}/archive` — active|suspended → archived. */
    post: operations['archive_tenant']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/entitlements': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/platform/tenants/{id}/entitlements` — a tenant's stored
     *     override rows.
     */
    get: operations['list_entitlement_overrides']
    put?: never
    /**
     * `POST /api/v1/platform/tenants/{id}/entitlements` — grant an override.
     *     Overrides above the configured threshold require four-eyes approval and
     *     return `approval_required` with the pending request id.
     */
    post: operations['grant_entitlement_override']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/entitlements/{feature}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /**
     * `DELETE /api/v1/platform/tenants/{id}/entitlements/{feature}` — revoke
     *     an override (fresh MFA required).
     */
    delete: operations['revoke_entitlement_override']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/resume': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/tenants/{id}/resume` — suspended → active. */
    post: operations['resume_tenant']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/subscription/override': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/platform/tenants/{id}/subscription/override` — grant a
     *     plan's entitlements without a Stripe subscription (audited operator
     *     action).
     */
    post: operations['apply_subscription_override']
    /**
     * `DELETE /api/v1/platform/tenants/{id}/subscription/override` — revoke an
     *     operator override.
     */
    delete: operations['revoke_subscription_override']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/tenants/{id}/suspend': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/tenants/{id}/suspend` — active → suspended. */
    post: operations['suspend_tenant']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/themes': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/themes`. */
    get: operations['list_platform_themes']
    put?: never
    /** `POST /api/v1/platform/themes` — install a theme version. */
    post: operations['install_theme_version']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/themes/{key}/versions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/platform/themes/{key}/versions`. */
    get: operations['list_platform_theme_versions']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/platform/themes/{key}/versions/{version}/yank': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/platform/themes/{key}/versions/{version}/yank` — withdraw. */
    post: operations['yank_theme_version']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/consents': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/privacy/consents` — own consent ledger (proof view). */
    get: operations['get_consents']
    /** `PUT /api/v1/privacy/consents` — grant/withdraw one consent. */
    put: operations['update_consents']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/directives': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/privacy/directives` — the resolved state per purpose, with
     *     source and jurisdiction (what the privacy centre renders). Binding
     *     unbound GPC signals happens here.
     */
    get: operations['get_directives']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/limit-sensitive': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/privacy/limit-sensitive` — CPRA "limit the use of my
     *     sensitive personal information".
     */
    post: operations['limit_sensitive_use']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/opt-out': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/privacy/opt-out` — sale/share, targeted advertising,
     *     profiling. NO verification gate; accepts `Sec-GPC`.
     */
    post: operations['record_opt_out']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/requests': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/privacy/requests` — self-service DSR. Authenticated users
     *     are verified by their session; email requesters receive an OTP.
     */
    post: operations['submit_dsr']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/requests/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/privacy/requests/{id}` — status for the subject (owned by
     *     session or challenge token).
     */
    get: operations['get_dsr_status']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/requests/{id}/appeal': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/privacy/requests/{id}/appeal` — appeal a refusal (US). */
    post: operations['appeal_request']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/requests/{id}/download': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/privacy/requests/{id}/download` — one-time, TTL-bound export
     *     download. The passphrase was delivered out of band; the token is the
     *     download link's secret.
     */
    get: operations['download_export']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/privacy/requests/{id}/rectify': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /** `PATCH /api/v1/privacy/requests/{id}/rectify` — apply corrections. */
    patch: operations['rectify_request']
    trace?: never
  }
  '/api/v1/privacy/requests/{id}/verify': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/privacy/requests/{id}/verify` — consume the OTP. */
    post: operations['verify_dsr']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/locales': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/public/locales` — the platform's enabled locale set. */
    get: operations['get_public_locales']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/messages/{domain}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/messages/{domain}?locale=` — catalog delivery for
     *     the frontend, ETag-cached.
     */
    get: operations['get_public_messages']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/plans': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/plans` — the pricing page catalog (localized by
     *     phase 06; hidden plans excluded).
     */
    get: operations['list_public_plans']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/privacy/metrics': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/privacy/metrics` — annual request metrics (CCPA
     *     disclosure), generated from the request ledger.
     */
    get: operations['get_public_metrics']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/privacy/notice': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/privacy/notice` — the current notice + version,
     *     generated from live configuration (jurisdiction sections and the
     *     retention table).
     */
    get: operations['get_privacy_notice']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/privacy/notice-at-collection': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/privacy/notice-at-collection` — categories, purposes,
     *     retention and sale/share status, served before any collection.
     */
    get: operations['get_notice_at_collection']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/slug-availability': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/public/slug-availability` — is this slug free? (boolean only.) */
    get: operations['check_slug_availability']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/subprocessors': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/subprocessors` — the public sub-processor list with
     *     role and transfer mechanism.
     */
    get: operations['list_public_subprocessors']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/tenant-context': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/tenant-context` — host-based context for the
     *     storefront SSR bootstrap. Unknown host → 404; suspended tenants answer
     *     normally (the frontend renders the maintenance page).
     */
    get: operations['public_tenant_context']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/theme': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/public/theme` — the resolved live theme for the request
     *     host (or the platform default), ETag-cached. No authentication; tenant
     *     resolution happens here because public paths skip the tenant middleware.
     */
    get: operations['get_public_theme']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/track': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['public_track_conversion']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/system/version': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Build/version info: `GET /api/v1/system/version`. */
    get: operations['version']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/audiences': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_audiences']
    put?: never
    post: operations['create_audience']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/audiences/{id}/refresh': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['refresh_audience']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/budget-alerts': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_budget_alerts']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/budget-alerts/{alert_id}/acknowledge': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['acknowledge_budget_alert']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/budget-caps': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_budget_caps']
    put: operations['put_budget_cap']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_campaigns']
    put?: never
    post: operations['create_campaign']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_campaign']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch: operations['patch_campaign']
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['add_ad_group']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch: operations['update_ad_group']
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['add_ad']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads/{ad_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch: operations['update_ad']
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/budget-cap': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_campaign_budget_cap']
    put: operations['put_campaign_budget_cap']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/changes': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_campaign_changes']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/drift': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Explicitly resolve a platform-observed campaign drift. The idempotency
     *     claim is durable and created before any provider write; the adapter also
     *     receives the same key for provider-side deduplication.
     */
    post: operations['resolve_campaign_drift']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/pause': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['pause_campaign']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/publish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['publish_campaign']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/resume': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['resume_campaign']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/campaigns/{campaign_id}/validate': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['validate_campaign']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/connections': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_connections']
    put?: never
    post: operations['create_connection']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/connections/{connection_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete: operations['delete_connection']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/connections/{platform}/oauth/callback': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['oauth_callback']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/connections/{platform}/oauth/start': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['start_oauth']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/conversions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_conversions']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/conversions/{id}/diagnostics': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_conversion_diagnostics']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/conversions/{id}/retry': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations['retry_conversion']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/creatives': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_creatives']
    put?: never
    post: operations['create_creative']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/creatives/{creative_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_creative']
    put?: never
    post?: never
    delete: operations['delete_creative']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/creatives/{creative_id}/previews': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_creative_previews']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/metrics': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_ads_metrics']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/metrics/export': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_ads_metrics_export']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/metrics/freshness': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_ads_metrics_freshness']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/metrics/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_ads_metrics_summary']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/platforms': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['list_ad_platforms']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/spend-status': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_spend_status']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/tracking/settings': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations['get_tracking_settings']
    put: operations['put_tracking_settings']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/ads/tracking/test-event': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Runs a synthetic event through the exact same capture pipeline as
     *     `/public/track` — including the directive gate — and returns what was
     *     captured and why, without persisting anything. Flagged as a test on
     *     the client side; nothing here ever reaches `advertising.conversion_events`.
     */
    post: operations['test_tracking_event']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/billing/checkout-session': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/billing/checkout-session` — start subscribing.
     *     Access is granted only when Stripe webhooks arrive, never from the
     *     redirect.
     */
    post: operations['create_checkout_session']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/billing/invoices': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/billing/invoices` — the tenant's invoices. */
    get: operations['list_invoices']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/billing/portal-session': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/billing/portal-session` — open the Customer Portal
     *     (upgrades, downgrades, cancellation, payment methods).
     */
    post: operations['create_portal_session']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/billing/subscription': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/billing/subscription` — the tenant's subscription. */
    get: operations['get_subscription']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/checkout': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/checkout` — start a purchase on the tenant's own
     *     connected account. Direct charge: money lands in the **tenant's**
     *     Stripe balance; nothing transits Sanvi. The response URL is a hint —
     *     the confirmation page trusts only `GET /tenant/checkout/{id}`.
     */
    post: operations['create_tenant_checkout']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/checkout/config': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/checkout/config` — the storefront's pre-flight.
     *     Same permission and entitlement as the buy path it guards, because it
     *     answers the same question the buy path would refuse on.
     */
    get: operations['get_tenant_checkout_config']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/checkout/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/checkout/{id}` — the confirming state. Polled by
     *     the confirmation page and trusted over any redirect: a customer who
     *     never returns still ends with a paid order here, a forged return URL
     *     yields nothing.
     */
    get: operations['get_tenant_checkout']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/context': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/context` — the current tenant's self-description
     *     (resolved by the middleware; the frontend bootstrap endpoint). Public,
     *     with the signed-in subject attached when a session exists.
     */
    get: operations['get_tenant_context']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/domains`. */
    get: operations['list_custom_domains']
    put?: never
    /** `POST /api/v1/tenant/domains`. */
    post: operations['claim_custom_domain']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/orders': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/domains/orders`. */
    get: operations['list_domain_orders']
    put?: never
    /** `POST /api/v1/tenant/domains/orders`. */
    post: operations['place_domain_order']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/orders/{id}/auto-renew': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/domains/orders/{id}/auto-renew`. */
    post: operations['set_order_auto_renew']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/search': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/domains/search`. */
    get: operations['search_domains']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/tenant/domains/{id}`. */
    delete: operations['remove_custom_domain']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/{id}/instructions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/domains/{id}/instructions`. */
    get: operations['get_domain_instructions']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/{id}/promote': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/domains/{id}/promote`. */
    post: operations['promote_primary_domain']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/domains/{id}/verify': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/domains/{id}/verify`. */
    post: operations['request_domain_verification']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/entitlements': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/entitlements` — the tenant's own resolved
     *     entitlements (feature-gated on `access.tenant_entitlements`).
     */
    get: operations['list_tenant_entitlements']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/invitations': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/invitations` — pending and accepted invitations. */
    get: operations['list_invitations']
    put?: never
    /** `POST /api/v1/tenant/invitations` — invite a member by email. */
    post: operations['invite_member']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/invitations/accept': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/invitations/accept` — redeem an invitation token. */
    post: operations['accept_invitation']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/invitations/{invitation_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/tenant/invitations/{invitation_id}` — revoke. */
    delete: operations['revoke_invitation']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/invitations/{invitation_id}/resend': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/invitations/{invitation_id}/resend` — reissue. */
    post: operations['resend_invitation']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/localization/overrides': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/localization/overrides`. */
    get: operations['get_localization_overrides']
    /** `PUT /api/v1/tenant/localization/overrides`. */
    put: operations['put_localization_overrides']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/localization/settings': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/localization/settings`. */
    get: operations['get_localization_settings']
    /** `PUT /api/v1/tenant/localization/settings`. */
    put: operations['put_localization_settings']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/members': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/members` — the tenant's members. */
    get: operations['list_members']
    put?: never
    /** `POST /api/v1/tenant/members` — grant a membership. */
    post: operations['grant_member']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/members/{user_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/tenant/members/{user_id}` — revoke a membership. */
    delete: operations['remove_member']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/members/{user_id}/roles': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /** `PATCH /api/v1/tenant/members/{user_id}/roles` — replace a member's roles. */
    patch: operations['update_member_roles']
    trace?: never
  }
  '/api/v1/tenant/payments': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments` — every documented filter combinable,
     *     cursor-paginated, tenant-scoped by RLS and indexed for the filter set.
     */
    get: operations['list_tenant_payments']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/connections': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/payments/connections` — connect a payment
     *     provider. Creates the account at the provider (Accounts v2, keyed by
     *     our connection id), persists the `Pending` connection, emits
     *     `ProviderConnectionStarted` and writes the audit entry — in that
     *     order, so a crashed response never orphans an account.
     */
    post: operations['create_payment_connection']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/connections/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments/connections/{id}` — the connection's
     *     status, capabilities, outstanding requirements (with i18n render keys
     *     and deadline), blockers, and the server-computed `can_accept_payments`
     *     (FR-903). Truthful because 09.3's webhooks and reconciliation job keep
     *     the row current.
     */
    get: operations['get_payment_connection']
    put?: never
    post?: never
    /**
     * `DELETE /api/v1/tenant/payments/connections/{id}` — disconnect the
     *     tenant's payment provider (09.7). Local semantics only: the row is
     *     marked `Disconnected`, new checkouts stop, every historical record
     *     stays. The provider account itself is never closed — it is the
     *     tenant's account to close in their own Dashboard.
     * @description Refused with `409` and a structured blocker list (`in_flight_payments`,
     *     `open_disputes`, `pending_payouts` as problem-extension members) while
     *     money could still move. Idempotent: a retried DELETE of an already-
     *     disconnected connection answers 200 from the record. Reconnecting
     *     later creates a *new* connection; history stays attached to this one.
     */
    delete: operations['delete_payment_connection']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/connections/{id}/session': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/payments/connections/{id}/session` — mint an
     *     Account Session client secret for the embedded onboarding component.
     * @description Fetched per render: never persisted, never logged, single-render;
     *     refused outright for a disconnected connection.
     */
    post: operations['create_payment_connection_session']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/disputes': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments/disputes` — disputes for this tenant,
     *     cursor-paginated.
     */
    get: operations['list_tenant_disputes']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/export': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments/export` — server-side CSV export,
     *     tenant-scoped, audited.
     * @description The column set is fixed and documented: `payment_id,external_payment_id,
     *     checkout_reference,amount_minor,currency,status,fee_minor,fee_currency,
     *     captured_at,created_at,refunded_minor,dispute_status`.
     */
    get: operations['export_tenant_payments']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/payouts': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments/payouts` — the connected account's payout
     *     history (schedule, next payout, recent history), read live over the
     *     connected account.
     */
    get: operations['list_tenant_payouts']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/providers': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments/providers`.
     * @description Gated three ways: the `payments.enabled` phase flag (route absent when
     *     off), `payments.read` (permission extractor), and the
     *     `payments.stripe_connect` entitlement (`RequiredFeature` — 403, never
     *     404, so the frontend can render an upgrade prompt instead of a dead
     *     end).
     *
     *     The response is derived from the provider registry — the handler adds
     *     nothing provider-specific. The tenant's country (from the tenant
     *     context's region, when it parses as ISO-3166-1 alpha-2) decides
     *     per-tenant availability; an unparseable region leaves the provider
     *     available rather than locking the tenant out.
     */
    get: operations['list_payment_providers']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/tax-settings': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/payments/tax-settings`. */
    get: operations['get_tenant_tax_settings']
    /**
     * `PUT /api/v1/tenant/payments/tax-settings` — enable/disable automatic
     *     tax. Enabling runs the preflight first: an account whose tax settings
     *     are not `active`, or which holds no active registration, cannot enable
     *     (409 naming the missing step) — without registrations Stripe collects
     *     nothing and returns no error, and that silence must never look like a
     *     working toggle.
     */
    put: operations['update_tenant_tax_settings']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/payments/{id}` — payment detail with timeline,
     *     refunds and dispute state.
     */
    get: operations['get_tenant_payment']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/payments/{id}/refund': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/payments/{id}/refund` — refund a payment.
     * @description `Idempotency-Key` is required; the response is the refund record,
     *     never a bare 204 — a partial refund of an unexpected amount is a
     *     support incident, so the UI must be able to show what actually
     *     happened. Arithmetic is in minor units against the already-refunded
     *     total; an over-refund is rejected with the remaining refundable
     *     amount in the error, not a generic 422. Executed on the connected
     *     account — the refund is the tenant's money moving, not ours.
     */
    post: operations['refund_tenant_payment']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/privacy/requests': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/privacy/requests` — the tenant's own requests. */
    get: operations['list_tenant_dsrs']
    put?: never
    /**
     * `POST /api/v1/tenant/privacy/requests` — tenant admin acting for their
     *     end users (processor / service-provider role).
     */
    post: operations['submit_tenant_dsr']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/roles': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/roles` — roles assignable in the current tenant. */
    get: operations['list_roles_tenant']
    put?: never
    /**
     * `POST /api/v1/tenant/roles` — create a custom tenant role. The role may
     *     only grant permissions the caller already holds (no escalation).
     */
    post: operations['create_role']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/roles/{id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/tenant/roles/{id}` — delete a custom tenant role. */
    delete: operations['delete_role']
    options?: never
    head?: never
    /** `PATCH /api/v1/tenant/roles/{id}` — update a custom tenant role. */
    patch: operations['update_role']
    trace?: never
  }
  '/api/v1/tenant/settings': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/settings` — all settings of the current tenant. */
    get: operations['get_tenant_settings']
    /** `PUT /api/v1/tenant/settings` — upsert settings of the current tenant. */
    put: operations['update_tenant_settings']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/assets': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/theme/assets`. */
    post: operations['upload_brand_asset']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/assets/{kind}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** `DELETE /api/v1/tenant/theme/assets/{kind}`. */
    delete: operations['remove_brand_asset']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/draft': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/theme/draft`. */
    get: operations['get_tenant_theme_draft']
    /** `PUT /api/v1/tenant/theme/draft`. */
    put: operations['put_tenant_theme_draft']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/preview': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /api/v1/tenant/theme/preview` — the draft, rendered through a
     *     signed short-lived token. Never cached, never indexed.
     */
    get: operations['preview_tenant_theme']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/preview-token': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * `POST /api/v1/tenant/theme/preview-token` — mint a short-lived token for
     *     the current tenant's draft.
     */
    post: operations['mint_theme_preview_token']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/publish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/theme/publish`. */
    post: operations['publish_tenant_theme']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/theme/rollback': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** `POST /api/v1/tenant/theme/rollback`. */
    post: operations['rollback_tenant_theme']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/tenant/themes/available': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** `GET /api/v1/tenant/themes/available`. */
    get: operations['list_available_themes']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/healthz': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Liveness: `GET /healthz`. Never depends on anything else. */
    get: operations['liveness']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/internal/tls/authorize': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * `GET /internal/tls/authorize` — the edge asks before issuing a
     *     certificate. Self-authenticated: `x-sanvi-internal` shared secret plus
     *     an optional client-IP allow-list; `/internal` sits outside the authn
     *     middleware.
     */
    get: operations['tls_authorize']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/readyz': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Readiness: `GET /readyz`. Degrades (503) when a dependency is down. */
    get: operations['readiness']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}
export type webhooks = Record<string, never>
export interface components {
  schemas: {
    AcceptInvitationCommand: {
      /** @example 64-hex-chars */
      token: string
    }
    AccountView: {
      display_name: string
      external_id: string
    }
    /**
     * @description Who performed the action. `User` is a tenant user; `PlatformAdmin` is an
     *     operator on the platform host; `System` is an automated process (jobs,
     *     lifecycle sweeps).
     * @enum {string}
     */
    ActorType: 'user' | 'platform_admin' | 'system'
    Ad: {
      creative: components['schemas']['Creative']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      landing_url: string
      tracking_template?: string | null
    }
    AdGroup: {
      ads: components['schemas']['Ad'][]
      bid: components['schemas']['BidSettings']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      name: string
      targeting: components['schemas']['Targeting']
    }
    AddPriceRequest: {
      currency: string
      interval: components['schemas']['PriceInterval']
      stripe_price_id: string
      /** Format: int32 */
      trial_days?: number | null
      /** Format: int64 */
      unit_amount_minor: number
    }
    AdsFreshnessSummaryView: {
      /** Format: int32 */
      stalled_connections: number
      /** Format: int32 */
      total_connections: number
      /** Format: double */
      worst_lag_hours?: number | null
    }
    /**
     * @description Stable RFC-7807 suffixes emitted by future advertising endpoints.
     * @enum {string}
     */
    AdvertisingProblemType:
      | 'advertising/platform-unavailable'
      | 'advertising/connection-not-active'
      | 'advertising/capability-unsupported'
      | 'advertising/token-expired'
      | 'advertising/directive-suppressed'
      | 'advertising/budget-cap-reached'
      | 'advertising/campaign-invalid'
    AffectedSet: {
      jurisdictions: components['schemas']['JurisdictionRef'][]
      /** Format: int64 */
      subjects: number
      /** Format: int64 */
      tenants: number
    }
    AgeSignal: {
      /**
       * Format: int32
       * @description Declared birth year; `is_minor` wins when present.
       */
      birth_year?: number | null
      is_minor: boolean
    }
    AgentInput: {
      agent_contact?: unknown
      agent_name: string
      /** @description Signed permission artifact: an opaque reference plus checksum. */
      authorization_evidence: unknown
    }
    /** @enum {string} */
    AlertCondition:
      | 'settled_breach'
      | 'provisional_lower_bound_breach'
      | 'provisional_warning'
      | 'stale_data_warning'
      | 'spend_anomaly'
      | 'threshold80'
    /**
     * @description Application-level API error.
     *
     *     Contexts map their domain errors into these at the adapter boundary; the
     *     HTTP status lives in exactly one place (here), never scattered across
     *     handlers.
     */
    ApiError:
      | {
          BadRequest: {
            detail: string
          }
        }
      | 'Unauthorized'
      | {
          Forbidden: {
            detail: string
          }
        }
      | {
          NotFound: {
            resource: string
          }
        }
      | {
          Conflict: {
            detail: string
          }
        }
      | {
          Gone: {
            detail: string
          }
        }
      | {
          BadGateway: {
            detail: string
          }
        }
      | 'TenantSuspended'
      | {
          TooManyRequests: {
            /** Format: int64 */
            retry_after_secs: number
          }
        }
      | 'RequestTimeout'
      | {
          ServiceUnavailable: {
            detail: string
          }
        }
      | {
          Internal: {
            detail: string
          }
        }
    /** @description The appeal aggregate (US states with an appeal right). */
    Appeal: {
      authority_notice?: null | components['schemas']['AuthorityContact']
      /** Format: date-time */
      decided_at?: string | null
      decided_by?: string | null
      decision_reason?: string | null
      /** Format: date-time */
      due_at: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      outcome?: null | components['schemas']['AppealOutcome']
      reason: string
      /** Format: date-time */
      received_at: string
      request_id: string
    }
    /** @enum {string} */
    AppealOutcome: 'upheld' | 'denied'
    AppealRequestOutput: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      appeal_id: string
      /** @description The state authority's complaint route, included up front. */
      authority: components['schemas']['AuthorityContact']
      /** Format: date-time */
      due_at: string
    }
    AppealRequestRequest: {
      reason: string
    }
    AppealStatusView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      appeal_id: string
      authority_notice?: null | components['schemas']['AuthorityContact']
      /** Format: date-time */
      decided_at?: string | null
      /** Format: date-time */
      due_at: string
      outcome?: string | null
      reason: string
    }
    /** @description One tenant's application-fee configuration (operator console). */
    ApplicationFeeView: {
      /** Format: int32 */
      basis_points?: number | null
      /** @description Off everywhere by default in 0.10.0. */
      enabled: boolean
      /** Format: int64 */
      fixed_amount_minor?: number | null
      fixed_currency?: string | null
      /** Format: int64 */
      minimum_minor: number
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    ApplyLegalHoldCommand: {
      reason: string
      scope: unknown
    }
    /** @enum {string} */
    ApprovalStatus: 'pending' | 'approved' | 'rejected' | 'executed'
    /** @description One approval request as exposed by the API. */
    ApprovalView: {
      action_type: string
      /** Format: date-time */
      decided_at?: string | null
      decided_by?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      payload: unknown
      /** Format: date-time */
      requested_at: string
      requested_by: string
      status: components['schemas']['ApprovalStatus']
    }
    AssetMetadata: {
      aspect_ratio: string
      /** Format: int32 */
      duration_seconds?: number | null
      /** Format: int64 */
      file_size_bytes: number
      /** Format: int32 */
      height_px: number
      is_video: boolean
      /** Format: int32 */
      width_px: number
    }
    Audience: {
      /** Format: date-time */
      created_at: string
      external_ref?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      included_identifiers: components['schemas']['HashedIdentifier'][]
      /** Format: date-time */
      last_synced_at?: string | null
      name: string
      platform: components['schemas']['PlatformKey']
      status: components['schemas']['AudienceStatus']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    AudienceStatus:
      | {
          /** @enum {string} */
          status: 'building'
        }
      | {
          /** @enum {string} */
          status: 'active'
        }
      | {
          reason: string
          /** @enum {string} */
          status: 'failed'
        }
    /**
     * @description A chained audit entry.
     *
     *     `seq` is the chain's ordering authority (assigned by the database on
     *     INSERT); it is deliberately *not* covered by the hash because the
     *     database assigns it after the hash is computed. Ordering integrity comes
     *     from the append-only grants + trigger; content and link integrity from
     *     the hash chain.
     */
    AuditEntry: {
      action: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      actor_id?: string
      actor_type: components['schemas']['ActorType']
      after?: unknown
      before?: unknown
      hash: number[]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      ip: string
      /** Format: date-time */
      occurred_at: string
      on_behalf_of?: string | null
      prev_hash: number[]
      request_id?: string | null
      resource_id?: string | null
      resource_type?: string | null
      /** Format: int64 */
      seq: number
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id?: string
      user_agent: string
    }
    /** @description One page of audit entries. */
    AuditPageView: {
      entries: components['schemas']['AuditEntry'][]
      /** Format: int64 */
      next_cursor?: number | null
    }
    AuthorityContact: {
      complaint_url: string
      name: string
    }
    AutoRenewCommand: {
      enabled: boolean
    }
    /** @description A theme in the tenant-facing catalog (entitlement-filtered). */
    AvailableThemeView: {
      capabilities: string[]
      dark_mode: boolean
      key: string
      name: components['schemas']['LocalizedName']
      preview_url?: string | null
      required_feature?: string | null
      status: components['schemas']['ThemeStatus']
      version: string
      visibility: components['schemas']['ThemeVisibility']
    }
    AvailableThemesView: {
      themes: components['schemas']['AvailableThemeView'][]
    }
    BidSettings: {
      maximum_bid?: null | components['schemas']['Money']
      strategy: string
    }
    /** @description One reason the connection cannot take payments yet, keyed for i18n. */
    BlockerView: {
      /** @example payments.blocker.card_payments_inactive */
      summary_key: string
    }
    /** @description One validated, stored brand asset. */
    BrandAsset: {
      /** @description The sha256 digest of the stored bytes (content-addressed file name). */
      digest: string
      /** @description The stored extension, e.g. `png`. */
      ext: string
      kind: components['schemas']['BrandAssetKind']
      mime: string
      /** Format: date-time */
      uploaded_at: string
    }
    /**
     * @description The brand asset kinds a tenant can upload.
     * @enum {string}
     */
    BrandAssetKind: 'logo' | 'favicon' | 'og_image'
    /** @description Absolute URLs for a tenant's brand assets. */
    BrandAssetUrls: {
      favicon?: string | null
      logo?: string | null
      og_image?: string | null
    }
    /** @description The tenant's brand assets. */
    BrandAssets: {
      favicon?: null | components['schemas']['BrandAsset']
      logo?: null | components['schemas']['BrandAsset']
      og_image?: null | components['schemas']['BrandAsset']
    }
    /** @description A breach incident aggregate; obligations are computed per jurisdiction. */
    BreachIncident: {
      affected: components['schemas']['AffectedSet']
      /** Format: date-time */
      contained_at?: string | null
      created_by?: string | null
      data_classes: components['schemas']['DataClass'][]
      /** Format: date-time */
      discovered_at: string
      encrypted_at_rest: boolean
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      notes?: string | null
    }
    /**
     * @description Breach-notification rules per jurisdiction. jsonb in the database so a
     *     new law is a data change; typed here so the calculator cannot misparse.
     */
    BreachRuleSet: {
      /**
       * Format: int32
       * @description Deadline to notify the authority, in days (states without an
       *     hour-level rule).
       */
      authority_due_days?: number | null
      /**
       * Format: int32
       * @description Deadline to notify the supervisory authority, in hours.
       */
      authority_due_hours?: number | null
      /**
       * Format: int32
       * @description Minimum number of affected subjects before the authority must be
       *     notified at all (several US states).
       */
      authority_threshold?: number | null
      /**
       * Format: int32
       * @description Deadline to notify consumers, in days.
       */
      consumer_due_days?: number | null
      /**
       * Format: int32
       * @description Minimum affected count before consumers must be notified.
       */
      consumer_threshold?: number | null
      /**
       * @description Whether encryption-at-rest of the compromised data suppresses the
       *     obligations this rule set marks as encryption-exempt (safe harbour).
       */
      encryption_safe_harbour: boolean
    }
    Budget: {
      amount: components['schemas']['Money']
      kind: components['schemas']['BudgetType']
    }
    BudgetActionsConfigured: {
      auto_pause: boolean
      auto_resume_on_rollover: boolean
      threshold_100: string
      threshold_80: string
    }
    BudgetAlert: {
      /** Format: date-time */
      acknowledged_at?: string | null
      acknowledged_by?: string | null
      auto_paused: boolean
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      campaign_id?: string
      cap_amount: components['schemas']['Money']
      cap_id?: string | null
      condition: components['schemas']['AlertCondition']
      /** Format: date-time */
      created_at: string
      data_freshness: components['schemas']['DataFreshness']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      period: components['schemas']['BudgetPeriod']
      /** Format: date */
      period_start: string
      spend: components['schemas']['Money']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
      /** Format: int32 */
      threshold: number
    }
    BudgetAlertsView: {
      alerts: components['schemas']['BudgetAlert'][]
    }
    BudgetCap: {
      amount: components['schemas']['Money']
      auto_pause: boolean
      auto_resume_on_rollover: boolean
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      campaign_id?: string
      /** Format: date-time */
      created_at: string
      declared_fx_basis?: string | null
      effective_currency: string
      /** Format: date */
      fx_rate_date?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      period: components['schemas']['BudgetPeriod']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
      /** Format: date-time */
      updated_at: string
      /** Format: int64 */
      version: number
    }
    BudgetCapsView: {
      caps: components['schemas']['BudgetCap'][]
    }
    /** @enum {string} */
    BudgetPeriod: 'daily' | 'monthly'
    /** @enum {string} */
    BudgetType: 'daily' | 'lifetime'
    /** @description Immutable build/version information, captured at compile time. */
    BuildInfo: {
      /**
       * @description RFC 3339 build timestamp (UTC).
       * @example 2026-08-15T09:00:00Z
       */
      built_at: string
      /**
       * @description Git commit the binary was built from (set by the build pipeline).
       * @example 3d0a5c1e
       */
      commit: string
      /**
       * @description Rust toolchain the binary was compiled with.
       * @example 1.93.1
       */
      rust_version: string
      /**
       * @description OTel service name of this deployment unit.
       * @example sanvi-api
       */
      service_name: string
      /**
       * @description Semantic version of the running binary.
       * @example 0.1.0
       */
      version: string
    }
    Campaign: {
      ad_groups: components['schemas']['AdGroup'][]
      budget: components['schemas']['Budget']
      drift: components['schemas']['DriftState']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      name: string
      objective: components['schemas']['Objective']
      schedule?: null | components['schemas']['Schedule']
      status: components['schemas']['CampaignStatus']
    }
    CampaignChange: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      actor_id?: string
      after_state: components['schemas']['Campaign']
      attribution?: string | null
      before_state: components['schemas']['Campaign']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      campaign_id: string
      changed_fields: string[]
      /** Format: date-time */
      created_at: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      metadata?: unknown
      /** Format: uuid */
      mutation_id?: string | null
      /** Format: int64 */
      revision: number
      source: components['schemas']['ChangeSource']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    CampaignChangesView: {
      changes: components['schemas']['CampaignChange'][]
    }
    /** @enum {string} */
    CampaignStatus: 'draft' | 'active' | 'paused' | 'ended' | 'archived'
    /**
     * @description One campaign plus the envelope fields the domain model does not carry:
     *     which connection it belongs to and the platform-assigned id once
     *     published.
     */
    CampaignView: {
      campaign: components['schemas']['Campaign']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      external_id?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      /** @example google_ads */
      platform: string
      /** Format: int64 */
      revision: number
    }
    CampaignsView: {
      campaigns: components['schemas']['CampaignView'][]
    }
    /** @description Data consumed by both the validator and the frontend form engine. */
    CapabilityMatrix: {
      budget_types: components['schemas']['BudgetType'][]
      creative_placements: components['schemas']['CreativePlacement'][]
      matrix_version: string
      minimum_budgets_minor: {
        [key: string]: {
          [key: string]: number
        }
      }
      objectives: components['schemas']['Objective'][]
      schedule_granularity: components['schemas']['ScheduleGranularity']
      targeting_dimensions: components['schemas']['TargetingDimension'][]
      /** @description Locale -> field name -> inclusive character limit. */
      text_limits: {
        [key: string]: {
          [key: string]: number
        }
      }
    }
    /**
     * @description The catalog the frontend consumes: every message for one domain in one
     *     locale, plus a revision (ETag) that changes whenever content does.
     */
    CatalogView: {
      domain: string
      locale: string
      messages: {
        [key: string]: string
      }
      revision: string
    }
    /**
     * @description The challenge as shown to the tenant (the token itself is the secret
     *     they must publish; the value is pre-rendered for copy-paste).
     */
    ChallengeView: {
      challenge_type: string
      /** Format: date-time */
      expires_at: string
      token: string
      txt_name: string
      txt_value: string
    }
    /** @enum {string} */
    ChangeSource: 'sanvi' | 'platform'
    /**
     * @description What the storefront needs before it can render a Pay button:
     *     readiness and the settlement currency. Derived from the tenant's live
     *     connection by the same gate the checkout itself applies.
     */
    CheckoutConfigView: {
      /**
       * @description Server-computed from the v2 `card_payments` capability, exactly as
       *     `POST /tenant/checkout` computes it. The storefront renders this;
       *     it never recomputes readiness of its own.
       */
      can_accept_payments: boolean
      /**
       * @description The i18n key for *why* not (`payments.blocker.*`), so the
       *     storefront can show a reason next to a disabled button instead of
       *     waiting for a 409. `null` when payments are accepted.
       * @example payments.blocker.card_payments_inactive
       */
      cannot_accept_reason?: string | null
      /**
       * @description The connected account's settlement currency. The storefront must
       *     price in this currency; anything else is refused at creation.
       * @example JPY
       */
      currency?: string | null
    }
    CheckoutSessionRequest: {
      cancel_url?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      price_id: string
      success_url?: string | null
    }
    CheckoutSessionView: {
      session_id: string
      url: string
    }
    /**
     * @description The checkout as the storefront sees it. `status` is the only source
     *     the confirmation page trusts: derived from webhook-recorded truth,
     *     never from the redirect.
     */
    CheckoutView: {
      /**
       * Format: int64
       * @example 2000
       */
      amount_minor: number
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      conversion_event_id?: string
      created_at: string
      /** @example JPY */
      currency: string
      customer_ref?: Record<string, never> | null
      expires_at?: string | null
      /**
       * @description Server-issued exactly once per order when paid; identical on every
       *     refresh of the confirmation page, so phase 10's conversion
       *     pipeline cannot double-count.
       *     The provider's decline/failure code for the newest failed attempt
       *     (`card_declined`, `insufficient_funds`, …), so the storefront can
       *     tell a buyer *why*. The provider's own message is deliberately not
       *     exposed: the storefront renders its own localized copy.
       * @example card_declined
       */
      failure_code?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      reference: string
      /**
       * @description `pending` | `paid` | `failed` | `expired` | `canceled`.
       * @example pending
       */
      status: string
      /**
       * @description The provider-hosted payment URL, while the checkout can still be
       *     paid. Absent once terminal.
       * @example https://checkout.stripe.com/c/pay/cs_…
       */
      url?: string | null
    }
    ClaimCustomDomainCommand: {
      /** @description The hostname to claim (`shop.acme.com`). */
      hostname: string
      /** @description `primary` (default when the tenant has none), `alias` or `redirect`. */
      role?: string | null
    }
    ClickIds: {
      /** Format: date-time */
      capture_time?: string | null
      fbc?: string | null
      fbp?: string | null
      gbraid?: string | null
      gclid?: string | null
      landing_url?: string | null
      wbraid?: string | null
    }
    /**
     * @description Our dunning machine, orthogonal to Stripe's status.
     * @enum {string}
     */
    CollectionState: 'ok' | 'dunning' | 'grace_expired'
    CompleteLinkChallengeBody: {
      /** @example 64-hex-chars */
      nonce?: string | null
    }
    ConnectionAttentionView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      last_error?: string | null
      platform: string
      reconnect_required: boolean
      scopes_missing: string[]
      stalled: boolean
      status: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    ConnectionFreshnessView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      /** Format: double */
      lag_hours?: number | null
      /** Format: date-time */
      last_ingested_at?: string | null
      platform: string
      /**
       * @description Ingestion is older than the configured freshness threshold — the
       *     dashboard's "sync failed" / "still updating" state, never presented
       *     as current.
       */
      stalled: boolean
    }
    ConnectionHealthView: {
      can_sync: boolean
      can_upload_conversions: boolean
      last_error?: string | null
      /** Format: date-time */
      last_synced_at?: string | null
      reconnect_required: boolean
      scopes_missing: string[]
      /** Format: date-time */
      token_expires_at?: string | null
    }
    /**
     * @description A short-lived Account Session for the embedded onboarding component.
     *     Fetched per render; never persisted, never logged, single-render.
     */
    ConnectionSessionView: {
      /**
       * @description The provider's embedded-components client secret. Handle like a
       *     credential: no caching, no logging, one render.
       */
      client_secret: string
      /**
       * @description The embedded components enabled on this session:
       *     `account_onboarding`, `notification_banner`, and `account_management`.
       */
      components: string[]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      expires_at: string
      /** @example stripe_connect */
      provider: string
    }
    /** @enum {string} */
    ConnectionState: 'not_connected' | 'connected'
    ConnectionView: {
      account_name?: string | null
      currency: string
      external_account_id: string
      health: components['schemas']['ConnectionHealthView']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      platform: string
      status: string
      timezone: string
    }
    ConnectionsView: {
      connections: components['schemas']['ConnectionView'][]
    }
    ConsentChangeRequest: {
      granted: boolean
      locale?: string | null
      method: string
      notice_version: string
      purpose: components['schemas']['ProcessingPurpose']
      signal_source?: string | null
    }
    /**
     * @description How consent was recorded (drives proof requirements).
     * @enum {string}
     */
    ConsentMethod: 'consent' | 'opt_out' | 'withdrawal' | 'guardian_consent'
    /**
     * @description How non-essential processing may start: permission first (EU/UK/JP) or
     *     notice with an honoured refusal (US states).
     * @enum {string}
     */
    ConsentModel: 'opt_in' | 'notice_and_opt_out'
    /** @description A consent/directive ledger entry. */
    ConsentRecord: {
      evidence: unknown
      granted: boolean
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      jurisdiction: components['schemas']['JurisdictionRef']
      locale?: string | null
      method: components['schemas']['ConsentMethod']
      notice_version: string
      purpose: components['schemas']['ProcessingPurpose']
      /** Format: date-time */
      recorded_at: string
      signal_source?: null | components['schemas']['SignalSource']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      subject_id?: string
      subject_ref: components['schemas']['SubjectRef']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id?: string
      /** Format: date-time */
      withdrawn_at?: string | null
    }
    /** @description Capture-time directive proof required by every outbound upload. */
    ConsentSnapshot: {
      answers: {
        [key: string]: string
      }
      jurisdiction: string
      purposes_asked: string[]
      resolver_version: string
      signal_source: string
    }
    /** @enum {string} */
    ControllerRole: 'controller' | 'processor' | 'business' | 'service_provider'
    ConversionDiagnostics: {
      /** Format: date-time */
      captured_at: string
      event: components['schemas']['ConversionEvent']
    }
    ConversionEvent: {
      click_ids: components['schemas']['ClickIds']
      consent: components['schemas']['ConsentSnapshot']
      event_id: string
      hashed_identifiers: {
        [key: string]: components['schemas']['HashedIdentifier']
      }
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      name: string
      /** Format: date-time */
      occurred_at: string
      order_ref?: string | null
      subject_key?: components['schemas']['SubjectKeyRef']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
      upload_states?: {
        [key: string]: components['schemas']['UploadState']
      }
      value?: null | components['schemas']['Money']
      value_source?: null | components['schemas']['ValueSource']
    }
    /** @description One field correction (rectification). */
    Correction: {
      context: string
      field: string
      value: string
    }
    CreateAdGroupRequest: {
      bid: components['schemas']['BidSettings']
      name: string
      targeting: components['schemas']['Targeting']
    }
    CreateAdRequest: {
      creative: components['schemas']['Creative']
      landing_url: string
      tracking_template?: string | null
    }
    CreateAudienceRequest: {
      name: string
      platform: components['schemas']['PlatformKey']
    }
    CreateCampaignRequest: {
      budget: components['schemas']['Budget']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      name: string
      /** @example sales */
      objective: string
      schedule?: null | components['schemas']['Schedule']
    }
    /**
     * @description `POST /api/v1/tenant/checkout` — create a checkout session on the
     *     tenant's connected account (09.4, direct charges). Idempotency-Key is
     *     required: a double-clicked buy button must not create two sessions.
     */
    CreateCheckoutRequest: {
      /**
       * Format: int64
       * @description Minor units — ¥2,000 is `2000` (JPY is zero-decimal).
       * @example 2000
       */
      amount_minor: number
      /** @example https://shop.tenant.test/cart */
      cancel_url: string
      /**
       * @description ISO-4217 code; must match the connected account's settlement
       *     currency.
       * @example JPY
       */
      currency: string
      /**
       * @description Free-form customer/order context (provider-passthrough; no card
       *     data ever). Rate limiting buckets one key per distinct value.
       */
      customer_ref?: Record<string, never> | null
      /** @description Presentation locale for the hosted page (`ja`, `en-US`, …). */
      locale?: string | null
      /**
       * @description The merchant's order reference, echoed on every read model.
       * @example order-2026-0821
       */
      reference: string
      /**
       * @description Redirect target on a **verified** tenant domain (phase 08). A
       *     success URL on any other host is rejected outright.
       * @example https://shop.tenant.test/thanks
       */
      success_url: string
    }
    CreateConnectionRequest: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      /** @example JPY */
      currency: string
      external_account_id: string
      /** @example Asia/Tokyo */
      timezone: string
    }
    CreateCreativeRequest: {
      asset_references: string[]
      assets?: components['schemas']['AssetMetadata'][]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      placement: string
      texts: components['schemas']['CreativeText'][]
    }
    CreateImpersonationRequest: {
      /** Format: int32 */
      duration_minutes: number
      mode?: components['schemas']['ImpersonationMode']
      reason: string
      target_user_id: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    CreatePlanRequest: {
      key: string
      name: string
      /** Format: int32 */
      sort_order?: number
      stripe_product_id: string
      tier: components['schemas']['PlanTier']
      visibility?: components['schemas']['PlanVisibility']
    }
    CreateRoleRequest: {
      key: string
      name: string
      permissions: string[]
    }
    Creative: {
      asset_references: string[]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      placement: string
      texts: components['schemas']['CreativeText'][]
    }
    CreativeAssetSpec: {
      aspect_ratios: string[]
      /**
       * @description Placement-set-level requirement (whether at least one image asset is required for the placement set).
       *     Not enforced per asset.
       */
      image_required: boolean
      /** Format: int32 */
      max_duration_seconds?: number | null
      /** Format: int64 */
      max_file_size_bytes?: number | null
      /** Format: int32 */
      min_duration_seconds?: number | null
      /** Format: int32 */
      min_height_px?: number | null
      /** Format: int32 */
      min_width_px?: number | null
      video_allowed: boolean
    }
    CreativePlacement: {
      asset_spec: components['schemas']['CreativeAssetSpec']
      key: string
    }
    CreativePreviewView: {
      asset_references: string[]
      body?: string | null
      headline?: string | null
      placement: string
      spec: components['schemas']['CreativeAssetSpec']
    }
    CreativePreviewsView: {
      previews: components['schemas']['CreativePreviewView'][]
    }
    CreativeText: {
      body: string
      headline: string
      locale: string
    }
    CreativeView: {
      assets?: components['schemas']['AssetMetadata'][]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      connection_id: string
      /** Format: date-time */
      created_at: string
      creative: components['schemas']['Creative']
      external_id?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      platform: string
      /** Format: date-time */
      updated_at: string
    }
    CreativesView: {
      creatives: components['schemas']['CreativeView'][]
    }
    CustomDomainView: {
      /**
       * Format: date-time
       * @description The active certificate's expiry, when one has been issued. `None`
       *     while the domain has no active cert (not yet issued, or removed).
       */
      cert_expires_at?: string | null
      challenge?: null | components['schemas']['ChallengeView']
      /** Format: date-time */
      created_at: string
      detected_registrar?: string | null
      failure?: null | components['schemas']['DomainFailure']
      hostname: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      kind: string
      role: string
      status: string
      /** Format: date-time */
      updated_at: string
      /** Format: date-time */
      verified_at?: string | null
    }
    /**
     * @description A data class: the granularity at which the data map, retention rules and
     *     breach classification operate. The registry below is the compile-time
     *     data map; every provider names its classes from it.
     * @enum {string}
     */
    DataClass:
      | 'identity_profile'
      | 'authentication'
      | 'membership'
      | 'contact'
      | 'billing'
      | 'invoice'
      | 'transaction_record'
      | 'audit_log'
      | 'consent_record'
      | 'preference'
      | 'communication'
      | 'jurisdiction'
      | 'request_record'
      | 'advertising_conversion_event'
      | 'advertising_metric'
      | 'advertising_campaign_change'
      | 'advertising_budget_cap'
      | 'advertising_budget_alert'
    DataFreshness: {
      is_settled: boolean
      is_stale: boolean
      /** Format: double */
      lag_hours?: number | null
      /** Format: date-time */
      last_synced_at?: string | null
    }
    DecideAppealOutput: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      appeal_id: string
      authority?: null | components['schemas']['AuthorityContact']
      /** Format: date-time */
      decided_at: string
      outcome: components['schemas']['AppealOutcome']
    }
    DecideAppealRequest: {
      outcome: components['schemas']['AppealOutcome']
      reason: string
    }
    DefineFeatureRequest: {
      default_enabled?: boolean
      /** Format: int64 */
      default_limit?: number | null
      key: string
      kind: components['schemas']['FeatureKind']
      name: string
      visibility?: components['schemas']['Visibility']
    }
    /** @description Result of probing one dependency for readiness. */
    DependencyStatus: {
      /** @description Human-readable detail, present when degraded. */
      detail?: string | null
      /**
       * @description Stable dependency name, e.g. `database`, `redis`.
       * @example database
       */
      name: string
      state: components['schemas']['HealthState']
    }
    /** @description The full resolved state for one subject. */
    DirectiveSnapshot: {
      directives: components['schemas']['PurposeDirective'][]
      honours_universal_opt_out: boolean
      jurisdiction: components['schemas']['JurisdictionRef']
      /** Format: int32 */
      minor_opt_in_age?: number | null
      subject: components['schemas']['SubjectRef']
    }
    /**
     * @description Where a directive's state came from. The jurisdiction profile supplies
     *     the default; everything else is an explicit subject action or signal.
     * @enum {string}
     */
    DirectiveSource: 'consent' | 'opt_out' | 'signal' | 'default' | 'guardian'
    /**
     * @description The resolved answer for one purpose.
     * @enum {string}
     */
    DirectiveState: 'allowed' | 'denied'
    /** @description Cursor-paginated dispute list. */
    DisputeListView: {
      items: components['schemas']['DisputeView'][]
      next_cursor?: string | null
    }
    /** @description One dispute plus its dashboard deep link (read-only). */
    DisputeView: {
      /** Format: int64 */
      amount_minor: number
      charge_id?: string | null
      created_at: string
      currency: string
      dashboard_url?: string | null
      due_by?: string | null
      external_dispute_id: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      payment_id: string
      reason?: string | null
      status: string
    }
    /** @description Why a domain failed or degraded, as a stable code plus free detail. */
    DomainFailure: {
      code: string
      detail: string
      /** @description Same as `txt_ok`, for the routing (CNAME/A) check. */
      routing_ok?: boolean | null
      /**
       * @description The last verification attempt's independent TXT-ownership result.
       *     `None` when this failure isn't a verification failure, or the check
       *     didn't run that attempt (not "passed").
       */
      txt_ok?: boolean | null
    }
    /** @description One search hit: a hostname candidate with normalized pricing. */
    DomainQuote: {
      available: boolean
      hostname: string
      premium: boolean
      register_price: components['schemas']['Money']
      registrar_id: string
      renew_price: components['schemas']['Money']
      tld: string
    }
    DomainSearchView: {
      query: string
      registrar_id: string
      results: components['schemas']['DomainQuote'][]
    }
    /** @enum {string} */
    DriftResolution: 'keep_theirs' | 'reapply_ours'
    DriftState: {
      changed_fields: string[]
      drifted: boolean
    }
    DryRunEvaluationResult: {
      cap_amount: components['schemas']['Money']
      condition: string
      current_spend: components['schemas']['Money']
      /** Format: double */
      percentage: number
      period: components['schemas']['BudgetPeriod']
      scope: string
      would_auto_pause: boolean
      would_breach_100: boolean
      would_breach_80: boolean
    }
    /**
     * @description A DSR kind. `KnowCategories` is the CCPA "right to know" (categories
     *     only, no contents).
     * @enum {string}
     */
    DsrKind:
      | 'access'
      | 'export'
      | 'erasure'
      | 'rectification'
      | 'restriction'
      | 'objection'
      | 'opt_out_sale_or_share'
      | 'opt_out_targeted_advertising'
      | 'opt_out_profiling'
      | 'limit_sensitive_use'
      | 'know_categories'
    /** @enum {string} */
    DsrStatus:
      | 'awaiting_verification'
      | 'in_progress'
      | 'partially_complete'
      | 'completed'
      | 'rejected'
      | 'on_hold'
      | 'under_appeal'
    /**
     * @description One plan → feature grant. Feature keys reference the access context's
     *     catalog (validated at write time; no FK because the catalog is runtime
     *     data).
     */
    EntitlementGrant: {
      enabled: boolean
      feature_key: string
      /** Format: int64 */
      limit?: number | null
    }
    /** @enum {string} */
    EntitlementSourceView: 'override' | 'subscription' | 'plan_default' | 'feature_default'
    EvidenceInput: {
      kind: string
      value: string
    }
    /**
     * @description What an entitlement buys.
     * @enum {string}
     */
    FeatureKind: 'boolean' | 'quota'
    /** @description One catalog feature as exposed by the API. */
    FeatureView: {
      default_enabled: boolean
      /** Format: int64 */
      default_limit?: number | null
      /** Format: date-time */
      deprecated_at?: string | null
      key: string
      kind: components['schemas']['FeatureKind']
      name: string
      visibility: components['schemas']['Visibility']
    }
    /**
     * @description A font the theme uses. Self-hosted only — no remote `@import` is ever
     *     possible through this schema.
     */
    FontSpec: {
      family: string
      source: string
      subsets: string[]
    }
    GetDirectivesOutput: {
      snapshot: components['schemas']['DirectiveSnapshot']
    }
    GetRequestStatusOutput: {
      /** Format: date-time */
      acknowledged_at?: string | null
      appeal?: null | components['schemas']['AppealStatusView']
      /** Format: date-time */
      completed_at?: string | null
      /** Format: date-time */
      due_at: string
      export_available: boolean
      /** Format: date-time */
      extended_to?: string | null
      jurisdiction: string
      kind: components['schemas']['DsrKind']
      /** Format: date-time */
      received_at: string
      rejection_reason?: string | null
      request_id: string
      status: components['schemas']['DsrStatus']
      submitted_by: components['schemas']['Requester']
    }
    GrantEntitlementRequest: {
      enabled?: boolean
      /** Format: date-time */
      expires_at?: string | null
      feature_key: string
      /** Format: int64 */
      limit?: number | null
      reason?: string | null
    }
    GrantEntitlementResultView:
      | 'granted'
      | {
          approval_required: {
            approval_id: string
          }
        }
    GrantMembershipCommand: {
      /** @example alice@example.com */
      email: string
      role_ids: string[]
    }
    /** @description The registrar-specific walkthrough (localized; phase 06). */
    GuideView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      steps: string[]
      title: string
    }
    HashedIdentifier: string
    /**
     * @description Whether a dependency is healthy.
     * @enum {string}
     */
    HealthState: 'ok' | 'degraded'
    /** @description One grant as exposed by the API. */
    ImpersonationGrantView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      actor_id: string
      /** Format: date-time */
      created_at: string
      /** Format: date-time */
      expires_at: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      mode: components['schemas']['ImpersonationMode']
      reason: string
      /** Format: date-time */
      revoked_at?: string | null
      revoked_by?: string | null
      target_user_id: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    /**
     * @description How much the impersonated session may do (mirrors the HTTP layer's
     *     mode; the adapter converts).
     * @enum {string}
     */
    ImpersonationMode: 'read_only' | 'read_write'
    /**
     * @description The command a theme artifact resolves to after the publish pipeline
     *     validated it (manifest schema, token schema, contrast gate).
     */
    InstallThemeVersionCommand: {
      /** @description Explicit override for the contrast gate (recorded, never silent). */
      allow_contrast_warnings: boolean
      /** @description sha256 digest the artifact must match. */
      artifact_digest: string
      /** @description Content-addressed artifact location. */
      artifact_uri: string
      /** @description The validated manifest (`theme.json`). */
      manifest: unknown
      /** @description Who published (first-party "sanvi" or a future third party). */
      publisher: string
      /** @description For premium themes: the entitlement key. */
      required_feature?: string | null
      /** @description The merged token document `{light: …, dark: …}`. */
      tokens: unknown
      /** @description `public` or `premium`. */
      visibility: string
    }
    /** @description One instruction record with a localized explanation line. */
    InstructionRecord: {
      explanation: string
      name: string
      record_type: string
      /** Format: int32 */
      ttl: number
      value: string
    }
    InstructionsView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      domain_id: string
      guide: components['schemas']['GuideView']
      hostname: string
      kind: string
      records: components['schemas']['InstructionRecord'][]
      role: string
      status: string
    }
    /** @enum {string} */
    InvitationStatus: 'pending' | 'accepted'
    InvitationView: {
      accepted_at?: string | null
      /** @example bob@example.com */
      email: string
      expires_at: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      invitation_id: string
      role_ids: string[]
      status: components['schemas']['InvitationStatus']
    }
    InviteMemberCommand: {
      /** @example bob@example.com */
      email: string
      role_ids: string[]
    }
    /**
     * @description Mirrors Stripe's invoice status one-to-one.
     * @enum {string}
     */
    InvoiceStatus: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
    /** @description An invoice row as served to the billing UI. */
    InvoiceView: {
      /** Format: date-time */
      created_at: string
      currency: string
      hosted_url?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      invoice_id: string
      number?: string | null
      /** Format: date-time */
      paid_at?: string | null
      pdf_url?: string | null
      period?: null | components['schemas']['Period']
      status: components['schemas']['InvoiceStatus']
      /** Format: int64 */
      total_minor: number
    }
    JurisdictionProfile: {
      /** Format: int32 */
      ack_days?: number | null
      /** Format: int32 */
      appeal_response_days?: number | null
      /** Format: int32 */
      appeal_window_days?: number | null
      authority: components['schemas']['AuthorityContact']
      breach_rules: components['schemas']['BreachRuleSet']
      code: components['schemas']['JurisdictionRef']
      consent_model: components['schemas']['ConsentModel']
      /** Format: date */
      effective_from: string
      /** Format: int32 */
      extension_days: number
      honours_universal_opt_out: boolean
      /** Format: int32 */
      minor_opt_in_age?: number | null
      /** Format: int32 */
      opt_out_effective_business_days?: number | null
      regime: components['schemas']['Regime']
      /** Format: int32 */
      response_days: number
      risk_assessment_required: boolean
      sensitive_model: components['schemas']['SensitiveModel']
      source_note?: string | null
    }
    /**
     * @description A jurisdiction code (`eu`, `uk`, `jp`, `us-ca`, …). Parsed, never
     *     free-form, so a typo fails at the boundary rather than silently falling
     *     back to the most protective profile.
     */
    JurisdictionRef: string
    /** @description A tenant's layout adjustment: which slots to hide on an unlocked layout. */
    LayoutOverride: {
      hidden_slots: string[]
    }
    /** @description A layout definition: named slots and whether tenants may restructure it. */
    LayoutSpec: {
      locked?: boolean
      slots: string[]
    }
    /**
     * @description A legal basis for processing a data class.
     * @enum {string}
     */
    LegalBasis:
      | 'contract'
      | 'legal_obligation'
      | 'consent'
      | 'legitimate_interest'
      | 'notice_opt_out'
      | 'statutory_retention'
    /** @description A legal hold: blocks erasure for the named scope until released. */
    LegalHold: {
      /** Format: date-time */
      created_at: string
      created_by: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      reason: string
      /** Format: date-time */
      released_at?: string | null
      released_by?: string | null
      scope: unknown
    }
    LimitSensitiveRequest: {
      source?: string | null
    }
    LinkCompleteResponse: {
      linked: boolean
      provider: string
      subject: string
    }
    LivenessResult: {
      /** @example ok */
      status: string
    }
    /**
     * @description A validated, canonicalised BCP-47 language tag.
     *
     *     Canonicalisation: language lowercase, script title-case, region
     *     uppercase (`ja-jp` → `ja-JP`, `EN` → `en`). Only well-formed tags
     *     accepted: 2–3 letter language, optional 4-letter script, optional 2-letter
     *     or 3-digit region. This is deliberately *not* full BCP-47 (no variants,
     *     no extensions): the backend only needs the granularity it can translate
     *     and format with.
     */
    Locale: string
    LocalizationSettingsView: {
      default_locale: string
      enabled_locales: string[]
      timezone: string
      /** Format: date-time */
      updated_at: string
    }
    /** @description Localised display names in a manifest. */
    LocalizedName: {
      en: string
      ja: string
    }
    MarkBreachNotifiedCommand: {
      artifact?: unknown
      audience: string
      jurisdiction: string
    }
    MeView: {
      created_at: string
      /** @example alice@example.com */
      email: string
      email_verified: boolean
      /** @example en */
      locale?: string | null
      memberships: components['schemas']['MembershipSummary'][]
      status: components['schemas']['UserStatus']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      user_id: string
    }
    MemberView: {
      created_at: string
      /** @example alice@example.com */
      email: string
      invited_by?: string | null
      role_ids: string[]
      status: components['schemas']['MembershipStatus']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      user_id: string
    }
    /** @enum {string} */
    MembershipStatus: 'active' | 'suspended'
    /**
     * @description One tenant `GET /api/v1/me` reports the caller as a member of, with the
     *     roles/permissions they hold there — the single hydration call the
     *     frontend's session store and `can()`/`<Can>` are built on (see
     *     `sanvi-frontend/docs/phase-02-auth-ux`), so it carries everything a tenant
     *     switcher and permission-aware render need without a per-tenant follow-up
     *     request.
     */
    MembershipSummary: {
      /**
       * @description The union of every permission `role_ids` grants — a UX hint only; the
       *     backend enforces every mutation independently of what this list says.
       */
      permissions: string[]
      role_ids: string[]
      status: components['schemas']['MembershipStatus']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
      /** @example Acme Corporation */
      tenant_name: string
      /** @example acme */
      tenant_slug: string
    }
    /**
     * @description One rollup row (TASK-016, slice 10.7). The grain depends on the
     *     request's `group_by`: `campaign` populates both `platform` and
     *     `campaign_id`; `platform` populates only `platform`; `tenant` leaves
     *     both `None`. Tenant is supplied by the authenticated route scope.
     *
     *     `conversion_value` (the platform's own attribution) and `sanvi_revenue`
     *     (Sanvi's order-based view) are always both present, always labelled
     *     separately — never blended into one number (NFR-1006). Same for
     *     `roas_platform`/`roas_sanvi`: each is `null` on zero spend, never `∞`.
     */
    MetricPoint: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      campaign_id?: string
      /** Format: int64 */
      clicks: number
      /**
       * @description Platform-reported conversion value — attribution the ad platform's
       *     own model made.
       */
      conversion_value: components['schemas']['MoneyView']
      /** Format: double */
      conversions: number
      /**
       * Format: date
       * @example 2026-08-24
       */
      date: string
      /** Format: int64 */
      impressions: number
      /** @example google_ads */
      platform?: string | null
      rendered_spend?: null | components['schemas']['RenderedMoneyView']
      /**
       * @description Still inside the platform's restatement window — this day's numbers
       *     may still change on a later ingest.
       */
      restating: boolean
      /** Format: double */
      roas_platform?: number | null
      /** Format: double */
      roas_sanvi?: number | null
      /**
       * @description Sanvi's own order-based revenue view. Never summed with
       *     `conversion_value` — see the type's doc comment.
       */
      sanvi_revenue: components['schemas']['MoneyView']
      spend: components['schemas']['MoneyView']
    }
    MetricsFreshnessView: {
      connections: components['schemas']['ConnectionFreshnessView'][]
    }
    MetricsQueryResponse: {
      rows: components['schemas']['MetricPoint'][]
    }
    MetricsSummaryResponse: {
      compared?: components['schemas']['MetricsSummaryRow'][] | null
      current: components['schemas']['MetricsSummaryRow'][]
    }
    /**
     * @description One currency's totals across the whole requested range — the range
     *     itself collapsed, so unlike [`MetricPoint`] there is one row per
     *     currency, not per day.
     */
    MetricsSummaryRow: {
      /** Format: int64 */
      clicks: number
      conversion_value: components['schemas']['MoneyView']
      /** Format: double */
      conversions: number
      currency: string
      /** Format: int64 */
      impressions: number
      /**
       * @description `true` if any day in the range is still inside its platform's
       *     restatement window.
       */
      restating: boolean
      /** Format: double */
      roas_platform?: number | null
      /** Format: double */
      roas_sanvi?: number | null
      sanvi_revenue: components['schemas']['MoneyView']
      spend: components['schemas']['MoneyView']
    }
    Money: {
      /** Format: int64 */
      amount_minor: number
      currency: string
    }
    /**
     * @description A stored amount is always integer minor units plus the originating ad
     *     account's ISO-4217 currency. JPY ¥2,000 is represented as `2000` / `JPY`.
     */
    MoneyView: {
      /**
       * Format: int64
       * @example 2000
       */
      amount_minor: number
      /** @example JPY */
      currency: string
    }
    /**
     * @description The notice at collection (served before any collection happens): the
     *     categories collected, the purposes, sale/share status and retention
     *     summary.
     */
    NoticeAtCollectionView: {
      categories: string[]
      notice_version: string
      /** Format: int32 */
      opt_out_effective_business_days?: number | null
      purposes: string[]
      retention_summary: components['schemas']['RetentionNoticeRow'][]
      sale_or_share: boolean
      sensitive_pi: boolean
      targeted_advertising: boolean
    }
    NoticeJurisdictionView: {
      /** Format: int32 */
      appeal_window_days?: number | null
      code: string
      consent_model: string
      honours_universal_opt_out: boolean
      regime: string
      /** Format: int32 */
      response_days: number
    }
    /** @description One computed notification obligation. */
    NotificationObligation: {
      artifact?: unknown
      audience: components['schemas']['ObligationAudience']
      /** Format: date-time */
      due_at: string
      jurisdiction: components['schemas']['JurisdictionRef']
      /** Format: date-time */
      notified_at?: string | null
      suppressed_by_encryption: boolean
    }
    OAuthCallbackQuery: {
      code: string
      /**
       * @description Must match the `redirect_uri` sent to `start` — the platform rejects
       *     a mismatch at exchange time.
       */
      redirect_uri: string
      state: string
    }
    Objective: string
    /** @enum {string} */
    ObligationAudience: 'authority' | 'consumer' | 'tenant'
    OrderView: {
      auto_renew: boolean
      /** Format: date-time */
      created_at: string
      currency: string
      /** Format: date-time */
      expires_at?: string | null
      hostname: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      /** Format: int64 */
      price_minor: number
      /** Format: date-time */
      registered_at?: string | null
      status: string
      /** Format: int32 */
      term_years: number
      whois_privacy: boolean
    }
    /** @description One stored override row (operator console). */
    OverrideView: {
      enabled: boolean
      /** Format: date-time */
      expires_at?: string | null
      feature: string
      granted_by?: string | null
      granted_reason?: string | null
      /** Format: int64 */
      limit?: number | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
      /** Format: date-time */
      updated_at: string
    }
    PatchAdGroupRequest: {
      bid?: null | components['schemas']['BidSettings']
      name?: string | null
      targeting?: null | components['schemas']['Targeting']
    }
    PatchAdRequest: {
      creative?: null | components['schemas']['Creative']
      landing_url?: string | null
      /**
       * @description `None` leaves the stored value unchanged; there is no way to clear it
       *     back to unset in this slice (same limitation `PATCH /campaigns/{id}`
       *     has for `schedule`).
       */
      tracking_template?: string | null
    }
    /**
     * @description A merge patch: every field is optional and `None` leaves the stored
     *     value unchanged. Used both by `PATCH` and by `validate`'s dry run.
     */
    PatchCampaignRequest: {
      ad_groups?: components['schemas']['AdGroup'][] | null
      budget?: null | components['schemas']['Budget']
      name?: string | null
      /** @example sales */
      objective?: string | null
      schedule?: null | components['schemas']['Schedule']
    }
    /**
     * @description The payment detail the support UI renders: payment + its refunds +
     *     disputes + timeline.
     *
     *     The timeline is a first-class projection derived from stored events
     *     (created, succeeded/failed, refunded, disputed, paid out), each with
     *     a timestamp and an actor where one exists.
     */
    PaymentDetailView: {
      checkout_reference?: string | null
      disputes: components['schemas']['DisputeView'][]
      payment: components['schemas']['PaymentView']
      refunds: components['schemas']['RefundView'][]
      timeline: components['schemas']['TimelineEntry'][]
    }
    /** @description Cursor-paginated payment list. */
    PaymentListView: {
      items: components['schemas']['PaymentView'][]
      next_cursor?: string | null
    }
    /** @description One payment as the tenant sees it in the list. */
    PaymentView: {
      /** Format: int64 */
      amount_minor: number
      captured_at?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      checkout_id?: string
      created_at?: string | null
      currency: string
      external_payment_id: string
      failure_code?: string | null
      failure_message?: string | null
      fee_currency?: string | null
      /**
       * Format: int64
       * @description The provider-reported fee on this payment. When the platform's
       *     application fee is enabled for the tenant, this is where it is
       *     disclosed — a platform fee the merchant cannot see is not
       *     acceptable, whatever the contract says.
       */
      fee_minor?: number | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      /**
       * @description Payout status once payout reconciliation includes this payment
       *     (`pending` | `paid` | `failed`; null until then).
       */
      payout_status?: string | null
      status: string
    }
    /**
     * @description One payout as the tenant's list renders it. Read-only: payout
     *     management lives in the provider's own dashboard / embedded component.
     */
    PayoutView: {
      /** Format: int64 */
      amount_minor: number
      arrival_at?: string | null
      currency: string
      external_payout_id: string
      /**
       * @description `pending` | `paid` | `failed`. A failed payout is alerted, not
       *     just listed — the tenant's money is stuck at the provider.
       * @example paid
       */
      status: string
    }
    PayoutsListView: {
      /** @description Newest first; empty before a connection exists. */
      payouts: components['schemas']['PayoutView'][]
    }
    PendingConnectionView: {
      accounts: components['schemas']['AccountView'][]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      platform: string
      status: string
    }
    /** @description A billing period (current or invoice period). */
    Period: {
      /** Format: date-time */
      end: string
      /** Format: date-time */
      start: string
    }
    /**
     * @description Who a permission applies to, which decides how the check resolves.
     * @enum {string}
     */
    PermissionScope: 'platform' | 'tenant' | 'authenticated'
    PermissionView: {
      description: string
      key: string
      scope: components['schemas']['PermissionScope']
    }
    PlaceDomainOrderCommand: {
      /** @description Renew automatically before expiry (default true). */
      auto_renew?: boolean
      /** @description The hostname to purchase (must be an apex: `acme.com`). */
      hostname: string
      /**
       * Format: uuid
       * @description Client-supplied idempotency key: retrying a purchase returns the
       *     original order instead of charging twice.
       */
      idempotency_key?: string | null
      registrant_contact: components['schemas']['RegistrantContact']
      /**
       * Format: int32
       * @description Registration term in years.
       */
      term_years?: number
      /** @description WHOIS privacy (default true where supported). */
      whois_privacy?: boolean
    }
    PlanAdminPriceView: {
      active: boolean
      currency: string
      interval: components['schemas']['PriceInterval']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      price_id: string
      stripe_price_id: string
      /** Format: int32 */
      trial_days?: number | null
      /** Format: int64 */
      unit_amount_minor: number
    }
    /** @description The operator view adds the Stripe ids and visibility. */
    PlanAdminView: {
      entitlements: components['schemas']['EntitlementGrant'][]
      key: string
      name: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      plan_id: string
      prices: components['schemas']['PlanAdminPriceView'][]
      /** Format: int32 */
      sort_order: number
      stripe_product_id: string
      tier: components['schemas']['PlanTier']
      visibility: components['schemas']['PlanVisibility']
    }
    /** @description One price on the public pricing page. */
    PlanPriceView: {
      currency: string
      interval: components['schemas']['PriceInterval']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      price_id: string
      /** Format: int32 */
      trial_days?: number | null
      /** Format: int64 */
      unit_amount_minor: number
    }
    /**
     * @description One sellable tier. Each tier maps to exactly one Stripe Product so
     *     Checkout line items show a distinguishable name.
     * @enum {string}
     */
    PlanTier: 'starter' | 'professional' | 'enterprise'
    /**
     * @description Whether a plan appears on the public pricing page.
     * @enum {string}
     */
    PlanVisibility: 'public' | 'hidden'
    PlatformAdsHealthReport: {
      connections_needing_attention: components['schemas']['ConnectionAttentionView'][]
      freshness_summary: components['schemas']['AdsFreshnessSummaryView']
      platform_counts: components['schemas']['PlatformConnectionCountView'][]
    }
    PlatformConnectionCountView: {
      /** Format: int32 */
      active: number
      /** Format: int32 */
      disconnected: number
      /** Format: int32 */
      expired: number
      /** Format: int32 */
      pending: number
      platform: string
      /** Format: int32 */
      total: number
    }
    /**
     * @description The platform's fee disclosure for this tenant (their payment settings).
     *     A platform fee the merchant cannot see is not acceptable, whatever the
     *     contract says.
     */
    PlatformFeeDisclosure: {
      /** Format: int32 */
      basis_points?: number | null
      /** @description Fees are off for this tenant unless stated here. */
      enabled: boolean
      fixed_currency?: string | null
      /** Format: int64 */
      fixed_minor?: number | null
      /** Format: int64 */
      minimum_minor: number
    }
    /** @description Adapter-owned identifier. Domain code never switches on a platform name. */
    PlatformKey: string
    /**
     * @description Registry-derived catalog item. A platform without entitlement remains in
     *     the list so clients can render its upgrade state rather than a dead end.
     */
    PlatformView: {
      available: boolean
      capability_matrix: components['schemas']['CapabilityMatrix']
      connection_state: components['schemas']['ConnectionState']
      /** @example Google Ads */
      display_name: string
      entitlement_key: string
      /** @example google_ads */
      key: string
      upgrade_required: boolean
    }
    /**
     * @description Stable envelope for the platform catalog. TASK-010 fills this only from
     *     registered capability matrices; no platform name is hard-coded here.
     */
    PlatformsView: {
      platforms: components['schemas']['PlatformView'][]
    }
    PortalSessionView: {
      url: string
    }
    PreviewTokenView: {
      /** Format: date-time */
      expires_at: string
      token: string
    }
    /**
     * @description Billing variant of a plan: monthly vs annual, currency, amount.
     * @enum {string}
     */
    PriceInterval: 'month' | 'year'
    PrivacyNoticeView: {
      /** Format: int64 */
      backup_retention_days: number
      jurisdictions: components['schemas']['NoticeJurisdictionView'][]
      notice_version: string
      retention: components['schemas']['RetentionNoticeRow'][]
      subprocessors: components['schemas']['SubProcessorNoticeRow'][]
    }
    /** @description RFC 9457 problem detail. This is the only error body the API produces. */
    ProblemDetail: (Record<string, never> | null) & {
      /** @description Human-readable explanation of this specific occurrence. */
      detail: string
      /** @description URI of the offending resource, if any. */
      instance?: string | null
      /**
       * @description Machine-readable reason for statuses that carry one (e.g. tenant
       *     suspension); absent otherwise.
       */
      reason?: string | null
      /**
       * Format: int32
       * @description HTTP status code (mirrors the response code).
       */
      status: number
      /** @description Short, human-readable, stable title. */
      title: string
      /** @description Correlates with the request id and the trace in OpenObserve. */
      trace_id?: string | null
      /**
       * @description Stable URI identifying the error class.
       * @example https://sanvi.dev/problems/bad-request
       */
      type: string
    }
    /**
     * @description An Art. 30 processing record (versioned; the active row describes the
     *     current processing).
     */
    ProcessingActivity: {
      active: boolean
      basis?: string | null
      controller_role: components['schemas']['ControllerRole']
      /** Format: date-time */
      created_at: string
      created_by?: string | null
      data_classes: components['schemas']['DataClass'][]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      name: string
      purpose: string
      supersedes?: string | null
      /** Format: int32 */
      version: number
    }
    /**
     * @description A processing purpose. `Essential` can never be denied and is never
     *     consentable; everything else resolves through the directive engine.
     * @enum {string}
     */
    ProcessingPurpose:
      | 'essential'
      | 'analytics'
      | 'marketing_email'
      | 'ads_personalisation'
      | 'ads_measurement'
      | 'session_replay'
      | 'sale_or_share'
      | 'targeted_advertising'
      | 'profiling_significant_effects'
      | 'sensitive_pi_use'
    /**
     * @description One connectable provider as the settings page renders it. Derived
     *     from the adapter's [`crate::domain::ports::ProviderDescriptor`] —
     *     never hardcoded per provider anywhere in this layer or the handlers.
     */
    ProviderView: {
      /**
       * @description Whether *this tenant* may connect (country support).
       * @example true
       */
      available: boolean
      /**
       * @description Human-readable name for cards and menus.
       * @example Stripe
       */
      display_name: string
      /**
       * @description Stable provider identifier (`stripe_connect`, `fake`).
       * @example stripe_connect
       */
      kind: string
      /**
       * @description Whether connecting requires an onboarding flow.
       * @example true
       */
      requires_onboarding: boolean
      /**
       * @description ISO-3166-1 alpha-2 countries whose tenants may connect.
       * @example [
       *       "US",
       *       "JP",
       *       "GB",
       *       "DE"
       *     ]
       */
      supported_countries: string[]
    }
    /**
     * @description `GET /api/v1/tenant/payments/providers` — the catalog envelope,
     *     derived from the provider registry.
     */
    ProvidersView: {
      /** @description Connectable providers, in stable kind order. */
      providers: components['schemas']['ProviderView'][]
    }
    ProvisionTenantCommand: {
      /** @example en */
      default_locale?: string
      /** @example Acme Corporation */
      display_name: string
      /** @example us */
      region: string
      /** @example acme */
      slug: string
    }
    PublicMetricsRow: {
      /** Format: int32 */
      complied: number
      /** Format: int32 */
      denied: number
      jurisdiction: string
      kind: string
      /** Format: double */
      median_days?: number | null
      /** Format: int32 */
      received: number
      /** Format: int32 */
      year: number
    }
    /**
     * @description A plan with its prices and entitlement grants (public pricing page; the
     *     Stripe price ids are omitted — they are integration details).
     */
    PublicPlanView: {
      entitlements: components['schemas']['EntitlementGrant'][]
      key: string
      name: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      plan_id: string
      prices: components['schemas']['PlanPriceView'][]
      /** Format: int32 */
      sort_order: number
      tier: components['schemas']['PlanTier']
    }
    /**
     * @description One resolved answer per purpose, with the provenance the privacy centre
     *     renders.
     */
    PurposeDirective: {
      /** Format: date-time */
      effective_at: string
      jurisdiction: components['schemas']['JurisdictionRef']
      notice_version?: string | null
      purpose: components['schemas']['ProcessingPurpose']
      source: components['schemas']['DirectiveSource']
      state: components['schemas']['DirectiveState']
      /** Format: date-time */
      superseded_at?: string | null
    }
    PutBudgetCapRequest: {
      amount: components['schemas']['Money']
      auto_pause?: boolean | null
      auto_resume_on_rollover?: boolean | null
      confirm_below_current_spend?: boolean | null
      declared_fx_basis?: string | null
      dry_run?: boolean | null
      /** Format: date */
      fx_rate_date?: string | null
      period: components['schemas']['BudgetPeriod']
    }
    PutBudgetCapResponse:
      | components['schemas']['BudgetCap']
      | components['schemas']['DryRunEvaluationResult']
    /** @description Aggregate readiness answer: every dependency's status plus the verdict. */
    Readiness: {
      checks: components['schemas']['DependencyStatus'][]
      /** @description `ok` when every dependency is healthy. */
      status: components['schemas']['HealthState']
    }
    RecordBreachIncidentCommand: {
      /** Format: date-time */
      contained_at?: string | null
      data_classes: string[]
      /** Format: date-time */
      discovered_at: string
      encrypted_at_rest: boolean
      jurisdictions: string[]
      notes?: string | null
      /** Format: int64 */
      subjects: number
      /** Format: int64 */
      tenants: number
    }
    RecordBreachIncidentOutput: {
      incident_id: string
      obligations: components['schemas']['NotificationObligation'][]
    }
    RecordConsentChangeOutput: {
      purpose: components['schemas']['ProcessingPurpose']
      source: components['schemas']['DirectiveSource']
      state: components['schemas']['DirectiveState']
    }
    RecordOptOutCommand: {
      device_ref?: string | null
      purposes: components['schemas']['ProcessingPurpose'][]
      /** @description `ui` | `api` | `gpc` — the GPC header path supplies `gpc`. */
      source: string
    }
    RecordOptOutOutput: {
      directives: components['schemas']['PurposeDirective'][]
      jurisdiction: string
    }
    RectifyRequest: {
      corrections: components['schemas']['Correction'][]
    }
    RefundAmount: {
      /** @example JPY */
      currency: string
      /**
       * Format: int64
       * @example 500
       */
      minor_units: number
    }
    /** @description Body for `POST /api/v1/tenant/payments/{id}/refund`. */
    RefundRequest: {
      amount?: null | components['schemas']['RefundAmount']
      /** @description Optional free-form note (support context, not the audit reason). */
      note?: string | null
      /**
       * @description Why the refund is being issued — required, audited and shown in
       *     the timeline. Empty is rejected.
       */
      reason: string
    }
    /** @description One refund record. */
    RefundView: {
      /** Format: int64 */
      amount_minor: number
      created_at: string
      created_by?: string | null
      currency: string
      external_refund_id?: string | null
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      payment_id: string
      reason?: string | null
      status: string
    }
    /**
     * @description The legal regime a jurisdiction belongs to; drives nothing by itself —
     *     every decision reads the profile's model fields instead.
     * @enum {string}
     */
    Regime: 'gdpr' | 'uk_gdpr' | 'appi' | 'us_state'
    /**
     * @description The registrant contact data (purchase journey). Personal data: minimized,
     *     registered in the phase-05 data map with the registrar as sub-processor,
     *     and erasable subject to ICANN retention rules.
     */
    RegistrantContact: {
      country_code: string
      email: string
      name: string
      organization?: string | null
      phone: string
    }
    RejectRequestRequest: {
      reason: string
    }
    ReleaseDomainCommand: {
      /** @description The audited reason for the force-release. */
      reason: string
    }
    /**
     * @description A presentation-only conversion. Converted money is never persisted; its
     *     rate date is required so chart and report values stay explainable.
     */
    RenderedMoneyView: {
      /** Format: int64 */
      amount_minor: number
      currency: string
      /**
       * Format: date
       * @example 2026-08-24
       */
      fx_rate_date: string
    }
    RequestOperatorView: {
      /** Format: date-time */
      completed_at?: string | null
      /** Format: date-time */
      due_at: string
      jurisdiction: string
      kind: components['schemas']['DsrKind']
      /** Format: date-time */
      received_at: string
      rejection_reason?: string | null
      request_id: string
      status: components['schemas']['DsrStatus']
      subject_key: string
      submitted_by: components['schemas']['Requester']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id?: string
    }
    /**
     * @description Who submitted a request.
     * @enum {string}
     */
    Requester: 'subject' | 'authorized_agent' | 'tenant_operator'
    /**
     * @description One outstanding provider requirement, with the i18n message key the
     *     frontend renders it from. The mapping is data
     *     (`payments.requirement_keys`); a code the map has not learned falls
     *     back to `payments.req.unmapped`, whose catalog entry shows the raw code
     *     plus Stripe's requirements help link — new requirements degrade,
     *     never break.
     */
    RequirementEntryView: {
      /**
       * @description The provider's requirement code, verbatim.
       * @example individual.verification.document
       */
      code: string
      /**
       * @description The i18n key to render (`payments.req.*`).
       * @example payments.req.id_document
       */
      summary_key: string
    }
    /**
     * @description The connection's outstanding-requirements summary, projected with
     *     render keys.
     */
    RequirementsView: {
      currently_due: components['schemas']['RequirementEntryView'][]
      deadline?: string | null
      eventually_due: components['schemas']['RequirementEntryView'][]
      past_due: components['schemas']['RequirementEntryView'][]
    }
    /**
     * @description How the tenant was resolved. Most-specific sources win; the source is
     *     recorded on the context for observability and debugging.
     * @enum {string}
     */
    ResolutionSource: 'internal_header' | 'session_claim' | 'custom_domain' | 'subdomain'
    ResolveCampaignDriftRequest: {
      resolution: components['schemas']['DriftResolution']
      /** Format: int64 */
      revision: number
    }
    ResolvedCampaignDriftView: {
      campaign: components['schemas']['Campaign']
      replayed: boolean
      resolution: components['schemas']['DriftResolution']
      /** Format: int64 */
      revision: number
    }
    /** @description One resolved entitlement as exposed to a tenant. */
    ResolvedEntitlementView: {
      enabled: boolean
      /** Format: date-time */
      expires_at?: string | null
      feature: string
      kind: components['schemas']['FeatureKind']
      /** Format: int64 */
      limit?: number | null
      source: components['schemas']['EntitlementSourceView']
    }
    /** @description A layout after tenant adjustments (hidden slots removed). */
    ResolvedLayout: {
      slots: string[]
    }
    /** @description The fully resolved theme document, ready for the frontend. */
    ResolvedTheme: {
      brand_assets: components['schemas']['BrandAssetUrls']
      capabilities: string[]
      /** @description Precompiled `:root{--…}` block (light + dark media query). */
      css_vars: string
      /** @description Sanitised tenant CSS, scoped under the storefront wrapper class. */
      custom_css?: string | null
      /** @description The merged dark token tree, when the theme ships dark mode. */
      dark_tokens?: unknown
      /** @description ETag: hash of (theme, version, revision, locale, api). */
      etag: string
      fonts: components['schemas']['FontSpec'][]
      layouts: {
        [key: string]: components['schemas']['ResolvedLayout']
      }
      locale: string
      /**
       * Format: int32
       * @description The live revision this document reflects (draft previews: 0).
       */
      revision: number
      theme_api: string
      theme_assets: components['schemas']['ThemeAssetUrls']
      theme_key: string
      theme_version: string
      /** @description The merged nested token tree (light mode). */
      tokens: unknown
    }
    /**
     * @description What the retention sweep does when a class's period expires.
     * @enum {string}
     */
    RetentionAction: 'delete' | 'anonymise' | 'archive'
    RetentionNoticeRow: {
      action: string
      category: string
      /** Format: int64 */
      period_days: number
    }
    /** @description A retention rule (one row of the data map's operational half). */
    RetentionRule: {
      action: components['schemas']['RetentionAction']
      basis?: null | components['schemas']['LegalBasis']
      data_class: components['schemas']['DataClass']
      disclosed_in_notice: boolean
      /** Format: int64 */
      period_days: number
      sensitivity: components['schemas']['SensitivityClass']
    }
    /** @description A DPIA / US state data-protection assessment. */
    RiskAssessment: {
      activity_id: string
      /** Format: date-time */
      created_at: string
      findings?: unknown
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      jurisdictions: components['schemas']['JurisdictionRef'][]
      mitigations?: unknown
      /** Format: date-time */
      next_review_at?: string | null
      /** Format: date-time */
      reviewed_at?: string | null
      reviewed_by?: string | null
      status: components['schemas']['RiskAssessmentStatus']
      trigger: components['schemas']['RiskAssessmentTrigger']
    }
    /** @enum {string} */
    RiskAssessmentStatus: 'open' | 'in_review' | 'approved' | 'superseded'
    /** @enum {string} */
    RiskAssessmentTrigger:
      | 'targeted_ads'
      | 'sale'
      | 'sensitive'
      | 'profiling'
      | 'large_scale'
      | 'health_data'
    /**
     * @description Where a role applies.
     * @enum {string}
     */
    RoleScope: 'platform' | 'tenant'
    /** @description One role as exposed by the API. */
    RoleView: {
      /** Format: date-time */
      created_at: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      is_system: boolean
      key: string
      name: string
      permissions: string[]
      scope: components['schemas']['RoleScope']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id?: string
    }
    Schedule: {
      ends_at?: string | null
      starts_at?: string | null
    }
    /** @enum {string} */
    ScheduleGranularity: 'daily' | 'hourly'
    /**
     * @description How sensitive-personal-information processing starts: permission first,
     *     a "limit my use" directive (CA), or notice only.
     * @enum {string}
     */
    SensitiveModel: 'opt_in' | 'limit_on_request' | 'notice_only'
    /**
     * @description The sensitivity class of a mapped personal-data field. Drives the CA
     *     "limit use" right, the non-CA opt-in for sensitive data, and the flagged
     *     health-data and minors classes that trigger consent-first handling.
     * @enum {string}
     */
    SensitivityClass: 'standard' | 'sensitive' | 'special' | 'flagged_health' | 'minors'
    SessionView: {
      aal: string
      authenticated_at?: string | null
      methods: string[]
      session_id: string
    }
    SetApplicationFeeRequest: {
      /**
       * Format: int32
       * @description Basis points of the charge total (1..=10000).
       */
      basis_points?: number | null
      /** @description Master switch. Enabling without a component is a validation error. */
      enabled?: boolean
      /**
       * Format: int64
       * @description Flat component in minor units, applied to charges in its currency.
       */
      fixed_amount_minor?: number | null
      fixed_currency?: string | null
      /**
       * Format: int64
       * @description Floor on the computed fee, minor units of the charge currency
       *     (currency-aware by interpretation: JPY minor units are whole yen;
       *     USD minor units are cents).
       */
      minimum_minor?: number
      /** @description Why the change is being made — audited with the actor. */
      reason?: string | null
    }
    SetEntitlementsRequest: {
      grants: components['schemas']['EntitlementGrant'][]
    }
    SettingsUpdate: {
      /**
       * @description Key → value map to upsert. Values are uninterpreted JSON.
       * @example {
       *       "checkout.currency": "JPY"
       *     }
       */
      settings: {
        [key: string]: unknown
      }
    }
    /** @enum {string} */
    SignalSource: 'ui' | 'api' | 'gpc' | 'uoom' | 'guardian' | 'import'
    /** @description The bare-boolean answer to a slug availability question. */
    SlugAvailability: {
      available: boolean
    }
    /**
     * Format: snowflake-id
     * @example 873698342314721281
     */
    SnowflakeId: string
    SpendStatusItem: {
      actions_configured: components['schemas']['BudgetActionsConfigured']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      campaign_id?: string
      cap?: null | components['schemas']['BudgetCap']
      data_freshness: components['schemas']['DataFreshness']
      /** Format: double */
      percentage?: number | null
      period: components['schemas']['BudgetPeriod']
      projected_spend: components['schemas']['Money']
      provisional_lower_bound?: null | components['schemas']['Money']
      provisional_spend: components['schemas']['Money']
      scope: string
      settled_spend: components['schemas']['Money']
      spend_to_date: components['schemas']['Money']
      /**
       * @description Currencies for which spend data could not be converted to the cap currency
       *     because an FX rate was unavailable. When non-empty, spend totals are incomplete.
       */
      unconvertible_spend_currencies?: string[]
    }
    SpendStatusReport: {
      items: components['schemas']['SpendStatusItem'][]
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    StartLinkChallengeCommand: {
      /** @example alice@example.com */
      email: string
      /** @description The Kratos login flow that collided (correlation only). */
      kratos_flow_id?: string | null
      /** @example google */
      provider: string
      /** @example sub-12345 */
      subject: string
    }
    StartLinkChallengeResponse: {
      /**
       * Format: int64
       * @description How long the challenge stays valid, in seconds.
       */
      expires_in_secs: number
      /**
       * @description The nonce the frontend stores in the `sanvi_link_intent` cookie
       *     (`HttpOnly`, `SameSite=Lax`, TTL = the intent's).
       */
      nonce: string
    }
    StartOAuthRequest: {
      redirect_uri: string
    }
    StartOAuthResponse: {
      authorization_url: string
      state: string
    }
    /**
     * @description A sub-processor registry row. `role` is the field that turns an
     *     ad-platform upload into a "sale"/"share" under US law — it is required
     *     and asserted by phase 10's uploads.
     */
    SubProcessor: {
      /** Format: date-time */
      added_at: string
      contract_terms: unknown
      dpa_url?: string | null
      location: string
      name: string
      purpose: string
      /** Format: date-time */
      removed_at?: string | null
      role: components['schemas']['SubProcessorRole']
      transfer_mechanism?: null | components['schemas']['TransferMechanism']
    }
    SubProcessorNoticeRow: {
      location: string
      name: string
      purpose: string
      role: string
      transfer_mechanism?: string | null
    }
    /** @enum {string} */
    SubProcessorRole: 'processor' | 'service_provider' | 'contractor' | 'third_party'
    /**
     * @description One identifier by which a subject can be looked up (email, platform user
     *     id, tenant-internal customer id, …).
     */
    SubjectIdentifier: {
      type: string
      value: string
    }
    /** @description The subject a request targets, as supplied by the requester. */
    SubjectInput: {
      age_signal?: null | components['schemas']['AgeSignal']
      email?: string | null
      /**
       * @description Jurisdiction evidence, most trusted first (country codes: `DE`,
       *     `GB`, `US-CA`, …).
       */
      evidence: components['schemas']['EvidenceInput'][]
      external_id?: string | null
      /** @description `user` (authenticated), `end_user` (tenant customer), `email`. */
      kind: string
    }
    /**
     * @description Enough of the capturing subject's identity to rebuild the exact
     *     `SubjectRef` a later withdrawal re-check must query — without ever
     *     persisting the raw email/phone TASK-014 forbids in this context. A
     *     device ref, a tenant's own customer ref, and a platform user id are not
     *     themselves the raw PII that rule targets, so they are stored verbatim;
     *     an email-identified (`Contact`) subject stores nothing reconstructable,
     *     and the retry path refuses rather than re-deriving a directive answer
     *     against the wrong subject.
     */
    SubjectKeyRef:
      | {
          device_ref: string
          /** @enum {string} */
          kind: 'tenant_device'
        }
      | {
          external_id: string
          /** @enum {string} */
          kind: 'end_user'
        }
      | {
          /** @enum {string} */
          kind: 'tenant_user'
          /** Format: int64 */
          user_id: number
        }
      | {
          /** @enum {string} */
          kind: 'contact'
        }
    /**
     * @description Who the personal data belongs to, relative to the platform.
     * @enum {string}
     */
    SubjectKind: 'tenant_user' | 'end_user' | 'contact' | 'device'
    /**
     * @description The cross-context reference to a data subject. `key` is the canonical,
     *     stable key used for directive materialisation and crypto-shredding:
     *     `user:{snowflake}`, `end_user:{tenant_id}:{external_id}`, `email:{addr}` or
     *     `device:{device_ref}`.
     */
    SubjectRef: {
      identifiers: components['schemas']['SubjectIdentifier'][]
      key: string
      kind: components['schemas']['SubjectKind']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id?: string
    }
    SubmitDsrCommand: {
      agent?: null | components['schemas']['AgentInput']
      kind: components['schemas']['DsrKind']
      note?: string | null
      requester: components['schemas']['Requester']
      subject: components['schemas']['SubjectInput']
    }
    SubmitDsrOutput: {
      challenge_id?: string | null
      /** Format: date-time */
      due_at: string
      /**
       * @description Opt-out kinds take effect immediately and never require
       *     verification.
       */
      effective_immediately: boolean
      /** Format: date-time */
      extended_to?: string | null
      jurisdiction: string
      request_id: string
      status: components['schemas']['DsrStatus']
      /** @description Present when verification is required before disclosure/deletion. */
      verification_required: boolean
      /**
       * @description Opaque half of the verification credential. The OTP is delivered
       *     out-of-band, so neither response nor notification is sufficient alone.
       */
      verification_token?: string | null
    }
    SubscriptionOverrideRequest: {
      plan_key: string
      reason: string
    }
    /**
     * @description Where the subscription came from.
     * @enum {string}
     */
    SubscriptionSource: 'stripe' | 'override'
    /**
     * @description Mirrors Stripe's subscription status one-to-one.
     * @enum {string}
     */
    SubscriptionStatus:
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'unpaid'
      | 'canceled'
      | 'incomplete'
      | 'incomplete_expired'
      | 'paused'
    /** @description The tenant's subscription as served to the billing UI. */
    SubscriptionView: {
      cancel_at_period_end: boolean
      collection_state: components['schemas']['CollectionState']
      current_period?: null | components['schemas']['Period']
      plan_key: string
      plan_name: string
      source: components['schemas']['SubscriptionSource']
      status: components['schemas']['SubscriptionStatus']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      subscription_id: string
      /** Format: date-time */
      trial_end?: string | null
    }
    /** @description A supported locale row from `localization.supported_locales`. */
    SupportedLocale: {
      code: components['schemas']['Locale']
      name_en: string
      name_native: string
      /** Format: int32 */
      sort_order: number
    }
    SupportedLocalesView: {
      default: string
      locales: components['schemas']['SupportedLocale'][]
    }
    /** @description Request body for suspending a tenant. */
    SuspendTenantRequest: {
      /**
       * @description Machine-readable reason: billing | abuse | legal | operational.
       * @example billing
       */
      reason: string
    }
    /** @description Typed extension data. Arbitrary JSON is deliberately not admitted to the domain. */
    Targeting: {
      dimensions: {
        [key: string]: string[]
      }
      extension_fields: {
        [key: string]: string
      }
    }
    TargetingDimension: string
    /**
     * @description The tenant-facing automatic-tax state plus the standing legal
     *     statement: registration and remittance are the tenant's responsibility;
     *     Sanvi never advises on where or whether to register.
     */
    TaxSettingsView: {
      /** Format: int32 */
      active_registrations: number
      /** @description Always present, always the same: we never advise. */
      disclaimer: string
      enabled: boolean
      last_checked_at?: string | null
      /**
       * @description The liable connected-account id when enabled (`{ type: 'account' }`
       *     routing) — with direct charges the connected account is the
       *     merchant of record.
       */
      liability_account?: string | null
      platform_fee?: null | components['schemas']['PlatformFeeDisclosure']
      provider_status: string
      warning?: null | components['schemas']['TaxWarningView']
    }
    TaxWarningView: {
      /** @description Stable i18n key (`payments.tax.warning.*`). */
      code: string
      detail: string
      detected_at: string
    }
    /** @description One page of the operator tenant search. */
    TenantAdminPageView: {
      next_cursor?: null | components['schemas']['TenantViewCursorView']
      tenants: components['schemas']['TenantAdminView'][]
    }
    /** @description One row of the platform admin tenant search. */
    TenantAdminView: {
      /**
       * Format: int32
       * @description Active impersonation grants into this tenant.
       */
      active_impersonations: number
      /** Format: date-time */
      created_at: string
      default_locale: string
      display_name: string
      /**
       * Format: int32
       * @description Active members (identity projection).
       */
      member_count: number
      /**
       * Format: int32
       * @description Non-expired entitlement overrides (access context).
       */
      override_count: number
      region: string
      slug: string
      status: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    /**
     * @description What a tenant looks like at request time — the shape every context reads
     *     from request extensions.
     */
    TenantContext: {
      default_locale: string
      display_name: string
      region: string
      resolution_source: components['schemas']['ResolutionSource']
      slug: string
      status: components['schemas']['TenantRuntimeStatus']
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    TenantListView: {
      items: components['schemas']['TenantView'][]
      /** @description Cursor for the next page (null on the last page). */
      next_cursor?: string | null
    }
    /**
     * @description Tenant lifecycle state as observed at runtime. Only `Active` tenants serve
     *     traffic; `Suspended` returns 423 except on the allow-list.
     * @enum {string}
     */
    TenantRuntimeStatus: 'provisioning' | 'active' | 'suspended' | 'archived'
    TenantSettingsOutput: {
      settings: {
        [key: string]: unknown
      }
    }
    TenantThemeDraftView: {
      spec: components['schemas']['ThemeSpecView']
      theme: components['schemas']['TenantThemeView']
    }
    /** @description The tenant's draft (or live) theme state. */
    TenantThemeView: {
      assets: components['schemas']['BrandAssets']
      custom_css?: string | null
      layout_overrides: {
        [key: string]: components['schemas']['LayoutOverride']
      }
      /** Format: int32 */
      revision: number
      state: components['schemas']['ThemeState']
      theme_key: string
      token_overrides: {
        [key: string]: components['schemas']['TokenValue']
      }
      /** Format: date-time */
      updated_at: string
      version: string
    }
    /** @description Public representation of a tenant. */
    TenantView: {
      /** Format: date-time */
      archived_at?: string | null
      /** Format: date-time */
      created_at: string
      default_locale: string
      display_name: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      region: string
      slug: string
      status: string
      suspended_reason?: string | null
      /** Format: date-time */
      updated_at: string
    }
    TenantViewCursorView: {
      /** Format: date-time */
      created_at: string
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    TestTrackingEventResponse: {
      captured: components['schemas']['ConversionEvent']
      /**
       * @description Always `true` — a marker so this synthetic call is never mistaken
       *     for a real event by anything reading the response.
       */
      test: boolean
    }
    /** @description A registry entry for the platform control plane. */
    ThemeAdminView: {
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      id: string
      key: string
      publisher: string
      required_feature?: string | null
      status: components['schemas']['ThemeStatus']
      versions: components['schemas']['ThemeVersionAdminView'][]
      visibility: components['schemas']['ThemeVisibility']
    }
    /** @description Theme-provided reference assets (preview/screenshots), resolved to URLs. */
    ThemeAssetUrls: {
      preview?: string | null
      screenshots?: string[]
    }
    /**
     * @description Theme reference data surfaced to the tenant UI (fonts/layouts the theme
     *     ships, so the editor knows what is overridable).
     */
    ThemeSpecView: {
      capabilities: string[]
      fonts: components['schemas']['FontSpec'][]
      key: string
      layouts: {
        [key: string]: components['schemas']['LayoutSpec']
      }
      overridable: string[]
      version: string
    }
    /**
     * @description Draft or live — the two rows a tenant may hold.
     * @enum {string}
     */
    ThemeState: 'draft' | 'live'
    /**
     * @description Lifecycle status of a theme in the catalog.
     * @enum {string}
     */
    ThemeStatus: 'active' | 'deprecated'
    /** @description A version row for the platform control plane. */
    ThemeVersionAdminView: {
      artifact_digest: string
      artifact_uri: string
      /** Format: date-time */
      published_at: string
      semver: string
      theme_api_range: string
      /** Format: date-time */
      yanked_at?: string | null
    }
    /**
     * @description Who can see a theme in the catalog.
     * @enum {string}
     */
    ThemeVisibility: 'public' | 'premium'
    /** @description One entry in the payment's timeline. */
    TimelineEntry: {
      /**
       * @description Who caused this entry, when a human exists (refunds). Webhook-
       *     derived entries have no actor — the provider did.
       */
      actor?: string | null
      amount?: null | components['schemas']['Money']
      at: string
      /**
       * @description Human detail (failure code, refund reason, dispute reason,
       *     status detail), when relevant.
       */
      detail?: string | null
      /**
       * @description Stable kind: `created`, `succeeded`, `failed`, `canceled`,
       *     `refunded`, `disputed`, `dispute_closed`, `paid_out` (09.6).
       * @example refunded
       */
      kind: string
    }
    TlsAuthorizeResponse: {
      allowed: boolean
      reason: string
    }
    /** @description A leaf token (`$value` + optional `$type`/`$description`). */
    TokenValue: {
      $description?: string | null
      $type?: string | null
      $value: unknown
    }
    TrackConversionRequest: {
      click_ids?: components['schemas']['ClickIds']
      currency?: string | null
      device_id?: string | null
      email?: string | null
      event_id: string
      event_name: string
      order_ref?: string | null
      phone?: string | null
      /** Format: int64 */
      value?: number | null
    }
    TrackingSettings: {
      /** @description event name -> (platform key -> the platform's conversion action) */
      mappings: {
        [key: string]: {
          [key: string]: string
        }
      }
      /**
       * Format: snowflake-id
       * @example 873698342314721281
       */
      tenant_id: string
    }
    /** @enum {string} */
    TransferMechanism: 'sccs' | 'uk_addendum' | 'dpf' | 'appi_equivalent' | 'none'
    /** @description One override in a PUT body. */
    TranslationPatch: {
      key: string
      locale: string
      value: string
    }
    TranslationView: {
      key: string
      locale: string
      scope: string
      /** Format: date-time */
      updated_at: string
      value: string
    }
    UpdateFeatureRequest: {
      default_enabled: boolean
      /** Format: int64 */
      default_limit?: number | null
      name: string
      visibility?: components['schemas']['Visibility']
    }
    UpdateLocalizationSettingsCommand: {
      /**
       * @description The locale the change was made under (the admin's negotiated
       *     locale), carried on the event so downstream work renders correctly.
       */
      acting_locale?: string
      default_locale: string
      enabled_locales: string[]
      timezone: string
    }
    UpdatePlanRequest: {
      name: string
      /** Format: int32 */
      sort_order?: number
      stripe_product_id?: string | null
      visibility?: components['schemas']['PlanVisibility']
    }
    UpdateRoleRequest: {
      name?: string | null
      permissions?: string[] | null
    }
    UpdateRolesCommand: {
      role_ids: string[]
    }
    UpdateTaxSettingsRequest: {
      /**
       * @description Enable requires the compliance preflight to pass right now; disable
       *     always succeeds (and is a tenant-facing change requiring notice:
       *     mid-period it changes what customers are charged).
       */
      enabled: boolean
    }
    /**
     * @description The edit command. Every field is optional: `None` leaves it unchanged;
     *     `custom_css: Some(None)` removes custom CSS.
     */
    UpdateTenantThemeDraftCommand: {
      /** @description Replacement custom CSS (`Some(None)` clears it). */
      custom_css?: string | null
      /** @description Layout adjustments (hidden slots on unlocked layouts). */
      layout_overrides?: {
        [key: string]: components['schemas']['LayoutOverride']
      } | null
      /**
       * @description Switch theme. When present with no `version`, pins the theme's
       *     latest published version.
       */
      theme_key?: string | null
      /** @description Flat token overrides (`color.brand.primary` → `{$value, $type}`). */
      token_overrides?: {
        [key: string]: components['schemas']['TokenValue']
      } | null
      /** @description Explicit version pin (a theme upgrade is never implicit). */
      version?: string | null
    }
    /**
     * @description The upload command: base64 payload with a declared media type (the
     *     declared type is advisory — the bytes are sniffed and must match).
     */
    UploadBrandAssetCommand: {
      /** @description The declared media type (must agree with the sniffed bytes). */
      content_type?: string | null
      /** @description Base64-encoded image bytes. */
      data_base64: string
      /** @description `logo` | `favicon` | `og_image`. */
      kind: string
    }
    UploadReceipt: {
      external_id: string
      platform: components['schemas']['PlatformKey']
      /** Format: date-time */
      uploaded_at: string
    }
    /**
     * @description Per-platform upload progress. Suppression is deliberately absent: a
     *     directive suppresses the whole event, not one platform, and the frozen
     *     `ConsentSnapshot` already carries which purpose was denied and by which
     *     signal source. Duplicating that here would give suppression two homes
     *     that can disagree.
     */
    UploadState:
      | {
          /** Format: int32 */
          attempt_count?: number
          /** @enum {string} */
          status: 'pending'
        }
      | {
          /** Format: int32 */
          attempt_count?: number
          /** @enum {string} */
          status: 'uploaded'
        }
      | {
          /** Format: int32 */
          attempt_count?: number
          reason: string
          /** @enum {string} */
          status: 'failed'
        }
      | {
          /** Format: int32 */
          attempts: number
          reason: string
          /** @enum {string} */
          status: 'parked'
        }
      | {
          /** @enum {string} */
          status: 'retracted'
        }
      | {
          reason: string
          /** @enum {string} */
          status: 'unpropagated'
        }
    UpsertActivityCommand: {
      basis?: string | null
      controller_role: string
      data_classes: string[]
      name: string
      purpose: string
    }
    UpsertAssessmentCommand: {
      activity_id: string
      findings?: unknown
      jurisdictions: string[]
      mitigations?: unknown
      /** Format: date-time */
      next_review_at?: string | null
      status: string
      trigger: string
    }
    UpsertJurisdictionCommand: {
      /** Format: int32 */
      ack_days?: number | null
      /** Format: int32 */
      appeal_response_days?: number | null
      /** Format: int32 */
      appeal_window_days?: number | null
      authority: components['schemas']['AuthorityContact']
      breach_rules: components['schemas']['BreachRuleSet']
      code: string
      consent_model: string
      /** Format: int32 */
      extension_days: number
      honours_universal_opt_out: boolean
      /** Format: int32 */
      minor_opt_in_age?: number | null
      /** Format: int32 */
      opt_out_effective_business_days?: number | null
      regime: string
      /** Format: int32 */
      response_days: number
      risk_assessment_required: boolean
      sensitive_model: string
      source_note?: string | null
    }
    UpsertRetentionRuleCommand: {
      action: string
      basis?: string | null
      data_class: string
      disclosed_in_notice: boolean
      /** Format: int64 */
      period_days: number
      sensitivity: string
    }
    UpsertSubProcessorCommand: {
      contract_terms: unknown
      dpa_url?: string | null
      location: string
      name: string
      purpose: string
      role: string
      transfer_mechanism?: string | null
    }
    /**
     * @description Lifecycle of a projected user. Deactivated is terminal; the email is
     *     released for reuse.
     * @enum {string}
     */
    UserStatus: 'active' | 'deactivated'
    ValidationResultView: {
      /** @description Empty means valid. Same shape a failed create or patch would carry. */
      violations: components['schemas']['ValidationViolation'][]
    }
    ValidationViolation: {
      code: string
      field_path: string
      message: string
    }
    /** @enum {string} */
    ValueSource: 'payment_record' | 'client_reported'
    VerifyRequestOutput: {
      /** Format: date-time */
      due_at: string
      request_id: string
      status: components['schemas']['DsrStatus']
    }
    VerifyRequestRequest: {
      code: string
      token: string
    }
    /**
     * @description Whether the feature shows up in tenant-facing catalogs.
     * @enum {string}
     */
    Visibility: 'public' | 'hidden'
  }
  responses: never
  parameters: never
  requestBodies: never
  headers: never
  pathItems: never
}
export type $defs = Record<string, never>
export interface operations {
  list_permissions: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Permission registry */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PermissionView'][]
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  start_link_challenge: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['StartLinkChallengeCommand']
      }
    }
    responses: {
      /** @description Challenge started */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['StartLinkChallengeResponse']
        }
      }
      /** @description Invalid input */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  complete_link_challenge: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CompleteLinkChallengeBody']
      }
    }
    responses: {
      /** @description Account linked */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['LinkCompleteResponse']
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Intent unavailable */
      410: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_me: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The current user */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MeView']
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_sessions: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The current session */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SessionView'][]
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  revoke_session: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Session id */
        session_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Session revoked */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Session not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  search_tenant_admin_views: {
    parameters: {
      query?: {
        /** @description Substring match on slug/display name */
        query?: string
        /** @description Tenant status filter */
        status?: string
        /** @description Cursor: created_at of the last row */
        after_created_at?: string
        /** @description Cursor: tenant id of the last row */
        after_id?: string
        /** @description Page size (1..=100, default 25) */
        limit?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description One page of tenant views */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantAdminPageView']
        }
      }
      /** @description Invalid filter */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_admin_view: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The tenant view */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantAdminView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_platform_ads_health: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Cross-tenant advertising connection health and freshness overview */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PlatformAdsHealthReport']
        }
      }
      /** @description Missing platform.tenant.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_pending_approvals: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Pending requests */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApprovalView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  approve_request: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Approval id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Approved and executed */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApprovalView']
        }
      }
      /** @description Permission denied, self-approval, or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Approval not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Approval no longer pending */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  reject_request: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Approval id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Rejected */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApprovalView']
        }
      }
      /** @description Permission denied, self-approval, or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Approval not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Approval no longer pending */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_audit: {
    parameters: {
      query?: {
        /** @description Restrict to one tenant (decimal Snowflake) */
        tenant_id?: string
        /** @description Restrict to one actor (decimal Snowflake) */
        actor_id?: string
        /** @description Exact action name, e.g. tenancy.suspend */
        action?: string
        /** @description Inclusive lower bound */
        since?: string
        /** @description Exclusive upper bound */
        until?: string
        /** @description Cursor: seq of the last entry of the previous page */
        after?: number
        /** @description Page size (1..=200, default 50) */
        limit?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description One page of audit entries, newest first */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AuditPageView']
        }
      }
      /** @description Invalid filter value */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing platform.audit.read */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_platform_domains: {
    parameters: {
      query: {
        /** @description Hostname substring */
        q: string
        /** @description Result cap (default 50) */
        limit: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Domains across tenants */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView'][]
        }
      }
    }
  }
  release_platform_domain: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The domain id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ReleaseDomainCommand']
      }
    }
    responses: {
      /** @description The released domain */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView']
        }
      }
      /** @description Unknown domain */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_features: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Feature catalog */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['FeatureView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  define_feature: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['DefineFeatureRequest']
      }
    }
    responses: {
      /** @description Feature defined */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['FeatureView']
        }
      }
      /** @description Invalid definition */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Feature key already exists */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  deprecate_feature: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Feature key */
        key: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Feature deprecated */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['FeatureView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Feature not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_feature: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Feature key */
        key: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateFeatureRequest']
      }
    }
    responses: {
      /** @description Feature updated */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['FeatureView']
        }
      }
      /** @description Invalid definition */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Feature not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_impersonations: {
    parameters: {
      query?: {
        /** @description Restrict to one tenant */
        tenant_id?: string
        /** @description Maximum grants (default 100) */
        limit?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Active grants */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ImpersonationGrantView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_impersonation: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateImpersonationRequest']
      }
    }
    responses: {
      /** @description Grant created */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ImpersonationGrantView']
        }
      }
      /** @description Invalid request */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied, target not a member, or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  revoke_impersonation: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Grant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Revoked grant */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ImpersonationGrantView']
        }
      }
      /** @description Permission denied or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Grant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_platform_translations: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Platform catalog overrides */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TranslationView'][]
        }
      }
    }
  }
  put_platform_translations: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TranslationPatch'][]
      }
    }
    responses: {
      /** @description Updated platform overrides */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TranslationView'][]
        }
      }
      /** @description Invalid override */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_plans: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description All plans */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PlanAdminView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_plan: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreatePlanRequest']
      }
    }
    responses: {
      /** @description Created plan */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PlanAdminView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Plan key taken */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_plan: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Plan id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdatePlanRequest']
      }
    }
    responses: {
      /** @description Updated plan */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PlanAdminView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Plan not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  set_plan_entitlements: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Plan id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SetEntitlementsRequest']
      }
    }
    responses: {
      /** @description The new map */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['EntitlementGrant'][]
        }
      }
      /** @description Unknown feature key */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Plan not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  add_plan_price: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Plan id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AddPriceRequest']
      }
    }
    responses: {
      /** @description Created price */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PlanAdminPriceView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Plan not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_activities: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Processing activities */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProcessingActivity'][]
        }
      }
    }
  }
  upsert_activity: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpsertActivityCommand']
      }
    }
    responses: {
      /** @description Recorded */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'text/plain': string
        }
      }
    }
  }
  list_appeals: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Open appeals */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['Appeal'][]
        }
      }
    }
  }
  decide_appeal: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The appeal id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['DecideAppealRequest']
      }
    }
    responses: {
      /** @description Decision recorded */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DecideAppealOutput']
        }
      }
      /** @description Self-review refused */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_assessments: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Assessments */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RiskAssessment'][]
        }
      }
    }
  }
  upsert_assessment: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpsertAssessmentCommand']
      }
    }
    responses: {
      /** @description Recorded */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'text/plain': string
        }
      }
    }
  }
  list_holds: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Legal holds */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['LegalHold'][]
        }
      }
    }
  }
  apply_hold: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ApplyLegalHoldCommand']
      }
    }
    responses: {
      /** @description Hold applied */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'text/plain': string
        }
      }
    }
  }
  release_hold: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The hold id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Hold released */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  list_incidents: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Incidents */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['BreachIncident'][]
        }
      }
    }
  }
  record_incident: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RecordBreachIncidentCommand']
      }
    }
    responses: {
      /** @description Incident + obligations */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RecordBreachIncidentOutput']
        }
      }
    }
  }
  mark_obligation_notified: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The incident id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['MarkBreachNotifiedCommand']
      }
    }
    responses: {
      /** @description Recorded */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  list_obligations: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The incident id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Obligations */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['NotificationObligation'][]
        }
      }
    }
  }
  list_jurisdictions: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Jurisdiction profiles */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['JurisdictionProfile'][]
        }
      }
    }
  }
  upsert_jurisdiction: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpsertJurisdictionCommand']
      }
    }
    responses: {
      /** @description Profile saved */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  list_dsrs: {
    parameters: {
      query?: {
        /** @description Filter by status */
        status?: components['schemas']['DsrStatus']
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Requests */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RequestOperatorView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  extend_dsr: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The request id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description New deadline */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'text/plain': string
        }
      }
    }
  }
  reject_dsr: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The request id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RejectRequestRequest']
      }
    }
    responses: {
      /** @description Rejected */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  list_retention_rules: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Retention rules */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RetentionRule'][]
        }
      }
    }
  }
  upsert_retention_rule: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpsertRetentionRuleCommand']
      }
    }
    responses: {
      /** @description Saved */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  list_subprocessors: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Sub-processors */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SubProcessor'][]
        }
      }
    }
  }
  upsert_subprocessor: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpsertSubProcessorCommand']
      }
    }
    responses: {
      /** @description Saved */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  remove_subprocessor: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The sub-processor name */
        name: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Removed */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  list_roles_platform: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Role catalog */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RoleView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_tenants: {
    parameters: {
      query?: {
        /** @description Page size (default 20, max 100) */
        limit?: number
        /** @description Cursor: tenant id of the last item of the previous page */
        after?: string
        /** @description Filter by tenant status */
        status?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant page */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantListView']
        }
      }
      /** @description Invalid filter */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  provision_tenant: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ProvisionTenantCommand']
      }
    }
    responses: {
      /** @description Tenant provisioned */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantView']
        }
      }
      /** @description Invalid input */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Slug unavailable or illegal transition */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantView']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  activate_tenant: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant activated */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantView']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Illegal transition */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_application_fee: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The configuration (disabled when never configured) */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApplicationFeeView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  set_application_fee: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SetApplicationFeeRequest']
      }
    }
    responses: {
      /** @description Configuration stored */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApplicationFeeView']
        }
      }
      /** @description Invalid configuration */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  disable_application_fee: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Disabled */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Permission denied or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  archive_tenant: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant archived */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantView']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Illegal transition */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_entitlement_overrides: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Override rows */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['OverrideView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  grant_entitlement_override: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['GrantEntitlementRequest']
      }
    }
    responses: {
      /** @description Granted (or approval required) */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['GrantEntitlementResultView']
        }
      }
      /** @description Invalid request */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  revoke_entitlement_override: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
        /** @description Feature key */
        feature: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Revoked */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Permission denied or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  resume_tenant: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant resumed */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantView']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Illegal transition */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  apply_subscription_override: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SubscriptionOverrideRequest']
      }
    }
    responses: {
      /** @description Override applied */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Plan not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Live Stripe subscription blocks an override */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  revoke_subscription_override: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Override revoked */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Not an operator override */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  suspend_tenant: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Tenant id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SuspendTenantRequest']
      }
    }
    responses: {
      /** @description Tenant suspended */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantView']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Illegal transition */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_platform_themes: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The full theme registry */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ThemeAdminView'][]
        }
      }
    }
  }
  install_theme_version: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['InstallThemeVersionCommand']
      }
    }
    responses: {
      /** @description Installed version */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ThemeVersionAdminView']
        }
      }
      /** @description Manifest, tokens or contrast validation failed */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Version already exists */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_platform_theme_versions: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Theme key */
        key: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The theme's version history */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ThemeVersionAdminView'][]
        }
      }
      /** @description Unknown theme */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  yank_theme_version: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Theme key */
        key: string
        /** @description Semver to withdraw */
        version: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Version withdrawn */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Unknown theme or version */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_consents: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Consent ledger rows for the subject */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConsentRecord'][]
        }
      }
    }
  }
  update_consents: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ConsentChangeRequest']
      }
    }
    responses: {
      /** @description Recorded and materialised */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RecordConsentChangeOutput']
        }
      }
      /** @description Essential is not consentable */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_directives: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Resolved directives */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['GetDirectivesOutput']
        }
      }
    }
  }
  limit_sensitive_use: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['LimitSensitiveRequest']
      }
    }
    responses: {
      /** @description Sensitive use limited */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RecordOptOutOutput']
        }
      }
    }
  }
  record_opt_out: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RecordOptOutCommand']
      }
    }
    responses: {
      /** @description Directives flipped immediately */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RecordOptOutOutput']
        }
      }
    }
  }
  submit_dsr: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SubmitDsrCommand']
      }
    }
    responses: {
      /** @description Request accepted; clocks and jurisdiction resolved */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SubmitDsrOutput']
        }
      }
      /** @description Conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_dsr_status: {
    parameters: {
      query?: {
        /** @description Challenge token (for unauthenticated requesters) */
        token?: string
      }
      header?: never
      path: {
        /** @description The request id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Status incl. ack time and due date */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['GetRequestStatusOutput']
        }
      }
      /** @description Unknown request */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  appeal_request: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The refused request id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AppealRequestRequest']
      }
    }
    responses: {
      /** @description Appeal accepted; authority contact included */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AppealRequestOutput']
        }
      }
      /** @description Not appealable */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  download_export: {
    parameters: {
      query: {
        /** @description Download token */
        token: string
      }
      header?: never
      path: {
        /** @description The request id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The encrypted export archive */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/octet-stream': number[]
        }
      }
      /** @description Unknown artifact */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Expired or exhausted */
      410: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  rectify_request: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The rectification request id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RectifyRequest']
      }
    }
    responses: {
      /** @description Corrections applied */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  verify_dsr: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The request id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['VerifyRequestRequest']
      }
    }
    responses: {
      /** @description Verified */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['VerifyRequestOutput']
        }
      }
      /** @description Challenge not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_public_locales: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Supported locales */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SupportedLocalesView']
        }
      }
    }
  }
  get_public_messages: {
    parameters: {
      query?: {
        /** @description Requested locale (defaults to en) */
        locale?: string
      }
      header?: never
      path: {
        /** @description Catalog domain (billing, emails, errors, privacy) */
        domain: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Message catalog */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CatalogView']
        }
      }
      /** @description Not modified (ETag match) */
      304: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Unknown domain */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_public_plans: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Plans with prices and entitlement grants */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicPlanView'][]
        }
      }
    }
  }
  get_public_metrics: {
    parameters: {
      query?: {
        /** @description Disclosure year (default: previous year) */
        year?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Annual metrics */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicMetricsRow'][]
        }
      }
    }
  }
  get_privacy_notice: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The privacy notice */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PrivacyNoticeView']
        }
      }
    }
  }
  get_notice_at_collection: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Notice at collection */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['NoticeAtCollectionView']
        }
      }
    }
  }
  check_slug_availability: {
    parameters: {
      query: {
        /** @description Candidate slug */
        slug: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Availability answer */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SlugAvailability']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_public_subprocessors: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Sub-processors */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SubProcessor'][]
        }
      }
    }
  }
  public_tenant_context: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant context for this host */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantContext']
        }
      }
      /** @description Unknown host */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_public_theme: {
    parameters: {
      query?: {
        /** @description Host to resolve (defaults to the request Host header) */
        host?: string
        /** @description Requested locale (defaults to en) */
        locale?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Resolved theme with css_vars */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ResolvedTheme']
        }
      }
      /** @description Not modified (ETag match) */
      304: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Invalid locale */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  public_track_conversion: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TrackConversionRequest']
      }
    }
    responses: {
      /** @description Always returned, regardless of outcome — see the module doc for why */
      202: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
    }
  }
  version: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Build information */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['BuildInfo']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_audiences: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Every audience owned by the tenant */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['Audience'][]
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_audience: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateAudienceRequest']
      }
    }
    responses: {
      /** @description Draft audience created */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['Audience']
        }
      }
      /** @description Invalid audience parameters */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  refresh_audience: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The audience ID to refresh */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Audience refreshed */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['Audience']
        }
      }
      /** @description Missing advertising.campaign.write permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Audience not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_budget_alerts: {
    parameters: {
      query?: never
      header?: never
      path: {
        campaign_id: string
        unacknowledged_only: boolean | null
        limit: number | null
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Budget alerts history */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['BudgetAlertsView']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  acknowledge_budget_alert: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Target budget alert ID */
        alert_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Acknowledged budget alert */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['BudgetAlert']
        }
      }
      /** @description Missing advertising.budget.manage permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Budget alert not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_budget_caps: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description All budget caps defined for this tenant */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['BudgetCapsView']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  put_budget_cap: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PutBudgetCapRequest']
      }
    }
    responses: {
      /** @description Budget cap created or updated, or dry-run simulation result */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PutBudgetCapResponse']
        }
      }
      /** @description Missing advertising.budget.manage permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description New cap is below current period spend and confirmation is required */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_campaigns: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Every campaign owned by the tenant, newest first */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignsView']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_campaign: {
    parameters: {
      query?: never
      header: {
        /** @description Required. A retry with the same key returns the original draft. */
        'Idempotency-Key': string
      }
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateCampaignRequest']
      }
    }
    responses: {
      /** @description Draft campaign created. Never touches the platform. */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed Idempotency-Key or invalid campaign fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection is not active */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_campaign: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The campaign's current intent and revision */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  patch_campaign: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The campaign's current revision; a stale value returns 409 with the current state. */
        'If-Match': string
        /** @description Required. A retry with the same key returns the original result. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatchCampaignRequest']
      }
    }
    responses: {
      /** @description Intent updated; if published, the edit was also pushed to the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed headers, invalid creative id, or invalid fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign or creative not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Stale revision or idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  add_ad_group: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The campaign's current revision. */
        'If-Match': string
        /** @description Required. A retry with the same key returns the original result. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateAdGroupRequest']
      }
    }
    responses: {
      /** @description Ad group appended; if published, pushed to the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed headers or invalid fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Stale revision or idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_ad_group: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The campaign's current revision. */
        'If-Match': string
        /** @description Required. A retry with the same key returns the original result. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
        /** @description Ad group id */
        ad_group_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatchAdGroupRequest']
      }
    }
    responses: {
      /** @description Ad group updated; if published, pushed to the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed headers or invalid fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign or ad group not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Stale revision or idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  add_ad: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The campaign's current revision. */
        'If-Match': string
        /** @description Required. A retry with the same key returns the original result. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
        /** @description Ad group id */
        ad_group_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateAdRequest']
      }
    }
    responses: {
      /** @description Ad appended; if published, pushed to the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed headers, invalid creative id, or invalid fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign, ad group or creative not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Stale revision or idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_ad: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The campaign's current revision. */
        'If-Match': string
        /** @description Required. A retry with the same key returns the original result. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
        /** @description Ad group id */
        ad_group_id: string
        /** @description Ad id */
        ad_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatchAdRequest']
      }
    }
    responses: {
      /** @description Ad updated; if published, pushed to the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed headers, invalid creative id, or invalid fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign, ad group, ad or creative not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Stale revision or idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_campaign_budget_cap: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Target campaign ID */
        campaign_id: string
        period: null | components['schemas']['BudgetPeriod']
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Campaign budget cap */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['BudgetCap']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No budget cap found for this campaign and period */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  put_campaign_budget_cap: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Target campaign ID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PutBudgetCapRequest']
      }
    }
    responses: {
      /** @description Campaign budget cap created/updated or dry run result */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PutBudgetCapResponse']
        }
      }
      /** @description Missing advertising.budget.manage permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description New cap is below current period spend and confirmation is required */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_campaign_changes: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Newest-first attributed change log: actor, source (sanvi|platform), before/after state */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignChangesView']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  resolve_campaign_drift: {
    parameters: {
      query?: never
      header: {
        /** @description Required. A retry of this drift resolution returns its original result. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ResolveCampaignDriftRequest']
      }
    }
    responses: {
      /** @description Drift resolution applied or replayed */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ResolvedCampaignDriftView']
        }
      }
      /** @description Missing or malformed idempotency key, or invalid resolution */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Stale revision, idempotency conflict, or resolution in progress */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  pause_campaign: {
    parameters: {
      query?: never
      header: {
        /** @description Required. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Paused on the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed Idempotency-Key */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign is not yet published, or an idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  publish_campaign: {
    parameters: {
      query?: never
      header: {
        /** @description Required. A retry after a timeout returns the one campaign that was created, never a second. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Live on the platform; external_id is now set. Replaying publish on an already-published campaign is a no-op success. */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Campaign fails platform validation (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  resume_campaign: {
    parameters: {
      query?: never
      header: {
        /** @description Required. */
        'Idempotency-Key': string
      }
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Resumed on the platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CampaignView']
        }
      }
      /** @description Missing/malformed Idempotency-Key */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign is not yet published, or an idempotency conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Platform adapter unavailable */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  validate_campaign: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Campaign UUID */
        campaign_id: string
      }
      cookie?: never
    }
    /** @description Fields to validate; omitted fields keep the stored value. An empty body validates the campaign as stored. */
    requestBody: {
      content: {
        'application/json': components['schemas']['PatchCampaignRequest']
      }
    }
    responses: {
      /** @description Field-addressed violations; empty means valid. Never writes. */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ValidationResultView']
        }
      }
      /** @description Invalid objective in the candidate body */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Campaign not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_connections: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Every connection with server-computed health */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConnectionsView']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_connection: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateConnectionRequest']
      }
    }
    responses: {
      /** @description Connection finalized and active */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConnectionView']
        }
      }
      /** @description Chosen account was not among the fetched accounts, or invalid currency/timezone */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.connect permission or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  delete_connection: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Connection UUID */
        connection_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Disconnected in Sanvi; the platform side is untouched */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Missing advertising.connect permission or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  oauth_callback: {
    parameters: {
      query: {
        /** @description Opaque state returned by start */
        state: string
        /** @description Authorization code from the platform */
        code: string
        /** @description Must match the redirect_uri sent to start */
        redirect_uri: string
      }
      header?: never
      path: {
        /** @description google_ads or meta */
        platform: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Code redeemed; connection is pending account selection */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PendingConnectionView']
        }
      }
      /** @description Forged, expired, replayed, or cross-tenant state, or the code could not be exchanged */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.connect permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  start_oauth: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description google_ads or meta */
        platform: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['StartOAuthRequest']
      }
    }
    responses: {
      /** @description Authorization URL and opaque state; the frontend never constructs the URL and never sees a token */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['StartOAuthResponse']
        }
      }
      /** @description Unknown platform or missing redirect_uri */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.connect permission, missing platform entitlement, or fresh MFA missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_conversions: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Captured conversion events, newest first */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConversionEvent'][]
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_conversion_diagnostics: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Conversion event Snowflake ID */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Conversion event diagnostics story */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConversionDiagnostics']
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Conversion not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  retry_conversion: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Conversion event Snowflake ID */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Conversion event re-queued for upload */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConversionEvent']
        }
      }
      /** @description Missing advertising.campaign.write permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Conversion not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Conversion retry refused */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_creatives: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Every creative on an entitled platform */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CreativesView']
        }
      }
      /** @description Missing advertising.read permission or advertising platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_creative: {
    parameters: {
      query?: never
      header: {
        /** @description Required. A retry with the same key returns the original creative. */
        'Idempotency-Key': string
      }
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateCreativeRequest']
      }
    }
    responses: {
      /** @description Creative created with upload-time matrix validation. */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CreativeView']
        }
      }
      /** @description Missing/malformed Idempotency-Key or invalid creative fields (advertising/campaign-invalid carries field violations) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection is not active */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_creative: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Creative UUID */
        creative_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Stored creative specification and metadata */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CreativeView']
        }
      }
      /** @description Missing advertising.read permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Creative not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  delete_creative: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Creative UUID */
        creative_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Creative deleted */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Missing advertising.campaign.write permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Creative not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_creative_previews: {
    parameters: {
      query?: {
        placement?: string
      }
      header?: never
      path: {
        /** @description Creative UUID */
        creative_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Spec-rendered placement previews */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CreativePreviewsView']
        }
      }
      /** @description Missing advertising.read permission or platform entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Creative not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_ads_metrics: {
    parameters: {
      query: {
        /**
         * @description Inclusive range start, `YYYY-MM-DD`.
         * @example 2026-08-01
         */
        from: string
        /**
         * @description Inclusive range end, `YYYY-MM-DD`.
         * @example 2026-08-24
         */
        to: string
        /**
         * @description `campaign` (default), `platform`, or `tenant`.
         * @example campaign
         */
        group_by?: string
        /** @example google_ads */
        platform?: string
        campaign_id?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Rollup rows for the requested range and grain, both ROAS numbers labelled separately */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MetricsQueryResponse']
        }
      }
      /** @description Invalid date range, unknown group_by, or a span exceeding the configured maximum */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_ads_metrics_export: {
    parameters: {
      query: {
        /**
         * @description Inclusive range start, `YYYY-MM-DD`.
         * @example 2026-08-01
         */
        from: string
        /**
         * @description Inclusive range end, `YYYY-MM-DD`.
         * @example 2026-08-24
         */
        to: string
        /**
         * @description `campaign` (default), `platform`, or `tenant`.
         * @example campaign
         */
        group_by?: string
        /** @example google_ads */
        platform?: string
        campaign_id?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The same labelled columns as /ads/metrics, streamed as CSV — no blended ROAS column */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'text/csv': unknown
        }
      }
      /** @description Invalid date range, unknown group_by, or a span exceeding the configured maximum */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_ads_metrics_freshness: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Per-connection last-ingested-at and lag — what a stalled sync looks like, not a guess based on the clock */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MetricsFreshnessView']
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_ads_metrics_summary: {
    parameters: {
      query: {
        /** @example 2026-08-01 */
        from: string
        /** @example 2026-08-24 */
        to: string
        /**
         * @description Start date of an equal-length prior period to compare against
         *     (`YYYY-MM-DD`). Omit for no comparison.
         * @example 2026-07-01
         */
        compare_to?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Whole-range totals per currency, with an optional prior-period comparison */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MetricsSummaryResponse']
        }
      }
      /** @description Invalid date range or a span exceeding the configured maximum */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_ad_platforms: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Registry-derived, versioned advertising capability catalog */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PlatformsView']
        }
      }
      /** @description Missing advertising.read permission or both advertising platform entitlements */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_spend_status: {
    parameters: {
      query?: never
      header?: never
      path: {
        period: null | components['schemas']['BudgetPeriod']
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Spend status and run-rate projection across tenant and campaign scopes */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SpendStatusReport']
        }
      }
      /** @description Missing advertising.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tracking_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Event-name to platform-conversion-action mappings */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TrackingSettings']
        }
      }
      /** @description Missing advertising.connect permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  put_tracking_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TrackingSettings']
      }
    }
    responses: {
      /** @description Settings saved */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Missing advertising.connect permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  test_tracking_event: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TrackConversionRequest']
      }
    }
    responses: {
      /** @description What was captured, the resolver's decision, and why */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TestTrackingEventResponse']
        }
      }
      /** @description Missing advertising.metrics.read permission */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_checkout_session: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CheckoutSessionRequest']
      }
    }
    responses: {
      /** @description Checkout URL */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CheckoutSessionView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description A live subscription already exists */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_invoices: {
    parameters: {
      query?: {
        /** @description Page size (default 50) */
        limit?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Invoices, newest first */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InvoiceView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_portal_session: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Portal URL */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PortalSessionView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No subscription */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_subscription: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The subscription, or null when none */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': null | components['schemas']['SubscriptionView']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_tenant_checkout: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The same key returns the same checkout — one double-clicked buy button, one session */
        'Idempotency-Key': string
      }
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateCheckoutRequest']
      }
    }
    responses: {
      /** @description Idempotent replay: the same checkout the Idempotency-Key already owns */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CheckoutView']
        }
      }
      /** @description Session created on the connected account */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CheckoutView']
        }
      }
      /** @description Malformed request, non-positive amount, or a redirect URL off the verified-domain allow-list (payments/domain-not-allowed) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.checkout permission or the payments.stripe_connect entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description The connected account cannot accept payments (payments/connection-not-active) */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Rate limit exceeded per tenant, client or customer reference (payments/rate-limited) */
      429: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider unavailable (payments/provider-unavailable) */
      502: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description The payments.checkout flag is off (payments/provider-unavailable) */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_checkout_config: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Whether the tenant's connected account can accept payments, why not, and its settlement currency */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CheckoutConfigView']
        }
      }
      /** @description Missing payments.checkout permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description The payments.checkout flag is off (payments/provider-unavailable) */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_checkout: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The checkout id returned by POST /api/v1/tenant/checkout */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The webhook-truthful checkout state (the only thing the confirmation page trusts) */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CheckoutView']
        }
      }
      /** @description Missing payments.checkout permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No such checkout for this tenant */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description The payments.checkout flag is off (payments/provider-unavailable) */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_context: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Resolved tenant context */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantContext']
        }
      }
      /** @description No tenant resolved */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_custom_domains: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The tenant's domains */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView'][]
        }
      }
    }
  }
  claim_custom_domain: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ClaimCustomDomainCommand']
      }
    }
    responses: {
      /** @description The claim and its verification challenge */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView']
        }
      }
      /** @description Invalid hostname */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Entitlement missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Hostname already claimed */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_domain_orders: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The tenant's domain orders */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['OrderView'][]
        }
      }
    }
  }
  place_domain_order: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PlaceDomainOrderCommand']
      }
    }
    responses: {
      /** @description The order (the saga may still be in flight; see status) */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['OrderView']
        }
      }
      /** @description Invalid hostname or unsupported TLD */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Entitlement missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  set_order_auto_renew: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The order id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AutoRenewCommand']
      }
    }
    responses: {
      /** @description The updated order */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['OrderView']
        }
      }
      /** @description Unknown order */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  search_domains: {
    parameters: {
      query: {
        /** @description Bare term (`acme`) or hostname (`acme.com`) */
        q: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Availability and normalized pricing */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DomainSearchView']
        }
      }
      /** @description Entitlement missing */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  remove_custom_domain: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The domain claim id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The removed domain */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView']
        }
      }
      /** @description Unknown domain */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_domain_instructions: {
    parameters: {
      query?: {
        /** @description Requested locale (defaults to the negotiated one) */
        locale?: string
      }
      header?: never
      path: {
        /** @description The domain claim id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The exact records and the registrar walkthrough */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InstructionsView']
        }
      }
      /** @description Unknown domain */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  promote_primary_domain: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The domain claim id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The domain is now primary */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView']
        }
      }
      /** @description Unknown domain */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  request_domain_verification: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The domain claim id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The domain, now queued for verification */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CustomDomainView']
        }
      }
      /** @description Unknown domain */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Throttled by the backoff schedule */
      429: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_tenant_entitlements: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Resolved entitlements */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ResolvedEntitlementView'][]
        }
      }
      /** @description Permission denied or feature not enabled */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No tenant context */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_invitations: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Invitations */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InvitationView'][]
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  invite_member: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['InviteMemberCommand']
      }
    }
    responses: {
      /** @description Invitation created */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InvitationView']
        }
      }
      /** @description Invalid input */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  accept_invitation: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AcceptInvitationCommand']
      }
    }
    responses: {
      /** @description Invitation accepted */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': unknown
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Invitation not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Invitation expired */
      410: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  revoke_invitation: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Invitation id */
        invitation_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Invitation revoked */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Invitation not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  resend_invitation: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Invitation id */
        invitation_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Invitation reissued */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InvitationView']
        }
      }
      /** @description Invitation not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_localization_overrides: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant copy overrides */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TranslationView'][]
        }
      }
    }
  }
  put_localization_overrides: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TranslationPatch'][]
      }
    }
    responses: {
      /** @description Updated overrides */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TranslationView'][]
        }
      }
      /** @description Invalid override */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_localization_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant localization settings */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['LocalizationSettingsView']
        }
      }
      /** @description Tenant not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  put_localization_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateLocalizationSettingsCommand']
      }
    }
    responses: {
      /** @description Updated settings */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['LocalizationSettingsView']
        }
      }
      /** @description Invalid settings */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Settings conflict */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_members: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Members */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MemberView'][]
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  grant_member: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['GrantMembershipCommand']
      }
    }
    responses: {
      /** @description Membership granted */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MemberView']
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description User not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  remove_member: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description User id */
        user_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Membership revoked */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Permission denied or last-owner guard */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Membership not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_member_roles: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description User id */
        user_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateRolesCommand']
      }
    }
    responses: {
      /** @description Roles updated */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': unknown
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Membership not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_tenant_payments: {
    parameters: {
      query?: {
        /** @description Filter by payment status */
        status?: string
        /** @description Filter by currency (ISO-4217) */
        currency?: string
        /** @description Filter by customer reference substring */
        customer?: string
        /** @description Filter by created_at >= (RFC3339) */
        date_from?: string
        /** @description Filter by created_at <= (RFC3339) */
        date_to?: string
        /** @description Pagination cursor (opaque) */
        cursor?: string
        /** @description Page size (1-100, default 20) */
        limit?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description One page of payments */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaymentListView']
        }
      }
      /** @description Malformed filter (unknown status, bad currency) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_payment_connection: {
    parameters: {
      query?: never
      header: {
        /** @description Required. The same key returns the same connection; it is also the provider-side idempotency key, so a retry after a crash adopts the created account instead of duplicating it */
        'Idempotency-Key': string
      }
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateConnectionRequest']
      }
    }
    responses: {
      /** @description Connection created (or the same one returned on an idempotent retry) */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConnectionView']
        }
      }
      /** @description Missing/malformed Idempotency-Key, provider, country or currency */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.manage permission or the payments.stripe_connect entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description An active connection already exists (payments/connection-exists) */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider rate limit exhausted (payments/provider-rate-limited) */
      429: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider unavailable (payments/provider-unavailable) */
      502: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_payment_connection: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The connection id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Status, capabilities, requirements, blockers and the server-computed can_accept_payments */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConnectionView']
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No such connection for this tenant */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  delete_payment_connection: {
    parameters: {
      query?: never
      header: {
        /** @description Required on every mutating payments endpoint */
        'Idempotency-Key': string
      }
      path: {
        /** @description The connection id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Disconnected (or already disconnected: idempotent replay) */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConnectionView']
        }
      }
      /** @description Missing/malformed Idempotency-Key */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.manage permission or the payments.stripe_connect entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No such connection for this tenant */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Money is still moving on this connection; the problem body names the blockers as extension members: blockers: [{code, summary_key}] with code in {in_flight_payments, open_disputes, pending_payouts} (payments/disconnect-blocked) */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_payment_connection_session: {
    parameters: {
      query?: never
      header: {
        /** @description Required on every mutating payments endpoint; sessions are minted fresh per call */
        'Idempotency-Key': string
      }
      path: {
        /** @description The connection id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Account Session client secret + enabled components */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ConnectionSessionView']
        }
      }
      /** @description Missing/malformed Idempotency-Key */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.manage permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No such connection for this tenant */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Connection is disconnected or rejected (payments/connection-not-active) */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider unavailable (payments/provider-unavailable) */
      502: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_tenant_disputes: {
    parameters: {
      query?: {
        /** @description Filter by dispute status */
        status?: string
        /** @description Filter by currency */
        currency?: string
        /** @description Filter by created_at >= (RFC3339) */
        date_from?: string
        /** @description Filter by created_at <= (RFC3339) */
        date_to?: string
        /** @description Pagination cursor */
        cursor?: string
        /** @description Page size */
        limit?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description One page of disputes */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DisputeListView']
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  export_tenant_payments: {
    parameters: {
      query?: {
        /** @description Filter by payment status */
        status?: string
        /** @description Filter by currency */
        currency?: string
        /** @description Filter by customer reference substring */
        customer?: string
        /** @description Filter by created_at >= (RFC3339) */
        date_from?: string
        /** @description Filter by created_at <= (RFC3339) */
        date_to?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description CSV bytes (text/csv) */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'text/csv': unknown
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_tenant_payouts: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The connected account's payout history, newest first */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PayoutsListView']
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider unavailable (payments/provider-unavailable) */
      502: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_payment_providers: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Connectable providers, derived from the provider registry */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProvidersView']
        }
      }
      /** @description Missing payments.read permission or the payments.stripe_connect entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_tax_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The tenant's automatic-tax state with the legal statement */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TaxSettingsView']
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_tenant_tax_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateTaxSettingsRequest']
      }
    }
    responses: {
      /** @description The updated tax settings */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TaxSettingsView']
        }
      }
      /** @description Malformed request */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.manage permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Preflight failed — the response names the exact missing step (payments/tax-preflight-failed) */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider unavailable (payments/provider-unavailable) */
      502: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_payment: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description The payment id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Payment detail with timeline, refunds and disputes */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaymentDetailView']
        }
      }
      /** @description Missing payments.read permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No such payment for this tenant */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  refund_tenant_payment: {
    parameters: {
      query?: never
      header: {
        /** @description Required (UUID). The same key with the same amount/reason replays the same refund; a different payload conflicts */
        'Idempotency-Key': string
      }
      path: {
        /** @description The payment id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RefundRequest']
      }
    }
    responses: {
      /** @description Idempotent replay: the same refund the Idempotency-Key already owns */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RefundView']
        }
      }
      /** @description Refund issued on the connected account */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RefundView']
        }
      }
      /** @description Missing reason, malformed amount, over-refund (payments/over-refund reports remaining), currency mismatch */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing payments.refund permission or the entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No such payment for this tenant */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Idempotency-Key reuse with a different amount/reason (payments/idempotency-conflict) or already fully refunded */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Provider unavailable (payments/provider-unavailable) */
      502: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_tenant_dsrs: {
    parameters: {
      query?: {
        /** @description Filter by status */
        status?: components['schemas']['DsrStatus']
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant's requests */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RequestOperatorView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  submit_tenant_dsr: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SubmitDsrCommand']
      }
    }
    responses: {
      /** @description Request accepted */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SubmitDsrOutput']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_roles_tenant: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Assignable roles */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RoleView'][]
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  create_role: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateRoleRequest']
      }
    }
    responses: {
      /** @description Role created */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RoleView']
        }
      }
      /** @description Invalid role definition */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Escalation or permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Role key already exists */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  delete_role: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Role id */
        id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Role deleted */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description System role or permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Role not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_role: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description Role id */
        id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateRoleRequest']
      }
    }
    responses: {
      /** @description Role updated */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RoleView']
        }
      }
      /** @description Invalid role definition */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Escalation or permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Role not found */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Tenant settings */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantSettingsOutput']
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No tenant resolved */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  update_tenant_settings: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SettingsUpdate']
      }
    }
    responses: {
      /** @description Updated settings */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantSettingsOutput']
        }
      }
      /** @description Invalid settings */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Not authenticated */
      401: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Permission denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No tenant resolved */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  upload_brand_asset: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UploadBrandAssetCommand']
      }
    }
    responses: {
      /** @description Updated draft */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantThemeView']
        }
      }
      /** @description Invalid asset */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  remove_brand_asset: {
    parameters: {
      query?: never
      header?: never
      path: {
        /** @description logo | favicon | og_image */
        kind: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Updated draft */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantThemeView']
        }
      }
      /** @description Unknown asset kind */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  get_tenant_theme_draft: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The tenant's theme draft */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantThemeDraftView']
        }
      }
    }
  }
  put_tenant_theme_draft: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateTenantThemeDraftCommand']
      }
    }
    responses: {
      /** @description Updated draft */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantThemeView']
        }
      }
      /** @description Invalid draft */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Missing entitlement */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Unknown theme or version */
      404: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  preview_tenant_theme: {
    parameters: {
      query: {
        /** @description Signed preview token */
        token: string
        /** @description Requested locale (defaults to en) */
        locale?: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Preview of the draft theme */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ResolvedTheme']
        }
      }
      /** @description Invalid locale */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description Invalid or expired preview token */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  mint_theme_preview_token: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Signed draft preview token */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PreviewTokenView']
        }
      }
      /** @description Preview signing is not configured */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  publish_tenant_theme: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The new live theme */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantThemeView']
        }
      }
      /** @description Draft failed validation (including contrast) */
      400: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
      /** @description No draft to publish */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  rollback_tenant_theme: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description The restored live theme */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TenantThemeView']
        }
      }
      /** @description No previous revision */
      409: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  list_available_themes: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Themes this tenant may choose from */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AvailableThemesView']
        }
      }
    }
  }
  liveness: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Process is alive */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['LivenessResult']
        }
      }
      /** @description Internal error */
      500: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  tls_authorize: {
    parameters: {
      query: {
        /** @description The hostname the edge wants a certificate for */
        host: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Issuance authorized */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TlsAuthorizeResponse']
        }
      }
      /** @description Issuance denied */
      403: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['TlsAuthorizeResponse']
        }
      }
      /** @description The gate is not configured */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ProblemDetail']
        }
      }
    }
  }
  readiness: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description All dependencies healthy */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['Readiness']
        }
      }
      /** @description At least one dependency is degraded */
      503: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['Readiness']
        }
      }
    }
  }
}
