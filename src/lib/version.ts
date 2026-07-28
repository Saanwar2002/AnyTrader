import { Capacitor } from '@capacitor/core';

export const CURRENT_APP_VERSION = "1.0.0";

export interface PlatformUpdateConfig {
  latestVersion?: string;
  minRequiredVersion?: string;
  forceUpdate?: boolean;
  updateTitle?: string;
  updateDescription?: string;
  releaseNotes?: string[];
  androidAppUrl?: string;
  iosAppUrl?: string;
  webAppUrl?: string;
  updatedAt?: any;
}

/**
 * Compares two semantic version strings (e.g. "1.1.0" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 || !v2) return 0;

  const cleanV1 = v1.replace(/^v/, '').trim();
  const cleanV2 = v2.replace(/^v/, '').trim();

  const parts1 = cleanV1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

export function checkUpdateNeeded(config?: PlatformUpdateConfig, currentVersion: string = CURRENT_APP_VERSION) {
  if (!config || !config.latestVersion) {
    return {
      hasUpdate: false,
      isForced: false,
      latestVersion: currentVersion,
      minRequiredVersion: currentVersion,
      releaseNotes: [],
    };
  }

  const latestVersion = config.latestVersion || currentVersion;
  const minRequiredVersion = config.minRequiredVersion || "1.0.0";

  const isOlderThanLatest = compareVersions(currentVersion, latestVersion) < 0;
  const isOlderThanMin = compareVersions(currentVersion, minRequiredVersion) < 0;
  const isForced = isOlderThanMin || !!config.forceUpdate;

  return {
    hasUpdate: isOlderThanLatest,
    isForced: isForced,
    latestVersion,
    minRequiredVersion,
    releaseNotes: config.releaseNotes || [
      "Performance and security enhancements",
      "New feature updates and bug fixes",
      "Improved mobile interface responsiveness"
    ],
    updateTitle: config.updateTitle || "New Version Available!",
    updateDescription: config.updateDescription || "A new update for AnyTrader is available. Update now to get the latest features and security improvements.",
  };
}

export function openUpdateStore(config?: PlatformUpdateConfig) {
  const platform = Capacitor.getPlatform();
  let url = config?.webAppUrl || "https://anytrader.app";

  if (platform === "android") {
    url = config?.androidAppUrl || "https://play.google.com/store/apps/details?id=com.anytrader.app";
  } else if (platform === "ios") {
    url = config?.iosAppUrl || "https://apps.apple.com/app/id647000000";
  }

  try {
    if (Capacitor.isNativePlatform()) {
      window.open(url, "_system");
    } else {
      window.open(url, "_blank");
    }
  } catch (e) {
    window.location.href = url;
  }
}
