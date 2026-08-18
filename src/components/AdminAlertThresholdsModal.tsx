import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldAlert, Settings, X, Save, RefreshCw, Bell, Volume2, 
  VolumeX, Mail, CheckCircle2, AlertTriangle, Zap, Shield, HelpCircle,
  Sliders, ArrowUpRight, Flame, Send
} from "lucide-react";
import { 
  ThresholdRuleConfig, 
  DEFAULT_THRESHOLD_RULES, 
  getAdminAlertThresholdRules, 
  saveAdminAlertThresholdRules,
  triggerTestBreachAlert,
  ActiveBreachAlert
} from "../services/adminAlertThresholdService";
import { cn } from "@/src/lib/utils";

interface AdminAlertThresholdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestBreachTriggered?: (breach: ActiveBreachAlert) => void;
}

export default function AdminAlertThresholdsModal({
  isOpen,
  onClose,
  onTestBreachTriggered
}: AdminAlertThresholdsModalProps) {
  const [rules, setRules] = useState<ThresholdRuleConfig>(DEFAULT_THRESHOLD_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [testTestingType, setTestTestingType] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const remoteRules = await getAdminAlertThresholdRules();
      setRules(remoteRules);
    } catch (err) {
      console.warn("Failed to load rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await saveAdminAlertThresholdRules(rules);
      if (res.success) {
        setStatusMessage({ text: "Alert threshold rules saved successfully!", type: "success" });
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage({ text: res.message, type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = (type: "multiple_profile_creations" | "rapid_api_usage" | "deals_misuse") => {
    setTestTestingType(type);
    try {
      const breach = triggerTestBreachAlert(type, (b) => {
        if (onTestBreachTriggered) {
          onTestBreachTriggered(b);
        }
      }, rules.adminAlertEmail);

      setStatusMessage({ 
        text: `Triggered ${breach.severity} test alert. Dispatched toast & email notification.`, 
        type: "success" 
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      console.warn("Test breach error:", err);
    } finally {
      setTimeout(() => setTestTestingType(null), 800);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl border-2 border-black shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-black">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 rounded-2xl text-slate-950 font-black">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Real-Time Alert Rules & Misuse Thresholds
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                Configure automated Firestore threshold monitors, toast notifications, and email alerting parameters.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-2xl text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50 flex-1">
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5",
                statusMessage.type === "success" 
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-rose-50 text-rose-900 border-rose-300"
              )}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </motion.div>
          )}

          {/* Section 1: Notification Channels */}
          <div className="bg-white rounded-2xl border border-black p-5 space-y-4 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              1. Alert Dispatch Channels
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Toast Toggle */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    In-App Toast Alerts
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Show interactive popup toasts in Admin
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.enableToastAlerts}
                  onChange={(e) => setRules({ ...rules, enableToastAlerts: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* Audio Chime Toggle */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                    Audio Warning Chime
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Synthesize audible pulse on alert
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.enableAudioChime}
                  onChange={(e) => setRules({ ...rules, enableAudioChime: e.target.checked })}
                  className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                />
              </div>

              {/* Email Alerts Toggle */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-rose-600" />
                    Automated Email Alerts
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Dispatch immediate incident report
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.enableEmailAlerts}
                  onChange={(e) => setRules({ ...rules, enableEmailAlerts: e.target.checked })}
                  className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              {/* Email Severity Filter */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="text-xs font-black text-slate-900">
                  Email Minimum Severity
                </div>
                <select
                  value={rules.minSeverityForEmail}
                  onChange={(e) => setRules({ ...rules, minSeverityForEmail: e.target.value as any })}
                  className="w-full text-xs font-bold bg-white border border-black rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none"
                >
                  <option value="ALL">All Alerts (Low, Medium, High, Critical)</option>
                  <option value="HIGH_AND_CRITICAL">High & Critical Only (Recommended)</option>
                  <option value="CRITICAL_ONLY">Critical Breaches Only</option>
                </select>
              </div>
            </div>

            {/* Email Recipient Input */}
            <div className="pt-2">
              <label className="block text-xs font-black text-slate-900 mb-1">
                Admin Notification Recipient Email:
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={rules.adminAlertEmail}
                  onChange={(e) => setRules({ ...rules, adminAlertEmail: e.target.value })}
                  placeholder="admin@anytrader.co.uk"
                  className="flex-1 text-xs font-bold bg-slate-50 border border-black rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Threshold Parameters */}
          <div className="bg-white rounded-2xl border border-black p-5 space-y-4 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-600" />
              2. Real-Time Activity Threshold Limits
            </h4>

            <div className="space-y-4">
              {/* Profile Creations Threshold */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-900">
                  <span>Max Profile Creations (in 15 min sliding window)</span>
                  <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg font-mono">
                    {rules.maxRegistrationsPer15m} accounts
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={rules.maxRegistrationsPer15m}
                  onChange={(e) => setRules({ ...rules, maxRegistrationsPer15m: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Triggers CRITICAL breach if account creations exceed this threshold within 15 minutes.
                </p>
              </div>

              {/* AI Invocations Rate Threshold */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-900">
                  <span>Max AI Invocations / API Invocations (in 60 seconds)</span>
                  <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg font-mono">
                    {rules.maxAiInvocationsPerMin} queries / min
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={rules.maxAiInvocationsPerMin}
                  onChange={(e) => setRules({ ...rules, maxAiInvocationsPerMin: Number(e.target.value) })}
                  className="w-full accent-purple-600"
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Detects prompt scraping loops, token exhaustion bursts, and high-frequency automated tools.
                </p>
              </div>

              {/* Flash Deals Creation & Discount Depth Thresholds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-900">
                    <span>Max Deals Created / Trader (in 1 hr)</span>
                    <span className="bg-slate-900 text-white px-2 py-0.5 rounded-lg font-mono">
                      {rules.maxFlashDealsPerHour} deals
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rules.maxFlashDealsPerHour}
                    onChange={(e) => setRules({ ...rules, maxFlashDealsPerHour: Number(e.target.value) })}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-900">
                    <span>Max Discount Flag Ceiling (%)</span>
                    <span className="bg-slate-900 text-white px-2 py-0.5 rounded-lg font-mono">
                      {rules.maxDiscountPercentageThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={rules.maxDiscountPercentageThreshold}
                    onChange={(e) => setRules({ ...rules, maxDiscountPercentageThreshold: Number(e.target.value) })}
                    className="w-full accent-rose-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Live Test Trigger Suite */}
          <div className="bg-white rounded-2xl border border-black p-5 space-y-3 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              3. Verification & Live Alert Simulation
            </h4>
            <p className="text-xs text-slate-600 font-medium">
              Click any button below to simulate an immediate threshold violation and verify your audio chime, toast notification, and email alert pipeline.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                onClick={() => handleRunTest("multiple_profile_creations")}
                disabled={testTestingType !== null}
                className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-900 font-black rounded-xl text-xs border border-rose-300 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                Test Multi-Account Spike
              </button>

              <button
                onClick={() => handleRunTest("rapid_api_usage")}
                disabled={testTestingType !== null}
                className="px-3 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-black rounded-xl text-xs border border-purple-300 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-purple-600" />
                Test AI API Burst
              </button>

              <button
                onClick={() => handleRunTest("deals_misuse")}
                disabled={testTestingType !== null}
                className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-black rounded-xl text-xs border border-amber-300 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Test Flash Deal Misuse
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-black flex items-center justify-between">
          <button
            onClick={() => setRules(DEFAULT_THRESHOLD_RULES)}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Reset to Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all border border-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving Rules..." : "Save Threshold Rules"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
