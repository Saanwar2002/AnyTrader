import React from "react";
import { 
  Zap, Moon, Bell, Mail, RefreshCw, ChevronDown, Loader2, 
  CheckCircle, XCircle, Pause, Play, Trash2 
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/src/lib/utils";

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

interface GrowthNotificationsCardProps {
  isBusinessProfile: boolean;
  isBannerAdsEnabled: boolean;
  // Notifications
  notificationSettings: {
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
  };
  setNotificationSettings: React.Dispatch<React.SetStateAction<any>>;
  handleSaveNotifications: (newSettings: any) => void;
  // Recurring
  loadingRecurring: boolean;
  recurringSchedules: any[];
  currentUserId?: string;
  userRole?: string;
  handleUpdateRecurringStatus: (scheduleId: string, status: string, otherPartyId: string, title: string) => void;
}

export const GrowthNotificationsCard: React.FC<GrowthNotificationsCardProps> = ({
  isBusinessProfile,
  isBannerAdsEnabled,
  notificationSettings,
  setNotificationSettings,
  handleSaveNotifications,
  loadingRecurring,
  recurringSchedules,
  currentUserId,
  userRole,
  handleUpdateRecurringStatus,
}) => {
  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 sm:p-7 relative space-y-7">
      
      {/* 1. Promotion & Advertising (Traders Banner Ad Studio) */}
      {isBusinessProfile && isBannerAdsEnabled && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-black">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-black leading-tight">Growth & Native Advertising</h3>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 border border-black shadow-sm">
            <div className="relative z-10 text-center sm:text-left">
              <h4 className="text-base font-black mb-1">Traders Banner Ad Studio</h4>
              <p className="text-blue-100 text-xs max-w-sm font-medium">
                Promote your services across top search categories to win direct client bookings.
              </p>
            </div>
            <div className="relative z-10 shrink-0 w-full sm:w-auto">
              <Link 
                to="/trader/banner-ads" 
                className="w-full sm:w-auto bg-white text-black border border-black px-5 py-2.5 rounded-xl font-black text-xs hover:bg-slate-50 transition-colors inline-block text-center shadow-md uppercase tracking-wider cursor-pointer"
              >
                Open Ad Studio
              </Link>
            </div>
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
              <Zap className="w-48 h-48" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Notification Preferences */}
      <div id="notifications" className={cn(isBusinessProfile && isBannerAdsEnabled && "pt-5 border-t border-black")}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-black">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-black leading-tight">Lead Alerts & Notifications</h3>
            <p className="text-[11px] text-black font-medium">Manage how and when you receive job lead alerts</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Quiet Hours Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-black">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100/70 text-black flex items-center justify-center border border-black">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-black">Quiet Hours (Do Not Disturb)</h4>
                <p className="text-[10px] text-black font-extrabold">Mute lead notifications during specific hours</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationSettings.quietHoursEnabled}
              onClick={() => {
                const newSettings = { ...notificationSettings, quietHoursEnabled: !notificationSettings.quietHoursEnabled };
                setNotificationSettings(newSettings);
                handleSaveNotifications(newSettings);
              }}
              className={cn(
                "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                notificationSettings.quietHoursEnabled ? "bg-blue-600" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs border border-black transition duration-200 ease-in-out",
                  notificationSettings.quietHoursEnabled ? "translate-x-5.5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {/* Quiet Hours Time Range */}
          {notificationSettings.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-3 pl-2">
              <div>
                <label className="block text-[10px] font-black text-black uppercase mb-1">Start Time</label>
                <div className="relative">
                  <select
                    value={notificationSettings.quietHoursStart}
                    onChange={(e) => {
                      const newSettings = { ...notificationSettings, quietHoursStart: e.target.value };
                      setNotificationSettings(newSettings);
                      handleSaveNotifications(newSettings);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-black rounded-xl text-xs font-black text-black appearance-none cursor-pointer"
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-black uppercase mb-1">End Time</label>
                <div className="relative">
                  <select
                    value={notificationSettings.quietHoursEnd}
                    onChange={(e) => {
                      const newSettings = { ...notificationSettings, quietHoursEnd: e.target.value };
                      setNotificationSettings(newSettings);
                      handleSaveNotifications(newSettings);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-black rounded-xl text-xs font-black text-black appearance-none cursor-pointer"
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Push & Email Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-black">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-black">Push Alerts</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notificationSettings.pushEnabled}
                onClick={() => {
                  const newSettings = { ...notificationSettings, pushEnabled: !notificationSettings.pushEnabled };
                  setNotificationSettings(newSettings);
                  handleSaveNotifications(newSettings);
                }}
                className={cn(
                  "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                  notificationSettings.pushEnabled ? "bg-blue-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs border border-black transition duration-200 ease-in-out",
                    notificationSettings.pushEnabled ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-black">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-black" />
                <span className="text-xs font-bold text-black">Email Summaries</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notificationSettings.emailEnabled}
                onClick={() => {
                  const newSettings = { ...notificationSettings, emailEnabled: !notificationSettings.emailEnabled };
                  setNotificationSettings(newSettings);
                  handleSaveNotifications(newSettings);
                }}
                className={cn(
                  "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                  notificationSettings.emailEnabled ? "bg-blue-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs border border-black transition duration-200 ease-in-out",
                    notificationSettings.emailEnabled ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Scheduled & Recurring Services */}
      <div className="pt-5 border-t border-black">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-black">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-black leading-tight">Recurring Service Contracts</h3>
            <p className="text-[11px] text-black font-medium">Manage scheduled repeat visits with clients</p>
          </div>
        </div>

        {loadingRecurring ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          </div>
        ) : recurringSchedules.length > 0 ? (
          <div className="space-y-3">
            {recurringSchedules.map((schedule) => {
              const otherPartyId = userRole === "homeowner" ? schedule.tradespersonId : schedule.homeownerId;
              const isProposer = schedule.proposedBy === currentUserId;
              const needsApproval = schedule.status === "pending_approval" && !isProposer;

              return (
                <div key={schedule.id} className="p-3.5 rounded-2xl border border-black bg-slate-50/70 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-black text-black text-xs">{schedule.title}</h4>
                      <p className="text-[10px] text-black uppercase font-bold tracking-wider">
                        {schedule.frequency} • £{schedule.amount}/visit
                      </p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-black",
                      schedule.status === "active" ? "bg-green-100 text-black" :
                      schedule.status === "pending_approval" ? "bg-amber-100 text-black" :
                      schedule.status === "paused" ? "bg-slate-200 text-black" : "bg-red-100 text-black"
                    )}>
                      {schedule.status.replace("_", " ")}
                    </span>
                  </div>

                  {needsApproval ? (
                    <div className="flex gap-2 pt-1">
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "active", otherPartyId, schedule.title)}
                        className="flex-1 bg-green-600 text-white py-1.5 rounded-xl text-xs font-black hover:bg-green-700 transition-colors flex items-center justify-center gap-1 cursor-pointer border border-black"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Accept
                      </button>
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "cancelled", otherPartyId, schedule.title)}
                        className="flex-1 bg-white border border-black text-red-600 py-1.5 rounded-xl text-xs font-black hover:bg-red-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  ) : schedule.status === "active" ? (
                    <div className="flex gap-2 pt-1">
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "paused", otherPartyId, schedule.title)}
                        className="flex-1 bg-white border border-black text-black py-1.5 rounded-xl text-xs font-black hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                      </button>
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "cancelled", otherPartyId, schedule.title)}
                        className="flex-1 bg-white border border-black text-red-600 py-1.5 rounded-xl text-xs font-black hover:bg-red-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  ) : schedule.status === "paused" ? (
                    <button 
                      onClick={() => handleUpdateRecurringStatus(schedule.id, "active", otherPartyId, schedule.title)}
                      className="w-full bg-indigo-600 text-white py-1.5 rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 cursor-pointer border border-black"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Resume Service
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-black">
            <RefreshCw className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs text-black font-medium">No recurring services scheduled yet.</p>
          </div>
        )}
      </div>

    </div>
  );
};
