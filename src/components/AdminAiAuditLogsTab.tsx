import React, { useState, useEffect } from "react";
import { 
  FileText, RefreshCw, Filter, CheckCircle2, AlertTriangle, Clock, 
  Calendar, ShieldCheck, Zap, Bot, ArrowRight, Sparkles, Terminal
} from "lucide-react";
import { 
  AiAgentAuditLogEntry, 
  getAiAgentAuditLogs 
} from "../services/aiAgentEcosystemService";
import { cn } from "@/src/lib/utils";

interface AdminAiAuditLogsTabProps {
  onShowNotice?: (text: string, type?: "success" | "error" | "info") => void;
}

export default function AdminAiAuditLogsTab({ onShowNotice }: AdminAiAuditLogsTabProps) {
  const [logs, setLogs] = useState<AiAgentAuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AiAgentAuditLogEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAiAgentAuditLogs();
      setLogs(data || []);
    } catch (err) {
      console.warn("Failed to fetch audit logs:", err);
      onShowNotice?.("Failed to fetch audit logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (selectedAgent !== "all" && !log.agentType.toLowerCase().includes(selectedAgent.toLowerCase())) {
      return false;
    }
    if (selectedSource !== "all" && log.triggerSource !== selectedSource) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6" id="admin-ai-audit-logs-root">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-xl text-white">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">AI Governance & Autonomous Audit Trail</h3>
            <span className="bg-slate-100 text-slate-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-slate-300 uppercase">
              Immutable Governance Log
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Real-time chronological record of all autonomous background cron executions, Sentinel security mitigations, 1-Click dispute resolutions, and automated compliance dispatches.
          </p>
        </div>

        <button
          id="refresh-audit-logs-btn"
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Refreshing..." : "Refresh Audit Trail"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-black shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700">Filter Agent:</span>
            <select
              id="filter-agent-select"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
            >
              <option value="all">All AI Agents</option>
              <option value="compliance">Compliance Guardian</option>
              <option value="sentinel">Sentinel Threat Guard</option>
              <option value="dispute">Dispute Mediator</option>
              <option value="materials">Materials Arbitrage</option>
              <option value="churn">Trader Churn Predictor</option>
              <option value="demand">Demand Surge Predictor</option>
              <option value="social">Social Campaign Engine</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Trigger Source:</span>
            <select
              id="filter-source-select"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
            >
              <option value="all">All Trigger Sources</option>
              <option value="autonomous_cron">🤖 Autonomous Cron (Background)</option>
              <option value="admin_one_click">⚡ Admin 1-Click Action</option>
              <option value="admin_portal">🖥️ Admin Portal Scan</option>
            </select>
          </div>
        </div>

        <span className="font-bold text-slate-500">
          Showing <strong>{filteredLogs.length}</strong> of {logs.length} logged events
        </span>
      </div>

      {/* Audit Log Table / Feed */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-black shadow-sm text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="font-black text-slate-900 text-base">No Audit Records Found</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No matching AI governance actions for the selected filters.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className="bg-white rounded-2xl p-5 border border-black shadow-sm space-y-3 transition-all hover:border-indigo-400"
              id={`audit-log-${log.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {log.id}
                  </span>

                  <span className="font-black text-slate-900 text-xs uppercase tracking-wide">
                    {log.agentType.replace(/_/g, " ")}
                  </span>

                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {log.action}
                  </span>

                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase border",
                    log.triggerSource === "autonomous_cron" ? "bg-purple-50 text-purple-800 border-purple-200" :
                    log.triggerSource === "admin_one_click" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-200"
                  )}>
                    {log.triggerSource.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono">{new Date(log.timestamp).toLocaleString("en-GB")}</span>
                </div>
              </div>

              <div className="text-xs text-slate-700 font-medium leading-relaxed">
                {log.details}
              </div>

              {log.summary && log.summary !== log.details && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span><strong>Summary:</strong> {log.summary}</span>
                </div>
              )}

              {log.payload && Object.keys(log.payload).length > 0 && (
                <details className="text-[11px] text-slate-500 pt-1">
                  <summary className="cursor-pointer font-bold hover:text-slate-800 flex items-center gap-1">
                    <Terminal className="w-3 h-3" /> View Execution Payload & Telemetry
                  </summary>
                  <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl mt-2 overflow-x-auto font-mono text-[10px] border border-black">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
