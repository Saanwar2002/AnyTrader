import React, { useState } from "react";
import { 
  Bell, Clock, ShieldAlert, Volume2, VolumeX, MapPin, 
  Check, X, Sparkles, Sliders, Smartphone, AlertCircle, Info, Send
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import { 
  TraderMatchNotificationSettings, 
  DEFAULT_NOTIFICATION_SETTINGS, 
  MatchNotificationSchedule,
  triggerDeviceNotification,
  checkAndNotifyTraderMatches
} from "@/src/services/traderNotificationEngine";
import { db, doc, updateDoc } from "@/src/firebase";
import { toast } from "sonner";

interface TraderNotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  traderProfile: any;
  onSaved?: (updatedSettings: TraderMatchNotificationSettings) => void;
}

export const TraderNotificationPreferencesModal: React.FC<TraderNotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  traderProfile,
  onSaved,
}) => {
  const currentSettings: TraderMatchNotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(traderProfile?.matchNotificationSettings || {}),
  };

  const [schedule, setSchedule] = useState<MatchNotificationSchedule>(currentSettings.schedule);
  const [radiusMiles, setRadiusMiles] = useState<number>(currentSettings.radiusMiles || 25);
  const [bypassEmergency, setBypassEmergency] = useState<boolean>(currentSettings.bypassEmergency ?? true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(currentSettings.soundEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  if (!isOpen) return null;

  const requestPermissionIfNeeded = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        setPermissionStatus(res);
        if (res === "granted") {
          toast.success("Push notifications enabled on your device!");
        } else if (res === "denied") {
          toast.error("Notifications are blocked in your browser/device settings.");
        }
      } catch (e) {
        console.warn("Notification request error:", e);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updated: TraderMatchNotificationSettings = {
      schedule,
      radiusMiles,
      bypassEmergency,
      soundEnabled: schedule === "silent_in_app_only" ? false : soundEnabled,
      lastCheckedAt: Date.now(),
    };

    try {
      if (traderProfile?.uid) {
        await updateDoc(doc(db, "users", traderProfile.uid), {
          matchNotificationSettings: updated,
        });
      }
      toast.success("Notification preferences saved!");
      if (onSaved) onSaved(updated);
      onClose();
    } catch (e: any) {
      console.error("Error saving notification settings:", e);
      toast.error("Failed to save settings: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTesting(true);
    await requestPermissionIfNeeded();

    const isSilent = schedule === "silent_in_app_only";
    const sampleCategory = (traderProfile?.trades && traderProfile.trades[0]) || "Plumbing & Heating";
    const title = `🔔 AnyTrader: 3 New Matched Jobs in Your Area (${radiusMiles}mi)`;
    const body = `${sampleCategory} Emergency Leak Repair (£180) + 2 more in your postcode radius. Tap to view dashboard.`;

    const sent = await triggerDeviceNotification({
      title,
      body,
      tag: "test-match-notification",
      silent: isSilent || !soundEnabled,
      data: { url: "/trade-jobs" },
    });

    if (sent) {
      toast.success("Test notification delivered to your device banner!");
    } else {
      toast.info("In-app test notification triggered (enable OS permissions for phone bar banner).");
    }
    setTesting(false);
  };

  const scheduleOptions = [
    {
      id: "every_5_hours" as MatchNotificationSchedule,
      title: "Every 5 Hours (Periodic Digest)",
      description: "Smart background summary of all newly matched jobs in your trade & radius every 5 hours.",
      badge: "Recommended",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    },
    {
      id: "morning_8am" as MatchNotificationSchedule,
      title: "Morning Digest (8:00 AM)",
      description: "Receive a concentrated morning notification with jobs posted overnight before starting your day.",
      badge: "8:00 AM",
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
    },
    {
      id: "afternoon_2pm" as MatchNotificationSchedule,
      title: "Afternoon Digest (2:00 PM)",
      description: "Mid-day summary of fresh customer requests, afternoon bookings, and next-day scheduled quotes.",
      badge: "2:00 PM",
      badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
    },
    {
      id: "silent_in_app_only" as MatchNotificationSchedule,
      title: "Don't Send Push (Silent In-App Only)",
      description: "No phone pop-ups or sounds. Matched jobs will still be highlighted inside your in-app ALERTS hub & dashboard.",
      badge: "Silent Mode",
      badgeColor: "bg-slate-200 text-slate-800 border-slate-400",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] border border-black shadow-2xl max-w-lg w-full overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="bg-[#002B5C] text-white p-5 sm:p-6 relative border-b border-black">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                <Bell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black leading-tight text-white">
                  Match Notification Timing
                </h3>
                <p className="text-xs text-blue-200 font-medium">
                  Background job alerts for your exact trades & radius
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border border-white/20 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* OS Permission Banner if default or denied */}
          {permissionStatus !== "granted" && (
            <div className="mt-4 p-3 bg-white/10 rounded-xl border border-white/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-200 font-semibold">
                <Smartphone className="w-4 h-4 shrink-0 text-amber-300" />
                <span>Device notifications not yet authorized</span>
              </div>
              <button
                onClick={requestPermissionIfNeeded}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shrink-0 cursor-pointer"
              >
                Enable
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Section 1: Timing Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Notification Schedule
              </label>
              <span className="text-[10px] text-slate-500 font-bold">Pick 1 of 4 options</span>
            </div>

            <div className="space-y-2.5">
              {scheduleOptions.map((opt) => {
                const isSelected = schedule === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSchedule(opt.id)}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer text-left flex items-start gap-3 relative",
                      isSelected
                        ? "bg-blue-50/70 border-black ring-2 ring-blue-600 shadow-sm"
                        : "bg-slate-50 border-black hover:bg-slate-100"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border border-black flex items-center justify-center shrink-0 mt-0.5",
                      isSelected ? "bg-blue-600 text-white" : "bg-white"
                    )}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-black">{opt.title}</span>
                        <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md border", opt.badgeColor)}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Matching Radius Selector */}
          <div className="space-y-3 pt-4 border-t border-black">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
                Coverage Radius
              </label>
              <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                {radiusMiles} Miles
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[5, 10, 15, 25, 50].map((miles) => (
                <button
                  key={miles}
                  type="button"
                  onClick={() => setRadiusMiles(miles)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-black border transition-all cursor-pointer",
                    radiusMiles === miles
                      ? "bg-black text-white border-black shadow-md scale-105"
                      : "bg-slate-50 text-black border-black hover:bg-slate-100"
                  )}
                >
                  {miles} mi
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 font-medium">
              Only notify jobs posted within <strong className="text-black">{radiusMiles} miles</strong> of your registered postcode/location.
            </p>
          </div>

          {/* Section 3: Emergency Bypass Toggle */}
          <div className="pt-4 border-t border-black space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-amber-50/80 rounded-2xl border border-black">
              <div className="flex items-center gap-3 pr-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center border border-black shrink-0 font-black">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-black text-black">Bypass for Emergency Leads</h4>
                  <p className="text-[10px] text-slate-800 font-medium leading-tight mt-0.5">
                    Deliver urgent plumbing bursts, boiler breakdowns & roof leaks immediately without waiting for periodic timers.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={bypassEmergency}
                onClick={() => setBypassEmergency(!bypassEmergency)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                  bypassEmergency ? "bg-amber-500" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md border border-black transition duration-200 ease-in-out",
                    bypassEmergency ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Section 4: Exact Trade Matching Assurance Note */}
          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-start gap-2.5 text-xs text-blue-950 font-medium">
            <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong className="font-black text-black">Strict Trade Matching:</strong> Notifications only trigger for your registered trades ({traderProfile?.trades?.slice(0, 3).join(", ") || "General Trade"}). Middle-word partials (e.g. carpet for pet) are automatically filtered out.
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-black flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSendTestNotification}
            disabled={testing}
            className="px-3.5 py-2.5 bg-white border border-black rounded-xl text-xs font-black text-black hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test Notification</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-black rounded-xl text-xs font-black text-black hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black border border-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
export default TraderNotificationPreferencesModal;
