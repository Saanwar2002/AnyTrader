import React, { useState } from "react";
import {
  Car, Users, CreditCard, Building2, Calendar, MapPin, Search,
  Plus, CheckCircle2, AlertCircle, Clock, ShieldCheck, Download,
  Receipt, ArrowRight, Zap, Sparkles, Send, X, RefreshCw, ChevronRight,
  TrendingUp, Sliders, DollarSign, UserCheck, Plane, Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/src/lib/utils";

// --- Mock Corporate Accounts & Departments ---
const initialDepartments = [
  { id: "DEP-101", name: "Executive & Board", code: "CC-901", activeEmployees: 8, monthlyAllowance: 2500, spentMTD: 1840, priority: "VIP Executive (4.95+ Drivers)" },
  { id: "DEP-102", name: "Sales & Client Operations", code: "CC-402", activeEmployees: 24, monthlyAllowance: 3500, spentMTD: 2190, priority: "Standard + MPV 7-Seater" },
  { id: "DEP-103", name: "Engineering & Field Support", code: "CC-305", activeEmployees: 42, monthlyAllowance: 4000, spentMTD: 3120, priority: "Standard Taxi & Electric" },
  { id: "DEP-104", name: "HR & Finance", code: "CC-100", activeEmployees: 12, monthlyAllowance: 1200, spentMTD: 640, priority: "Late Night Commute Safety" }
];

// --- Mock Live Corporate Rides ---
const initialActiveRides = [
  {
    id: "RIDE-9921",
    passengerName: "Eleanor Vance (VP Sales)",
    department: "Sales & Client Operations",
    pickup: "Canary Wharf, One Canada Square",
    dropoff: "Heathrow Airport Terminal 5",
    vehicleType: "Executive Mercedes E-Class",
    driverName: "Michael K. (4.98 ★)",
    driverPhone: "+44 7700 900112",
    status: "En Route to Heathrow",
    fare: 84.50,
    eta: "24 mins",
    costCenter: "CC-402"
  },
  {
    id: "RIDE-9920",
    passengerName: "Jameson Miller (Engineer)",
    department: "Engineering & Field Support",
    pickup: "London Bridge Station",
    dropoff: "Shoreditch Tech Hub",
    vehicleType: "Zero-Emission Electric Cab",
    driverName: "Tariq A. (4.92 ★)",
    driverPhone: "+44 7700 900871",
    status: "Passenger On Board",
    fare: 22.00,
    eta: "8 mins",
    costCenter: "CC-305"
  },
  {
    id: "RIDE-9918",
    passengerName: "Board Visitor (Client)",
    department: "Executive & Board",
    pickup: "Gatwick Airport South Terminal",
    dropoff: "The Ritz London, Mayfair",
    vehicleType: "Luxury Mercedes S-Class",
    driverName: "David P. (4.99 ★)",
    driverPhone: "+44 7700 900331",
    status: "Scheduled (Flight BA2490 Synced)",
    fare: 110.00,
    eta: "Pickup at 18:30",
    costCenter: "CC-901"
  }
];

export default function CorporatePortal() {
  const [activeTab, setActiveTab] = useState<"rides" | "departments" | "billing" | "vouchers">("rides");
  const [departments, setDepartments] = useState(initialDepartments);
  const [activeRides, setActiveRides] = useState(initialActiveRides);
  const [searchQuery, setSearchQuery] = useState("");

  // Ride Booking Modal
  const [isBookRideOpen, setIsBookRideOpen] = useState(false);
  const [passengerName, setPassengerName] = useState("");
  const [pickupLoc, setPickupLoc] = useState("");
  const [dropoffLoc, setDropoffLoc] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("Executive Mercedes E-Class");
  const [selectedDept, setSelectedDept] = useState("Sales & Client Operations");

  // New Department Modal
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptAllowance, setNewDeptAllowance] = useState("2000");

  const totalSpentMTD = departments.reduce((acc, d) => acc + d.spentMTD, 0);
  const totalAllowance = departments.reduce((acc, d) => acc + d.monthlyAllowance, 0);
  const totalEmployees = departments.reduce((acc, d) => acc + d.activeEmployees, 0);

  const handleBookCorporateRide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerName || !pickupLoc || !dropoffLoc) return;

    const newRide = {
      id: `RIDE-${Math.floor(1000 + Math.random() * 9000)}`,
      passengerName,
      department: selectedDept,
      pickup: pickupLoc,
      dropoff: dropoffLoc,
      vehicleType: selectedVehicle,
      driverName: "Assigned Executive Driver (4.95+)",
      driverPhone: "+44 7700 900555",
      status: "Driver Dispatched",
      fare: selectedVehicle.includes("Luxury") ? 95.00 : 45.00,
      eta: "6 mins",
      costCenter: departments.find(d => d.name === selectedDept)?.code || "CC-100"
    };

    setActiveRides([newRide, ...activeRides]);
    toast.success(`🚖 Corporate Taxi Dispatched for ${passengerName}! Driver arriving in 6 mins.`);
    setIsBookRideOpen(false);
    setPassengerName("");
    setPickupLoc("");
    setDropoffLoc("");
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;

    const newDept = {
      id: `DEP-${Math.floor(100 + Math.random() * 900)}`,
      name: newDeptName,
      code: newDeptCode || `CC-${Math.floor(100 + Math.random() * 900)}`,
      activeEmployees: 5,
      monthlyAllowance: parseInt(newDeptAllowance, 10) || 1000,
      spentMTD: 0,
      priority: "Standard & Executive"
    };

    setDepartments([...departments, newDept]);
    toast.success(`🏢 Department '${newDept.name}' added with £${newDept.monthlyAllowance}/mo ride allowance!`);
    setIsAddDeptOpen(false);
    setNewDeptName("");
    setNewDeptCode("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* AnyRoller Corporate Taxi Portal Header */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 rounded-3xl border border-black shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-sm">
              <Car className="w-4 h-4 text-white" />
              AnyRoller Corporate Taxi & Fleet Account
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Corporate Passenger Travel & Expenses
            </h1>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Centralized corporate ride dispatch, executive airport transfers, employee commute vouchers, and consolidated Net-30 monthly invoicing for <strong>{totalEmployees} enrolled employees</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsBookRideOpen(true)}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl border border-black shadow-lg flex items-center gap-2 transition active:scale-95"
            >
              <Car className="w-4 h-4 text-amber-300" />
              <span>Dispatch Corporate Taxi</span>
            </button>
          </div>
        </div>

        {/* Corporate Fleet KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-black text-slate-400">Monthly Ride Budget</p>
            <p className="text-2xl font-black text-white mt-1">£{totalAllowance.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Across {departments.length} Departments</p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-black text-slate-400">Spent MTD (Consolidated)</p>
            <p className="text-2xl font-black text-amber-300 mt-1">£{totalSpentMTD.toLocaleString()}</p>
            <p className="text-[10px] text-slate-300 font-semibold mt-0.5">{Math.round((totalSpentMTD / totalAllowance) * 100)}% Budget Utilized</p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-black text-slate-400">Active Rides En Route</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{activeRides.length} Vehicles</p>
            <p className="text-[10px] text-blue-300 font-semibold mt-0.5">Live Flight & GPS Tracked</p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-black text-slate-400">Vetted Executive Drivers</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">4.95 ★</p>
            <p className="text-[10px] text-emerald-300 font-semibold mt-0.5">Enhanced DBS & VIP Vetted</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2">
        {[
          { id: "rides", label: "Active Corporate Rides", icon: Car },
          { id: "departments", label: "Department Budgets & Roster", icon: Building2 },
          { id: "vouchers", label: "Employee Commute Vouchers", icon: Sparkles },
          { id: "billing", label: "Monthly Invoices & Stripe B2B", icon: Receipt }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 font-black text-xs whitespace-nowrap border-b-2 transition -mb-px rounded-t-2xl",
                isActive
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: ACTIVE CORPORATE RIDES --- */}
      {activeTab === "rides" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">Live Corporate Fleet & Dispatch Monitor</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Real-time GPS tracking and flight-synchronised pickups for staff and VIP clients.</p>
            </div>

            <button
              onClick={() => setIsBookRideOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl border border-black shadow-sm transition active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Dispatch New Ride
            </button>
          </div>

          <div className="space-y-4">
            {activeRides.map(ride => (
              <div key={ride.id} className="p-5 rounded-2xl border border-black bg-slate-50 space-y-3 hover:border-blue-600 transition">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                      {ride.id}
                    </span>
                    <h4 className="font-black text-slate-900 text-sm">{ride.passengerName}</h4>
                    <span className="text-xs text-slate-500 font-semibold">• {ride.department} ({ride.costCenter})</span>
                  </div>

                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-3 py-1 rounded-full border border-blue-300 uppercase tracking-wider">
                    {ride.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div className="space-y-1">
                    <p className="text-slate-400 font-bold uppercase text-[10px]">Route Details</p>
                    <p className="font-extrabold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      {ride.pickup}
                    </p>
                    <p className="font-extrabold text-slate-700 flex items-center gap-1 pl-4">
                      ↓ {ride.dropoff}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 text-right">
                    <div>
                      <p className="text-slate-400 font-bold uppercase text-[10px]">Vehicle & Driver</p>
                      <p className="font-black text-slate-900">{ride.vehicleType}</p>
                      <p className="text-[11px] text-slate-500">{ride.driverName}</p>
                    </div>

                    <div className="border-l border-slate-200 pl-4">
                      <p className="text-slate-400 font-bold uppercase text-[10px]">Fare Charge</p>
                      <p className="font-black text-blue-600 text-base">£{ride.fare.toFixed(2)}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">ETA: {ride.eta}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 2: DEPARTMENT BUDGETS & ROSTER --- */}
      {activeTab === "departments" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900">Corporate Departments & Travel Caps</h3>
              <p className="text-xs text-slate-500 font-semibold">Assign cost center codes and monthly ride spending limits per business unit.</p>
            </div>

            <button
              onClick={() => setIsAddDeptOpen(true)}
              className="px-4 py-2.5 bg-blue-600 text-white font-black text-xs rounded-2xl border border-black shadow-sm flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {departments.map(dept => {
              const utilPercent = Math.round((dept.spentMTD / dept.monthlyAllowance) * 100);
              return (
                <div key={dept.id} className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {dept.code}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">{dept.name}</h3>
                      <p className="text-xs text-slate-500 font-semibold">{dept.activeEmployees} Enrolled Employees</p>
                    </div>

                    <span className="bg-slate-100 text-slate-900 font-black text-xs px-3 py-1 rounded-2xl border border-slate-300">
                      £{dept.monthlyAllowance.toLocaleString()} / mo
                    </span>
                  </div>

                  {/* Budget Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">MTD Usage (£{dept.spentMTD})</span>
                      <span className={cn(utilPercent > 85 ? "text-rose-600" : "text-blue-600")}>{utilPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={cn("h-full transition-all duration-500", utilPercent > 85 ? "bg-rose-500" : "bg-blue-600")}
                        style={{ width: `${Math.min(100, utilPercent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100 text-slate-600">
                    <span>Priority Class: <strong>{dept.priority}</strong></span>
                    <button
                      onClick={() => toast.success(`📊 Generated CSV travel report for ${dept.name} (${dept.code})`)}
                      className="text-blue-600 font-black hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Usage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 3: COMMUTE VOUCHERS --- */}
      {activeTab === "vouchers" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">Employee Commute & Travel Vouchers</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Issue single-use or monthly ride passes for late-night office commutes or client meetings.</p>
            </div>

            <button
              onClick={() => toast.success("🎟️ Generated 10x Commute Vouchers (£25 limit each) for late-night staff!")}
              className="px-4 py-2 bg-emerald-600 text-white font-black text-xs rounded-2xl border border-black shadow-sm transition active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Generate 10x Commute Passes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl border border-black bg-gradient-to-br from-blue-900 to-slate-900 text-white space-y-3">
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                Late-Night Office Safety
              </span>
              <h4 className="font-black text-lg text-white">Late-Night Staff Commute Pass</h4>
              <p className="text-xs text-slate-300 font-medium">Auto-activated after 8:00 PM for all registered office staff for home drop-offs.</p>
              <div className="pt-2 border-t border-white/10 text-xs flex justify-between text-amber-300 font-bold">
                <span>Cap: £35 / ride</span>
                <span>Active 7 days/wk</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-black bg-slate-900 text-white space-y-3">
              <span className="bg-blue-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                VIP Client Pass
              </span>
              <h4 className="font-black text-lg text-white">Executive Airport Transfer Pass</h4>
              <p className="text-xs text-slate-300 font-medium">Includes Mercedes E-Class / S-Class with airport meet-and-greet service.</p>
              <div className="pt-2 border-t border-white/10 text-xs flex justify-between text-blue-300 font-bold">
                <span>Cap: £150 / ride</span>
                <span>Includes Flight Sync</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-black bg-slate-50 text-slate-900 space-y-3">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300 uppercase">
                Eco Fleet Pass
              </span>
              <h4 className="font-black text-lg text-slate-900">Zero-Emission Green Commute</h4>
              <p className="text-xs text-slate-600 font-medium">Restricted to 100% Electric Taxis for corporate ESG sustainability targets.</p>
              <div className="pt-2 border-t border-slate-200 text-xs flex justify-between text-emerald-700 font-bold">
                <span>Cap: £25 / ride</span>
                <span>100% EV Guaranteed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: MONTHLY INVOICES & STRIPE B2B --- */}
      {activeTab === "billing" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">Consolidated B2B Corporate Ride Invoicing</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Automated Net-30 monthly ride billing via Stripe Invoicing with cost center breakdown.</p>
            </div>

            <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Stripe Direct Corporate Auto-Debit Enabled
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-black space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">Current Month Draft (MTD)</p>
              <p className="text-3xl font-black text-amber-300">£{totalSpentMTD.toLocaleString()}.00</p>
              <p className="text-[11px] text-slate-300">Invoice date: 1st of next month</p>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-500">Completed Corporate Journeys</p>
              <p className="text-3xl font-black text-slate-900">142 Rides</p>
              <p className="text-[11px] text-slate-500">100% Tax & VAT Itemized</p>
            </div>

            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 space-y-1">
              <p className="text-[10px] uppercase font-bold text-blue-700">Average Fare / Trip</p>
              <p className="text-3xl font-black text-blue-900">£38.40</p>
              <p className="text-[11px] text-blue-700 font-semibold">Incl. corporate discount rate</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => toast.success("📄 Downloaded itemized Net-30 Stripe B2B Invoice PDF with cost center breakdown!")}
              className="px-5 py-3 bg-slate-900 text-white font-black text-xs rounded-xl border border-black hover:bg-slate-800 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Full Itemized B2B Tax Invoice (PDF)
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: DISPATCH CORPORATE TAXI --- */}
      <AnimatePresence>
        {isBookRideOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-lg w-full p-6 space-y-6 overflow-hidden relative"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-black text-slate-900">Dispatch Corporate Taxi / VIP Ride</h3>
                <button onClick={() => setIsBookRideOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBookCorporateRide} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-700 mb-1">Passenger Name / VIP Visitor</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins (Client Executive)"
                    value={passengerName}
                    onChange={e => setPassengerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Charging Department</label>
                  <select
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 mb-1">Pickup Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Canary Wharf"
                      value={pickupLoc}
                      onChange={e => setPickupLoc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Dropoff Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Heathrow Airport T5"
                      value={dropoffLoc}
                      onChange={e => setDropoffLoc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Vehicle Fleet Class</label>
                  <select
                    value={selectedVehicle}
                    onChange={e => setSelectedVehicle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  >
                    <option value="Executive Mercedes E-Class">Executive Sedan (Mercedes E-Class)</option>
                    <option value="Luxury Mercedes S-Class">Luxury VIP (Mercedes S-Class)</option>
                    <option value="Zero-Emission Electric Cab">Zero-Emission Electric Cab</option>
                    <option value="MPV 7-Seater Group Van">MPV 7-Seater Executive Van</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white font-extrabold rounded-xl border border-black hover:bg-blue-700 transition"
                  >
                    Confirm & Dispatch Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBookRideOpen(false)}
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

      {/* --- MODAL: ADD DEPARTMENT --- */}
      <AnimatePresence>
        {isAddDeptOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-md w-full p-6 space-y-6 overflow-hidden relative"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-black text-slate-900">Add Corporate Department</h3>
                <button onClick={() => setIsAddDeptOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddDepartment} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-700 mb-1">Department Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marketing & Events"
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Cost Center Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CC-501"
                    value={newDeptCode}
                    onChange={e => setNewDeptCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Monthly Ride Budget Cap (£)</label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={newDeptAllowance}
                    onChange={e => setNewDeptAllowance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-black rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white font-extrabold rounded-xl border border-black hover:bg-blue-700 transition"
                  >
                    Add Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddDeptOpen(false)}
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
    </div>
  );
}
