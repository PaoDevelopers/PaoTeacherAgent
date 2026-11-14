"use client";

import useSWR from "swr";
import { usePathname } from "next/navigation";
import useCCPairs from "@/hooks/useCCPairs";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { SWR_KEYS } from "@/lib/swr-keys";
import { isAuthPath } from "@/lib/auth/paths";
import {
  ApplicationStatus,
  AppSettings,
  QueryHistoryType,
  Settings,
} from "@/lib/settings/types";
import { APP_NAME } from "@/lib/constants";
import { DEFAULT_LOCALE } from "@/i18n/config";

const SETTINGS_ERROR_RETRY_INTERVAL = 5_000;

const DEFAULT_SETTINGS: Settings = {
  auto_scroll: true,
  application_status: ApplicationStatus.ACTIVE,
  gpu_enabled: false,
  maximum_chat_retention_days: null,
  notifications: [],
  needs_reindexing: false,
  anonymous_user_enabled: false,
  invite_only_enabled: false,
  deep_research_enabled: true,
  multi_model_chat_enabled: true,
  temperature_override_enabled: true,
  reasoning_override_enabled: true,
  query_history_type: QueryHistoryType.NORMAL,
  default_language: DEFAULT_LOCALE,
};

/**
 * The single settings hook. Returns a fully-derived `AppSettings` object.
 *
 * Derived fields (`appName`, `vectorDbEnabled`) are pre-computed so callers
 * never have to re-derive them.
 */
export function useSettings(): AppSettings {
  // Skip core settings on /auth/* routes: unauthenticated callers 403 there.
  const onAuthPath = isAuthPath(usePathname());

  const {
    data: rawSettings,
    error: settingsError,
    isLoading: settingsLoading,
  } = useSWR<Settings>(
    onAuthPath ? null : SWR_KEYS.settings,
    errorHandlingFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 30_000,
      errorRetryInterval: SETTINGS_ERROR_RETRY_INTERVAL,
    }
  );

  const core = rawSettings ?? DEFAULT_SETTINGS;

  return {
    ...core,
    appName: APP_NAME,
    vectorDbEnabled:
      !settingsLoading && !settingsError && core.vector_db_enabled !== false,
    isLoading: settingsLoading,
    error: settingsError,
  };
}

/**
 * Returns `true` when search mode is actually usable by the current user.
 *
 * This is a cross-cutting hook: it joins `useSettings()` with connector state (`useCCPairs`). It is intentionally kept
 * separate from `useSettings()` so that the connector list fetch only fires in
 * the small number of components that actually need it.
 */
export function useIsSearchModeAvailable(): boolean {
  const { vectorDbEnabled, search_ui_enabled } = useSettings();
  const { ccPairs } = useCCPairs(vectorDbEnabled);
  return search_ui_enabled !== false && ccPairs.length > 0;
}
