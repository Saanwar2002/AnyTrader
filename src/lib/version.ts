import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { NativeMarket } from '@capacitor-community/native-market';

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

/**
 * Uses AppLauncher and NativeMarket plugins to launch Google Play Store or Apple App Store listing
 */
export async function openUpdateStore(config?: PlatformUpdateConfig) {
  const platform = Capacitor.getPlatform();
  const appId = "com.anytrader.app";

  if (Capacitor.isNativePlatform()) {
    try {
      if (platform === "android") {
        const canOpen = await AppLauncher.canOpenUrl({ url: `market://details?id=${appId}` }).catch(() => ({ value: false }));
        if (canOpen.value) {
          await AppLauncher.openUrl({ url: `market://details?id=${appId}` });
          return;
        }
        await NativeMarket.openStoreListing({ appId });
        return;
      } else if (platform === "ios") {
        const canOpen = await AppLauncher.canOpenUrl({ url: "itms-apps://itunes.apple.com/app/id647000000" }).catch(() => ({ value: false }));
        if (canOpen.value) {
          await AppLauncher.openUrl({ url: "itms-apps://itunes.apple.com/app/id647000000" });
          return;
        }
        await NativeMarket.openStoreListing({ appId: "647000000" });
        return;
      }
    } catch (err) {
      console.warn("Native Store Launch error, executing URL fallback:", err);
    }
  }

  // Web or fallback store URL handling
  let fallbackUrl = config?.webAppUrl || "https://anytrader.app";
  if (platform === "android") {
    fallbackUrl = config?.androidAppUrl || `https://play.google.com/store/apps/details?id=${appId}`;
  } else if (platform === "ios") {
    fallbackUrl = config?.iosAppUrl || "https://apps.apple.com/app/id647000000";
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await AppLauncher.openUrl({ url: fallbackUrl }).catch(() => window.open(fallbackUrl, "_system"));
    } else {
      window.open(fallbackUrl, "_blank");
    }
  } catch (e) {
    window.location.href = fallbackUrl;
  }
}

/**
 * Requests in-app review or opens store rating page using NativeMarket plugin
 */
export async function requestStoreReview() {
  const appId = "com.anytrader.app";
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeMarket.openStoreListing({ appId });
      return true;
    } catch (err) {
      console.warn("Store review prompt via NativeMarket failed:", err);
    }
  }

  const fallbackUrl = Capacitor.getPlatform() === "ios"
    ? "https://apps.apple.com/app/id647000000?action=write-review"
    : `https://play.google.com/store/apps/details?id=${appId}`;
  window.open(fallbackUrl, "_blank");
  return false;
}

