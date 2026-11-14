import {
  CombinedSettings,
  EnterpriseSettings,
  ApplicationStatus,
  Settings,
  QueryHistoryType,
} from "@/lib/settings/types";
import { HOST_URL } from "@/lib/constants";
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

export async function fetchEnterpriseSettingsSS(): Promise<EnterpriseSettings | null> {
  try {
    const response = await fetchSS("/enterprise-settings");
    if (!response?.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function fetchSettingsSS(): Promise<CombinedSettings | null> {
  const settingsTask = fetchSS("/settings");
  const enterpriseTask = fetchSS("/enterprise-settings");

  try {
    const [settingsResponse, enterpriseResponse] = await Promise.all([
      settingsTask,
      enterpriseTask,
    ]);

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

    let enterpriseSettings: EnterpriseSettings | null = null;
    if (enterpriseResponse) {
      if (enterpriseResponse.ok) {
        enterpriseSettings = await enterpriseResponse.json();
      } else if (
        // 404: a build without Enterprise code has no such route.
        enterpriseResponse.status !== 404 &&
        enterpriseResponse.status !== 403 &&
        enterpriseResponse.status !== 401
      ) {
        throw new Error(
          `fetchSettingsSS: enterprise failed status=${
            enterpriseResponse.status
          } body=${await enterpriseResponse.text()}`
        );
      }
    }

    if (settings.deep_research_enabled == null) {
      settings.deep_research_enabled = true;
    }

    return {
      settings,
      enterpriseSettings,
      webVersion: settings.version ?? getWebVersion(),
      webDomain: HOST_URL,
      appName:
        enterpriseSettings?.application_name?.trim() || "PaoTeacherAgent",
    };
  } catch (error) {
    console.error("fetchSettingsSS exception: ", error);
    return null;
  }
}
