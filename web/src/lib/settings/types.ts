import { Tier } from "@/lib/tiers/types";
import type { Notification } from "@/lib/notifications/interfaces";
import type { Locale } from "@/i18n/config";

export enum ApplicationStatus {
  PAYMENT_REMINDER = "payment_reminder",
  GATED_ACCESS = "gated_access",
  ACTIVE = "active",
  SEAT_LIMIT_EXCEEDED = "seat_limit_exceeded",
}

export enum QueryHistoryType {
  DISABLED = "disabled",
  ANONYMIZED = "anonymized",
  NORMAL = "normal",
}

export interface Settings {
  anonymous_user_enabled: boolean;
  invite_only_enabled: boolean;
  anonymous_user_path?: string;
  maximum_chat_retention_days?: number | null;
  company_name?: string | null;
  company_description?: string | null;
  notifications: Notification[];
  needs_reindexing: boolean;
  gpu_enabled: boolean;
  application_status: ApplicationStatus;
  auto_scroll: boolean;
  temperature_override_enabled: boolean;
  reasoning_override_enabled?: boolean;
  // Model selector shows one flat list instead of per-provider groups.
  hide_provider_grouping?: boolean;

  // "Auto" picker item backed by the admin-chosen router.
  // router model configuration (e.g. openrouter/auto).
  model_routing_enabled?: boolean;
  model_routing_model_configuration_id?: number | null;
  query_history_type: QueryHistoryType;

  // Visibility-only: hides the sidebar page; query-history APIs + recording stay on.
  hide_query_history_from_admin_panel?: boolean;

  deep_research_enabled?: boolean;
  multi_model_chat_enabled?: boolean;
  search_ui_enabled?: boolean;
  auto_detect_search_filters?: boolean;

  // Image processing settings
  image_extraction_and_analysis_enabled?: boolean;
  image_analysis_max_size_mb?: number | null;

  // Global limit on indexing embedding requests; null means no limit
  embedding_rate_limit_requests?: number | null;
  embedding_rate_limit_period_seconds?: number;

  // User Knowledge settings
  user_knowledge_enabled?: boolean;
  user_file_max_upload_size_mb?: number | null;
  file_token_count_threshold_k?: number | null;

  // Connector settings
  show_extra_connectors?: boolean;

  // Default Assistant settings
  disable_default_assistant?: boolean;

  // Onyx Craft (Build Mode) feature flag
  onyx_craft_enabled?: boolean;

  // Deployment-level Craft availability, ignoring workspace/per-user policy.
  // Gates visibility of the admin Craft-access controls.
  onyx_craft_available?: boolean;

  // Craft is switched on but the tier is too low: show the upgrade prompt.
  onyx_craft_requires_upgrade?: boolean;

  // Workspace default for Craft access; per-user overrides win.
  craft_default_enabled?: boolean;

  // Workspace UI language for users without a stored language of their own.
  default_language: Locale;

  // Workspace-wide switch for the LLM gateway (direct model API access via
  // /api/gateway). When false, all gateway routes reject requests.
  llm_gateway_enabled?: boolean;

  oauth_provider_enabled?: boolean;

  // Workspace-wide instructions injected into every Craft agent's system
  // prompt (AGENTS.md).
  craft_instructions?: string | null;

  // Dev/debug flag: when true, the Craft UI renders an "Opencode pod logs"
  // button that streams the user's sandbox pod logs in real time. Backed
  // by the ENABLE_OPENCODE_DEBUGGING env var on the server. Never set in
  // production — the underlying SSE endpoint also gates on the env var.
  opencode_debugging_enabled?: boolean;

  tier?: Tier;

  // Seat usage - populated when seat limit is exceeded
  seat_count?: number | null;
  used_seats?: number | null;

  // Vector DB availability flag - false when DISABLE_VECTOR_DB is set.
  // When false, connectors, RAG search, document sets, and related features
  // are unavailable.
  vector_db_enabled?: boolean;

  // HIDE_ONYX_BRANDING env var, honored only on the Enterprise tier.
  hide_onyx_branding?: boolean;

  // True when hooks are available: single-tenant deployments only.
  hooks_enabled?: boolean;

  // Application version from the ONYX_VERSION env var on the server.
  version?: string | null;
  // Hard ceiling for user_file_max_upload_size_mb, derived from env var.
  max_allowed_upload_size_mb?: number;

  // Factory defaults for the restore button.
  default_pruning_freq?: number;
  default_user_file_max_upload_size_mb?: number;
  default_file_token_count_threshold_k?: number;

  // True when the backend runs inside a container (Docker/Podman).
  // Used to default local-service URLs to host.docker.internal.
  is_containerized?: boolean;
}

/**
 * Combined settings shape returned by the server-side `fetchSettingsSS`
 * helper in `lib/settings/svcSS.ts`. Used only for SSR — client
 * components access settings via the SWR hooks in `lib/settings/hooks.ts`.
 */
export interface CombinedSettings {
  settings: Settings;
  webVersion: string | null;
  webDomain: string | null;
  appName: string;
}

/**
 * Strip the derived/frontend-only fields from an `AppSettings` object,
 * returning only the plain `Settings` slice safe to send to the backend.
 */
export function toSettings({
  appName: _appName,
  vectorDbEnabled: _vectorDbEnabled,
  isLoading: _isLoading,
  error: _error,
  ...core
}: AppSettings): Settings {
  return core;
}

/**
 * The fully-derived application settings object returned by `useSettings()`.
 *
 * Extends `Settings` with pre-computed derived fields.
 */
export interface AppSettings extends Settings {
  /** Always APP_NAME ("PaoTeacherAgent"). */
  appName: string;
  /** False when DISABLE_VECTOR_DB is set server-side. */
  vectorDbEnabled: boolean;
  isLoading: boolean;
  error: Error | undefined;
}
