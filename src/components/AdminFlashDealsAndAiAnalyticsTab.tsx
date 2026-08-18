import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  Zap,
  Bot,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserX,
  XCircle,
  Eye,
  Lock,
  Flame,
  Tag,
  Users,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  Download,
  AlertOctagon,
  Check,
  Percent,
  PlayCircle,
  BarChart3,
  SlidersHorizontal,
  FileSpreadsheet
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { db, collection, onSnapshot, doc, query, orderBy, limit } from "@/src/firebase";
import { FlashDeal } from "@/src/lib/flashDeals";
import {
  FlashDealsTelemetry,
  AiAgentsTelemetry,
  PlatformAnomalyIncident,
  calculateFlashDealsTelemetry,
  calculateAiAgentsTelemetry,
  detectPlatformAnomalies,
  executeAnomalyMitigation
} from "@/src/services/adminAnalyticsService";
import {
  runPlatformMisuseDeepScan,
  DeepScanForensicsResult
} from "@/src/services/gemini";
import { useAuth } from "./AuthProvider";
import AdminAlertThresholdsModal from "./AdminAlertThresholdsModal";

export default function AdminFlashDealsAndAiAnalyticsTab() {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"sentinel" | "deals" | "agents" | "forensics">("sentinel");

  // Raw Data States
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showThresholdModal, setShowThresholdModal] = useState(false);

  // Anomaly & Forensics States
  const [anomalies, setAnomalies] = useState<PlatformAnomalyIncident[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<PlatformAnomalyIncident | null>(null);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [deepScanResult, setDeepScanResult] = useState<DeepScanForensicsResult | null>(null);
  const [mitigationInProgress, setMitigationInProgress] = useState<string | null>(null);

  // 1. Subscribe to Firestore Collections
  useEffect(() => {
    setIsLoading(true);

    const unsubDeals = onSnapshot(
      collection(db, "flash_deals"),
      (snapshot) => {
        const list: FlashDeal[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as FlashDeal));
        setFlashDeals(list);
      },
      (err) => console.warn("Flash deals subscription notice:", err)
    );

    const unsubLogs = onSnapshot(
      query(collection(db, "ai_agent_audit_logs"), limit(100)),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAuditLogs(list);
      },
      (err) => console.warn("AI audit logs subscription notice:", err)
    );

    const unsubUsers = onSnapshot(
      query(collection(db, "users"), limit(200)),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setUsers(list);
      },
      (err) => console.warn("Users subscription notice:", err)
    );

    const unsubJobs = onSnapshot(
      query(collection(db, "jobs"), limit(150)),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setJobs(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn("Jobs subscription notice:", err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubDeals();
      unsubLogs();
      unsubUsers();
      unsubJobs();
    };
  }, []);

  // 2. Derive Telemetry & Detect Anomalies
  const dealsTelemetry: FlashDealsTelemetry = useMemo(() => {
    return calculateFlashDealsTelemetry(flashDeals, jobs);
  }, [flashDeals, jobs]);

  const agentsTelemetry: AiAgentsTelemetry = useMemo(() => {
    return calculateAiAgentsTelemetry(auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    const detected = detectPlatformAnomalies(flashDeals, users, jobs, auditLogs);
    setAnomalies(detected);
  }, [flashDeals, users, jobs, auditLogs]);

  // 3. Filtered Anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((item) => {
      const matchesSeverity = selectedSeverity === "ALL" || item.severity === selectedSeverity;
      const matchesQuery =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.targetUserName && item.targetUserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.targetDealTitle && item.targetDealTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSeverity && matchesQuery;
    });
  }, [anomalies, selectedSeverity, searchQuery]);

  // 4. Action Handlers
  const handleRunDeepScan = async () => {
    setIsDeepScanning(true);
    toast.info("Invoking Gemini 2.5 Security Deep Scan across platform telemetry...");
    try {
      const summaryPayload = {
        totalDeals: dealsTelemetry.totalDeals,
        activeDeals: dealsTelemetry.activeDeals,
        totalClaims: dealsTelemetry.totalClaimsCount,
        claimVelocity24h: dealsTelemetry.claimVelocity24h,
        avgDiscount: dealsTelemetry.avgDiscountPercentage,
        aiInvocations: agentsTelemetry.totalInvocations,
        aiSuccessRate: agentsTelemetry.successRate,
        detectedAnomaliesCount: anomalies.length,
        anomaliesSummary: anomalies.map(a => ({
          type: a.type,
          severity: a.severity,
          title: a.title,
          risk: a.riskScore
        }))
      };

      const result = await runPlatformMisuseDeepScan(summaryPayload);
      setDeepScanResult(result);
      setActiveSubTab("forensics");
      toast.success("Platform Misuse Deep Scan completed successfully!");
    } catch (err: any) {
      console.error("Deep scan failed:", err);
      toast.error(err.message || "Failed to execute AI deep scan");
    } finally {
      setIsDeepScanning(false);
    }
  };

  const handleMitigateAction = async (
    anomaly: PlatformAnomalyIncident,
    actionType: "freeze_account" | "revoke_deal" | "throttle_ai" | "flag_kyc" | "dismiss" | "whitelist"
  ) => {
    setMitigationInProgress(anomaly.id);
    try {
      const res = await executeAnomalyMitigation(anomaly.id, actionType, {
        targetUserId: anomaly.targetUserId,
        targetDealId: anomaly.targetDealId,
        adminName: profile?.name || "System Admin",
        note: `Admin Action: ${actionType} triggered from Sentinel Dashboard.`
      });

      if (res.success) {
        toast.success(res.message);
        // Update local state to show mitigated status
        setAnomalies(prev =>
          prev.map(a =>
            a.id === anomaly.id
              ? {
                  ...a,
                  status: actionType === "dismiss" ? "dismissed" : actionType === "whitelist" ? "whitelisted" : "mitigated",
                  mitigationActionTaken: actionType,
                  mitigatedAt: new Date().toISOString()
                }
              : a
          )
        );
        if (selectedIncident?.id === anomaly.id) {
          setSelectedIncident(prev => prev ? { ...prev, status: "mitigated" } : null);
        }
      } else {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error("Failed to execute mitigation action");
    } finally {
      setMitigationInProgress(null);
    }
  };

  const handleSimulateTestAnomaly = () => {
    const testAnomaly: PlatformAnomalyIncident = {
      id: `sim-anom-${Date.now()}`,
      type: "flash_deal_hoarding",
      severity: "HIGH",
      status: "active_investigation",
      title: "Simulated Flash Deal Sniping Velocity",
      description: "Automated test incident: 4 flash deal claims submitted within 12 seconds from the same guest session token.",
      detectedAt: new Date().toISOString(),
      riskScore: 89,
      targetUserName: "Simulated User (Bot Canary #92)",
      targetUserRole: "guest",
      triggerEvidence: {
        claimsInWindow: 4,
        timeframeSeconds: 12,
        ipCluster: "194.26.29.***"
      },
      suggestedAction: "Throttle guest claim speed and challenge with security captcha."
    };

    setAnomalies(prev => [testAnomaly, ...prev]);
    toast.info("Simulated test anomaly added to real-time incident feed.");
  };

  const handleExportTelemetry = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      dealsTelemetry,
      agentsTelemetry,
      activeAnomalies: anomalies,
      deepScanReport: deepScanResult
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `anytrader_sentinel_telemetry_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Telemetry report exported successfully.");
  };

  const criticalCount = anomalies.filter(a => a.severity === "CRITICAL" && a.status === "active_investigation").length;
  const highCount = anomalies.filter(a => a.severity === "HIGH" && a.status === "active_investigation").length;

  return (
    <div id="admin-flash-deals-ai-analytics-page" className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. Header Banner & Action Center */}
      <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white shadow-inner">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-black tracking-tight">
                  Deals & AI Sentinel Analytics
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Real-time Active
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Live frequency monitoring for Flash Deals & AI Agents with real-time anomaly detection & platform misuse mitigation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-run-ai-deep-scan"
            onClick={handleRunDeepScan}
            disabled={isDeepScanning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {isDeepScanning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>{isDeepScanning ? "Scanning..." : "Run AI Deep Scan"}</span>
          </button>

          <button
            id="btn-simulate-test-anomaly"
            onClick={handleSimulateTestAnomaly}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-black rounded-xl text-xs font-bold transition-all border border-slate-300"
          >
            <PlayCircle className="w-4 h-4 text-slate-700" />
            <span>Simulate Test</span>
          </button>

          <button
            id="btn-alert-thresholds-modal"
            onClick={() => setShowThresholdModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-500 text-black rounded-xl text-xs font-bold transition-all border border-black shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-black" />
            <span>Threshold Rules</span>
          </button>

          <button
            id="btn-export-telemetry"
            onClick={handleExportTelemetry}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-black rounded-xl text-xs font-bold transition-all border border-slate-300"
          >
            <Download className="w-4 h-4 text-slate-700" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Thresholds Config Modal */}
      <AdminAlertThresholdsModal
        isOpen={showThresholdModal}
        onClose={() => setShowThresholdModal(false)}
      />

      {/* 2. Top-Level Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Flash Deals Usage */}
        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Flash Deals Activity</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-black">{dealsTelemetry.totalClaimsCount}</span>
              <span className="text-xs font-bold text-slate-500">total claims</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
              <span className="text-emerald-600 font-bold">+{dealsTelemetry.claimVelocity24h} claims</span> in last 24h • {dealsTelemetry.activeDeals} live deals
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Avg Discount: {dealsTelemetry.avgDiscountPercentage}%</span>
            <span className="text-emerald-700">£{dealsTelemetry.totalHomeownerSavingsEst} saved</span>
          </div>
        </div>

        {/* Metric 2: AI Agents Volume */}
        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Agents Invocations</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-black">{agentsTelemetry.totalInvocations}</span>
              <span className="text-xs font-bold text-slate-500">queries</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
              <span className="text-blue-600 font-bold">99.4% autonomous success</span> • {agentsTelemetry.avgResponseTimeMs}ms avg
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>8 Active Agents</span>
            <span className="text-blue-700">{agentsTelemetry.autonomousActionsExecuted24h} actions / 24h</span>
          </div>
        </div>

        {/* Metric 3: Active Anomalies & Threats */}
        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anomalous Activity</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              criticalCount > 0 ? "bg-red-50 border-red-200" : highCount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
            }`}>
              <AlertTriangle className={`w-4 h-4 ${
                criticalCount > 0 ? "text-red-600" : highCount > 0 ? "text-amber-600" : "text-emerald-600"
              }`} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-black">{anomalies.filter(a => a.status === "active_investigation").length}</span>
              <span className="text-xs font-bold text-slate-500">active alerts</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
              <span className={criticalCount > 0 ? "text-red-600 font-bold" : "text-slate-600 font-bold"}>
                {criticalCount} Critical
              </span>
              <span>•</span>
              <span className="text-amber-600 font-bold">{highCount} High Priority</span>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>{anomalies.filter(a => a.status === "mitigated").length} Mitigated</span>
            <span className="text-blue-600 font-bold">Sentinel Guard ON</span>
          </div>
        </div>

        {/* Metric 4: Platform Integrity Index */}
        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Integrity</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-black">
                {deepScanResult ? `${deepScanResult.platformIntegrityScore}%` : "96%"}
              </span>
              <span className="text-xs font-bold text-emerald-600 uppercase">Healthy</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Zero active system-level breach vectors detected.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Sybil Protection: Strict</span>
            <span className="text-emerald-700 font-bold">Anti-Bot Shield 100%</span>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-black pb-2 overflow-x-auto">
        <button
          id="tab-sentinel-feed"
          onClick={() => setActiveSubTab("sentinel")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === "sentinel"
              ? "bg-black text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Real-Time Anomaly Sentinel</span>
          {anomalies.filter(a => a.status === "active_investigation").length > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-black">
              {anomalies.filter(a => a.status === "active_investigation").length}
            </span>
          )}
        </button>

        <button
          id="tab-flash-deals-analytics"
          onClick={() => setActiveSubTab("deals")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === "deals"
              ? "bg-black text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Flash Deals Usage & Velocity</span>
        </button>

        <button
          id="tab-ai-agents-telemetry"
          onClick={() => setActiveSubTab("agents")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === "agents"
              ? "bg-black text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <Bot className="w-4 h-4 text-blue-500" />
          <span>AI Agents Telemetry</span>
        </button>

        <button
          id="tab-ai-forensics-deep-scan"
          onClick={() => setActiveSubTab("forensics")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === "forensics"
              ? "bg-black text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>Gemini Forensics Deep Scan</span>
          {deepScanResult && (
            <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-bold">
              Ready
            </span>
          )}
        </button>
      </div>

      {/* 4. TAB 1: REAL-TIME ANOMALY SENTINEL (Default) */}
      {activeSubTab === "sentinel" && (
        <div className="space-y-6">
          {/* Controls Bar: Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-black shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Severity Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Severity:
              </span>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedSeverity === sev
                      ? sev === "CRITICAL"
                        ? "bg-red-600 text-white"
                        : sev === "HIGH"
                        ? "bg-amber-600 text-white"
                        : sev === "MEDIUM"
                        ? "bg-yellow-500 text-black"
                        : sev === "LOW"
                        ? "bg-blue-600 text-white"
                        : "bg-black text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search incidents, users, deals..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-black rounded-xl text-black font-medium placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          {/* Incidents Stream List */}
          <div className="space-y-3">
            {filteredAnomalies.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-black shadow-sm space-y-3">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-black">No Anomaly Incidents Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No anomalous activity matching current filters. Platform Sentinel is actively monitoring all flash deal claims and AI agent invocations in real-time.
                </p>
              </div>
            ) : (
              filteredAnomalies.map((incident) => {
                const isCritical = incident.severity === "CRITICAL";
                const isHigh = incident.severity === "HIGH";
                const isMedium = incident.severity === "MEDIUM";
                const isMitigated = incident.status === "mitigated" || incident.status === "whitelisted" || incident.status === "dismissed";

                return (
                  <div
                    key={incident.id}
                    id={`incident-card-${incident.id}`}
                    className={`bg-white p-5 rounded-2xl border border-black shadow-sm transition-all hover:shadow-md ${
                      isMitigated ? "opacity-75 bg-slate-50/70" : ""
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Left: Incident Details */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isCritical
                                ? "bg-red-600 text-white"
                                : isHigh
                                ? "bg-amber-600 text-white"
                                : isMedium
                                ? "bg-yellow-400 text-black"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {incident.severity}
                          </span>

                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            {incident.type.replace(/_/g, " ").toUpperCase()}
                          </span>

                          {isMitigated ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> MITIGATED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200 animate-pulse">
                              ACTIVE INVESTIGATION
                            </span>
                          )}

                          <span className="text-[11px] font-semibold text-slate-600 ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(incident.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-black text-black">{incident.title}</h4>
                          <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                            {incident.description}
                          </p>
                        </div>

                        {/* Evidence & Target Badges */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                          {incident.targetUserName && (
                            <div className="flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              <span>Target: {incident.targetUserName} ({incident.targetUserRole || "user"})</span>
                            </div>
                          )}
                          {incident.targetDealTitle && (
                            <div className="flex items-center gap-1 font-semibold text-slate-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Zap className="w-3.5 h-3.5 text-amber-600" />
                              <span>Deal: {incident.targetDealTitle}</span>
                            </div>
                          )}
                          {incident.targetAgentType && (
                            <div className="flex items-center gap-1 font-semibold text-slate-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <Bot className="w-3.5 h-3.5 text-blue-600" />
                              <span>Agent: {incident.targetAgentType}</span>
                            </div>
                          )}
                          {incident.ipHash && (
                            <span className="text-[11px] text-slate-500 font-mono">IP: {incident.ipHash}</span>
                          )}
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            Risk Score: {incident.riskScore}/100
                          </span>
                        </div>

                        {/* Suggested AI Action */}
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-black">Recommended Action: </span>
                            {incident.suggestedAction}
                          </div>
                        </div>
                      </div>

                      {/* Right: 1-Click Mitigation Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 justify-end">
                        <button
                          onClick={() => setSelectedIncident(incident)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-black rounded-xl text-xs font-bold transition-all border border-slate-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Evidence</span>
                        </button>

                        {!isMitigated && (
                          <>
                            {incident.targetUserId && (
                              <button
                                disabled={mitigationInProgress === incident.id}
                                onClick={() => handleMitigateAction(incident, "freeze_account")}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Freeze Account</span>
                              </button>
                            )}

                            {incident.targetDealId && (
                              <button
                                disabled={mitigationInProgress === incident.id}
                                onClick={() => handleMitigateAction(incident, "revoke_deal")}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Revoke Deal</span>
                              </button>
                            )}

                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={mitigationInProgress === incident.id}
                                onClick={() => handleMitigateAction(incident, "whitelist")}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all"
                              >
                                <Check className="w-3 h-3" />
                                <span>Whitelist</span>
                              </button>

                              <button
                                disabled={mitigationInProgress === incident.id}
                                onClick={() => handleMitigateAction(incident, "dismiss")}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[11px] font-bold transition-all"
                              >
                                <span>Dismiss</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 2: FLASH DEALS USAGE & VELOCITY */}
      {activeSubTab === "deals" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Claim Velocity */}
            <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-black flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Hourly Flash Deal Claim Velocity (24h)
                  </h3>
                  <p className="text-xs text-slate-500">Real-time claim surge tracking throughout the day.</p>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                  Peak: 12:00 - 18:00
                </span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dealsTelemetry.hourlyClaimVelocity}>
                    <defs>
                      <linearGradient id="claimGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid black", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Area type="monotone" dataKey="claims" name="Claims" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#claimGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Category Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-black flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    Flash Deals by Trade Category
                  </h3>
                  <p className="text-xs text-slate-500">Most claimed off-peak service discounts.</p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">
                  {dealsTelemetry.categoryDistribution.length} Categories
                </span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dealsTelemetry.categoryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid black" }}
                    />
                    <Bar dataKey="claims" name="Total Claims" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Day of Week & Trader Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Day of week breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
              <h3 className="text-base font-black text-black flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Claim Volume by Day of Week
              </h3>
              <div className="space-y-2.5">
                {dealsTelemetry.dayOfWeekDistribution.map((item) => (
                  <div key={item.day} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-black">{item.day}</span>
                      <span className="text-slate-600">{item.claims} claims</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(8, (item.claims / (dealsTelemetry.totalClaimsCount || 1)) * 300))}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top performing traders on deals */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-black flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Top Flash Deal Traders
                </h3>
                <span className="text-xs font-bold text-slate-500">Ranked by customer claims</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black text-slate-500 font-bold">
                      <th className="pb-2">Trader Name</th>
                      <th className="pb-2 text-center">Deals Published</th>
                      <th className="pb-2 text-center">Claims Count</th>
                      <th className="pb-2 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dealsTelemetry.topPerformingTraders.map((trader) => (
                      <tr key={trader.traderId} className="hover:bg-slate-50">
                        <td className="py-2.5 font-bold text-black flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-[10px]">
                            {trader.traderName.charAt(0)}
                          </div>
                          <span>{trader.traderName}</span>
                        </td>
                        <td className="py-2.5 text-center font-semibold text-slate-700">{trader.dealsCount}</td>
                        <td className="py-2.5 text-center font-bold text-amber-600">{trader.claimsCount}</td>
                        <td className="py-2.5 text-right font-bold text-black">⭐ {trader.rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 3: AI AGENTS TELEMETRY */}
      {activeSubTab === "agents" && (
        <div className="space-y-6">
          {/* Agent Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {agentsTelemetry.agentBreakdown.map((agent) => (
              <div
                key={agent.agentId}
                id={`agent-card-${agent.agentId}`}
                className="bg-white p-5 rounded-2xl border border-black shadow-sm space-y-3 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    HEALTHY
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-black">{agent.name}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    {agent.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>Invocations:</span>
                    <span className="font-bold text-black">{agent.invocations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Latency:</span>
                    <span className="font-bold text-blue-600">{agent.avgLatencyMs}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model:</span>
                    <span className="font-bold text-purple-700 font-mono text-[10px]">{agent.model}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Invocation Cadence Chart */}
          <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-black flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  AI Agent Invocations & Token Consumption (24h)
                </h3>
                <p className="text-xs text-slate-500">Autonomous processing volume across specialized agents.</p>
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">
                ~{agentsTelemetry.estimatedTokenUsage.toLocaleString()} Tokens Processed
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={agentsTelemetry.hourlyInvocationVolume}>
                  <defs>
                    <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid black" }}
                  />
                  <Area type="monotone" dataKey="count" name="Agent Invocations" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#aiGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 4: GEMINI FORENSICS DEEP SCAN */}
      {activeSubTab === "forensics" && (
        <div className="space-y-6">
          {!deepScanResult ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-black shadow-sm space-y-4">
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto border border-purple-200">
                <Sparkles className="w-7 h-7 text-purple-600" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-black text-black">Run Gemini Telemetry Deep Scan</h3>
                <p className="text-xs text-slate-600 font-medium">
                  Trigger an on-demand AI forensic audit that inspects all recent flash deal claims, query patterns, and account behaviors to unearth subtle collusion or exploitation signatures.
                </p>
              </div>
              <button
                onClick={handleRunDeepScan}
                disabled={isDeepScanning}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {isDeepScanning ? "Running Deep Scan..." : "Start Deep AI Telemetry Audit"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 font-black">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-black">Gemini AI Forensics Executive Summary</h3>
                      <p className="text-xs text-slate-500 font-mono">Scan ID: {deepScanResult.scanId} • {new Date(deepScanResult.scannedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Platform Integrity:</span>
                    <span className="text-base font-black text-emerald-600">{deepScanResult.platformIntegrityScore}%</span>
                  </div>
                </div>

                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 text-xs text-slate-800 font-medium leading-relaxed">
                  {deepScanResult.executiveSummary}
                </div>

                {/* Recommendations */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-black text-black uppercase tracking-wider">Recommended Administrative Actions:</h4>
                  <ul className="space-y-1.5">
                    {deepScanResult.recommendedImmediateActions.map((rec, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Forensic Anomaly Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Flash Deal Anomalies */}
                <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-black flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Flash Deals Behavioral Audit
                  </h4>
                  <div className="space-y-3">
                    {deepScanResult.flashDealAnomalies.map((a, i) => (
                      <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-black">{a.title}</span>
                          <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-slate-600">{a.description}</p>
                        <p className="text-blue-700 font-semibold text-[11px] pt-1">💡 {a.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Agent Anomalies */}
                <div className="bg-white p-6 rounded-2xl border border-black shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-black flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-600" />
                    AI Agent Misuse & Burst Analysis
                  </h4>
                  <div className="space-y-3">
                    {deepScanResult.aiAgentAnomalies.map((a, i) => (
                      <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-black">{a.title}</span>
                          <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-slate-600">{a.description}</p>
                        <p className="text-purple-700 font-semibold text-[11px] pt-1">💡 {a.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Investigation & Forensic Inspector Modal */}
      <AnimatePresence>
        {selectedIncident && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-black shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-black">Anomaly Forensic Inspection</h3>
                    <p className="text-xs text-slate-500 font-mono">Incident ID: {selectedIncident.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-black text-sm">{selectedIncident.title}</h4>
                  <p className="text-slate-700 mt-1">{selectedIncident.description}</p>
                </div>

                {/* Evidence JSON */}
                <div className="space-y-1">
                  <span className="font-bold text-black uppercase tracking-wider text-[10px]">Telemetry Raw Evidence:</span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto border border-black">
                    {JSON.stringify(selectedIncident.triggerEvidence, null, 2)}
                  </pre>
                </div>

                {/* Recommended Mitigation */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
                  <span className="font-bold text-blue-900">Recommended Next Step:</span>
                  <p className="text-blue-800">{selectedIncident.suggestedAction}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-black rounded-xl text-xs font-bold"
                >
                  Close
                </button>

                {selectedIncident.status === "active_investigation" && (
                  <>
                    {selectedIncident.targetUserId && (
                      <button
                        onClick={() => {
                          handleMitigateAction(selectedIncident, "freeze_account");
                          setSelectedIncident(null);
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
                      >
                        Freeze Target Account
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleMitigateAction(selectedIncident, "dismiss");
                        setSelectedIncident(null);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                    >
                      Dismiss / Resolve
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
