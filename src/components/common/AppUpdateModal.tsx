import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Download, CheckCircle2, ShieldAlert, X, ExternalLink, RefreshCw, Star } from "lucide-react";
import { 
  CURRENT_APP_VERSION, 
  PlatformUpdateConfig, 
  checkUpdateNeeded, 
  openUpdateStore,
  requestStoreReview
} from "@/src/lib/version";
import { triggerHaptic, ImpactStyle } from "@/src/lib/capacitor";
import { useRemoteConfig } from "@/src/components/RemoteConfigProvider";

interface AppUpdateModalProps {
  platformConfig?: PlatformUpdateConfig;
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
  isManualCheck?: boolean;
}

export function AppUpdateModal({
  platformConfig,
  isOpenOverride,
  onCloseOverride,
  isManualCheck = false,
}: AppUpdateModalProps) {
  const { values: remoteConfig } = useRemoteConfig();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    return localStorage.getItem("dismissed_app_version");
  });

  // Consolidate platformConfig with RemoteConfig fallback
  const effectiveConfig: PlatformUpdateConfig = {
    latestVersion: platformConfig?.latestVersion || remoteConfig?.latestVersion,
    minRequiredVersion: platformConfig?.minRequiredVersion || remoteConfig?.minRequiredVersion,
    forceUpdate: platformConfig?.forceUpdate ?? remoteConfig?.forceUpdate,
    updateTitle: platformConfig?.updateTitle || remoteConfig?.updateTitle,
    updateDescription: platformConfig?.updateDescription || remoteConfig?.updateDescription,
    releaseNotes: platformConfig?.releaseNotes || remoteConfig?.releaseNotes,
    androidAppUrl: platformConfig?.androidAppUrl || remoteConfig?.androidAppUrl,
    iosAppUrl: platformConfig?.iosAppUrl || remoteConfig?.iosAppUrl,
    webAppUrl: platformConfig?.webAppUrl,
  };

  const updateInfo = checkUpdateNeeded(effectiveConfig, CURRENT_APP_VERSION);

  // Determine visibility
  let isVisible = false;
  if (isOpenOverride !== undefined) {
    isVisible = isOpenOverride;
  } else if (updateInfo.hasUpdate) {
    if (updateInfo.isForced) {
      isVisible = true; // Never dismissable if forced
    } else {
      isVisible = dismissedVersion !== updateInfo.latestVersion;
    }
  }

  const handleDismiss = () => {
    if (updateInfo.isForced && !onCloseOverride) return;

    if (!updateInfo.isForced && updateInfo.latestVersion) {
      localStorage.setItem("dismissed_app_version", updateInfo.latestVersion);
      setDismissedVersion(updateInfo.latestVersion);
    }

    if (onCloseOverride) {
      onCloseOverride();
    }
  };

  const handleUpdate = () => {
    triggerHaptic(ImpactStyle.Medium);
    openUpdateStore(effectiveConfig);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-white rounded-[28px] border border-black shadow-2xl overflow-hidden p-6 text-slate-900"
          >
            {/* Header Icon Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                <Sparkles className="w-7 h-7 stroke-[2.5] animate-pulse" />
              </div>

              {!updateInfo.isForced && (
                <button
                  onClick={handleDismiss}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Version Badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200">
                Update Available
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                v{CURRENT_APP_VERSION} → <span className="text-blue-600 font-bold">v{updateInfo.latestVersion}</span>
              </span>

              {updateInfo.isForced && (
                <span className="ml-auto px-2.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-red-200 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-red-600" />
                  Required
                </span>
              )}
            </div>

            {/* Title & Description */}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              {updateInfo.updateTitle}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {updateInfo.updateDescription}
            </p>

            {/* Release Notes Checklist */}
            {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">What's New</p>
                <ul className="space-y-2">
                  {updateInfo.releaseNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs font-semibold text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleUpdate}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] min-h-[48px]"
              >
                <Download className="w-4 h-4" />
                <span>Update Now via App Store / Play Store</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>

              {!updateInfo.isForced && (
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors min-h-[44px]"
                >
                  Remind Me Later
                </button>
              )}
            </div>

            {updateInfo.isForced && (
              <p className="text-[11px] text-center text-slate-400 font-medium mt-4">
                This update contains critical security and stability improvements required to continue using AnyTrader.
              </p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default AppUpdateModal;
