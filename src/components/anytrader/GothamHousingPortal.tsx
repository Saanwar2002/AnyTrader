import React, { useState, useEffect } from "react";
import {
  Building2, Users, Receipt, Briefcase, Plus, Filter,
  Search, ArrowRight, Settings, CheckCircle2, AlertTriangle, Clock,
  Wrench, ShieldCheck, Zap, TrendingUp, BarChart3, FileText, Download,
  Sliders, UserCheck, PieChart, Check, Send, Sparkles, MapPin, RefreshCw, X,
  PoundSterling, CreditCard, Layers, Calculator, Info, Percent, SlidersHorizontal
} from "lucide-react";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { calculateGothamSaaSPlan } from "@/src/services/subscriptionService";

// --- Mock Housing Association Estates & Properties ---
const initialEstates = [
  {
    id: "EST-101",
    name: "Clarion Riverside Estate",
    association: "Clarion Housing Group",
    unitsCount: 1240,
    activeRepairs: 14,
    slaCompliance: 98.4,
    dampRiskIndex: "Low (1.2%)",
    cp12Compliance: 99.1,
    leadContractor: "Apex Plumbing & Electrical"
  },
  {
    id: "EST-102",
    name: "Peabody Green Towers",
    association: "Peabody Trust",
    unitsCount: 850,
    activeRepairs: 9,
    slaCompliance: 96.8,
    dampRiskIndex: "Moderate (3.8%)",
    cp12Compliance: 97.5,
    leadContractor: "London HVAC Services"
  },
  {
    id: "EST-103",
    name: "L&Q Victoria Court",
    association: "London & Quadrant",
    unitsCount: 1920,
    activeRepairs: 22,
    slaCompliance: 99.2,
    dampRiskIndex: "Very Low (0.4%)",
    cp12Compliance: 100.0,
    leadContractor: "Metro Build Ltd"
  },
  {
    id: "EST-104",
    name: "Notting Hill Genesis Trust",
    association: "NHG Housing",
    unitsCount: 840,
    activeRepairs: 7,
    slaCompliance: 95.1,
    dampRiskIndex: "High (5.2% - Awaab Alert)",
    cp12Compliance: 96.0,
    leadContractor: "Thermal Shield Environmental"
  }
];

// --- Mock B2B Tenant Repair Tickets ---
const initialTickets = [
  {
    id: "TKT-8842",
    estateId: "EST-104",
    estateName: "Notting Hill Genesis Trust",
    unit: "Flat 4B, Block C",
    tenantName: "Sarah Jenkins",
    issueCategory: "Damp & Mould (Awaab's Law Urgent)",
    priority: "Emergency (2h SLA)",
    reportedTime: "22 mins ago",
    slaDeadline: "1h 38m remaining",
    slaStatus: "warning",
    status: "Auto-Dispatched",
    assignedTrader: "Thermal Shield Environmental",
    traderPhone: "+44 7700 900821"
  },
  {
    id: "TKT-8841",
    estateId: "EST-101",
    estateName: "Clarion Riverside Estate",
    unit: "Unit 12A, Tower 1",
    tenantName: "David O'Connor",
    issueCategory: "Boiler Failure / Heating Outage",
    priority: "Urgent (24h SLA)",
    reportedTime: "2 hours ago",
    slaDeadline: "22h 00m remaining",
    slaStatus: "ok",
    status: "In Progress",
    assignedTrader: "Apex Plumbing & Electrical",
    traderPhone: "+44 7700 900142"
  },
  {
    id: "TKT-8839",
    estateId: "EST-103",
    estateName: "L&Q Victoria Court",
    unit: "Apt 204, North Wing",
    tenantName: "Marcus Sterling",
    issueCategory: "EICR Electrical Inspection Due",
    priority: "Routine (5-Day SLA)",
    reportedTime: "1 day ago",
    slaDeadline: "4 days remaining",
    slaStatus: "ok",
    status: "Scheduled",
    assignedTrader: "Metro Build Ltd",
    traderPhone: "+44 7700 900988"
  }
];

// --- Approved Contractor Network Matrix ---
const contractors = [
  {
    name: "Apex Plumbing & Electrical",
    slaScore: "99.4%",
    jobsCompleted: 1420,
    avgResponseTime: "18 mins",
    verifiedBadge: true,
    rating: 4.9
  },
  {
    name: "Thermal Shield Environmental",
    slaScore: "98.8%",
    jobsCompleted: 890,
    avgResponseTime: "22 mins",
    verifiedBadge: true,
    rating: 4.95
  },
  {
    name: "Metro Build Ltd",
    slaScore: "97.9%",
    jobsCompleted: 2150,
    avgResponseTime: "31 mins",
    verifiedBadge: true,
    rating: 4.85
  }
];

export default function GothamHousingPortal() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "estates" | "repairs" | "billing" | "contractors">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [estates, setEstates] = useState(initialEstates);
  const [tickets, setTickets] = useState(initialTickets);
  const [isDispatching, setIsDispatching] = useState(false);
  
  // Onboarding Modal
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [newEstateName, setNewEstateName] = useState("");
  const [newEstateAssoc, setNewEstateAssoc] = useState("");
  const [newEstateUnits, setNewEstateUnits] = useState("250");

  // Gotham B2B Enterprise SaaS Subscription State
  const [saasBillingCycle, setSaasBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isSaaSCalculatorOpen, setIsSaaSCalculatorOpen] = useState(false);
  const [calculatorDoors, setCalculatorDoors] = useState(4850);

  const totalUnits = estates.reduce((acc, e) => acc + e.unitsCount, 0);
  const totalActiveRepairs = tickets.filter(t => t.status !== "Completed").length;
  const criticalSlaCount = tickets.filter(t => t.slaStatus === "critical" || t.slaStatus === "warning").length;

  // Active Gotham SaaS Licensing Plan
  const currentSaasPlan = calculateGothamSaaSPlan(totalUnits, saasBillingCycle);

  const handleAutoDispatchTicket = (ticketId: string, contractorName?: string) => {
    setIsDispatching(true);
    setTimeout(() => {
      setTickets(prev =>
        prev.map(t =>
          t.id === ticketId
            ? { ...t, status: "Auto-Dispatched", assignedTrader: contractorName || contractors[0].name }
            : t
        )
      );
      setIsDispatching(false);
      toast.success(`⚡ 1-Tap Auto-Dispatched repair ticket ${ticketId} to ${contractorName || contractors[0].name} with Property Passport Specs!`);
    }, 600);
  };

  const handleAddEstate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEstateName) return;

    const addedUnits = parseInt(newEstateUnits, 10) || 100;
    const newEstate = {
      id: `EST-${Math.floor(100 + Math.random() * 900)}`,
      name: newEstateName,
      association: newEstateAssoc || "Independent Council / Trust",
      unitsCount: addedUnits,
      activeRepairs: 0,
      slaCompliance: 100.0,
      dampRiskIndex: "Low (0.0%)",
      cp12Compliance: 100.0,
      leadContractor: contractors[0].name
    };

    const newTotal = totalUnits + addedUnits;
    const updatedPlan = calculateGothamSaaSPlan(newTotal, saasBillingCycle);

    setEstates([newEstate, ...estates]);
    toast.success(
      `🏢 Onboarded ${newEstate.name} (${addedUnits} Doors)!\n` +
      `Gotham SaaS Plan: ${updatedPlan.tierName} (${newTotal.toLocaleString()} Doors @ £${updatedPlan.effectiveRatePerDoor.toFixed(2)}/door/mo = £${updatedPlan.monthlyFee.toLocaleString()}/mo)`
    );
    setIsOnboardingOpen(false);
    setNewEstateName("");
    setNewEstateAssoc("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Gotham Enterprise Layer Branding Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-black shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-slate-950" />
              Gotham B2B Enterprise & Housing Association Layer
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Social Housing & Portfolio Automation
            </h1>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              High-capacity portfolio management engine monitoring <strong>{totalUnits.toLocaleString()} units</strong> across social housing, estate trusts, and corporate portfolios with real-time SLA repair time tracking & automated dispatching.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setCalculatorDoors(totalUnits);
                setIsSaaSCalculatorOpen(true);
              }}
              className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-2xl border border-black shadow-lg flex items-center gap-2 transition active:scale-95"
            >
              <Calculator className="w-4 h-4 text-slate-950" />
              <span>SaaS Fee Calculator</span>
              <span className="bg-slate-950 text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-mono">
                £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)}/door
              </span>
            </button>

            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl border border-black shadow-lg flex items-center gap-2 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard Housing Estate</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Total Managed Doors</p>
            <p className="text-2xl font-black text-white mt-1">{totalUnits.toLocaleString()} Units</p>
            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">100% CP12 & EICR Mapped</p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Active Tenant Repairs</p>
            <p className="text-2xl font-black text-amber-300 mt-1">{totalActiveRepairs} Tickets</p>
            <p className="text-[10px] text-slate-300 font-semibold mt-0.5">Avg SLA Response: 19 mins</p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Awaab Damp SLA Alert</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{criticalSlaCount} Urgent</p>
            <p className="text-[10px] text-rose-300 font-semibold mt-0.5">24h Mandatory Remediation</p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Monthly Gotham SaaS License</p>
            <p className="text-2xl font-black text-indigo-300 mt-1">
              £{currentSaasPlan.monthlyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
              £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)}/door ({currentSaasPlan.tierName})
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2">
        {[
          { id: "overview", label: "Dashboard Overview", icon: LayoutGrid },
          { id: "estates", label: "Housing Estates & Blocks", icon: Building2 },
          { id: "repairs", label: "SLA Repairs & Auto-Dispatch", icon: Wrench },
          { id: "billing", label: "Gotham B2B SaaS Billing", icon: Receipt },
          { id: "contractors", label: "Approved Trader Network", icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 font-extrabold text-xs whitespace-nowrap border-b-2 transition -mb-px rounded-t-2xl",
                isActive
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: OVERVIEW --- */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Repairs Monitor */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Live SLA Repair Tickets</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Automated dispatching & Awaab's Law damp/mould compliance tracking</p>
                </div>
                <span className="bg-rose-50 text-rose-700 font-black text-[10px] px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  Awaab's Law Active
                </span>
              </div>

              <div className="space-y-3">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-black transition space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                          {ticket.id}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">{ticket.estateName}</span>
                        <span className="text-xs text-slate-500 font-semibold">• {ticket.unit}</span>
                      </div>

                      <span className={cn(
                        "text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border",
                        ticket.priority.includes("Emergency")
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : ticket.priority.includes("Urgent")
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-indigo-100 text-indigo-800 border-indigo-300"
                      )}>
                        {ticket.priority}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{ticket.issueCategory}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Reported by: {ticket.tenantName} ({ticket.reportedTime})</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">SLA Countdown</p>
                          <p className={cn("font-mono font-black text-xs", ticket.slaStatus === "warning" ? "text-rose-600" : "text-emerald-600")}>
                            {ticket.slaDeadline}
                          </p>
                        </div>

                        {ticket.status === "Auto-Dispatched" ? (
                          <span className="bg-emerald-50 text-emerald-800 font-black text-[10px] px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Dispatched
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAutoDispatchTicket(ticket.id)}
                            disabled={isDispatching}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl border border-black transition active:scale-95 flex items-center gap-1 shadow-sm"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300" />
                            1-Tap Auto Dispatch
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance Matrix Side Column */}
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Regulatory Compliance
                  </h3>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Audit Ready
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">CP12 Gas Safety Compliance</p>
                      <p className="text-[10px] text-slate-400">Automated annual renewal alerts</p>
                    </div>
                    <span className="text-lg font-black text-emerald-400">99.1%</span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">EICR Electrical Safety</p>
                      <p className="text-[10px] text-slate-400">5-Year certification status</p>
                    </div>
                    <span className="text-lg font-black text-emerald-400">98.5%</span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Awaab Damp & Mould SLA</p>
                      <p className="text-[10px] text-slate-400">24-Hour emergency response</p>
                    </div>
                    <span className="text-lg font-black text-amber-300">96.2%</span>
                  </div>
                </div>

                <button
                  onClick={() => toast.success("📄 Generated full Housing Association Regulatory Compliance Audit Report PDF!")}
                  className="w-full py-2.5 bg-white text-slate-950 font-black text-xs rounded-xl border border-black hover:bg-slate-100 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  Export Regulator Audit Report
                </button>
              </div>

              {/* Gotham B2B SaaS Summary Widget */}
              <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-300">
                    B2B SaaS Plan Active
                  </span>
                  <span className="text-xs font-black text-slate-900">£{currentSaasPlan.effectiveRatePerDoor.toFixed(2)}/door</span>
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">{currentSaasPlan.tierName}</h4>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {totalUnits.toLocaleString()} Managed Doors @ £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)} = <strong>£{currentSaasPlan.monthlyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</strong>
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("billing")}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl border border-black transition flex items-center justify-center gap-1"
                >
                  <span>Manage SaaS Plan & Invoices</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: HOUSING ESTATES & BLOCKS --- */}
      {activeTab === "estates" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search estates, housing associations, or contractors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-black rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white font-extrabold text-xs rounded-2xl border border-black shadow-sm flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Onboard New Estate Block
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {estates.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.association.toLowerCase().includes(searchQuery.toLowerCase())).map(estate => {
              const estateSaasFee = estate.unitsCount * currentSaasPlan.effectiveRatePerDoor;
              return (
                <div key={estate.id} className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {estate.id}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">{estate.name}</h3>
                      <p className="text-xs text-slate-500 font-semibold">{estate.association}</p>
                    </div>

                    <span className="bg-slate-100 text-slate-900 font-black text-xs px-3 py-1 rounded-2xl border border-slate-300 shrink-0">
                      {estate.unitsCount} Units
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">SLA Compliance</p>
                      <p className="text-sm font-black text-emerald-600">{estate.slaCompliance}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Damp Risk</p>
                      <p className={cn("text-xs font-black", estate.dampRiskIndex.includes("High") ? "text-rose-600" : "text-slate-700")}>
                        {estate.dampRiskIndex.split(' ')[0]}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">CP12 Safety</p>
                      <p className="text-sm font-black text-indigo-600">{estate.cp12Compliance}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100">
                    <div className="text-slate-500 font-medium">
                      Lead Contractor: <strong className="text-slate-900">{estate.leadContractor}</strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">SaaS License Share</span>
                      <span className="font-black text-indigo-600">
                        £{estateSaasFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 3: SLA REPAIRS & AUTO DISPATCH --- */}
      {activeTab === "repairs" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">SLA Repair Ticket Command Center</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Automated dispatching matching tenant Property Passport specs directly with certified trade engineers.</p>
            </div>

            <button
              onClick={() => toast.success("⚡ Triggered platform-wide SLA compliance audit across all active tenant tickets!")}
              className="px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-2xl border border-black shadow-sm flex items-center gap-2 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run SLA Audit
            </button>
          </div>

          <div className="space-y-4">
            {tickets.map(t => (
              <div key={t.id} className="p-5 rounded-2xl border border-black bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                      {t.id}
                    </span>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{t.issueCategory}</h4>
                      <p className="text-xs text-slate-500 font-medium">{t.estateName} — <strong>{t.unit}</strong></p>
                    </div>
                  </div>

                  <span className={cn(
                    "text-xs font-black px-3 py-1 rounded-full border uppercase tracking-wider",
                    t.priority.includes("Emergency")
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : "bg-indigo-100 text-indigo-800 border-indigo-300"
                  )}>
                    {t.priority}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Assigned Contractor:</span>
                    <p className="font-black text-slate-900 mt-0.5">{t.assignedTrader} ({t.traderPhone})</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px] block">Status</span>
                      <span className="font-black text-indigo-600">{t.status}</span>
                    </div>

                    {t.status !== "Auto-Dispatched" && (
                      <button
                        onClick={() => handleAutoDispatchTicket(t.id)}
                        disabled={isDispatching}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl border border-black shadow-sm transition active:scale-95 flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        Dispatch Contractor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: CONSOLIDATED ENTERPRISE BILLING & GOTHAM SAAS LICENSE --- */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Gotham B2B Enterprise SaaS Active Subscription Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-black shadow-lg relative overflow-hidden space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-slate-950" />
                  Active Gotham B2B SaaS Licensing Plan
                </div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-indigo-400" />
                  {currentSaasPlan.tierName}
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  Per-property SaaS licensing engine for automated repair dispatch, CP12/EICR compliance, & SLA tracking.
                </p>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setSaasBillingCycle("monthly")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-black rounded-xl transition",
                    saasBillingCycle === "monthly" ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Monthly (£{currentSaasPlan.ratePerDoor.toFixed(2)}/door)
                </button>
                <button
                  type="button"
                  onClick={() => setSaasBillingCycle("annual")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-black rounded-xl transition flex items-center gap-1",
                    saasBillingCycle === "annual" ? "bg-amber-400 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <span>Annual</span>
                  <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold">15% OFF</span>
                </button>
              </div>
            </div>

            {/* SaaS Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-slate-400">Managed Housing Doors</p>
                <p className="text-2xl font-black text-white mt-0.5">{totalUnits.toLocaleString()} <span className="text-xs text-slate-400 font-normal">Units</span></p>
                <p className="text-[10px] text-indigo-300 font-semibold mt-1">Across {estates.length} Estates</p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-slate-400">Per-Door Monthly Rate</p>
                <p className="text-2xl font-black text-amber-300 mt-0.5">
                  £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)}
                  <span className="text-xs text-slate-400 font-normal"> / door</span>
                </p>
                <p className="text-[10px] text-emerald-400 font-semibold mt-1">
                  {saasBillingCycle === "annual" ? "15% Annual Savings Applied" : "Volume Discount Tier"}
                </p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-slate-400">Monthly SaaS License Fee</p>
                <p className="text-2xl font-black text-indigo-300 mt-0.5">
                  £{currentSaasPlan.monthlyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-300 font-semibold mt-1">
                  Billed {currentSaasPlan.billingCycle} via Stripe Net-30
                </p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-slate-400">Est. Awaab Fine Savings</p>
                <p className="text-2xl font-black text-emerald-400 mt-0.5">
                  £{currentSaasPlan.estimatedRegulatorFineSavings.toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-300 font-semibold mt-1">
                  In avoided damp/mould SLA penalties
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Includes Housing Regulator Compliance Audit Trail & Unlimited Dispatch.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCalculatorDoors(totalUnits);
                  setIsSaaSCalculatorOpen(true);
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl border border-black shadow-md flex items-center gap-1.5 transition active:scale-95"
              >
                <Calculator className="w-4 h-4" />
                Open SaaS License Calculator
              </button>
            </div>
          </div>

          {/* Combined Invoicing & PO Overview Cards */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h3 className="text-xl font-black text-slate-900">Consolidated B2B Enterprise Outlays</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Breakdown between monthly Gotham SaaS platform licensing and pass-through contractor maintenance outlays.
                </p>
              </div>
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Stripe B2B Auto-Pay (Net 30)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-black space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">1. Gotham SaaS License Fee</p>
                <p className="text-3xl font-black text-amber-300">
                  £{currentSaasPlan.monthlyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-300">Fixed rate: {totalUnits.toLocaleString()} Doors @ £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)}/mo</p>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-500">2. Contractor Maintenance POs (MTD)</p>
                <p className="text-3xl font-black text-slate-900">£148,250.00</p>
                <p className="text-[11px] text-slate-500">42 Approved Repair POs (100% SLA Verified)</p>
              </div>

              <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200 space-y-1">
                <p className="text-[10px] uppercase font-bold text-indigo-700">3. Total Draft Invoice (SaaS + POs)</p>
                <p className="text-3xl font-black text-indigo-900">
                  £{(148250 + currentSaasPlan.monthlyFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-indigo-700 font-semibold">Scheduled Net-30 debit via Stripe Invoicing</p>
              </div>
            </div>
          </div>

          {/* Estate Per-Door License Fee Allocation Table */}
          <div className="bg-white border border-black rounded-3xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Per-Estate SaaS Licensing Allocation</h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Detailed monthly SaaS licensing fee distribution broken down across each registered housing estate block.
                </p>
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                Volume Rate: £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)} / door
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-black font-extrabold text-slate-700 uppercase">
                    <th className="px-6 py-4">Estate Block</th>
                    <th className="px-6 py-4">Association Trust</th>
                    <th className="px-6 py-4 text-center">Managed Units</th>
                    <th className="px-6 py-4">Licensing Rate</th>
                    <th className="px-6 py-4 text-right">Monthly SaaS Fee Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold text-slate-900">
                  {estates.map((est) => {
                    const estateSaasFee = est.unitsCount * currentSaasPlan.effectiveRatePerDoor;
                    return (
                      <tr key={est.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900 text-sm">{est.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {est.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{est.association}</td>
                        <td className="px-6 py-4 text-center font-black text-indigo-600">
                          {est.unitsCount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-600">
                          £{currentSaasPlan.effectiveRatePerDoor.toFixed(2)} / door / mo
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                          £{estateSaasFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: CONTRACTOR NETWORK MATRIX --- */}
      {activeTab === "contractors" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">Approved B2B Trade Contractor Matrix</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Pre-audited, video-verified trade contractors allocated to emergency housing response SLAs.</p>
            </div>

            <button
              onClick={() => toast.success("📢 Invitation sent to top-rated local trade contractors for B2B Housing Framework!")}
              className="px-4 py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-2xl border border-black shadow-sm transition active:scale-95"
            >
              + Invite Trade Contractor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contractors.map((c, i) => (
              <div key={i} className="p-5 rounded-2xl border border-black bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm border border-black">
                    {c.name.charAt(0)}
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                    SLA: {c.slaScore}
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-slate-900 text-sm">{c.name}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Rating: ⭐ {c.rating} / 5.0</p>
                </div>

                <div className="pt-2 border-t border-slate-200 text-xs flex justify-between text-slate-600">
                  <span>Completed: <strong>{c.jobsCompleted} Jobs</strong></span>
                  <span>Avg Response: <strong>{c.avgResponseTime}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL: ONBOARD NEW HOUSING ESTATE --- */}
      <AnimatePresence>
        {isOnboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-lg w-full p-6 space-y-6 overflow-hidden relative"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-black text-slate-900">Onboard New Housing Development</h3>
                <button onClick={() => setIsOnboardingOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddEstate} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-700 mb-1">Estate / Block Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. St. George Riverside Blocks"
                    value={newEstateName}
                    onChange={e => setNewEstateName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Housing Association Trust / Council Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Southwark Local Council"
                    value={newEstateAssoc}
                    onChange={e => setNewEstateAssoc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Managed Property Units / Doors</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newEstateUnits}
                    onChange={e => setNewEstateUnits(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-[11px] text-indigo-900 space-y-1">
                  <p className="font-extrabold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-indigo-600" /> Dynamic SaaS Rate Adjustment:
                  </p>
                  <p className="text-indigo-700">
                    Onboarding this block will automatically adjust your portfolio's volume rate tier and update your consolidated Stripe B2B monthly license invoice.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white font-extrabold rounded-xl border border-black hover:bg-indigo-700 transition"
                  >
                    Onboard to Gotham Layer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(false)}
                    className="px-4 py-3 bg-slate-100 text-slate-800 font-extrabold rounded-xl border border-black"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: GOTHAM SAAS LICENSING CALCULATOR & ROI SIMULATOR --- */}
      <AnimatePresence>
        {isSaaSCalculatorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-xl w-full p-6 space-y-6 overflow-hidden relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                    <Calculator className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Gotham B2B SaaS Licensing Calculator</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">Simulate per-property licensing costs and regulatory compliance ROI</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSaaSCalculatorOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-between bg-slate-100 p-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase">Billing Term:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSaasBillingCycle("monthly")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-black rounded-xl transition",
                      saasBillingCycle === "monthly" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaasBillingCycle("annual")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-black rounded-xl transition flex items-center gap-1",
                      saasBillingCycle === "annual" ? "bg-amber-400 text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <span>Annual Billing</span>
                    <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">15% OFF</span>
                  </button>
                </div>
              </div>

              {/* Slider & Input Controls */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 uppercase">Simulated Housing Units / Doors:</label>
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-3 py-1">
                    <input
                      type="number"
                      min={10}
                      max={50000}
                      value={calculatorDoors}
                      onChange={(e) => setCalculatorDoors(Math.max(10, parseInt(e.target.value, 10) || 10))}
                      className="w-20 text-right text-sm font-black text-slate-900 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">Doors</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={10}
                  max={10000}
                  step={10}
                  value={calculatorDoors}
                  onChange={(e) => setCalculatorDoors(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />

                {/* Preset Shortcuts */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: "80 Doors (Starter)", count: 80 },
                    { label: "500 Doors (Growth)", count: 500 },
                    { label: "2,500 Doors (Enterprise)", count: 2500 },
                    { label: "10,000 Doors (Council)", count: 10000 }
                  ].map((preset) => (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => setCalculatorDoors(preset.count)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition",
                        calculatorDoors === preset.count ? "bg-indigo-600 text-white border-black" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Calculated Plan Breakdown */}
              {(() => {
                const plan = calculateGothamSaaSPlan(calculatorDoors, saasBillingCycle);
                return (
                  <div className="bg-slate-900 text-white p-5 rounded-2xl border border-black space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                          {plan.tierName}
                        </span>
                        <p className="text-sm font-black text-white mt-1">
                          {calculatorDoors.toLocaleString()} Managed Properties
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase">Rate / Door / Month</p>
                        <p className="text-xl font-black text-amber-300">
                          £{plan.effectiveRatePerDoor.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Monthly SaaS License Fee</p>
                        <p className="text-2xl font-black text-indigo-300 mt-0.5">
                          £{plan.monthlyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Billed {plan.billingCycle}</p>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Annualized License Total</p>
                        <p className="text-2xl font-black text-white mt-0.5">
                          £{plan.annualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                          {saasBillingCycle === "annual" ? `Saves £${plan.annualDiscountSavings.toLocaleString()}/yr` : "Save 15% with Annual"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-950/50 border border-emerald-500/30 p-3 rounded-xl space-y-1 text-xs">
                      <p className="font-extrabold text-emerald-300 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        Estimated Regulatory & Admin ROI:
                      </p>
                      <div className="flex justify-between text-slate-300 text-[11px]">
                        <span>• Admin Time Saved: <strong>~{plan.estimatedAdminHoursSaved} hrs / mo</strong></span>
                        <span>• Damp SLA Penalty Mitigation: <strong>£{plan.estimatedRegulatorFineSavings.toLocaleString()} / mo</strong></span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Included SaaS Capabilities:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                        {plan.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const plan = calculateGothamSaaSPlan(calculatorDoors, saasBillingCycle);
                    toast.success(
                      `⚡ Gotham SaaS Plan Updated to ${plan.tierName}!\n` +
                      `${calculatorDoors.toLocaleString()} Doors @ £${plan.effectiveRatePerDoor.toFixed(2)}/door/mo = £${plan.monthlyFee.toLocaleString()}/mo synced with Stripe B2B Direct Invoicing.`
                    );
                    setIsSaaSCalculatorOpen(false);
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl border border-black shadow-md flex items-center justify-center gap-2 transition"
                >
                  <CreditCard className="w-4 h-4 text-amber-300" />
                  Confirm & Sync Stripe B2B Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setIsSaaSCalculatorOpen(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-black transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
