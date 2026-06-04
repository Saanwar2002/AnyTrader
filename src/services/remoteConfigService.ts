import { getRemoteConfig, fetchAndActivate, getValue, isSupported } from "firebase/remote-config";
import { app } from "../firebase";

export interface RemoteConfigValues {
  platformCommissionRate: number;      // e.g. 0.12 for 12%
  driverWaitTimeLimitMins: number;      // e.g. 5 minutes
  emergencySurgePricingEnabled: boolean; // true or false
  isDemoMode: boolean;                 // true or false
}

// Default values to fall back on or use initially
export const REMOTE_CONFIG_DEFAULTS: RemoteConfigValues = {
  platformCommissionRate: 0.12,
  driverWaitTimeLimitMins: 5,
  emergencySurgePricingEnabled: false,
  isDemoMode: true
};

let remoteConfigInstance: any = null;

// Helper to check and initialize Remote Config in client environment
export async function initRemoteConfig(): Promise<RemoteConfigValues> {
  if (typeof window === "undefined") {
    return REMOTE_CONFIG_DEFAULTS;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("Firebase Remote Config is not supported in this environment (e.g. iframe with restricted storage). Using system defaults.");
      return getMergedValuesWithOverrides(REMOTE_CONFIG_DEFAULTS);
    }

    // Initialize Remote Config instance
    remoteConfigInstance = getRemoteConfig(app);

    // Set fetch interval: in development/preview environments, check frequently (e.g. 1 minute)
    remoteConfigInstance.settings.minimumFetchIntervalMillis = 60000; // 1 minute
    
    // Set default values in SDK
    remoteConfigInstance.defaultConfig = {
      platform_commission_rate: REMOTE_CONFIG_DEFAULTS.platformCommissionRate,
      driver_wait_time_limit_mins: REMOTE_CONFIG_DEFAULTS.driverWaitTimeLimitMins,
      emergency_surge_pricing_enabled: REMOTE_CONFIG_DEFAULTS.emergencySurgePricingEnabled,
      is_demo_mode: REMOTE_CONFIG_DEFAULTS.isDemoMode
    };

    console.log("Firebase Remote Config SDK initialized successfully. Fetching parameter overrides...");
    
    // Fetch and activate configs
    await fetchAndActivate(remoteConfigInstance);

    const activeValues: RemoteConfigValues = {
      platformCommissionRate: getValue(remoteConfigInstance, "platform_commission_rate").asNumber(),
      driverWaitTimeLimitMins: getValue(remoteConfigInstance, "driver_wait_time_limit_mins").asNumber(),
      emergencySurgePricingEnabled: getValue(remoteConfigInstance, "emergency_surge_pricing_enabled").asBoolean(),
      isDemoMode: getValue(remoteConfigInstance, "is_demo_mode").asBoolean()
    };

    console.log("Active Firebase Remote Config Values Loaded:", activeValues);
    return getMergedValuesWithOverrides(activeValues);
  } catch (err) {
    console.warn("Failed to complete Remote Config fetch & activate:", err);
    return getMergedValuesWithOverrides(REMOTE_CONFIG_DEFAULTS);
  }
}

// Local simulation overrides stored in localStorage for robust testing in AI Studio Preview!
export function getSavedOverrides(): Partial<RemoteConfigValues> {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem("anytrader_remote_config_sim_overrides");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveSimOverrides(overrides: Partial<RemoteConfigValues>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("anytrader_remote_config_sim_overrides", JSON.stringify(overrides));
  } catch (e) {
    console.error("Failed to save simulation overrides:", e);
  }
}

export function clearSimOverrides(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("anytrader_remote_config_sim_overrides");
  } catch (e) {
    console.error("Failed to clear simulation overrides:", e);
  }
}

function getMergedValuesWithOverrides(base: RemoteConfigValues): RemoteConfigValues {
  const overrides = getSavedOverrides();
  return {
    ...base,
    ...overrides
  };
}
