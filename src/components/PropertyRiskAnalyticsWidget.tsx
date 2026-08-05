import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, ShieldCheck, TrendingUp, AlertTriangle, FileText,
  Download, RefreshCw, Sparkles, CheckCircle2, ChevronRight, BarChart3,
  Thermometer, Flame, Droplets, Zap, Wrench, Building
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

interface PropertyRiskAnalyticsProps {
  propertyPassport?: any;
  userPostcode?: string;
}

export default function PropertyRiskAnalyticsWidget({ propertyPassport, userPostcode = "SW1A 1AA" }: PropertyRiskAnalyticsProps) {
  const [selectedTab, setSelectedTab] = useState<"overview" | "vectors" | "forecast" | "certificate">("overview");
  const [isExporting, setIsExporting] = useState(false);

  // Property specs (fallback or passport synced)
  const propName = propertyPassport?.name || propertyPassport?.address?.line1 || "Main Residence";
  const propAge = propertyPassport?.era || "1930s-1970s";
  const epcRating = propertyPassport?.epcRating || "C";
  const boilerAge = propertyPassport?.boilerInfo?.age || "6 years";

  // Calculated Risk Matrix
  const overallRiskScore = 18; // 0 (Safest) - 100 (Highest Risk)
  const insuranceGrade = "Grade A+ (Low Risk)";
  const estInsuranceDiscount = "£240 / year";

  // Risk Vector Breakdown
  const riskVectors = [
    {
      id: "roof",
      name: "Roof & Structural Flashing",
      score: 12, // Low risk
      status: "Low Risk",
      icon: Building,
      findings: "Roof tile timber alignment verified in last Property Passport inspection. No mortar subsidence detected.",
      recommendation: "Bi-annual chimney stack mortar check recommended before winter rain."
    },
    {
      id: "electrical",
      name: "Electrical & Consumer Unit Safety",
      score: 15,
      status: "Low Risk",
      icon: Zap,
      findings: "EICR certification active. Modern dual RCD consumer unit installed.",
      recommendation: "Test RCD safety trip buttons every 6 months."
    },
    {
      id: "plumbing",
      name: "Plumbing, Gas & Flood Hazard",
      score: 28,
      status: "Moderate Risk",
      icon: Droplets,
      findings: "Gas CP12 certificate active. Boiler age 6+ years requires annual heat exchanger service.",
      recommendation: "Install smart leak detection sensors under washing machine & kitchen sink."
    },
    {
      id: "damp",
      name: "Damp, Mould & Ventilation Index",
      score: 14,
      status: "Low Risk",
      icon: Thermometer,
      findings: "Bathroom humidity airflow exceeds 15 litres/sec (Awaab's Law Compliant).",
      recommendation: "Maintain trickled vent gaps during winter heating cycles."
    }
  ];

  // 1-Year, 3-Year, 5-Year Maintenance Expenditure Forecast
  const maintenanceExpenditure = [
    { period: "Year 1 (2026-2027)", estimatedCost: "£280 - £420", priorityItems: ["Boiler Service", "Gutter Clearance"], riskPrevented: "Avoids £1,800 emergency water leak damage" },
    { period: "Year 3 (2028-2029)", estimatedCost: "£850 - £1,400", priorityItems: ["EICR Electrical Renewal", "Roof Ridge Repointing"], riskPrevented: "Avoids £3,500 roof damp intrusion" },
    { period: "Year 5 (2030-2031)", estimatedCost: "£2,200 - £3,500", priorityItems: ["Boiler System Upgrade", "Double Glazing Seals"], riskPrevented: "Preserves EPC Grade C & adds +£12,000 property value" }
  ];

  const handleExportRiskCertificate = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast.success("📄 Insurance Property Risk & Health Certificate generated! Forward to your home insurance provider to unlock up to £240/yr premium discount.");
    }, 1200);
  };

  return (
    <div className="bg-white rounded-3xl border border-black p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Property Risk Analytics & Underwriter Scoring</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{propName}</span>
            <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              {propAge}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Aggregated structural health index for home insurance underwriters & predictive maintenance planning.
          </p>
        </div>

        <button
          onClick={handleExportRiskCertificate}
          disabled={isExporting}
          className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-2xl border border-black shadow-md flex items-center gap-2 transition active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4 text-cyan-300" />
          {isExporting ? "Generating Certificate..." : "Export Insurance Risk Passport"}
        </button>
      </div>

      {/* Metric Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-2xl border border-black shadow-md space-y-1">
          <p className="text-[10px] uppercase font-extrabold text-slate-400">Aggregate Risk Index</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">{overallRiskScore}</span>
            <span className="text-xs font-bold text-slate-300">/ 100 (Very Low Risk)</span>
          </div>
          <p className="text-[11px] text-emerald-300 font-medium">Top 5% safest residential properties in {userPostcode}</p>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-black space-y-1">
          <p className="text-[10px] uppercase font-extrabold text-slate-500">Underwriter Risk Rating</p>
          <p className="text-2xl font-black text-slate-900">{insuranceGrade}</p>
          <p className="text-[11px] text-slate-600 font-medium">Eligible for low-risk policy discounts</p>
        </div>

        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-300 space-y-1">
          <p className="text-[10px] uppercase font-extrabold text-emerald-800">Est. Insurance Savings</p>
          <p className="text-2xl font-black text-emerald-700">{estInsuranceDiscount}</p>
          <p className="text-[11px] text-emerald-800 font-medium">Discount applied on home & contents insurance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 pb-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSelectedTab("overview")}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-extrabold transition border shrink-0",
            selectedTab === "overview" ? "bg-slate-900 text-white border-black" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          4-Vector Risk Analysis
        </button>
        <button
          onClick={() => setSelectedTab("forecast")}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-extrabold transition border shrink-0",
            selectedTab === "forecast" ? "bg-slate-900 text-white border-black" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          Predictive Maintenance Expenditure (5-Yr)
        </button>
      </div>

      {/* Tab 1: 4-Vector Risk Analysis */}
      {selectedTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {riskVectors.map((vec) => {
            const Icon = vec.icon;
            return (
              <div key={vec.id} className="bg-slate-50 p-5 rounded-2xl border border-black space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-black flex items-center justify-center text-slate-900 font-bold shadow-sm">
                      <Icon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm">{vec.name}</h4>
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2.5 py-1 rounded-full border",
                    vec.status === "Low Risk" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
                  )}>
                    {vec.status} ({vec.score}/100)
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-snug">{vec.findings}</p>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="font-black text-indigo-700 block text-[10px] uppercase">Underwriter Recommendation:</span>
                  <span className="text-slate-700 font-semibold">{vec.recommendation}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Predictive Maintenance Expenditure (5-Yr) */}
      {selectedTab === "forecast" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {maintenanceExpenditure.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-black space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-black text-indigo-700 uppercase">{item.period}</span>
                  <span className="text-sm font-black text-slate-900">{item.estimatedCost}</span>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-extrabold uppercase text-slate-500">Key Planned Work:</p>
                  <ul className="text-xs text-slate-700 font-bold list-disc list-inside space-y-0.5">
                    {item.priorityItems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 font-semibold">
                  🛡 <strong>Financial Impact:</strong> {item.riskPrevented}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
