import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, ShieldAlert, Zap, Megaphone, Cpu, Power, Settings2, 
  RefreshCw, CheckCircle2, AlertTriangle, Play, Sparkles, Send, 
  Copy, ExternalLink, HelpCircle, Eye, ShieldCheck, DollarSign, Clock, Filter, ArrowRight, Share2, Layers, UserPlus,
  ShoppingBag, Users, CloudLightning, FileText, AlertOctagon, ArrowUpRight, Search
} from "lucide-react";
import TraderOutreachAgent from "./TraderOutreachAgent";
import AdminMaterialsArbitrageTab from "./AdminMaterialsArbitrageTab";
import AdminTraderChurnTab from "./AdminTraderChurnTab";
import AdminDemandSurgeTab from "./AdminDemandSurgeTab";
import AdminAiAuditLogsTab from "./AdminAiAuditLogsTab";
import AdminFlashDealsAndAiAnalyticsTab from "./AdminFlashDealsAndAiAnalyticsTab";
import AdminSearchDemandTab from "./AdminSearchDemandTab";
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
  executeAgentAction,
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
  const [activeSubTab, setActiveSubTab] = useState<
    "toggles" | "outreach" | "materials_arbitrage" | "trader_churn" | "demand_surge" | "search_demand" |
    "finances" | "disputes" | "compliance" | "concierge" | "threats" | "campaigns" | "diagnostics" | "audit_logs" | "sentinel_analytics"
  >("outreach");
  
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
  const [executingDisputeId, setExecutingDisputeId] = useState<string | null>(null);
  const [executingComplianceId, setExecutingComplianceId] = useState<string | null>(null);

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
      leadConciergeEnabled: enable,
      traderOutreachAgentEnabled: enable,
      materialsArbitrageEnabled: enable,
      traderChurnPredictorEnabled: enable,
      demandSurgePredictorEnabled: enable
    };
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    setSaving(true);
    const success = await updateAiAgentSettings(updates);
    setSaving(false);

    if (success) {
      showNotice(`All 11 Autonomous AI Agents have been ${enable ? "ENABLED" : "DISABLED (Dormant)"}!`, "success");
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

      showNotice(`AI Agent Sweep Complete! Generated ${newCampaigns.length} campaigns, ${newThreats.length} security alerts, ${newDisputes.length} disputes, and ${newLeads.length} leads.`, "success");
    } catch (err) {
      console.error("Failed to run manual sweep:", err);
      showNotice("Failed to complete AI agent sweep", "error");
    } finally {
      setIsRunningScan(false);
    }
  };

  const handleExecuteDisputeSettlement = async (c: DisputeResolutionCase) => {
    setExecutingDisputeId(c.id);
    try {
      const res = await executeAgentAction(
        "EXECUTE_DISPUTE_SETTLEMENT",
        {
          disputeId: c.id,
          jobId: c.jobId,
          traderPayout: c.proposedSettlement.traderPayout,
          customerRefund: c.proposedSettlement.customerRefund,
          rationale: c.proposedSettlement.rationale
        },
        "DISPUTE_MEDIATOR_AGENT"
      );

      if (res.success) {
        showNotice(res.outcomeMessage, "success");
        setDisputes(prev => prev.filter(item => item.id !== c.id));
      } else {
        showNotice("Failed to execute dispute settlement", "error");
      }
    } catch (err) {
      showNotice("Error executing dispute payout", "error");
    } finally {
      setExecutingDisputeId(null);
    }
  };

  const handleDispatchComplianceJob = async (alert: ComplianceAuditAlert) => {
    setExecutingComplianceId(alert.id);
    try {
      const res = await executeAgentAction(
        "DISPATCH_COMPLIANCE_JOB",
        {
          alertId: alert.id,
          entityName: alert.entityName,
          issueType: alert.issueType,
          daysRemaining: alert.daysRemaining,
          recommendedAction: alert.recommendedAction
        },
        "COMPLIANCE_GUARDIAN_AGENT"
      );

      if (res.success) {
        showNotice(res.outcomeMessage, "success");
        setComplianceAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, autoActionTaken: true } : a));
      } else {
        showNotice("Failed to auto-dispatch compliance pro", "error");
      }
    } catch (err) {
      showNotice("Error auto-dispatching pro", "error");
    } finally {
      setExecutingComplianceId(null);
    }
  };

  if (loading || !settings) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-black text-center space-y-4 shadow-sm">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-800 mx-auto" />
        <h3 className="text-lg font-black text-slate-900">Loading AI Agent Ecosystem...</h3>
        <p className="text-xs text-slate-500 font-medium">Fetching settings from Firestore</p>
      </div>
    );
  }

  const anyAgentEnabled = Object.entries(settings).some(
    ([k, v]) => k.endsWith("Enabled") && v === true
  );

  return (
    <div className="space-y-6" id="admin-ai-agents-tab-root">
      {/* Toast Notice */}
      {statusNotice && (
        <div className={cn(
          "p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-4 duration-300",
          statusNotice.type === "success" && "bg-emerald-50 text-emerald-900 border-emerald-300",
          statusNotice.type === "error" && "bg-rose-50 text-rose-900 border-rose-300",
          statusNotice.type === "info" && "bg-indigo-50 text-indigo-900 border-indigo-300"
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
                  12 Specialized autonomous AI agents managing security, growth, materials arbitrage, churn, profile optimization, compliance, and dispute mediation.
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
          Master Toggles
        </button>

        <button
          onClick={() => setActiveSubTab("outreach")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "outreach" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <UserPlus className="w-4 h-4 text-indigo-400" />
          Trader Outreach CRM
        </button>

        <button
          onClick={() => setActiveSubTab("materials_arbitrage")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "materials_arbitrage" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShoppingBag className="w-4 h-4 text-emerald-500" />
          Materials Arbitrage
          <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
            New
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("trader_churn")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "trader_churn" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Users className="w-4 h-4 text-indigo-400" />
          Trader Churn Predictor
          <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
            New
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("demand_surge")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "demand_surge" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <CloudLightning className="w-4 h-4 text-sky-400" />
          Weather & Demand Surge
          <span className="bg-sky-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
            New
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("search_demand")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "search_demand" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Search className="w-4 h-4 text-amber-400" />
          Search Demand & Synonyms
          <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
            Live
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("disputes")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "disputes" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          Dispute Mediator
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
          onClick={() => setActiveSubTab("finances")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0",
            activeSubTab === "finances" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          Treasury Intelligence
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
        </button>

        <button
          onClick={() => setActiveSubTab("threats")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "threats" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Sentinel Security
        </button>

        <button
          onClick={() => setActiveSubTab("campaigns")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black relative shrink-0",
            activeSubTab === "campaigns" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Megaphone className="w-4 h-4 text-indigo-400" />
          Social Engine
        </button>

        <button
          onClick={() => setActiveSubTab("diagnostics")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0",
            activeSubTab === "diagnostics" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          Supply Gaps
        </button>

        <button
          onClick={() => setActiveSubTab("sentinel_analytics")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "sentinel_analytics" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Deals & AI Sentinel
          <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
            Live
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("audit_logs")}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-black shrink-0 relative",
            activeSubTab === "audit_logs" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          )}
        >
          <FileText className="w-4 h-4 text-slate-800" />
          Audit Trail
          <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
            Gov
          </span>
        </button>
      </div>

      {/* Outreach Agent SubTab */}
      {activeSubTab === "outreach" && (
        <TraderOutreachAgent />
      )}

      {/* Materials Arbitrage SubTab */}
      {activeSubTab === "materials_arbitrage" && (
        <AdminMaterialsArbitrageTab onShowNotice={showNotice} />
      )}

      {/* Trader Churn Predictor SubTab */}
      {activeSubTab === "trader_churn" && (
        <AdminTraderChurnTab users={users} onShowNotice={showNotice} />
      )}

      {/* Dynamic Weather & Demand Surge SubTab */}
      {activeSubTab === "demand_surge" && (
        <AdminDemandSurgeTab onShowNotice={showNotice} />
      )}

      {/* Search Demand Telemetry & Dynamic Synonyms SubTab */}
      {activeSubTab === "search_demand" && (
        <AdminSearchDemandTab />
      )}

      {/* Governance & Audit Logs SubTab */}
      {activeSubTab === "audit_logs" && (
        <AdminAiAuditLogsTab onShowNotice={showNotice} />
      )}

      {/* Deals & AI Sentinel Analytics SubTab */}
      {activeSubTab === "sentinel_analytics" && (
        <AdminFlashDealsAndAiAnalyticsTab />
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
                <p className="text-xs text-slate-400 font-medium">Enable or disable all 11 autonomous AI agents across the ecosystem with 1-click.</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => handleToggleAllAgents(true)}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all border border-black shadow-sm disabled:opacity-50"
              >
                Enable All 11 Agents
              </button>
              <button
                onClick={() => handleToggleAllAgents(false)}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-700 shadow-sm disabled:opacity-50"
              >
                Disable All (Dormant)
              </button>
            </div>
          </div>

          {/* Autonomous Execution Permissions */}
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <h4 className="font-black text-slate-900 text-base">Autonomous Execution & Closed-Loop Safeguards</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h5 className="font-black text-slate-900 text-xs">Auto-Execute Compliance Dispatches</h5>
                  <p className="text-[11px] text-slate-500">Autonomous Gas Safe & EICR pro dispatch on urgent SLA expirations (&lt;7 days).</p>
                </div>
                <button
                  onClick={() => handleToggleAgent("autoExecuteComplianceDispatches")}
                  className={cn(
                    "w-12 h-7 rounded-full p-1 transition-colors relative border border-black shrink-0",
                    settings.autoExecuteComplianceDispatches ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.autoExecuteComplianceDispatches ? 20 : 0 }}
                    className="w-5 h-5 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h5 className="font-black text-slate-900 text-xs">Auto-Execute Dispute Settlements</h5>
                  <p className="text-[11px] text-slate-500">Auto-split Stripe escrow payouts when both parties accept 1st-stage AI terms.</p>
                </div>
                <button
                  onClick={() => handleToggleAgent("autoExecuteDisputeSettlements")}
                  className={cn(
                    "w-12 h-7 rounded-full p-1 transition-colors relative border border-black shrink-0",
                    settings.autoExecuteDisputeSettlements ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.autoExecuteDisputeSettlements ? 20 : 0 }}
                    className="w-5 h-5 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Individual Agent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agent 1: Sentinel Security Guard */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Sentinel Security Guard</h3>
                    <p className="text-xs text-slate-500 font-medium">Sybil & Fraud Defense Engine</p>
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
                Autonomous threat detector actively scans user telemetry, disposable email domains, and suspicious IP velocities to quarantine fake accounts and fraudulent job postings.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.sentinelGuardEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.sentinelGuardEnabled ? "Active (Autonomous 2h Cron)" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 1B: AI Profile Optimization & Readiness Coach */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                    <Sparkles className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Profile Optimization Coach</h3>
                    <p className="text-xs text-slate-500 font-medium">Auto-Bio, Skill Parity & Readiness Engine</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("profileOptimizationCoachEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.profileOptimizationCoachEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.profileOptimizationCoachEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Audits trader and homeowner profiles for professional wording, missing search keywords, video selfie credentials, and Stripe/payout readiness, dispatching 1-click optimization alerts.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.profileOptimizationCoachEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.profileOptimizationCoachEnabled ? "Active (On Signup & 14-Day Audit)" : "OFF (Dormant)"}
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
                Analyzes live trade demand, top customer reviews, and emergency job spikes to automatically generate multi-channel social copy for Facebook, LinkedIn, X, and Instagram.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Mode:</span>
                <span className="font-black text-indigo-600 uppercase">1-Tap Approval & Webhook</span>
              </div>
            </div>

            {/* Agent 3: Materials Arbitrage Agent */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <ShoppingBag className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Materials Arbitrage Agent</h3>
                    <p className="text-xs text-slate-500 font-medium">Wholesale Merchant Price Arbitrage</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("materialsArbitrageEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.materialsArbitrageEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.materialsArbitrageEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Scours trade merchants (Screwfix, Travis Perkins, Toolstation, Selco) to detect wholesale price drops, saving tradespeople up to 28% on BOM material orders.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.materialsArbitrageEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.materialsArbitrageEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 4: Trader Churn Predictor */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Trader Churn Predictor</h3>
                    <p className="text-xs text-slate-500 font-medium">Contractor Retention & LTV Optimizer</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("traderChurnPredictorEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.traderChurnPredictorEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.traderChurnPredictorEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Identifies contractors showing signs of churning due to lost bids or high radius distances, prescribing targeted fee rebates and radius adjustments.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.traderChurnPredictorEnabled ? "text-emerald-600" : "text-slate-400")}>
                  {settings.traderChurnPredictorEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 5: Demand Surge Predictor */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200">
                    <CloudLightning className="w-6 h-6 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Weather & Demand Surge Predictor</h3>
                    <p className="text-xs text-slate-500 font-medium">Meteorological Emergency Pre-Alert Engine</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAgent("demandSurgePredictorEnabled")}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300 relative border border-black",
                    settings.demandSurgePredictorEnabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: settings.demandSurgePredictorEnabled ? 24 : 0 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Monitors sub-zero freezes, storm winds, and heatwaves to pre-alert on-call emergency plumbers and roofers, locking in rapid response times.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status:</span>
                <span className={cn("font-black uppercase tracking-wider", settings.demandSurgePredictorEnabled ? "text-sky-600" : "text-slate-400")}>
                  {settings.demandSurgePredictorEnabled ? "Active" : "OFF (Dormant)"}
                </span>
              </div>
            </div>

            {/* Agent 6: Compliance Guardian */}
            <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Compliance Guardian</h3>
                    <p className="text-xs text-slate-500 font-medium">Awaab's Law & CP12/EICR Auditor</p>
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
                  {settings.complianceGuardianEnabled ? "Active (Daily 04:00 Cron)" : "OFF (Dormant)"}
                </span>
              </div>
            </div>
          </div>
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
              {disputes.map((c) => {
                const isExecuting = executingDisputeId === c.id;

                return (
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
                          id={`execute-dispute-settlement-btn-${c.id}`}
                          onClick={() => handleExecuteDisputeSettlement(c)}
                          disabled={isExecuting}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold transition-all border border-black text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isExecuting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Processing Escrow Split...
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              ⚡ Execute 1-Click Escrow Settlement
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              {complianceAlerts.map((a) => {
                const isExecuting = executingComplianceId === a.id;

                return (
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
                        {a.autoActionTaken ? (
                          <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">
                            ✓ Pro Dispatched & SLA Clock Active
                          </span>
                        ) : (
                          <button
                            id={`dispatch-compliance-pro-btn-${a.id}`}
                            onClick={() => handleDispatchComplianceJob(a)}
                            disabled={isExecuting}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all border border-black text-xs shadow-sm flex items-center gap-1.5"
                          >
                            {isExecuting ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Dispatching Pro...
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5 text-amber-300" />
                                ⚡ 1-Click Auto-Dispatch Pro
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Financial Treasury SubTab */}
      {activeSubTab === "finances" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-lg">Financial Intelligence & Treasury Agent</h3>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300 uppercase">
                  Trade Platform Only
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Live monitoring of all TradeOS revenues, B2B Gotham SaaS licensing, Stripe fees, and cloud container running costs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setFinTimeframe(tf)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border border-black",
                    finTimeframe === tf ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {financials && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-black shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Incomings</span>
                <p className="text-2xl font-black text-emerald-600">£{(financials.totalRevenue ?? 0).toFixed(2)}</p>
                <span className="text-[10px] font-bold text-slate-400">Trade Subs & SaaS Doors</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-black shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Running Costs</span>
                <p className="text-2xl font-black text-rose-600">£{financials.totalOutgoings.toFixed(2)}</p>
                <span className="text-[10px] font-bold text-slate-400">Cloud Run & APIs</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-black shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Net Profit Margin</span>
                <p className="text-2xl font-black text-slate-900">£{financials.netProfit.toFixed(2)} ({financials.profitMarginPct.toFixed(1)}%)</p>
                <span className="text-[10px] font-bold text-emerald-700">Healthy Margin Yield</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Concierge SubTab */}
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
              Scan Lead Queue
            </button>
          </div>

          {leads.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-black shadow-sm text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-sky-500 mx-auto" />
              <h4 className="font-black text-slate-900 text-base">All Inbound Jobs Pre-Qualified</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                No raw un-structured homeowner job requests pending triage.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((l) => (
                <div key={l.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-black text-slate-900 text-sm">{l.category} Lead (#{l.jobId})</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Pre-Qualified
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{l.conciergeSummary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sentinel Threats SubTab */}
      {activeSubTab === "threats" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Sentinel Security Threat Logs
            </h3>
          </div>

          {threats.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-black shadow-sm">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">No Active Security Threats</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Platform registrations, IP velocity, and disposable domains are all within safe operational thresholds.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {threats.map((t) => (
                <div key={t.id} className="bg-white rounded-3xl p-5 border border-black shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-300">
                      {t.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(t.detectedAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{t.details}</p>
                  <p className="text-xs font-bold text-emerald-600">Action: {t.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Social Campaigns SubTab */}
      {activeSubTab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-600" />
              Real-Time Social Growth Campaigns
            </h3>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-black shadow-sm">
              <Megaphone className="w-12 h-12 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">No Draft Campaigns in Queue</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Trigger a manual sweep to generate fresh localized marketing posts.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-indigo-100 text-indigo-900 text-xs font-bold px-3 py-1 rounded-full border border-indigo-300">
                      {c.platform.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{c.headline}</h4>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{c.bodyText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diagnostics SubTab */}
      {activeSubTab === "diagnostics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Supply Gaps & Database Health
            </h3>
          </div>

          {diagnostics.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-black shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">All Telemetry Healthy</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active supply shortages or index errors detected.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {diagnostics.map((d) => (
                <div key={d.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
                      {d.category.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{d.title}</h4>
                  <p className="text-xs text-slate-600">{d.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
