import React, { useState } from "react";
import { 
  BarChart3, Map, Car, ClipboardList, DollarSign, Star, 
  Tag, Users, UserCircle, Settings, ShieldCheck, MapPin, 
  Activity, Calendar, ShieldAlert, Ticket, StarHalf, 
  Megaphone, Gift, Link, Database, Lock, Search, Bell, Award
} from "lucide-react";
import RidesCommandCenter from "./RidesCommandCenter";
import AnyRollerDashboard from "./anyroller/AnyRollerDashboard";
import RideHistory from "./anyroller/RideHistory";
import ScheduledRides from "./anyroller/ScheduledRides";
import PaymentsRevenue from "./anyroller/PaymentsRevenue";
import PricingFares from "./anyroller/PricingFares";
import VehicleManagement from "./anyroller/VehicleManagement";
import PrioritySettings from "./anyroller/PrioritySettings";
import DispatchEngine from "./anyroller/DispatchEngine";
import ZonesGeofences from "./anyroller/ZonesGeofences";
import LiveMap from "./anyroller/LiveMap";
import SubscriptionManager from "./anyroller/SubscriptionManager";

import DriversList from "./anyroller/DriversList";
import RidersList from "./anyroller/RidersList";
import DocumentCompliance from "./anyroller/DocumentCompliance";
import SOSManager from "./anyroller/SOSManager";

import SupportTickets from "./anyroller/SupportTickets";
import RatingsReviews from "./anyroller/RatingsReviews";
import BroadcastMessaging from "./anyroller/BroadcastMessaging";
import Promotions from "./anyroller/Promotions";
import Referrals from "./anyroller/Referrals";

import Analytics from "./anyroller/Analytics";
import AnyTraderIntegration from "./anyroller/AnyTraderIntegration";
import AdminUsers from "./anyroller/AdminUsers";
import AuditLog from "./anyroller/AuditLog";
import GlobalSettings from "./anyroller/GlobalSettings";
import AdminTierManager from "./AdminTierManager";

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, category: "Core" },
  { id: "live_map", label: "Live Map", icon: Map, category: "Core" },
  { id: "active_rides", label: "Active Rides", icon: Car, category: "Core" },
  { id: "ride_history", label: "Ride History", icon: ClipboardList, category: "Core" },

  { id: "payments", label: "Payments & Revenue", icon: DollarSign, category: "Financials" },
  { id: "priority", label: "Priority Settings", icon: Star, category: "Financials" },
  { id: "pricing", label: "Pricing & Fares", icon: Tag, category: "Financials" },
  { id: "subscriptions", label: "Subscriptions & B2B", icon: StarHalf, category: "Financials" },
  { id: "tiers", label: "Tiers, Perks & Privileges", icon: Star, category: "Financials" },

  { id: "drivers", label: "Drivers", icon: Users, category: "Users" },
  { id: "riders", label: "Riders", icon: UserCircle, category: "Users" },
  { id: "vehicles", label: "Vehicles", icon: Car, category: "Users" },
  { id: "documents", label: "Documents & Compliance", icon: ShieldCheck, category: "Users" },

  { id: "zones", label: "Zones & Geofences", icon: MapPin, category: "Operations" },
  { id: "dispatch", label: "Dispatch Engine", icon: Activity, category: "Operations" },
  { id: "scheduled", label: "Scheduled Rides", icon: Calendar, category: "Operations" },

  { id: "sos", label: "SOS & Safety", icon: ShieldAlert, category: "Support" },
  { id: "tickets", label: "Support Tickets", icon: Ticket, category: "Support" },
  { id: "ratings", label: "Ratings & Reviews", icon: StarHalf, category: "Support" },
  { id: "broadcasts", label: "Broadcasts", icon: Megaphone, category: "Support" },

  { id: "promos", label: "Promotions", icon: Gift, category: "Marketing" },
  { id: "referrals", label: "Referrals", icon: Link, category: "Marketing" },
  { id: "analytics", label: "Analytics", icon: BarChart3, category: "Marketing" },

  { id: "anytrader", label: "AnyTrader Integration", icon: Link, category: "System" },
  { id: "admin_users", label: "Admin Users & RBAC", icon: Lock, category: "System" },
  { id: "audit_log", label: "Audit Log", icon: Database, category: "System" },
  { id: "settings", label: "Settings", icon: Settings, category: "System" }
];

export default function AnyRollerAdmin() {
  const [activeScreen, setActiveScreen] = useState("dashboard");

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden text-sm">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full overflow-y-auto no-scrollbar shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-emerald-500" />
            AnyRoller
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block -mt-1">Command Center</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-6 pb-8">
          {["Core", "Financials", "Users", "Operations", "Support", "Marketing", "System"].map(category => (
            <div key={category}>
              <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 px-3">
                {category}
              </h2>
              <div className="space-y-0.5">
                {SIDEBAR_ITEMS.filter(item => item.category === category).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveScreen(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      activeScreen === item.id 
                        ? "bg-emerald-500/10 text-emerald-400 font-medium" 
                        : "hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-black flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            {SIDEBAR_ITEMS.find(i => i.id === activeScreen)?.label || "Dashboard"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-black"></span>
            </button>
          </div>
        </header>

        {/* Dynamic Screen Content */}
        <div className="flex-1 overflow-y-auto p-6">
           {activeScreen === "dashboard" ? (
             <AnyRollerDashboard />
           ) : activeScreen === "live_map" ? (
             <LiveMap />
           ) : activeScreen === "active_rides" ? (
             <RidesCommandCenter />
           ) : activeScreen === "ride_history" ? (
             <RideHistory />
           ) : activeScreen === "scheduled" ? (
             <ScheduledRides />
           ) : activeScreen === "payments" ? (
             <PaymentsRevenue />
           ) : activeScreen === "priority" ? (
             <PrioritySettings />
           ) : activeScreen === "subscriptions" ? (
             <SubscriptionManager />
           ) : activeScreen === "tiers" ? (
             <div className="p-8 h-full overflow-y-auto">
               <div className="mb-6 space-y-1">
                 <h2 className="text-xl font-bold text-slate-900">Perks & Privileges Matrix</h2>
                 <p className="text-slate-500">Manage global limits, pricing, and capabilities for taxi drivers.</p>
               </div>
               <AdminTierManager modelsToShow={["on_demand_transport"]} />
             </div>
           ) : activeScreen === "pricing" ? (
             <PricingFares />
           ) : activeScreen === "vehicles" ? (
             <VehicleManagement />
           ) : activeScreen === "dispatch" ? (
             <DispatchEngine />
           ) : activeScreen === "zones" ? (
             <ZonesGeofences />
           ) : activeScreen === "drivers" ? (
             <DriversList />
           ) : activeScreen === "riders" ? (
             <RidersList />
           ) : activeScreen === "documents" ? (
             <DocumentCompliance />
           ) : activeScreen === "sos" ? (
             <SOSManager />
           ) : activeScreen === "tickets" ? (
             <SupportTickets />
           ) : activeScreen === "ratings" ? (
             <RatingsReviews />
           ) : activeScreen === "broadcasts" ? (
             <BroadcastMessaging />
           ) : activeScreen === "promos" ? (
             <Promotions />
           ) : activeScreen === "referrals" ? (
             <Referrals />
           ) : activeScreen === "analytics" ? (
             <Analytics />
           ) : activeScreen === "anytrader" ? (
             <AnyTraderIntegration />
           ) : activeScreen === "admin_users" ? (
             <AdminUsers />
           ) : activeScreen === "audit_log" ? (
             <AuditLog />
           ) : activeScreen === "settings" ? (
             <GlobalSettings />
           ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <Car className="w-12 h-12 mb-4 text-slate-200" />
               <p className="text-lg font-medium">{SIDEBAR_ITEMS.find(i => i.id === activeScreen)?.label} module under construction.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
