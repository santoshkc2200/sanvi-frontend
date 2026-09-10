// Layout primitives

// Core components
export { default as AdPlatformCard } from './advertising/AdPlatformCard.svelte'
// Advertising connections (phase 10, TASK-011)
export { default as AdAccountPicker } from './advertising/AdAccountPicker.svelte'
export type { AdAccountOption, AdPickerLabels } from './advertising/AdAccountPicker.svelte'
export { default as AdConnectionHealth } from './advertising/AdConnectionHealth.svelte'
export type { AdHealthLabels } from './advertising/AdConnectionHealth.svelte'
export {
  adHealthState,
  AD_HEALTH_TONES,
  EXPIRING_SOON_SECS,
  type AdConnectionHealthData,
  type AdHealthState,
} from './advertising/health'
// Advertising campaign surfaces (phase 10, TASK-012)
export { default as AdDriftDiff } from './advertising/AdDriftDiff.svelte'
export type { DriftDiffRow } from './advertising/AdDriftDiff.svelte'
export { default as AdChangeTimeline } from './advertising/AdChangeTimeline.svelte'
export type { AdChangeItem } from './advertising/AdChangeTimeline.svelte'
// Advertising creatives & placement previews (phase 10, TASK-013)
export { default as AdLocaleCopyEditor } from './advertising/AdLocaleCopyEditor.svelte'
export { default as PlacementPreview } from './advertising/PlacementPreview.svelte'
// Conversion diagnostics (phase 10, TASK-015)
export { default as ReasonBadge } from './advertising/ReasonBadge.svelte'
export { default as HealthBanner } from './advertising/HealthBanner.svelte'
export type { AdHealthFigure } from './advertising/HealthBanner.svelte'
// Attribution methodology (phase 10, TASK-016)
export { default as AttributionExplainer } from './advertising/AttributionExplainer.svelte'
export type { AttributionPlatformRow } from './advertising/AttributionExplainer.svelte'
// Budget guardrails (phase 10, TASK-017)
export { default as CapProgress } from './advertising/CapProgress.svelte'
export { default as ConsequenceDialog } from './advertising/ConsequenceDialog.svelte'
export type { ConsequenceFigure } from './advertising/ConsequenceDialog.svelte'
// Chart primitives (phase 10, TASK-016) — tokenized layer, accessible tables
export { default as BarChart } from './charts/BarChart.svelte'
export { default as ChartDataTable } from './charts/ChartDataTable.svelte'
export { default as LineChart } from './charts/LineChart.svelte'
export { default as OverlayChart } from './charts/OverlayChart.svelte'
export { default as Sparkline } from './charts/Sparkline.svelte'
export { default as StackedBarChart } from './charts/StackedBarChart.svelte'
export { CHART_SERIES_COLORS } from './charts/math'
export type {
  ChartFrameLabels,
  ChartSeries,
  ChartTableLabels,
} from './charts/types'
export {
  AD_DIRECTIVE_CATEGORIES,
  AD_REASON_CATEGORIES,
  AD_REASON_TONES,
  isDirectiveCategory,
  type AdReasonCategory,
} from './advertising/reasons'
export {
  aspectRatioFromDimensions,
  assetMetadataFromMeasured,
  hasImageAsset,
  previewFrameAspectRatio,
  specRequirements,
  validateAssetAgainstSpec,
  validateAssetSetAgainstSpec,
  type AdAssetMetadata,
  type AdAssetSetIssue,
  type AdAssetSetIssueCode,
  type AdAssetSpecDimension,
  type AdAssetSpecIssue,
  type AdSpecRequirement,
} from './advertising/creative-spec'
export { default as Alert } from './Alert.svelte'
export { type ApprovalRequestItem, default as ApprovalRequest } from './ApprovalRequest.svelte'
export { type AppShellNavItem, default as AppShell } from './AppShell.svelte'
export { type AuditEntryRow, default as AuditTrail } from './AuditTrail.svelte'
export { default as Badge } from './Badge.svelte'
export { default as Button } from './Button.svelte'
export { default as Checkbox } from './Checkbox.svelte'
export { default as ConsentBanner, type ConsentBannerPurpose } from './ConsentBanner.svelte'
export { default as ConsentPreferences, type PreferenceRow } from './ConsentPreferences.svelte'
export { default as CopyButton } from './CopyButton.svelte'
export { csvCell, csvDocument, downloadCsv } from './csv'
export { default as DangerousAction } from './DangerousAction.svelte'
export { default as DataTable } from './DataTable.svelte'
export { type DetailShellTab, default as DetailShell } from './DetailShell.svelte'
export { default as Dialog } from './Dialog.svelte'
export {
  default as DomainRecordTable,
  type DomainRecordItem,
} from './DomainRecordTable.svelte'
export { default as Drawer } from './Drawer.svelte'
export { default as EmptyState } from './EmptyState.svelte'
export { default as ErrorView } from './ErrorView.svelte'
export { default as Field, type FieldControlProps } from './Field.svelte'
export { default as FilterBar, type FilterFieldConfig } from './FilterBar.svelte'
export {
  formatAdCurrency,
  formatRatio,
  minorUnitDigits,
  NO_VALUE,
  type RatioFormatOptions,
} from './format/metrics'
// Capability-driven advertising form engine (phase 10)
export { default as CapabilityForm } from './forms/CapabilityForm.svelte'
export { default as StepperNav } from './forms/StepperNav.svelte'
export { humanizeOptionValue } from './forms/humanize'
export {
  campaignFormSchema,
  codePointLength,
  emptyDraft,
  FIELD_PATHS,
  textFieldsFor,
  textLimit,
  type CampaignFormSchema,
  type TextEntrySchema,
} from './forms/schema'
export {
  builderAutosaveKey,
  builderSteps,
  clearBuilderAutosave,
  draftFromCampaign,
  draftToCreatePayload,
  draftToPatchPayload,
  loadBuilderAutosave,
  saveBuilderAutosave,
  seedAdGroupPayload,
  validateStep,
  type BuilderAutosave,
  type BuilderSchedule,
  type BuilderStepId,
  type CampaignSnapshot,
  type CreateCampaignPayload,
  type PatchCampaignPayload,
  type SeedAdGroupPayload,
} from './forms/builder'
export type {
  AdAssetSpec,
  AdCapabilityMatrix,
  AdCreativePlacement,
  AdPlatform,
  CampaignFormDraft,
  CampaignFormTextEntry,
  FormIssue,
  MappedViolations,
  ServerViolation,
} from './forms/types'
export { mapViolations, minimumFor, validateDraft } from './forms/validate'
export { default as Input } from './Input.svelte'
export { enterUnlessComposing, isComposingKeyboardEvent } from './ime'
export { default as Cluster } from './layout/Cluster.svelte'
export { default as Container } from './layout/Container.svelte'
export { default as Grid } from './layout/Grid.svelte'
export { default as Spacer } from './layout/Spacer.svelte'
export { default as Stack } from './layout/Stack.svelte'
export {
  createListQueryState,
  ListQueryState,
  type ListQueryStateOptions,
  type SavedView,
} from './list-query-state.svelte'
export { default as Radio } from './Radio.svelte'
export { default as LocaleSwitcher, type LocaleSwitcherOption } from './LocaleSwitcher.svelte'
export { default as ReasonPrompt } from './ReasonPrompt.svelte'
export { default as PastDueBanner } from './PastDueBanner.svelte'
export { default as PrivacyFooterLinks } from './PrivacyFooterLinks.svelte'
export { default as PrivacyNoticeBanner } from './PrivacyNoticeBanner.svelte'
export { default as QuotaExceededDialog } from './QuotaExceededDialog.svelte'
export { default as Select, type SelectOption } from './Select.svelte'
export { default as Spinner } from './Spinner.svelte'
export { default as StatCard } from './StatCard.svelte'
export { default as StepUpGate } from './StepUpGate.svelte'
export { default as SuspendedInterstitial } from './SuspendedInterstitial.svelte'
export { default as SuspendedTenantNotice } from './SuspendedTenantNotice.svelte'
export { default as Table } from './Table.svelte'
export { default as TenantSwitcher, type TenantSwitcherOption } from './TenantSwitcher.svelte'
export { default as Textarea } from './Textarea.svelte'
export { default as ToastViewport } from './ToastViewport.svelte'
export { default as TrialBanner } from './TrialBanner.svelte'
export { default as PaymentProviderCard } from './PaymentProviderCard.svelte'
export { default as UpgradePrompt } from './UpgradePrompt.svelte'
export type { DataTableBulkActionArgs, TableColumn } from './table-types'
// Toast store (used with ToastViewport)
export {
  dismissToast,
  getToasts,
  showToast,
  type ToastItem,
  type ToastOptions,
} from './toast.svelte'
// Token helpers
export {
  RADIUS_SCALE,
  type RadiusScale,
  radiusVar,
  SPACING_SCALE,
  type SpacingScale,
  spacingVar,
} from './tokens'
export { default as UsageMeter } from './UsageMeter.svelte'
