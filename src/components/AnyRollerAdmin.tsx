import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart3, Map, Car, ClipboardList, DollarSign, Star, 
  Tag, Users, UserCircle, Settings, ShieldCheck, MapPin, 
  Activity, Calendar, ShieldAlert, Ticket, StarHalf, 
  Megaphone, Gift, Link, Database, Lock, Search, Bell, Award,
  Building2
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
import CorporatePortal from "./anyroller/CorporatePortal";

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
  { id: "subscriptions", label: "Subscriptions", icon: StarHalf, category: "Financials" },
  { id: "corporate", label: "Corporate (B2B)", icon: Building2, category: "Financials" },
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
  const [pendingVehicleCount, setPendingVehicleCount] = useState(0);
  const [pendingDocCount, setPendingDocCount] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    // We can map additional keywords for specific tools to help users discover them
    const keywordMap: Record<string, string[]> = {
      "zones": ["surge", "serge", "heatmap", "pricing", "multiplier", "dynamic", "geofence", "map", "radius"],
      "payments": ["stripe", "revenue", "commission", "fee", "payout", "balance", "money"],
      "dispatch": ["queue", "timeout", "matching", "radius", "bidding", "bids", "algorithm"],
      "priority": ["newcomer", "fairness", "penalty", "boost", "complain"],
      "vehicles": ["approval", "car", "van", "truck", "fleet", "class"],
      "documents": ["license", "insurance", "mot", "background check"],
      "drivers": ["ban", "suspend", "block", "approve", "live", "status"],
      "riders": ["passenger", "customer", "user", "ban"],
      "scheduled": ["booking", "future", "later", "reserved"],
      "sos": ["emergency", "police", "help", "alert", "danger", "crash"],
      "anytrader": ["roles", "sync", "master"],
      "dashboard": ["overview", "stats", "volume", "active"],
      "promos": ["discount", "coupon", "code", "marketing"],
      "settings": ["global", "maintenance", "offline", "general"]
    };

    const q = searchQuery.toLowerCase();
    
    return SIDEBAR_ITEMS.filter(item => {
      // Check title match
      if (item.label.toLowerCase().includes(q)) return true;
      // Check category match
      if (item.category.toLowerCase().includes(q)) return true;
      // Check targeted keywords match
      const kw = keywordMap[item.id];
      if (kw && kw.some(word => word.includes(q))) return true;
      
      return false;
    });
  }, [searchQuery]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => doc.data());
      const drivers = allUsers.filter((u: any) => 
        u.role === "driver" || 
        (u.memberId && u.memberId.startsWith("D-")) || 
        u.isDriver
      );
      const pendingApprovalDrivers = drivers.filter((d: any) => d.requestedVehicleCategories && d.requestedVehicleCategories.length > 0);
      setPendingVehicleCount(pendingApprovalDrivers.length);

      // Document compliance count
      let docCount = 0;
      allUsers.forEach((u: any) => {
        if (u.verificationDocs && Array.isArray(u.verificationDocs)) {
          u.verificationDocs.forEach((d: any) => {
            if (d.status === "pending") {
              docCount++;
            }
          });
        }
      });
      setPendingDocCount(docCount);
    });
    return () => unsub();
  }, []);

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
                    <span className="flex-1">{item.label}</span>
                    {item.id === "vehicles" && pendingVehicleCount > 0 && (
                      <span className="bg-red-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-5 animate-pulse">
                        {pendingVehicleCount}
                      </span>
                    )}
                    {item.id === "documents" && pendingDocCount > 0 && (
                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-5 animate-pulse">
                        {pendingDocCount}
                      </span>
                    )}
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
            <div className="relative z-50">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search settings (e.g. surge)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="w-64 pl-9 pr-4 py-1.5 bg-slate-100 border border-transparent rounded-full text-sm outline-none focus:ring-2 focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
              />
              
              <AnimatePresence>
                {isSearchFocused && searchQuery.trim() && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full lg:right-0 right-auto left-auto lg:left-auto pt-2 w-80 transform lg:translate-x-0 -translate-x-1/2 mr-2"
                  >
                    <div className="bg-white border md:border-black border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-[350px] overflow-y-auto">
                      {searchResults.length > 0 ? (
                        <div className="py-2">
                          <h3 className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
                            Search Results ({searchResults.length})
                          </h3>
                          {searchResults.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveScreen(item.id);
                                setSearchQuery("");
                                setIsSearchFocused(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50/80 active:bg-emerald-100 transition-colors text-left border-b border-slate-50 last:border-0 group"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 transition-colors shrink-0">
                                <item.icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700">{item.label}</p>
                                <p className="text-[11px] text-slate-500 truncate">{item.category}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 flex flex-col items-center justify-center text-center">
                          <Search className="w-8 h-8 text-slate-200 mb-2" />
                          <p className="text-sm font-bold text-slate-800">No results found</p>
                          <p className="text-xs text-slate-500 mt-1">Try searching for "surge" or "drivers"</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors border border-transparent rounded-full hover:bg-slate-100">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
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
           ) : activeScreen === "corporate" ? (
             <CorporatePortal />
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
