import {
  CombinedSettings,
  ApplicationStatus,
  Settings,
  QueryHistoryType,
} from "@/lib/settings/types";
import { APP_NAME, HOST_URL } from "@/lib/constants";
import { fetchSS } from "@/lib/utilsSS";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getWebVersion } from "@/lib/version";

export async function fetchStandardSettingsSS(): Promise<Settings | null> {
  try {
    const response = await fetchSS("/settings");
    if (!response?.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function fetchSettingsSS(): Promise<CombinedSettings | null> {
  try {
    const settingsResponse = await fetchSS("/settings");

    let settings: Settings;
    if (!settingsResponse) {
      throw new Error("Standard settings fetch failed.");
    }
    if (!settingsResponse.ok) {
      if (settingsResponse.status === 403 || settingsResponse.status === 401) {
        settings = {
          auto_scroll: true,
          application_status: ApplicationStatus.ACTIVE,
          gpu_enabled: false,
          maximum_chat_retention_days: null,
          notifications: [],
          needs_reindexing: false,
          anonymous_user_enabled: false,
          invite_only_enabled: false,
          deep_research_enabled: true,
          temperature_override_enabled: true,
          reasoning_override_enabled: true,
          query_history_type: QueryHistoryType.NORMAL,
          default_language: DEFAULT_LOCALE,
        };
      } else {
        throw new Error(
          `fetchSettingsSS: settings failed status=${
            settingsResponse.status
          } body=${await settingsResponse.text()}`
        );
      }
    } else {
      settings = await settingsResponse.json();
    }

    if (settings.deep_research_enabled == null) {
      settings.deep_research_enabled = true;
    }

    return {
      settings,
      webVersion: settings.version ?? getWebVersion(),
      webDomain: HOST_URL,
      appName: APP_NAME,
    };
  } catch (error) {
    console.error("fetchSettingsSS exception: ", error);
    return null;
  }
}
