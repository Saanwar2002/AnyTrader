import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, Receipt, Briefcase, Plus, Filter,
  Search, ArrowRight, Settings, CheckCircle2, AlertTriangle, Clock,
  Wrench, ShieldCheck, Zap, TrendingUp, BarChart3, FileText, Download,
  Sliders, UserCheck, PieChart, Check, Send, Sparkles, MapPin, RefreshCw, X
} from "lucide-react";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// --- Mock Housing Association Estates & Properties ---
const initialEstates = [
  {
    id: "EST-801",
    name: "Clarion Riverside Estate",
    association: "Clarion Housing Group",
    unitsCount: 1240,
    activeRepairs: 14,
    slaCompliance: 98.5,
    dampRiskIndex: "Low (1.2%)",
    cp12Status: "100% Compliant",
    eicrStatus: "99.2% Compliant",
    leadContractor: "Metro Heating & Gas Ltd"
  },
  {
    id: "EST-802",
    name: "Peabody St. Jude Towers",
    association: "Peabody Trust",
    unitsCount: 850,
    activeRepairs: 28,
    slaCompliance: 94.2,
    dampRiskIndex: "Moderate (4.8%)",
    cp12Status: "98.8% Compliant",
    eicrStatus: "97.5% Compliant",
    leadContractor: "London Premier Trade Services"
  },
  {
    id: "EST-803",
    name: "Pinnacle Horizon Heights",
    association: "Pinnacle Property Mgmt",
    unitsCount: 2150,
    activeRepairs: 9,
    slaCompliance: 99.1,
    dampRiskIndex: "Very Low (0.4%)",
    cp12Status: "100% Compliant",
    eicrStatus: "100% Compliant",
    leadContractor: "Apex Electrical Solutions"
  },
  {
    id: "EST-804",
    name: "Metropolitan West Gardens",
    association: "Metropolitan Thames Valley",
    unitsCount: 610,
    activeRepairs: 19,
    slaCompliance: 91.8,
    dampRiskIndex: "Action Required (8.1%)",
    cp12Status: "95.4% Compliant",
    eicrStatus: "94.0% Compliant",
    leadContractor: "Citywide Plumbing & Drainage"
  }
];

// --- Mock SLA Repair Tickets ---
const initialSlaTickets = [
  {
    id: "REP-9901",
    estate: "Peabody St. Jude Towers",
    unit: "Flat 42B, Tower 2",
    category: "Plumbing & Heating",
    issue: "Boiler Pressure Failure & No Hot Water (Awaab's Law Priority)",
    tenantName: "Sarah Jenkins",
    priority: "Emergency (2h SLA)",
    slaMinutesLeft: 38,
    slaStatus: "critical",
    assignedContractor: "Metro Heating & Gas Ltd",
    status: "Dispatched",
    loggedAt: "1 hour ago"
  },
  {
    id: "REP-9902",
    estate: "Clarion Riverside Estate",
    unit: "Block C, Flat 12",
    category: "Electrical",
    issue: "Communal Hallway Lighting Circuit Trip",
    tenantName: "Estate Mgmt",
    priority: "Urgent (24h SLA)",
    slaMinutesLeft: 720,
    slaStatus: "ontrack",
    assignedContractor: "Apex Electrical Solutions",
    status: "In Progress",
    loggedAt: "3 hours ago"
  },
  {
    id: "REP-9903",
    estate: "Metropolitan West Gardens",
    unit: "Unit 108, West Block",
    category: "Damp & Ventilation",
    issue: "Bathroom Extractor Fan Failure & Surface Mould Inspection",
    tenantName: "Marcus Vance",
    priority: "Urgent (24h SLA)",
    slaMinutesLeft: 140,
    slaStatus: "warning",
    assignedContractor: "Pending Auto-Dispatch",
    status: "Unassigned",
    loggedAt: "18 hours ago"
  },
  {
    id: "REP-9904",
    estate: "Pinnacle Horizon Heights",
    unit: "Penthouse 14, Tower A",
    category: "Roofing & Guttering",
    issue: "Minor Rainwater Gutter Overflow",
    tenantName: "David Miller",
    priority: "Routine (5-day SLA)",
    slaMinutesLeft: 4320,
    slaStatus: "ontrack",
    assignedContractor: "Citywide Plumbing & Drainage",
    status: "Scheduled",
    loggedAt: "Yesterday"
  }
];

// --- Mock Contractor Performance Matrix ---
const initialContractors = [
  {
    id: "CON-501",
    name: "Metro Heating & Gas Ltd",
    trade: "Gas Safety & Heating",
    slaResponseRate: "99.4%",
    avgResolutionTime: "1.8 hrs",
    tenantSatisfaction: 4.9,
    jobsCompleted: 342,
    activeJobs: 4,
    complianceVerified: true,
    tier: "Preferred Enterprise Partner"
  },
  {
    id: "CON-502",
    name: "Apex Electrical Solutions",
    trade: "Electrical & EICR",
    slaResponseRate: "98.1%",
    avgResolutionTime: "2.4 hrs",
    tenantSatisfaction: 4.8,
    jobsCompleted: 289,
    activeJobs: 2,
    complianceVerified: true,
    tier: "Preferred Enterprise Partner"
  },
  {
    id: "CON-503",
    name: "London Premier Trade Services",
    trade: "Multi-Trade Maintenance",
    slaResponseRate: "93.6%",
    avgResolutionTime: "4.1 hrs",
    tenantSatisfaction: 4.6,
    jobsCompleted: 512,
    activeJobs: 7,
    complianceVerified: true,
    tier: "Approved SLA Vendor"
  },
  {
    id: "CON-504",
    name: "Citywide Plumbing & Drainage",
    trade: "Plumbing & Drainage",
    slaResponseRate: "95.8%",
    avgResolutionTime: "3.2 hrs",
    tenantSatisfaction: 4.7,
    jobsCompleted: 198,
    activeJobs: 3,
    complianceVerified: true,
    tier: "Approved SLA Vendor"
  }
];

export default function CorporatePortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"estates" | "sla" | "contractors" | "billing">("sla");
  const [estates, setEstates] = useState(initialEstates);
  const [tickets, setTickets] = useState(initialSlaTickets);
  const [contractors, setContractors] = useState(initialContractors);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicketForDispatch, setSelectedTicketForDispatch] = useState<any | null>(null);
  const [selectedContractorForAssign, setSelectedContractorForAssign] = useState<string>("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  // New Estate Form State
  const [newEstateName, setNewEstateName] = useState("");
  const [newEstateAssoc, setNewEstateAssoc] = useState("");
  const [newEstateUnits, setNewEstateUnits] = useState("250");

  const totalUnits = estates.reduce((acc, e) => acc + e.unitsCount, 0);
  const totalActiveRepairs = tickets.filter(t => t.status !== "Completed").length;
  const criticalSlaCount = tickets.filter(t => t.slaStatus === "critical" || t.slaStatus === "warning").length;
  const avgSlaCompliance = (estates.reduce((acc, e) => acc + e.slaCompliance, 0) / estates.length).toFixed(1);

  const handleAutoDispatchTicket = (ticketId: string, contractorName?: string) => {
    setIsDispatching(true);
    setTimeout(() => {
      const assigned = contractorName || contractors[0].name;
      setTickets(prev =>
        prev.map(t =>
          t.id === ticketId
            ? { ...t, assignedContractor: assigned, status: "Dispatched", slaStatus: "ontrack" }
            : t
        )
      );
      toast.success(`⚡ SLA Repair Ticket ${ticketId} dispatched to ${assigned} under 2h SLA Guarantee!`);
      setIsDispatching(false);
      setSelectedTicketForDispatch(null);
    }, 800);
  };

  const handleOnboardEstate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEstateName) return;

    const newEstate = {
      id: `EST-${Math.floor(100 + Math.random() * 900)}`,
      name: newEstateName,
      association: newEstateAssoc || "Housing Association Partner",
      unitsCount: parseInt(newEstateUnits, 10) || 100,
      activeRepairs: 0,
      slaCompliance: 100.0,
      dampRiskIndex: "Low (0.0%)",
      cp12Status: "100% Compliant",
      eicrStatus: "100% Compliant",
      leadContractor: contractors[0].name
    };

    setEstates([newEstate, ...estates]);
    toast.success(`🏢 Onboarded ${newEstate.name} (${newEstate.unitsCount} Units) to Gotham Enterprise Layer!`);
    setIsOnboardingOpen(false);
    setNewEstateName("");
    setNewEstateAssoc("");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Gotham Enterprise Layer Branding Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] border border-black shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Gotham B2B Enterprise & Housing Association Layer
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-indigo-400 shrink-0" />
              Enterprise Command Center
            </h1>
            <p className="text-sm text-slate-300 font-medium mt-1 max-w-2xl">
              High-capacity portfolio management engine monitoring <strong>{totalUnits.toLocaleString()} units</strong> across social housing, estate trusts, and corporate portfolios with real-time SLA repair time tracking & automated dispatching.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl border border-black shadow-lg flex items-center gap-2 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Onboard Housing Estate / Block
            </button>
            <button
              onClick={() => {
                toast.success("📄 Generating Housing Regulator Compliance & SLA Audit Report (Awaab's Law Standard)...");
              }}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-2xl border border-white/20 shadow-sm flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-cyan-300" />
              Export SLA Audit Report
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Total Managed Housing Stock</p>
            <p className="text-2xl font-black text-white mt-0.5">{totalUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Units</span></p>
          </div>
          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Active SLA Repair Tickets</p>
            <p className="text-2xl font-black text-amber-300 mt-0.5">{totalActiveRepairs} <span className="text-xs font-semibold text-slate-400">Open</span></p>
          </div>
          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Portfolio SLA Compliance</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{avgSlaCompliance}% <span className="text-xs font-semibold text-slate-400">Target &gt;95%</span></p>
          </div>
          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-extrabold text-slate-400">Critical SLA Alerts</p>
            <p className="text-2xl font-black text-red-400 mt-0.5">{criticalSlaCount} <span className="text-xs font-semibold text-slate-400">Priority 1</span></p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2 pb-1">
        <button
          onClick={() => setActiveTab("sla")}
          className={cn(
            "px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition shrink-0",
            activeTab === "sla"
              ? "bg-slate-900 text-white border-black shadow-md"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>SLA Repair Time & Dispatch</span>
          {criticalSlaCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {criticalSlaCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("estates")}
          className={cn(
            "px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition shrink-0",
            activeTab === "estates"
              ? "bg-slate-900 text-white border-black shadow-md"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>Estates & Block Stock ({estates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("contractors")}
          className={cn(
            "px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition shrink-0",
            activeTab === "contractors"
              ? "bg-slate-900 text-white border-black shadow-md"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>Contractor Performance Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={cn(
            "px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition shrink-0",
            activeTab === "billing"
              ? "bg-slate-900 text-white border-black shadow-md"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Receipt className="w-4 h-4 text-cyan-400" />
          <span>Consolidated Enterprise Billing</span>
        </button>
      </div>

      {/* --- TAB 1: SLA REPAIR TIME & AUTOMATED DISPATCH ENGINE --- */}
      {activeTab === "sla" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-black shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repair tickets by estate, tenant, or issue..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Auto-Dispatch Status:</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-600 animate-pulse" />
                Active (Awaab SLA Engine)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {tickets
              .filter(t => t.estate.toLowerCase().includes(searchQuery.toLowerCase()) || t.issue.toLowerCase().includes(searchQuery.toLowerCase()) || t.unit.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((ticket) => (
                <div
                  key={ticket.id}
                  className={cn(
                    "bg-white p-5 rounded-2xl border shadow-sm transition-all space-y-3",
                    ticket.slaStatus === "critical" ? "border-red-500 bg-red-50/20" :
                    ticket.slaStatus === "warning" ? "border-amber-400" : "border-black"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border border-black",
                        ticket.slaStatus === "critical" ? "bg-red-600 text-white" :
                        ticket.slaStatus === "warning" ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
                      )}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{ticket.id}</span>
                          <span className="text-xs text-slate-500 font-bold">• {ticket.estate} ({ticket.unit})</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mt-0.5">{ticket.issue}</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                        ticket.priority.includes("Emergency") ? "bg-red-100 text-red-800 border-red-300" :
                        ticket.priority.includes("Urgent") ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-100 text-slate-800 border-slate-300"
                      )}>
                        {ticket.priority}
                      </span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 border",
                        ticket.slaStatus === "critical" ? "bg-red-600 text-white border-red-700 animate-pulse" :
                        ticket.slaStatus === "warning" ? "bg-amber-500 text-white border-amber-600" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      )}>
                        <Clock className="w-3 h-3" />
                        SLA: {ticket.slaMinutesLeft > 60 ? `${Math.floor(ticket.slaMinutesLeft / 60)}h ${ticket.slaMinutesLeft % 60}m` : `${ticket.slaMinutesLeft} mins`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 text-xs text-slate-600 font-medium">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>👤 Tenant: <strong>{ticket.tenantName}</strong></span>
                      <span>Category: <strong>{ticket.category}</strong></span>
                      <span>Assigned: <strong className={ticket.assignedContractor.includes("Pending") ? "text-amber-600" : "text-indigo-700"}>{ticket.assignedContractor}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      {ticket.assignedContractor.includes("Pending") || ticket.status === "Unassigned" ? (
                        <button
                          onClick={() => setSelectedTicketForDispatch(ticket)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-900 hover:from-blue-800 hover:to-indigo-950 text-white font-extrabold text-xs rounded-xl border border-black shadow-md flex items-center gap-1.5 transition active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          1-Tap Auto-Dispatch SLA Contractor
                        </button>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-xl font-extrabold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Contractor En Route (SLA Guaranteed)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- TAB 2: ESTATES & BLOCK HOUSING STOCK --- */}
      {activeTab === "estates" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {estates.map((est) => (
            <div key={est.id} className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {est.association}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1">{est.name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{est.unitsCount.toLocaleString()} Housing Units • ID: {est.id}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-400 uppercase">SLA Compliance</p>
                  <p className="text-2xl font-black text-emerald-600">{est.slaCompliance}%</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Gas CP12</p>
                  <p className="font-extrabold text-slate-900 mt-0.5">{est.cp12Status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">EICR Certs</p>
                  <p className="font-extrabold text-slate-900 mt-0.5">{est.eicrStatus}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Damp & Mould Risk</p>
                  <p className={cn(
                    "font-extrabold mt-0.5",
                    est.dampRiskIndex.includes("Action") ? "text-red-600" : "text-emerald-700"
                  )}>{est.dampRiskIndex}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-600 font-medium">Lead Contractor: <strong>{est.leadContractor}</strong></span>
                <button
                  onClick={() => {
                    toast.success(`⚡ Triggered bulk compliance & damp inspection dispatch for all ${est.unitsCount} units in ${est.name}!`);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl border border-black shadow-sm flex items-center gap-1 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  Auto-Dispatch Block Inspection
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 3: CONTRACTOR PERFORMANCE MATRIX --- */}
      {activeTab === "contractors" && (
        <div className="bg-white border border-black rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">Approved SLA Contractor Performance Matrix</h3>
              <p className="text-xs text-slate-500 font-medium">Evaluation matrix scoring contractor SLA response time, tenant ratings, and compliance checks.</p>
            </div>
            <button
              onClick={() => toast.info("Opening SLA Vendor Accreditation Portal...")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl border border-black shadow-sm flex items-center gap-1.5 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              Accredit New Contractor
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-black font-extrabold text-slate-700 uppercase">
                  <th className="px-6 py-4">Contractor / Firm</th>
                  <th className="px-6 py-4">Primary Specialty</th>
                  <th className="px-6 py-4">SLA Response Rate</th>
                  <th className="px-6 py-4">Avg Resolution Time</th>
                  <th className="px-6 py-4">Tenant Rating</th>
                  <th className="px-6 py-4">Active Capacity</th>
                  <th className="px-6 py-4 text-center">Accreditation Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-900">
                {contractors.map((con) => (
                  <tr key={con.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900 text-sm">{con.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{con.id} • {con.jobsCompleted} Jobs Completed</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{con.trade}</td>
                    <td className="px-6 py-4 text-emerald-600 font-black">{con.slaResponseRate}</td>
                    <td className="px-6 py-4 font-bold">{con.avgResolutionTime}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 font-black text-amber-600">
                        <span>★ {con.tenantSatisfaction}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800 font-bold border border-slate-200">
                        {con.activeJobs} Active Jobs
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        {con.tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 4: CONSOLIDATED ENTERPRISE BILLING --- */}
      {activeTab === "billing" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">Consolidated B2B Enterprise Invoicing</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Automated monthly billing consolidated across all housing developments & estates via Stripe Invoicing.</p>
            </div>
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Stripe B2B Auto-Pay Enabled
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-black space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">Current Month Draft (MTD)</p>
              <p className="text-3xl font-black text-amber-300">£148,250</p>
              <p className="text-[11px] text-slate-300">Invoice date: 1st of next month</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-500">Approved Purchase Orders</p>
              <p className="text-3xl font-black text-slate-900">42 POs</p>
              <p className="text-[11px] text-slate-500">100% SLA Verified</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-500">Average Job Cost</p>
              <p className="text-3xl font-black text-indigo-600">£184.50</p>
              <p className="text-[11px] text-slate-500">Incl. material wholesale discounts</p>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: AUTOMATED REPAIR DISPATCH MODAL --- */}
      <AnimatePresence>
        {selectedTicketForDispatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-lg w-full p-6 space-y-5 overflow-hidden relative"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <Zap className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Auto-Dispatch SLA Repair</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">{selectedTicketForDispatch.id} • {selectedTicketForDispatch.estate}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTicketForDispatch(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <p className="font-bold text-slate-900">{selectedTicketForDispatch.issue}</p>
                <div className="flex justify-between text-slate-600">
                  <span>Unit: {selectedTicketForDispatch.unit}</span>
                  <span className="font-extrabold text-red-600">{selectedTicketForDispatch.priority}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-900 uppercase">Select Accredited Contractor:</label>
                <select
                  value={selectedContractorForAssign}
                  onChange={(e) => setSelectedContractorForAssign(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">⚡ Auto-Select Best Rated SLA Partner (Recommended)</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.trade} - {c.slaResponseRate} SLA Rate)</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAutoDispatchTicket(selectedTicketForDispatch.id, selectedContractorForAssign)}
                  disabled={isDispatching}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl border border-black shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                  {isDispatching ? "Dispatching..." : "Confirm SLA Dispatch"}
                </button>
                <button
                  onClick={() => setSelectedTicketForDispatch(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-black transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: ONBOARD HOUSING ESTATE MODAL --- */}
      <AnimatePresence>
        {isOnboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-md w-full p-6 space-y-5 overflow-hidden relative"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-lg font-black text-slate-900">Onboard Housing Estate Block</h3>
                </div>
                <button
                  onClick={() => setIsOnboardingOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleOnboardEstate} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase">Estate / Development Name</label>
                  <input
                    type="text"
                    required
                    value={newEstateName}
                    onChange={(e) => setNewEstateName(e.target.value)}
                    placeholder="e.g. St. George Riverside Estate"
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase">Housing Association / Trust Name</label>
                  <input
                    type="text"
                    value={newEstateAssoc}
                    onChange={(e) => setNewEstateAssoc(e.target.value)}
                    placeholder="e.g. Clarion Housing Group"
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase">Total Unit Count</label>
                  <input
                    type="number"
                    value={newEstateUnits}
                    onChange={(e) => setNewEstateUnits(e.target.value)}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl border border-black shadow-md transition"
                  >
                    Onboard to Gotham Layer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(false)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-black transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
