import React, { useState } from "react";
import { useRemoteConfig } from "../RemoteConfigProvider";
import { 
  Settings, Zap, Shield, HelpCircle, RefreshCw, X, Play, RotateCcw, Landmark, Clock, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

const GlobalSettings: React.FC = () => {
  const { 
    values: config, 
    loading, 
    refresh, 
    updateSimulationOverrides, 
    resetToDefaults,
    isOverridden 
  } = useRemoteConfig();

  const [activeTab, setActiveTab] = useState<"controls" | "docs">("controls");
  const [localCommission, setLocalCommission] = useState((config.platformCommissionRate * 100).toString());
  const [localWaitTime, setLocalWaitTime] = useState(config.driverWaitTimeLimitMins.toString());
  const [localSurge, setLocalSurge] = useState(config.emergencySurgePricingEnabled);

  // Re-sync local inputs when config data refreshes
  React.useEffect(() => {
    setLocalCommission((config.platformCommissionRate * 100).toString());
    setLocalWaitTime(config.driverWaitTimeLimitMins.toString());
    setLocalSurge(config.emergencySurgePricingEnabled);
  }, [config]);

  const handleApplySimOverrides = () => {
    const rateNum = parseFloat(localCommission);
    const minsNum = parseInt(localWaitTime);

    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      toast.error("Please enter a valid platform commission rate (0-100%)");
      return;
    }
    if (isNaN(minsNum) || minsNum < 1 || minsNum > 60) {
      toast.error("Please enter a valid wait time limit (1-60 minutes)");
      return;
    }

    updateSimulationOverrides({
      platformCommissionRate: rateNum / 100,
      driverWaitTimeLimitMins: minsNum,
      emergencySurgePricingEnabled: localSurge,
      isDemoMode: false
    });

    toast.success("Simulation overrides applied successfully across all portals!");
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
    toast.success("Reset successfully connected live to Firebase Remote Config cloud server!");
  };

  const handleManualSync = async () => {
    try {
      await refresh();
      toast.success("Synced successfully with Google Firebase cloud configuration.");
    } catch {
      toast.error("Cloud synchronization timed out or failed. Running in fallback simulation mode.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-black">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-black pb-6">
        <div>
          <h1 className="text-3xl font-sans font-black tracking-tight uppercase flex items-center gap-2">
            <Settings className="w-8 h-8 text-[#007AFF]" />
            Ecosystem Settings
          </h1>
          <p className="text-slate-500 font-sans text-xs mt-1">
            Configure live parameters for all operational rides, payments, wait times, limits, and surge rules using <span className="font-mono text-[11px] font-bold text-black font-semibold bg-slate-100 px-1 rounded">Firebase Remote Config</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleManualSync}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 border border-black text-xs font-bold uppercase rounded-[6px] hover:bg-slate-200 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync Cloud Config
          </button>
        </div>
      </div>

      {/* Segment switcher */}
      <div className="flex border-b border-slate-200 mb-6 gap-4">
        <button
          onClick={() => setActiveTab("controls")}
          className={`pb-3 text-xs uppercase font-extrabold tracking-wider transition-all border-b-2 relative ${
            activeTab === "controls" 
              ? "border-black text-black font-black" 
              : "border-transparent text-slate-400 hover:text-black"
          }`}
        >
          Remote Config & Simulation Hub
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`pb-3 text-xs uppercase font-extrabold tracking-wider transition-all border-b-2 relative ${
            activeTab === "docs" 
              ? "border-black text-black font-black" 
              : "border-transparent text-slate-400 hover:text-black"
          }`}
        >
          Firebase Setup Guide
        </button>
      </div>

      {/* Tabs panels */}
      <AnimatePresence mode="wait">
        {activeTab === "controls" && (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left Side: Parameters Form */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Simulation Banner */}
              <div className="border border-black p-5 bg-[#F8F9FA] rounded-[8px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverridden ? "bg-amber-400" : "bg-emerald-400"}`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${isOverridden ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                    </span>
                    <h3 className="text-sm font-sans font-black uppercase">
                      Configuration State: {isOverridden ? "Local Simulator Overrides Active" : "Live Google Cloud Connected"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-1.5 leading-snug">
                    {isOverridden 
                      ? "The settings below have overridden the live server parameters in this preview. You can safely simulate different system-wide configurations without altering actual prod environments." 
                      : "This workspace is reading live constants directly from your active Google Firebase instance. Any changes in the console updates all users instantly."}
                  </p>
                </div>
                
                {isOverridden && (
                  <button 
                    onClick={handleResetToDefaults}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-black text-[10px] font-black uppercase rounded-[4px] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Cloud Default
                  </button>
                )}
              </div>

              {/* Main Panel Box */}
              <div className="border border-black p-6 bg-white rounded-[8px]">
                <h2 className="text-md font-sans font-black uppercase mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#007AFF]" />
                  Over-The-Air Parameter Simulation
                </h2>

                <div className="space-y-6">
                  {/* Platform Commission */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-slate-500" />
                        Platform Commission Rate (%)
                      </label>
                      <span className="text-[10px] font-mono font-bold bg-[#E8F1FF] text-[#007AFF] px-1.5 py-0.5 rounded-[4px]">
                        Active: {(config.platformCommissionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={localCommission}
                          onChange={(e) => setLocalCommission(e.target.value)}
                          min="0"
                          max="100"
                          className="w-full text-sm border border-slate-300 rounded-[6px] pl-3 pr-8 py-2 md:py-2.5 focus:border-black outline-none font-medium h-10"
                        />
                        <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-bold">%</span>
                      </div>
                      <div className="text-slate-400 text-xs font-bold font-mono">➡</div>
                      <div className="w-20 bg-slate-50 border border-slate-200 text-center py-2 rounded-[6px] text-xs font-black font-mono text-slate-600 h-10 flex items-center justify-center">
                        {(parseFloat(localCommission) || 0).toFixed(0)}%
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal font-sans">
                      The service commission deducted from gross driver fares on completions. (Instantly overrides payments QR rates and totals across active terminals).
                    </p>
                  </div>

                  {/* Driver Wait Limit */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-500" />
                        Driver Wait-Time Limit (Min)
                      </label>
                      <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-[4px]">
                        Active: {config.driverWaitTimeLimitMins} MINS
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={localWaitTime}
                          onChange={(e) => setLocalWaitTime(e.target.value)}
                          min="1"
                          max="60"
                          className="w-full text-sm border border-slate-300 rounded-[6px] pl-3 pr-12 py-2 md:py-2.5 focus:border-black outline-none font-medium h-10"
                        />
                        <span className="absolute right-3 top-2.5 text-slate-400 text-[10px] font-bold uppercase">MINS</span>
                      </div>
                      <div className="text-slate-400 text-xs font-bold font-mono">➡</div>
                      <div className="w-20 bg-slate-50 border border-slate-200 text-center py-2 rounded-[6px] text-xs font-black font-mono text-slate-600 h-10 flex items-center justify-center">
                        {parseInt(localWaitTime) || 0}m
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal font-sans">
                      Wait timer countdown before wait list transitions to paid waiting, and maximum limit before driver is eligible to cancel with abandonment platform charges.
                    </p>
                  </div>

                  {/* Emergency Surge Pricing Toggle */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex flex-col">
                        <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-[#FF3B30] fill-[#FF3B30]" />
                          Emergency Surge Pricing Action
                        </label>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-normal font-sans max-w-sm">
                          Forces platform-wide high demand pricing globally (e.g. 1.5x) to control dispatch capacity during catastrophic blackouts or weather emergencies.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded-[4px] ${config.emergencySurgePricingEnabled ? "bg-[#FFEFEB] text-[#FF3B30]" : "bg-slate-100 text-slate-400"}`}>
                          {config.emergencySurgePricingEnabled ? "ENABLED" : "DISABLED"}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => setLocalSurge(!localSurge)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${localSurge ? "bg-[#FF3B30]" : "bg-slate-200"}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSurge ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Submit button */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleApplySimOverrides}
                    className="px-5 py-2.5 bg-[#007AFF] text-white hover:bg-[#005EC2] text-xs font-bold uppercase rounded-[6px] shadow-[0_4px_12px_rgba(0,122,255,0.2)] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1"
                  >
                    Apply Simulator State
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>

            {/* Right Side Info Box */}
            <div className="flex flex-col gap-6">
              {/* Active Config HUD */}
              <div className="border border-black p-6 bg-white rounded-[8px]">
                <h3 className="text-sm font-sans font-black uppercase mb-4 text-[#007AFF] border-b border-light pb-2">
                  System Parameter HUD
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-[#F8F9FA] p-3 border border-slate-200 rounded-[6px]">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase">Commission</span>
                    <span className="font-mono text-sm font-black text-black">
                      {(config.platformCommissionRate * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-[#F8F9FA] p-3 border border-slate-200 rounded-[6px]">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase">Wait Limit</span>
                    <span className="font-mono text-sm font-black text-black">
                      {config.driverWaitTimeLimitMins} Mins
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-[#F8F9FA] p-3 border border-slate-200 rounded-[6px]">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase">Emergency Surge</span>
                    <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-[4px] ${config.emergencySurgePricingEnabled ? "bg-[#FFEFEB] text-[#FF3B30]" : "bg-slate-100 text-slate-500"}`}>
                      {config.emergencySurgePricingEnabled ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 text-[11px] text-slate-400 font-sans leading-relaxed">
                  The values shown here reflect the current parameters driving calculations under all active Passenger booking screens and Driver Terminals mock devices.
                </div>
              </div>

              {/* Developer Pro-Tip block */}
              <div className="border border-black p-6 bg-slate-900 border-white/20 text-white rounded-[8px]">
                <h3 className="text-xs uppercase font-mono font-black text-[#FFD60A] tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  Operator Console Guidance
                </h3>
                <p className="font-sans text-[11px] text-slate-300 leading-normal mb-3">
                  Firebase Remote Config variables can be altered instantaneously worldwide across all installed platforms.
                </p>
                <a 
                  href="https://console.firebase.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-mono text-[11px] font-bold text-[#FFD60A] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  Firebase Console
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

          </motion.div>
        )}

        {activeTab === "docs" && (
          <motion.div
            key="docs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="border border-black p-6 md:p-8 bg-white rounded-[8px]"
          >
            <h2 className="text-lg font-sans font-black uppercase mb-4 border-b pb-3 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#007AFF]" />
              Configuring Firebase Remote Config Variables
            </h2>

            <div className="space-y-6 text-slate-700 text-sm leading-relaxed max-w-4xl font-sans">
              <p>
                Follow these instructions to bind your actual Firebase Project variables so your marketing team can adjust values dynamically from the Firebase Web Console:
              </p>

              <div>
                <h3 className="text-sm font-sans font-black uppercase text-black mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-[11px] font-bold">1</span>
                  Create Remote Config Parameters in Firebase Console
                </h3>
                <p className="text-xs text-slate-500 mb-3 ml-7">
                  Log into your <span className="font-bold text-black">Firebase Console</span>, navigate to <span className="font-bold text-black">Release & Monitor ➡ Remote Config</span>, and configure the following parameters:
                </p>
                
                <div className="overflow-x-auto ml-7 border border-slate-200 rounded-lg">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 font-black text-black uppercase">Parameter Name</th>
                        <th className="p-3 font-black text-black uppercase">Data Type</th>
                        <th className="p-3 font-black text-black uppercase">Suggested Default</th>
                        <th className="p-3 font-black text-black uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3 font-mono font-bold text-black">platform_commission_rate</td>
                        <td className="p-3">Number</td>
                        <td className="p-3 font-mono">0.12</td>
                        <td className="p-3 text-slate-500">Represents the 12% platform fee configured automatically during checkout splits.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-black">driver_wait_time_limit_mins</td>
                        <td className="p-3">Number</td>
                        <td className="p-3 font-mono">5</td>
                        <td className="p-3 text-slate-500">Wait timeout limit before driver charge-abandonment policies trigger.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-black">emergency_surge_pricing_enabled</td>
                        <td className="p-3">Boolean</td>
                        <td className="p-3 font-mono">false</td>
                        <td className="p-3 text-slate-500">Forces a system-wide flat surge multiplier modifier across all zones.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-sans font-black uppercase text-black mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-[11px] font-bold">2</span>
                  Set Fetch Intervals
                </h3>
                <p className="text-xs text-slate-500 ml-7 leading-relaxed">
                  In development or simulation, variables fetch automatically every <span className="font-bold text-black">60 seconds</span>. In production environments, client apps automatically cache parameters for some duration (usually 1 up to 12 hours) to respect Google Firebase rate limits seamlessly.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-sans font-black uppercase text-black mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-[11px] font-bold">3</span>
                  Publish Over-The-Air Changes
                </h3>
                <p className="text-xs text-slate-500 ml-7 leading-relaxed">
                  After setting your custom parameter rules, click <span className="font-bold text-black font-semibold bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded">Publish changes</span> inside the Firebase web layout. All active mobile applications and web client widgets will update immediately on refresh!
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default GlobalSettings;
