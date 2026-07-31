import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Sparkles, ShieldAlert, CheckCircle2, Thermometer, 
  Wrench, Calendar, ArrowRight, Clock, ChevronDown, 
  ChevronUp, RefreshCw, Home, AlertTriangle, Droplets, 
  Flame, Zap, AlertCircle, Plus
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getMaintenancePredictions } from "../services/gemini";
import { toast } from "sonner";

interface HomeHealthWidgetProps {
  completedJobs?: any[];
  userPostcode?: string;
}

interface MaintenanceTask {
  id: string;
  title: string;
  category: string;
  urgency: "urgent" | "recommended" | "routine";
  season: string;
  reasoning: string;
  recommendedMonth: string;
  estimatedCostRange: string;
  impactScore: number; // 1-10
}

export default function HomeHealthWidget({ completedJobs = [], userPostcode }: HomeHealthWidgetProps) {
  const navigate = useNavigate();
  const [propertyAge, setPropertyAge] = useState<string>(() => {
    return localStorage.getItem("anytrader_property_age") || "1930s-1970s";
  });
  const [propertyType, setPropertyType] = useState<string>(() => {
    return localStorage.getItem("anytrader_property_type") || "Semi-Detached";
  });
  const [heatingType, setHeatingType] = useState<string>(() => {
    return localStorage.getItem("anytrader_heating_type") || "Gas Boiler";
  });

  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPredictions, setAiPredictions] = useState<any[]>([]);

  // Auto-close timer ref
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset or start the 10-second auto-close timer
  const resetAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (isExpanded) {
      autoCloseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 10000);
    }
  }, [isExpanded]);

  // Manage timer lifecycle when isExpanded changes
  useEffect(() => {
    if (isExpanded) {
      resetAutoCloseTimer();
    } else {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [isExpanded, resetAutoCloseTimer]);

  // Current UK Season Detection
  const currentMonth = new Date().getMonth(); // 0-11
  let currentSeasonName = "Winter Freeze Prep";
  let seasonIcon = Thermometer;
  let weatherAlert = "UK Winter Frost Warning: Temperatures dropping below 3°C across England & Wales.";

  if (currentMonth >= 2 && currentMonth <= 4) {
    currentSeasonName = "Spring Thaw & Roof Check";
    weatherAlert = "UK Spring Damp Alert: Inspect roof tiles and timber mortar after winter freezing cycles.";
  } else if (currentMonth >= 5 && currentMonth <= 7) {
    currentSeasonName = "Summer Exterior Maintenance";
    weatherAlert = "UK Summer Heatwave: Ideal window for exterior painting, brick repointing & window seals.";
  } else if (currentMonth >= 8 && currentMonth <= 10) {
    currentSeasonName = "Autumn Rain & Heating Warm-up";
    weatherAlert = "UK Autumn Rainfall Surge: Gutter clearances & boiler servicing recommended before November frost.";
  }

  // Save config settings
  const handleSaveConfig = (age: string, type: string, heating: string) => {
    setPropertyAge(age);
    setPropertyType(type);
    setHeatingType(heating);
    localStorage.setItem("anytrader_property_age", age);
    localStorage.setItem("anytrader_property_type", type);
    localStorage.setItem("anytrader_heating_type", heating);
    setShowConfig(false);
    toast.success("Property specifications updated! Recalculating health forecast...");
  };

  // Generate dynamic maintenance forecasts based on property age, season, and history
  const getForecasts = (): MaintenanceTask[] => {
    const tasks: MaintenanceTask[] = [];

    // 1. Heating / Boiler check
    const hasRecentBoilerJob = completedJobs.some(j => 
      j.category?.toLowerCase().includes("heating") || j.category?.toLowerCase().includes("plumbing")
    );

    if (currentMonth >= 8 || currentMonth <= 1 || !hasRecentBoilerJob) {
      tasks.push({
        id: "boiler-service",
        title: "Annual Boiler & Heating Efficiency Check",
        category: "Heating & Gas",
        urgency: currentMonth >= 8 || currentMonth <= 1 ? "urgent" : "recommended",
        season: "Autumn/Winter",
        reasoning: `${propertyAge} ${propertyType}s with ${heatingType} systems see a 40% higher breakdown risk during early winter frost if unserviced over 12 months.`,
        recommendedMonth: "Before Nov Freeze",
        estimatedCostRange: "£80 - £150",
        impactScore: 9
      });
    }

    // 2. Gutter & Roof Flashing
    tasks.push({
      id: "gutter-clearance",
      title: "Gutter Clearance & Roof Flashing Inspection",
      category: "Roofing",
      urgency: "urgent",
      season: "Autumn Rainfall",
      reasoning: "Autumn foliage & downpipe blockages cause water pooling against brickwork leading to internal damp patches.",
      recommendedMonth: "October / November",
      estimatedCostRange: "£90 - £180",
      impactScore: 8
    });

    // 3. Electrical & Consumer Unit Audit
    if (propertyAge.includes("1930s") || propertyAge.includes("Victorian") || propertyAge.includes("1970s")) {
      tasks.push({
        id: "electrical-safety",
        title: "Periodic Electrical Safety & RCD Breaker Check",
        category: "Electrical",
        urgency: "recommended",
        season: "Winter Overload Prep",
        reasoning: `${propertyAge} wiring systems experience elevated load during winter months with space heaters and festive lighting.`,
        recommendedMonth: "Year-Round",
        estimatedCostRange: "£120 - £250",
        impactScore: 7
      });
    }

    // 4. Damp & Extractor Fan Ventilation
    tasks.push({
      id: "damp-ventilation",
      title: "Damp & Condensation Airflow Audit",
      category: "Damp Proofing",
      urgency: "routine",
      season: "Winter Indoor Humidity",
      reasoning: "Reduced natural ventilation in cold months increases condensation risk in bathrooms & kitchens.",
      recommendedMonth: "November - February",
      estimatedCostRange: "£100 - £220",
      impactScore: 6
    });

    return tasks;
  };

  const forecasts = getForecasts();

  // Calculate Home Health Score (out of 100)
  const completedHistoryBonus = Math.min(completedJobs.length * 5, 20);
  const urgentTasksCount = forecasts.filter(f => f.urgency === "urgent").length;
  const recommendedTasksCount = forecasts.filter(f => f.urgency === "recommended").length;
  const attentionCount = urgentTasksCount + recommendedTasksCount;
  const healthScore = Math.max(50, Math.min(100, 92 - (urgentTasksCount * 8) + completedHistoryBonus));

  const handleFetchAIPredictions = async () => {
    setIsGenerating(true);
    try {
      const res = await getMaintenancePredictions(completedJobs);
      if (res && Array.isArray(res) && res.length > 0) {
        setAiPredictions(res);
        toast.success("AI Seasonal Maintenance Forecast refreshed!");
      } else {
        toast.info("Generated tailored seasonal forecasts based on your UK property profile.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePostPreventiveJob = (task: MaintenanceTask) => {
    const formattedDesc = `Preventive Maintenance Request (${propertyAge}, ${propertyType}, ${heatingType}):\n\n• Recommended Timeline: ${task.recommendedMonth}\n• Reason for Maintenance: ${task.reasoning}\n• Priority Level: ${task.urgency === 'urgent' ? 'High Seasonal Priority' : 'Recommended Seasonal Maintenance'}\n• Estimated Budget: ${task.estimatedCostRange}`;
    const params = new URLSearchParams({
      category: task.category || "General Maintenance",
      title: task.title,
      description: formattedDesc,
      urgency: task.urgency === "urgent" ? "asap" : "flexible",
      budget: task.estimatedCostRange,
      prefilledByAI: "true"
    });
    navigate(`/post-job?${params.toString()}`, {
      state: {
        category: task.category || "General Maintenance",
        title: task.title,
        description: formattedDesc,
        urgency: task.urgency === "urgent" ? "asap" : "flexible",
        selectedBudget: task.estimatedCostRange,
        prefilledByAI: true
      }
    });
  };

  return (
    <div 
      onTouchStart={resetAutoCloseTimer}
      onTouchMove={resetAutoCloseTimer}
      onMouseEnter={resetAutoCloseTimer}
      onMouseMove={resetAutoCloseTimer}
      onClick={resetAutoCloseTimer}
      className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border border-black shadow-lg space-y-4 transition-all duration-300"
    >
      {/* Top Header - Compact */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div 
          onClick={() => {
            if (!isExpanded) setIsExpanded(true);
          }}
          className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'cursor-pointer' : ''}`}
        >
          <div className="relative w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
            {/* Notification Bubble Badge */}
            {attentionCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md animate-bounce">
                {attentionCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-white truncate">AI Home Health & Seasonal Forecast</h2>
              {/* Notification Bubble Alert Pill */}
              {attentionCount > 0 ? (
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-400/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  🚨 {attentionCount} Alert{attentionCount > 1 ? 's' : ''} Need Attention
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  ✓ Healthy
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {currentSeasonName} • Proactive seasonal predictions based on your UK property.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfig(!showConfig);
            }}
            className="text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-blue-400" />
            <span>Specs</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            title={isExpanded ? "Collapse box" : "Expand box"}
          >
            <span>{isExpanded ? "Collapse" : "Expand"}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Property Specs Configuration Drawer */}
      {showConfig && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              Property Specifications
            </h4>
            <span className="text-[10px] text-slate-400">Tailors AI Risk Analysis</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-300 block mb-0.5">Property Age / Era</label>
              <select
                value={propertyAge}
                onChange={(e) => setPropertyAge(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="Pre-1919 Victorian / Edwardian">Pre-1919 Victorian / Edwardian</option>
                <option value="1930s-1970s">1930s - 1970s Period Property</option>
                <option value="1980s-1990s">1980s - 1990s Modern Construction</option>
                <option value="2000+ New Build">2000+ New Build</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-300 block mb-0.5">Property Type</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="Detached House">Detached House</option>
                <option value="Semi-Detached">Semi-Detached</option>
                <option value="Terraced House">Terraced House</option>
                <option value="Flat / Apartment">Flat / Apartment</option>
                <option value="Bungalow">Bungalow</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-300 block mb-0.5">Heating System</label>
              <select
                value={heatingType}
                onChange={(e) => setHeatingType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="Gas Combi Boiler">Gas Combi Boiler</option>
                <option value="Air Source Heat Pump">Air Source Heat Pump</option>
                <option value="Electric Radiators / Underfloor">Electric Radiators / Underfloor</option>
                <option value="Oil Boiler / LPG">Oil Boiler / LPG</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => handleSaveConfig(propertyAge, propertyType, heatingType)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition shadow-md"
            >
              Save Specs & Recalculate
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4">
          {/* Health Score & Weather Sync - Compact Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Score Card */}
            <div className="bg-gradient-to-br from-blue-900/50 to-slate-800/80 border border-blue-500/30 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="5" className="text-slate-700" fill="transparent" />
                  <circle
                    cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="5"
                    className={healthScore >= 80 ? "text-emerald-400" : healthScore >= 65 ? "text-amber-400" : "text-red-400"}
                    strokeDasharray={126}
                    strokeDashoffset={126 - (126 * healthScore) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute font-black text-sm text-white">{healthScore}</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wider">Health Index</p>
                <h4 className="font-extrabold text-xs text-white">
                  {healthScore >= 80 ? "Excellent Preventive Care" : healthScore >= 65 ? "Good — Seasonal Checks Due" : "Action Recommended"}
                </h4>
                <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-1">
                  {propertyAge} • {completedJobs.length} past jobs
                </p>
              </div>
            </div>

            {/* Weather Sync Banner */}
            <div className="md:col-span-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-amber-200">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-extrabold text-[11px] text-amber-300 uppercase tracking-wider">
                    {currentSeasonName}
                  </h4>
                  <button
                    onClick={handleFetchAIPredictions}
                    disabled={isGenerating}
                    className="text-[9px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 px-2 py-0.5 rounded-md transition flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>AI Sync</span>
                  </button>
                </div>
                <p className="text-[11px] text-amber-100/90 font-medium leading-snug line-clamp-2 mt-0.5">
                  {weatherAlert}
                </p>
              </div>
            </div>
          </div>

          {/* Forecast Cards - Compact Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Seasonal Action Forecasts
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">
                {forecasts.length} Action Items
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {forecasts.map((task) => (
                <div
                  key={task.id}
                  className="bg-white/5 border border-white/10 hover:border-blue-500/50 rounded-xl p-3 transition space-y-2 flex flex-col justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        task.urgency === 'urgent'
                          ? 'bg-red-500/20 text-red-300 border-red-400/30'
                          : task.urgency === 'recommended'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                          : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                      }`}>
                        {task.urgency === 'urgent' ? '🚨 High Priority' : task.urgency === 'recommended' ? '⚠️ Recommended' : 'Routine'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {task.recommendedMonth}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-xs text-white group-hover:text-blue-300 transition-colors">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">
                        {task.reasoning}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-emerald-400">{task.estimatedCostRange}</span>

                    <button
                      onClick={() => handlePostPreventiveJob(task)}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Request Quotes</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
