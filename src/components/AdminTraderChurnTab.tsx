import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Users, RefreshCw, Sparkles, AlertTriangle, CheckCircle2, ShieldCheck, 
  Percent, ArrowUpRight, Award, Zap, Mail, MessageSquare, MapPin, DollarSign
} from "lucide-react";
import { 
  TraderChurnRiskProfile, 
  runTraderChurnPredictorScan, 
  executeAgentAction 
} from "../services/aiAgentEcosystemService";
import { cn } from "@/src/lib/utils";

interface AdminTraderChurnTabProps {
  users?: any[];
  onShowNotice?: (text: string, type?: "success" | "error" | "info") => void;
}

export default function AdminTraderChurnTab({ users = [], onShowNotice }: AdminTraderChurnTabProps) {
  const [profiles, setProfiles] = useState<TraderChurnRiskProfile[]>([]);
  const [healthScore, setHealthScore] = useState<number>(78);
  const [highRiskCount, setHighRiskCount] = useState<number>(2);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const fetchChurnAnalysis = async () => {
    setLoading(true);
    try {
      const data = await runTraderChurnPredictorScan(users);
      setProfiles(data.profiles || []);
      setHealthScore(data.overallRetentionHealthScore || 78);
      setHighRiskCount(data.highRiskCount || 0);
      setSummary(data.recommendedInterventionSummary || "");
    } catch (err) {
      console.warn("Failed to fetch trader churn data:", err);
      onShowNotice?.("Failed to run trader churn analysis", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChurnAnalysis();
  }, []);

  const handleApplyRetentionIncentive = async (profile: TraderChurnRiskProfile) => {
    setExecutingId(profile.id);
    try {
      const res = await executeAgentAction(
        "APPLY_TRADER_RETENTION_INCENTIVE",
        {
          traderId: profile.id,
          traderName: profile.traderName,
          actionType: profile.prescribedRetentionAction.actionType,
          title: profile.prescribedRetentionAction.title,
          discountCode: profile.prescribedRetentionAction.discountCode,
          probability: profile.prescribedRetentionAction.estimatedRetentionProbability
        },
        "TRADER_CHURN_PREDICTOR_AGENT"
      );

      if (res.success) {
        setAppliedIds(prev => new Set(prev).add(profile.id));
        onShowNotice?.(res.outcomeMessage, "success");
      } else {
        onShowNotice?.("Failed to apply retention incentive", "error");
      }
    } catch (err) {
      onShowNotice?.("Error applying retention action", "error");
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="space-y-6" id="admin-trader-churn-root">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-700">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">AI Trader Churn & Retention Predictor</h3>
            <span className="bg-indigo-100 text-indigo-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-300 uppercase">
              Contractor Lifetime Value Protection
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Analyzes quote submission activity, bid loss patterns, win rate drops, and engagement lag across active tradespeople to prescribe automated retention fee rebates, instant alerts, and radius optimizations.
          </p>
        </div>

        <button
          id="churn-rescan-btn"
          onClick={fetchChurnAnalysis}
          disabled={loading}
          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Analyzing Activity..." : "Run Churn Scan"}
        </button>
      </div>

      {/* Health Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-black shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Network Retention Score</span>
            <p className="text-2xl font-black text-slate-900">{healthScore} / 100</p>
            <span className="text-[10px] font-bold text-emerald-700">✓ Healthy Trade Engagement</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-black shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">At-Risk Contractors</span>
            <p className="text-2xl font-black text-rose-600">{highRiskCount} Tradespeople</p>
            <span className="text-[10px] font-bold text-rose-700">Requires Proactive Intervention</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-black shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Est. Commission Protected</span>
            <p className="text-2xl font-black text-indigo-600">£420.00 / mo</p>
            <span className="text-[10px] font-bold text-indigo-700">Recoverable GMV</span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
            <DollarSign className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* AI Strategy Summary */}
      {summary && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-black shadow-lg space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h4 className="font-black text-white text-base">Gemini Retention Prescription & Intervention Strategy</h4>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            {summary}
          </p>
        </div>
      )}

      {/* Churn Risk Profiles */}
      <div className="space-y-4">
        {profiles.map((profile) => {
          const isApplied = appliedIds.has(profile.id);
          const isExecuting = executingId === profile.id;

          return (
            <div key={profile.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4" id={`churn-profile-${profile.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-base">{profile.traderName}</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {profile.tradeCategory}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {profile.cityLocation}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Days Inactive: <strong className="text-rose-600 font-bold">{profile.daysSinceLastQuote} days</strong></span>
                    <span>•</span>
                    <span>Win Rate: <strong className="text-slate-900 font-bold">{profile.quoteWinRatePct}%</strong></span>
                    <span>•</span>
                    <span>Quotes (Last 30d): <strong className="text-slate-900 font-bold">{profile.quotesSubmittedLast30Days}</strong></span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={cn(
                    "text-xs font-black px-3 py-1 rounded-full uppercase border border-black",
                    profile.riskLevel === "critical" ? "bg-rose-100 text-rose-800" :
                    profile.riskLevel === "high" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                  )}>
                    {profile.riskLevel} Churn Risk
                  </span>
                </div>
              </div>

              {/* Diagnosis and Prescription Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Identified Churn Drivers & Bid Friction:
                  </span>
                  <ul className="space-y-1.5 text-slate-700">
                    {profile.churnDrivers.map((driver, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{driver}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        AI Prescribed Retention Offer:
                      </span>
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {profile.prescribedRetentionAction.estimatedRetentionProbability} Success Probability
                      </span>
                    </div>

                    <h5 className="font-black text-slate-900 text-xs">
                      {profile.prescribedRetentionAction.title}
                    </h5>

                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {profile.prescribedRetentionAction.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-indigo-200 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-900">Discount Code: <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200">{profile.prescribedRetentionAction.discountCode}</code></span>
                  </div>
                </div>
              </div>

              {/* Action Button Row */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  id={`apply-retention-btn-${profile.id}`}
                  onClick={() => handleApplyRetentionIncentive(profile)}
                  disabled={isExecuting || isApplied}
                  className={cn(
                    "px-4 py-2 rounded-xl font-black transition-all border border-black flex items-center gap-1.5 text-xs shadow-sm",
                    isApplied
                      ? "bg-slate-100 text-slate-600 cursor-default"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  )}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Applying Retention Offer...
                    </>
                  ) : isApplied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Incentive Applied & Trader Notified
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      ⚡ Apply Retention Incentive & Notify Trader
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
