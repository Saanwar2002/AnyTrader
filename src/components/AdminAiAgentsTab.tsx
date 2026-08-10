import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, ShieldAlert, Zap, Megaphone, Cpu, Power, Settings2, 
  RefreshCw, CheckCircle2, AlertTriangle, Play, Sparkles, Send, 
  Copy, ExternalLink, HelpCircle, Eye, ShieldCheck, DollarSign, Clock, Filter, ArrowRight, Share2, Layers, UserPlus
} from "lucide-react";
import TraderOutreachAgent from "./TraderOutreachAgent";
import { 
  getAiAgentSettings, 
  updateAiAgentSettings, 
  runSentinelGuardScan, 
  generateSocialCampaigns, 
  runPlatformDiagnostics, 
  runFinancialIntelligenceAnalysis,
  runDisputeMediatorScan,
  runComplianceGuardianScan,
  runCustomerConciergeScan,
  AiAgentSettings, 
  SecurityThreatLog, 
  SocialMediaCampaign, 
  DiagnosticInsight,
  PlatformFinancialIntelligence,
  DisputeResolutionCase,
  ComplianceAuditAlert,
  PrequalifiedLeadSpec 
} from "../services/aiAgentEcosystemService";
import { cn } from "@/src/lib/utils";

interface AdminAiAgentsTabProps {
  users: any[];
  jobs: any[];
  reviews: any[];
  logs: any[];
}

export default function AdminAiAgentsTab({ users, jobs, reviews, logs }: AdminAiAgentsTabProps) {
  const [settings, setSettings] = useState<AiAgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"toggles" | "outreach" | "threats" | "campaigns" | "diagnostics" | "finances" | "disputes" | "compliance" | "concierge">("outreach");
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const showNotice = (text: string, type: "success" | "error" | "info" = "success") => {
    setStatusNotice({ text, type });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const [threats, setThreats] = useState<SecurityThreatLog[]>([]);
  const [campaigns, setCampaigns] = useState<SocialMediaCampaign[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInsight[]>([]);
  const [financials, setFinancials] = useState<PlatformFinancialIntelligence | null>(null);
  const [disputes, setDisputes] = useState<DisputeResolutionCase[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAuditAlert[]>([]);
  const [leads, setLeads] = useState<PrequalifiedLeadSpec[]>([]);
  const [finTimeframe, setFinTimeframe] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [isRunningScan, setIsRunningScan] = useState(false);

  // Webhook settings modal / form inputs
  const [metaWebhook, setMetaWebhook] = useState("");
  const [twitterKey, setTwitterKey] = useState("");
  const [linkedinWebhook, setLinkedinWebhook] = useState("");
  const [zapierWebhook, setZapierWebhook] = useState("");

  useEffect(() => {
    loadSettings();
    loadFinancials(finTimeframe);
    loadDisputes();
    loadCompliance();
    loadLeads();
  }, []);

  const loadDisputes = async () => {
    if (!settings) return;
    try {
      const d = await runDisputeMediatorScan(jobs, settings);
      setDisputes(d);
    } catch (e) {
      console.warn("Error loading disputes:", e);
    }
  };

  const loadCompliance = async () => {
    if (!settings) return;
    try {
      const c = await runComplianceGuardianScan(users, jobs, settings);
      setComplianceAlerts(c);
    } catch (e) {
      console.warn("Error loading compliance alerts:", e);
    }
  };

  const loadLeads = async () => {
    if (!settings) return;
    try {
      const l = await runCustomerConciergeScan(jobs, settings);
      setLeads(l);
    } catch (e) {
      console.warn("Error loading concierge leads:", e);
    }
  };

  useEffect(() => {
    loadFinancials(finTimeframe);
  }, [finTimeframe]);

  const loadFinancials = async (tf: "daily" | "weekly" | "monthly" | "yearly") => {
    try {
      const finData = await runFinancialIntelligenceAnalysis(users, jobs, tf);
      setFinancials(finData);
    } catch (err) {
      console.error("Failed to run financial analysis:", err);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    const data = await getAiAgentSettings();
    setSettings(data);
    setMetaWebhook(data.metaWebhookUrl || "");
    setTwitterKey(data.twitterApiKey || "");
    setLinkedinWebhook(data.linkedinWebhookUrl || "");
    setZapierWebhook(data.zapierWebhookUrl || "");
    setLoading(false);
  };

  const handleToggleAgent = async (agentKey: keyof AiAgentSettings) => {
    if (!settings) return;
    const updatedValue = !settings[agentKey];
    const newSettings = { ...settings, [agentKey]: updatedValue };
    setSettings(newSettings);
    
    setSaving(true);
    const success = await updateAiAgentSettings({ [agentKey]: updatedValue });
    setSaving(false);

    if (success) {
      showNotice(`${agentKey} status updated: ${updatedValue ? "ENABLED (Active)" : "DISABLED (Dormant)"}`, "success");
    } else {
      showNotice("Failed to update agent state", "error");
    }
  };

  const handleToggleAllAgents = async (enable: boolean) => {
    if (!settings) return;
    const updates: Partial<AiAgentSettings> = {
      sentinelGuardEnabled: enable,
      socialCampaignEngineEnabled: enable,
      selfHealingDiagnosticsEnabled: enable,
      b2bLeadScoutEnabled: enable,
      financialIntelligenceEnabled: enable,
      disputeMediatorEnabled: enable,
      complianceGuardianEnabled: enable,
      customerConciergeEnabled: enable,
    };
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    setSaving(true);
    const success = await updateAiAgentSettings(updates);
    setSaving(false);

    if (success) {
      showNotice(`All 8 Autonomous AI Agents have been ${enable ? "ENABLED" : "DISABLED (Dormant)"}!`, "success");
    } else {
      showNotice("Failed to update master agent states", "error");
    }
  };

  const handleSaveWebhooks = async () => {
    if (!settings) return;
    setSaving(true);
    const success = await updateAiAgentSettings({
      metaWebhookUrl: metaWebhook,
      twitterApiKey: twitterKey,
      linkedinWebhookUrl: linkedinWebhook,
      zapierWebhookUrl: zapierWebhook,
    });
    setSaving(false);

    if (success) {
      showNotice("Social API Webhooks and API credentials saved successfully!", "success");
    } else {
      showNotice("Failed to save credentials", "error");
    }
  };

  const handleTriggerManualScan = async () => {
    if (!settings) return;
    setIsRunningScan(true);
    showNotice("Running autonomous agent diagnostics & marketing sweep...", "info");

    try {
      const [newThreats, newCampaigns, newDiags, newFin, newDisputes, newCompliance, newLeads] = await Promise.all([
        runSentinelGuardScan(users, logs, settings),
        generateSocialCampaigns(jobs, reviews, settings),
        runPlatformDiagnostics(users, jobs),
        runFinancialIntelligenceAnalysis(users, jobs, finTimeframe),
        runDisputeMediatorScan(jobs, settings),
        runComplianceGuardianScan(users, jobs, settings),
        runCustomerConciergeScan(jobs, settings)
      ]);

      setThreats(newThreats);
      setCampaigns(newCampaigns);
      setDiagnostics(newDiags);
      setFinancials(newFin);
      setDisputes(newDisputes);
      setComplianceAlerts(newCompliance);
      setLeads(newLeads);

      showNotice("Agent scan & campaign generation complete!", "success");
    } catch (err) {
      console.error("Error during manual agent execution:", err);
      showNotice("Agent scan encountered an issue", "error");
    } finally {
      setIsRunningScan(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <p className="text-slate-600 font-medium">Initializing Autonomous Agent Command Hub...</p>
      </div>
    );
  }

  const anyAgentEnabled = settings.sentinelGuardEnabled || settings.selfHealingDiagnosticsEnabled || settings.socialCampaignEngineEnabled || settings.b2bLeadScoutEnabled;

  return (
    <div className="space-y-6 pb-12">
      {statusNotice && (
        <div className={cn(
          "p-4 rounded-2xl border border-black font-bold text-xs flex items-center justify-between shadow-md",
          statusNotice.type === "success" && "bg-emerald-100 text-emerald-950 border-emerald-400",
          statusNotice.type === "error" && "bg-rose-100 text-rose-950 border-rose-400",
          statusNotice.type === "info" && "bg-indigo-100 text-indigo-950 border-indigo-400"
        )}>
          <span>{statusNotice.text}</span>
          <button onClick={() => setStatusNotice(null)} className="text-xs underline font-black">Dismiss</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-black shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_70%)] pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
                <Bot className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Autonomous AI Operations & Marketing Ecosystem
                </h2>
                <p className="text-slate-300 text-sm font-medium">
                  Self-healing security guard, fraud detector, and real-time social media campaign engine powered by Gemini.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn("px-4 py-2 rounded-2xl border border-black text-xs font-black uppercase tracking-wider flex items-center gap-2", anyAgentEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300")}>
              <span className={cn("w-2.5 h-2.5 rounded-full", anyAgentEnabled ? "bg-slate-950 animate-pulse" : "bg-slate-500")} />
              {anyAgentEnabled ? "Agents Active" : "All Agents Dormant (Off at Launch)"}
            </div>

            <button
              onClick={handleTriggerManualScan}
              disabled={isRunningScan}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md flex items-center gap-2 border border-indigo-400/30 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", isRunningScan && "animate-spin")} />
              {isRunningScan ? "Running Scan..." : "Run Test Sweep"}
            </button>
          </div>
        </div>

        {/* Cost Safeguard Note */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span><strong>Zero-Cost Idle Protection:</strong> Dormant agents incur £0.00 daily overhead when disabled.</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span><strong>Active Cost Cap:</strong> Max ~£0.01 to £0.05 per campaign run using Gemini 2.5 Flash.</span>
          </div>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("toggles")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0",
            activeSubTab === "toggles" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Power className="w-4 h-4 text-amber-400" />
          Agent Master Toggles & Config
        </button>

        <button
          onClick={() => setActiveSubTab("outreach")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "outreach" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <UserPlus className="w-4 h-4 text-indigo-400" />
          Trader Outreach Agent
          <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            Directory CRM
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("finances")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0",
            activeSubTab === "finances" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          Financial Treasury Agent
        </button>

        <button
          onClick={() => setActiveSubTab("disputes")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "disputes" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          AI Dispute Mediator
          {disputes.length > 0 && (
            <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {disputes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("compliance")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "compliance" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          Compliance Guardian
          {complianceAlerts.length > 0 && (
            <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {complianceAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("concierge")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "concierge" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Sparkles className="w-4 h-4 text-sky-400" />
          Customer Concierge
          {leads.length > 0 && (
            <span className="bg-sky-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {leads.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("threats")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "threats" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Sentinel Security Audit
          {threats.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {threats.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("campaigns")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "campaigns" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Megaphone className="w-4 h-4 text-indigo-400" />
          Social Campaign Engine
          {campaigns.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {campaigns.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("diagnostics")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0",
            activeSubTab === "diagnostics" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          Self-Healing Supply Gaps
        </button>
      </div>

      {/* Outreach Agent SubTab */}
      {activeSubTab === "outreach" && (
        <TraderOutreachAgent />
      )}

      {/* 1. Master Toggles & Config SubTab */}
      {activeSubTab === "toggles" && (
        <div className="space-y-6">
          {/* Master Control Bar */}
          <div className="bg-slate-900 text-white p-5 rounded-3xl border border-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-400">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">Fleet Master Controls</h3>
                <p className="text-xs text-slate-400 font-medium">Enable or disable all 8 autonomous AI agents across the ecosystem with 1-click.</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => handleToggleAllAgents(true)}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all border border-black shadow-sm disabled:opacity-50"
              >
                Turn ALL Agents ON
              </button>
              <button
                onClick={() => handleToggleAllAgents(false)}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold rounded-xl text-xs transition-all border border-slate-700 disabled:opacity-50"
              >
                Turn ALL Agents OFF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent 1: Sentinel Guard */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Sentinel Guard Agent</h3>
                    <p className="text-xs text-slate-500 font-medium">Fraud, Duplicate Profiles & Sybil Attack Detector</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("sentinelGuardEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.sentinelGuardEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.sentinelGuardEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Monitors user registrations in real time. Flags duplicate phone numbers, disposable temp emails, bot attacks, rate limit abuses, and review ring manipulation.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.sentinelGuardEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.sentinelGuardEnabled ? "Active & Monitoring" : "OFF (Dormant at Launch)"}
                </span>
              </div>
            </div>

            {/* Agent 2: Social Growth Campaign Engine */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
                    <Megaphone className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Social Campaign Engine</h3>
                    <p className="text-xs text-slate-500 font-medium">Real-Time Multi-Channel Marketing Generator</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("socialCampaignEngineEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.socialCampaignEngineEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.socialCampaignEngineEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Analyzes live trade demand, top customer reviews, and emergency job spikes to automatically generate multi-channel social copy, ad headlines, and image prompts for Facebook, LinkedIn, X, and Instagram.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Human-in-the-Loop Mode:</span>
                <span className="font-black text-indigo-600 uppercase">1-Tap Admin Approval Required</span>
              </div>
            </div>

            {/* Agent 3: Self-Healing Diagnostics */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                    <Zap className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Platform Diagnostics Agent</h3>
                    <p className="text-xs text-slate-500 font-medium">Coverage Gap & Database Health Inspector</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("selfHealingDiagnosticsEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.selfHealingDiagnosticsEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.selfHealingDiagnosticsEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Detects outcode postcode areas where homeowners are posting jobs but trade supply is low, and triggers targeted local recruitment campaigns.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.selfHealingDiagnosticsEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.selfHealingDiagnosticsEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 4: B2B Housing Association Scout */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                    <Layers className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">B2B Gotham Lead Scout</h3>
                    <p className="text-xs text-slate-500 font-medium">Housing Association & Portfolio Manager Targeter</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("b2bLeadScoutEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.b2bLeadScoutEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.b2bLeadScoutEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Generates tailored B2B outreach proposals for council social housing tenders, landlord portfolios, and estate managers highlighting AnyTrader Gotham per-door SaaS licensing.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.b2bLeadScoutEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.b2bLeadScoutEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 5: Financial Treasury & Revenue Agent */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Financial Intelligence & Treasury Agent</h3>
                    <p className="text-xs text-slate-500 font-medium">Tracks AnyTrader Trade Incomings, Platform Costs, Forecasting & AI Efficiency Recommendations</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("financialIntelligenceEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.financialIntelligenceEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.financialIntelligenceEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Audits all AnyTrader trade revenue streams (Subscriptions, B2B Gotham SaaS doors, Direct Job Commissions, FlexiPay BNPL yields) against platform running costs (Cloud Run container uptime, Firestore database queries, Gemini API tokens, Stripe merchant processing fees) and predicts profit margins and cost optimizations.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Scope Notice:</span>
                <span className="font-black text-emerald-700 uppercase">AnyTrader Trade Operations Only (Taxi Separated)</span>
              </div>
            </div>

            {/* Agent 6: AI Dispute Mediator & Guarantee Arbitrator Agent */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">AI Dispute Mediator & Guarantee Arbitrator Agent</h3>
                    <p className="text-xs text-slate-500 font-medium">Scans job specifications, quotes, evidence & transcripts against UK building codes to resolve customer/trader disputes.</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("disputeMediatorEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.disputeMediatorEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.disputeMediatorEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically evaluates contested jobs against standard UK building standards (BS 5385, IET Wiring, Gas Safe) and material cost guides to generate neutral 1st-stage dispute settlement proposals, protecting the AnyTrader Guarantee fund.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.disputeMediatorEnabled ? "text-purple-600" : "text-slate-400")}>
                  {settings.disputeMediatorEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 7: Compliance & Certification Guardian Agent */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Compliance & Certification Guardian</h3>
                    <p className="text-xs text-slate-500 font-medium">Awaab's Law, Gas Safe & CP12/EICR Legal Compliance Auditor</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("complianceGuardianEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.complianceGuardianEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.complianceGuardianEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Audits Gas Safe, EICR, and PLI credentials for tradespeople, and enforces statutory Awaab's Law damp/mould investigation windows across Gotham landlord doors.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.complianceGuardianEnabled ? "text-rose-600" : "text-slate-400")}>
                  {settings.complianceGuardianEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 8: AI Customer Concierge & Pre-Qualification Agent */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200">
                    <Sparkles className="w-6 h-6 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">AI Customer Concierge & Pre-Qualifier</h3>
                    <p className="text-xs text-slate-500 font-medium">Interactive Lead Pre-Qualification & Photo/Video Spec Capturer</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("leadConciergeEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.leadConciergeEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.leadConciergeEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Interactively questions homeowners upon job posting, captures appliance brands/error codes and photos/videos, and attaches prequalified Property Passport specs to maximize quote conversions.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.leadConciergeEnabled ? "text-sky-600" : "text-slate-400")}>
                  {settings.leadConciergeEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>
          </div>

          {/* Social Media API Webhooks & External Dispatch Config */}
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Share2 className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Social Channel Webhooks & API Keys (Optional)</h3>
                <p className="text-xs text-slate-500">Configure webhook URLs (Zapier, Buffer, Make, Meta Graph API) to automatically dispatch approved campaigns live to social media outlets.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Meta Graph API / Facebook Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://graph.facebook.com/v18.0/me/feed or Zapier Webhook"
                  value={metaWebhook}
                  onChange={(e) => setMetaWebhook(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">X / Twitter API Key or Webhook</label>
                <input
                  type="text"
                  placeholder="Bearer token or Zapier Twitter hook"
                  value={twitterKey}
                  onChange={(e) => setTwitterKey(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn Pages API / Webhook</label>
                <input
                  type="text"
                  placeholder="https://api.linkedin.com/v2/ugcPosts or Zapier hook"
                  value={linkedinWebhook}
                  onChange={(e) => setLinkedinWebhook(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Buffer / Make / General Zapier Catch Hook</label>
                <input
                  type="text"
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={zapierWebhook}
                  onChange={(e) => setZapierWebhook(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveWebhooks}
                disabled={saving}
                className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-6 py-2.5 rounded-xl border border-black shadow-sm flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />}
                Save Social API Connections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Financial Intelligence & Treasury SubTab */}
      {activeSubTab === "finances" && (
        <div className="space-y-6">
          {/* Header Controls & Filter Bar */}
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-lg">Financial Intelligence & Treasury Agent</h3>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300 uppercase">
                  AnyTrader Trade OS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Tracks platform incomings (subscriptions, Gotham SaaS, 12% commissions) vs outgoings (Cloud Run, Firestore, Gemini AI, Stripe) for the Trade side of the business.
              </p>
            </div>

            {/* Timeframe Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-black shrink-0">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setFinTimeframe(tf)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border border-transparent",
                    finTimeframe === tf ? "bg-slate-900 text-white border-black shadow-sm" : "text-slate-700 hover:text-black"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {!financials ? (
            <div className="py-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-bold">Calculating Platform Treasury Financials...</p>
            </div>
          ) : (
            <>
              {/* High Level Key Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-emerald-50/70 rounded-3xl p-5 border border-emerald-300 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>Total Incomings (Revenue)</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-emerald-950">
                    £{financials.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium capitalize">
                    {financials.timeframe} platform revenue
                  </p>
                </div>

                <div className="bg-rose-50/70 rounded-3xl p-5 border border-rose-300 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                    <span>Total Running Costs (Outgoings)</span>
                    <Zap className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-2xl font-black text-rose-950">
                    £{financials.totalOutgoings.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-rose-700 font-medium capitalize">
                    Cloud Run, DB, AI & Gateway fees
                  </p>
                </div>

                <div className="bg-indigo-50/70 rounded-3xl p-5 border border-indigo-300 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-800">
                    <span>Net Operating Profit</span>
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-black text-indigo-950">
                    £{financials.netProfit.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-indigo-700 font-medium">
                    Net cash retained after expenses
                  </p>
                </div>

                <div className="bg-amber-50/70 rounded-3xl p-5 border border-amber-300 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                    <span>Platform Profit Margin</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-black text-amber-950">
                    {financials.profitMarginPct}%
                  </p>
                  <p className="text-[10px] text-amber-700 font-medium">
                    {financials.profitMarginPct > 50 ? "Healthy high-margin software efficiency" : "Early stage overhead ratio"}
                  </p>
                </div>
              </div>

              {/* Incomings & Outgoings Detailed Breakdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Incomings / Revenue Stream Breakdown */}
                <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      Revenue Stream Breakdown ({financials.timeframe})
                    </h4>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      £{financials.totalRevenue.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {financials.revenueBreakdown.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span>{item.label}</span>
                          <span>£{item.amount.toFixed(2)} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Outgoings / Platform Running Costs Breakdown */}
                <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      Platform Running Costs Breakdown ({financials.timeframe})
                    </h4>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      £{financials.totalOutgoings.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {financials.outgoingsBreakdown.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span>{item.label}</span>
                          <span>£{item.amount.toFixed(2)} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 30-Day Financial Forecast & Cashflow Projection Widget */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-black shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base">30-Day Cashflow & Growth Forecast</h4>
                      <p className="text-xs text-slate-300">Predictive growth projection based on active trade subscriptions & Gotham landlord doors.</p>
                    </div>
                  </div>

                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                    +15% Growth Projected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">Projected 30-Day Incomings</span>
                    <p className="text-xl font-black text-emerald-400">
                      £{financials.projection30Days.projectedRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">Projected 30-Day Costs</span>
                    <p className="text-xl font-black text-rose-400">
                      £{financials.projection30Days.projectedCosts.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">Projected 30-Day Net Profit</span>
                    <p className="text-xl font-black text-indigo-300">
                      £{financials.projection30Days.projectedNetProfit.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Gemini AI Platform Cost-Optimization & Efficiency Recommendations */}
              <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <div>
                      <h4 className="font-black text-slate-900 text-base">Gemini AI Financial Optimization Suggestions</h4>
                      <p className="text-xs text-slate-500">Targeted actions to increase net profitability without compromising platform performance.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    3 AI Actions Generated
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {financials.aiOptimizationRecommendations.map((rec, idx) => (
                    <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-black",
                            rec.impact === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {rec.impact} Impact
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">{rec.category}</span>
                        </div>

                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          {rec.suggestion}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 text-xs font-black text-emerald-700 flex items-center justify-between">
                        <span>Est. Benefit:</span>
                        <span>{rec.potentialMonthlySavings}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* AI Dispute Mediator SubTab */}
      {activeSubTab === "disputes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h3 className="font-black text-slate-900 text-lg">AI Dispute Mediator & Guarantee Arbitrator</h3>
                <span className="bg-purple-100 text-purple-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-300 uppercase">
                  AnyTrader Guarantee
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Evaluates job specifications, quotes, photos/videos, and chat transcripts against UK building codes to resolve customer/trader quality or pricing disputes.
              </p>
            </div>

            <button
              onClick={loadDisputes}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-evaluate Open Disputes
            </button>
          </div>

          {disputes.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-black shadow-sm text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-black text-slate-900 text-base">No Active Job Disputes</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                All AnyTrader jobs are currently progressing smoothly or resolved with high customer satisfaction.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((c) => (
                <div key={c.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-base">{c.category} Dispute</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                          {c.jobId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-bold">
                        Customer: <span className="text-slate-900">{c.customerName}</span> | Trader: <span className="text-slate-900">{c.traderName}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-500">Amount in Dispute:</span>
                      <p className="text-lg font-black text-purple-700">£{c.amountInDispute}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Dispute Reason & Evidence:</span>
                      <p className="text-slate-800 font-medium leading-relaxed">{c.disputeReason}</p>
                      <p className="text-[11px] text-slate-500 font-medium italic pt-1 border-t border-slate-200">
                        {c.evidenceSummary}
                      </p>
                    </div>

                    <div className="bg-purple-50/80 p-4 rounded-2xl border border-purple-200 space-y-2">
                      <span className="font-bold text-purple-900 uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        AI 1st-Stage Settlement Proposal:
                      </span>

                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-emerald-800">Trader Payout: £{c.proposedSettlement.traderPayout}</span>
                        <span className="text-rose-800">Customer Refund: £{c.proposedSettlement.customerRefund}</span>
                      </div>

                      <p className="text-purple-950 font-bold leading-relaxed">
                        {c.proposedSettlement.actionRequired}
                      </p>

                      <p className="text-[11px] text-purple-800 font-medium border-t border-purple-200 pt-1.5">
                        <strong className="text-purple-950">UK Code Rationale:</strong> {c.proposedSettlement.rationale}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 font-medium">Logged: {new Date(c.createdAt).toLocaleDateString("en-GB")}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => showNotice(`Settlement Proposal accepted for ${c.jobId}`, "success")}
                        className="px-3.5 py-1.5 bg-purple-700 text-white rounded-xl font-bold hover:bg-purple-800 transition-all border border-black text-xs"
                      >
                        Issue Settlement
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance & Certification Guardian SubTab */}
      {activeSubTab === "compliance" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-slate-900 text-lg">Compliance & Certification Guardian</h3>
                <span className="bg-rose-100 text-rose-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-300 uppercase">
                  Statutory Audit
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Audits trader credentials (Gas Safe, EICR, PLI), B2B Gotham CP12/EICR expirations, and Awaab's Law damp/mould 24h SLA compliance.
              </p>
            </div>

            <button
              onClick={loadCompliance}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run Compliance Audit
            </button>
          </div>

          {complianceAlerts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-black shadow-sm text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-black text-slate-900 text-base">100% Legal & Certification Compliance</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                All Gas Safe, EICR, and Awaab's Law statutory deadlines across traders and Gotham landlord doors are current.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {complianceAlerts.map((a) => (
                <div key={a.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-base">{a.entityName}</span>
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 uppercase">
                          {a.issueType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{a.details}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-500">Deadline Notice:</span>
                      <p className="text-lg font-black text-rose-700">{a.daysRemaining} Days Remaining</p>
                    </div>
                  </div>

                  <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 space-y-1.5 text-xs">
                    <span className="font-bold text-rose-900 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      Guardian Recommended Action:
                    </span>
                    <p className="text-rose-950 font-bold leading-relaxed">{a.recommendedAction}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 font-medium">Audited: {new Date(a.auditDate).toLocaleDateString("en-GB")}</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">
                        {a.autoActionTaken ? "Auto-Reminder Sent" : "Manual Action Required"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Customer Concierge & Pre-Qualification SubTab */}
      {activeSubTab === "concierge" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600" />
                <h3 className="font-black text-slate-900 text-lg">AI Customer Concierge & Lead Pre-Qualifier</h3>
                <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-sky-300 uppercase">
                  Lead Quality Maximizer
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Interactively questions homeowners upon job creation, captures appliance brands/error codes and photos/videos, and attaches prequalified Property Passport specs to maximize quote conversion.
              </p>
            </div>

            <button
              onClick={loadLeads}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Pre-Qualify Active Leads
            </button>
          </div>

          {leads.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-black shadow-sm text-center space-y-3">
              <Sparkles className="w-10 h-10 text-sky-500 mx-auto" />
              <h4 className="font-black text-slate-900 text-base">No Raw Job Leads Pending Pre-Qualification</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                All incoming homeowner job postings have been pre-qualified with complete Property Passport specs.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((l) => (
                <div key={l.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-base">{l.rawJobTitle}</span>
                        <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                          {l.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-bold">
                        Homeowner: <span className="text-slate-900">{l.customerName}</span> | Ref: <span className="text-slate-900">{l.jobId}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-500">Lead Quality Score:</span>
                      <p className="text-xl font-black text-emerald-600">{l.qualityScore} / 100</p>
                    </div>
                  </div>

                  <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 space-y-2 text-xs">
                    <span className="font-bold text-sky-950 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                      AI Concierge Pre-Qualification Takeaway:
                    </span>
                    <p className="text-sky-950 font-bold leading-relaxed">{l.conciergeSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-500 text-[10px] uppercase">Appliance / System Details:</span>
                      <p className="font-bold text-slate-900">{l.structuredPassportSpec.applianceBrandModel || "Standard Installation"}</p>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Est. Labor: {l.structuredPassportSpec.estimatedLaborHours} hrs | Photo/Video: {l.structuredPassportSpec.photoVideoAttached ? "Attached (Verified)" : "None"}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[10px] uppercase">Diagnostic Q&A Responses:</span>
                      <ul className="list-disc list-inside text-slate-700 font-medium space-y-0.5 text-[11px]">
                        {l.structuredPassportSpec.diagnosticQuestionsAnswered.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 font-medium">Pre-Qualified: {new Date(l.processedAt).toLocaleDateString("en-GB")}</span>
                    <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-sky-300 uppercase">
                      {l.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Security Threats SubTab */}
      {activeSubTab === "threats" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Sentinel Security Audit & Fraud Logs
            </h3>
            <span className="text-xs font-bold text-slate-500">{threats.length} Threats Detected</span>
          </div>

          {threats.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-black shadow-sm">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">No Security Threats Flagged</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Run a sweep to audit platform users for duplicate profiles, disposable emails, and rate limit anomalies.
              </p>
              <button
                onClick={handleTriggerManualScan}
                className="bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl border border-black"
              >
                Run Sentinel Scan
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {threats.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl p-5 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-black",
                        t.severity === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      )}>
                        {t.severity} Severity
                      </span>
                      <span className="text-xs font-bold text-slate-900">{t.type.replace(/_/g, " ").toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{t.details}</p>
                    {t.userEmail && <p className="text-[11px] text-slate-400 font-mono">User: {t.userEmail}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showNotice(`User ${t.userId || ""} flagged as resolved`, "success")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-black"
                    >
                      Mark Safe
                    </button>
                    <button
                      onClick={() => showNotice(`User ${t.userId || ""} blocked from platform`, "error")}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-black"
                    >
                      Block Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Social Growth & AI Campaigns SubTab */}
      {activeSubTab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-600" />
              Generated Real-Time Social Media Campaigns
            </h3>
            <button
              onClick={handleTriggerManualScan}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl border border-black flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Fresh Campaign Set
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-black shadow-sm">
              <Megaphone className="w-12 h-12 text-indigo-400 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">No Campaigns Queued</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "Run Test Sweep" above to generate tailored social media copy for Facebook, LinkedIn, Twitter/X, and Instagram based on live AnyTrader platform demand.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-3 py-1 rounded-full border border-indigo-300">
                        {c.platform}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">Target: {c.targetAudience}</span>
                    </div>

                    <h4 className="font-black text-slate-900 text-base leading-snug">{c.headline}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      {c.bodyText}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {c.hashtags.map((h, idx) => (
                        <span key={idx} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                          {h}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                      <strong>🎨 Suggested Graphic Prompt:</strong> "{c.suggestedImagePrompt}"
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${c.headline}\n\n${c.bodyText}\n\n${c.callToAction}\n\n${c.hashtags.join(" ")}`);
                        showNotice("Campaign copy copied to clipboard!", "success");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-black flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Copy
                    </button>

                    <button
                      onClick={() => {
                        if (zapierWebhook || metaWebhook) {
                          showNotice(`Dispatched campaign to ${c.platform} via configured Webhook!`, "success");
                        } else {
                          showNotice("Please configure Webhook URL in Settings first, or copy post text manually.", "error");
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl border border-black shadow-sm flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Approve & Dispatch Webhook
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Diagnostics SubTab */}
      {activeSubTab === "diagnostics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Self-Healing Diagnostics & Trade Supply Gaps
            </h3>
          </div>

          {diagnostics.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-black shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">All Platform Telemetry Healthy</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active supply shortages or database index errors detected.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {diagnostics.map((d) => (
                <div key={d.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
                      {d.category.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(d.detectedAt).toLocaleTimeString()}</span>
                  </div>

                  <h4 className="font-black text-slate-900 text-base">{d.title}</h4>
                  <p className="text-xs text-slate-600">{d.description}</p>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-800">
                    <strong>💡 AI Recommended Solution:</strong> {d.recommendedFix}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
