import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  CloudLightning, RefreshCw, Sparkles, AlertTriangle, CheckCircle2, 
  Send, ThermometerSnowflake, Wind, Flame, TrendingUp, DollarSign, Clock, ShieldCheck
} from "lucide-react";
import { 
  DemandSurgeForecast, 
  runDemandSurgePredictorScan, 
  executeAgentAction 
} from "../services/aiAgentEcosystemService";
import { cn } from "@/src/lib/utils";

interface AdminDemandSurgeTabProps {
  onShowNotice?: (text: string, type?: "success" | "error" | "info") => void;
}

export default function AdminDemandSurgeTab({ onShowNotice }: AdminDemandSurgeTabProps) {
  const [forecast, setForecast] = useState<DemandSurgeForecast | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<string>("Sub-Zero Freeze & Frost Alert");
  const [selectedRegion, setSelectedRegion] = useState<string>("UK Wide");
  const [loading, setLoading] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const [broadcasted, setBroadcasted] = useState<boolean>(false);

  const fetchDemandSurge = async (region: string, weather: string) => {
    setLoading(true);
    try {
      const data = await runDemandSurgePredictorScan(region, weather);
      setForecast(data);
    } catch (err) {
      console.warn("Failed to fetch demand surge forecast:", err);
      onShowNotice?.("Failed to run demand surge predictor", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandSurge(selectedRegion, selectedWeather);
  }, [selectedRegion, selectedWeather]);

  const handleActivateSurgeAlert = async () => {
    if (!forecast) return;
    setExecuting(true);
    try {
      const res = await executeAgentAction(
        "BROADCAST_DEMAND_SURGE_ALERT",
        {
          region: forecast.forecastRegion,
          weatherAlert: forecast.activeWeatherAlert,
          severity: forecast.severity,
          impactWindow: forecast.impactWindow,
          surges: forecast.projectedDemandSurges,
          estimatedGross: forecast.estimatedSurgeCommissionGross
        },
        "DEMAND_SURGE_PREDICTOR_AGENT"
      );

      if (res.success) {
        setBroadcasted(true);
        onShowNotice?.(res.outcomeMessage, "success");
      } else {
        onShowNotice?.("Failed to activate surge alerts", "error");
      }
    } catch (err) {
      onShowNotice?.("Error activating surge mode", "error");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6" id="admin-demand-surge-root">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-700">
              <CloudLightning className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Dynamic Weather & Demand Surge Predictor</h3>
            <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-sky-300 uppercase">
              Meteorological Predictive Dispatch
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Correlates Met Office freeze warnings, storm alerts, and seasonal shifts with historic repair spikes to pre-mobilize emergency plumbing, heating, and roofing contractors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            id="surge-weather-select"
            value={selectedWeather}
            onChange={(e) => setSelectedWeather(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-black rounded-xl px-3 py-2.5 text-slate-800"
          >
            <option value="Sub-Zero Freeze & Frost Alert">❄️ Sub-Zero Freeze & Frost</option>
            <option value="Storm & Heavy Gale Warning">🌪️ Storm & High Gale Warning</option>
            <option value="Heavy Flash Flooding Alert">🌧️ Heavy Flash Flooding</option>
            <option value="Summer Heatwave & AC Spike">☀️ Summer Heatwave (32°C+)</option>
          </select>

          <button
            id="surge-rescan-btn"
            onClick={() => fetchDemandSurge(selectedRegion, selectedWeather)}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {loading ? "Forecasting..." : "Run Forecast"}
          </button>
        </div>
      </div>

      {/* Forecast Status Banner */}
      {forecast && (
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 text-white border border-black shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-500/20 rounded-2xl border border-sky-400/30">
                <ThermometerSnowflake className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h4 className="font-black text-white text-base flex items-center gap-2">
                  {forecast.activeWeatherAlert}
                  <span className={cn(
                    "text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border",
                    forecast.severity === "emergency" ? "bg-rose-500/30 text-rose-300 border-rose-400" :
                    forecast.severity === "warning" ? "bg-amber-500/30 text-amber-300 border-amber-400" : "bg-sky-500/30 text-sky-300 border-sky-400"
                  )}>
                    {forecast.severity}
                  </span>
                </h4>
                <p className="text-xs text-slate-300">{forecast.temperatureForecast} • Window: {forecast.impactWindow}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Estimated Surge Platform GMV</span>
              <p className="text-xl font-black text-emerald-400">£{forecast.estimatedSurgeCommissionGross.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Surge Mode auto-allocates higher emergency callout rate multiplier (+15%) to boost pro response times.</span>
            </div>

            <button
              id="activate-surge-alert-btn"
              onClick={handleActivateSurgeAlert}
              disabled={executing || broadcasted}
              className={cn(
                "px-5 py-2.5 rounded-2xl font-black transition-all border border-black flex items-center justify-center gap-2 text-xs shadow-md shrink-0",
                broadcasted 
                  ? "bg-emerald-500 text-slate-950 cursor-default" 
                  : "bg-sky-500 hover:bg-sky-400 text-slate-950"
              )}
            >
              {executing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Broadcasting On-Call Alerts...
                </>
              ) : broadcasted ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Surge Mode Active & Pros Pre-Alerted
                </>
              ) : (
                <>
                  <CloudLightning className="w-4 h-4" />
                  ⚡ Activate Emergency Surge & Alert On-Call Pros
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Projected Demand Surges by Category */}
      {forecast && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-base">Projected Category Demand Spikes</h4>
            <span className="text-xs font-bold text-slate-500">{forecast.projectedDemandSurges.length} High-Impact Categories</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forecast.projectedDemandSurges.map((surge, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h5 className="font-black text-slate-900 text-base">{surge.category}</h5>
                      <span className="text-[11px] font-bold text-slate-500">
                        Pro Availability: <strong className={cn(
                          surge.activeTraderAvailabilityScore === "low" ? "text-rose-600" :
                          surge.activeTraderAvailabilityScore === "medium" ? "text-amber-600" : "text-emerald-600"
                        )}>{surge.activeTraderAvailabilityScore.toUpperCase()}</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Demand Spike</span>
                      <p className="text-2xl font-black text-sky-600 flex items-center justify-end gap-1">
                        <TrendingUp className="w-5 h-5 text-sky-500" />
                        +{surge.projectedIncreasePct}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Primary Surge Job Types:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {surge.primaryJobTypes.map((jobType, jIdx) => (
                        <span key={jIdx} className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-xl border border-slate-200">
                          {jobType}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-200 text-xs space-y-1">
                    <span className="font-black text-sky-950 uppercase text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-600" /> Recommended Pro Dispatch Strategy:
                    </span>
                    <p className="text-slate-700 font-medium">{surge.recommendedAction}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Automated SMS Draft:</span>
                  <p className="font-mono text-slate-800 bg-white p-2 rounded-lg border border-slate-200 text-[10px] leading-relaxed">
                    {surge.automatedSmsBroadcastDraft}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
