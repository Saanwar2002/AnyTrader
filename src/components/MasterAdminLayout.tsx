import React, { useState, useEffect } from "react";
import AnyTraderAdmin from "./AnyTraderAdmin";
import AnyRollerAdmin from "./AnyRollerAdmin";
import { useAuth } from "./AuthProvider";
import { Building2, Car, Shield, LogOut, Users, Activity, PoundSterling, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, handleFirestoreError, OperationType } from "@/src/firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";

export default function MasterAdminLayout() {
  const { profile } = useAuth();
  
  // Tabs: 'super_admin', 'anytrader', 'anyroller'
  const [activePortal, setActivePortal] = useState<"super_admin" | "anytrader" | "anyroller">("anytrader");

  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalTraders: 0,
    totalDrivers: 0,
    totalJobs: 0,
    totalRides: 0,
    platformRevenue: 0
  });

  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    if (activePortal !== "super_admin") return;

    setLoadingMetrics(true);

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = snapshot.docs.map(d => d.data());
      setMetrics(prev => ({
        ...prev,
        totalUsers: users.length,
        totalTraders: users.filter(u => u.role === "tradesperson").length,
        totalDrivers: users.filter(u => u.services?.includes("Taxi & Transport")).length
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, "users"));

    const unsubJobs = onSnapshot(collection(db, "jobs"), (snapshot) => {
      setMetrics(prev => ({ ...prev, totalJobs: snapshot.docs.length }));
    }, (error) => handleFirestoreError(error, OperationType.GET, "jobs"));

    const unsubRides = onSnapshot(collection(db, "ride_requests"), (snapshot) => {
      setMetrics(prev => ({ ...prev, totalRides: snapshot.docs.length }));
    }, (error) => handleFirestoreError(error, OperationType.GET, "ride_requests"));

    setLoadingMetrics(false);

    return () => {
      unsubUsers();
      unsubJobs();
      unsubRides();
    };
  }, [activePortal]);

  const handleLogout = () => {
    signOut(auth).then(() => {
      window.location.href = "/";
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Universal Top Nav for Portals */}
      <div className="bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight text-slate-900 hidden sm:inline-block">AnyEcosystem <span className="font-normal text-slate-500">Admin</span></span>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          {/* Portal Switcher Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActivePortal("super_admin")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                activePortal === "super_admin" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Super Admin</span>
            </button>
            <button
              onClick={() => setActivePortal("anytrader")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                activePortal === "anytrader" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">AnyTrader Control</span>
            </button>
            <button
              onClick={() => setActivePortal("anyroller")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                activePortal === "anyroller" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Car className="w-4 h-4" />
              <span className="hidden sm:inline">AnyRoller Control</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-900">{profile?.name || "Admin"}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{profile?.role || "System Admin"}</p>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col">
          {activePortal === "super_admin" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 p-6 lg:p-12 overflow-y-auto"
            >
              <div className="max-w-7xl mx-auto space-y-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Super Admin Overview</h2>
                  <p className="text-slate-500 font-medium mt-1">Cross-platform metrics for AnyTrader and AnyRoller.</p>
                </div>

                {loadingMetrics ? (
                  <div className="p-12 text-center text-slate-500 font-medium">Aggregating platform data...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Network Users</p>
                        <p className="text-4xl font-black text-slate-900">{metrics.totalUsers}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">AnyTrader Providers</p>
                        <p className="text-4xl font-black text-orange-600">{metrics.totalTraders}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <Building2 className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">AnyRoller Drivers</p>
                        <p className="text-4xl font-black text-emerald-600">{metrics.totalDrivers}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Car className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between mt-4">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Jobs Created</p>
                        <p className="text-3xl font-black text-slate-900">{metrics.totalJobs}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Briefcase className="w-5 h-5" />
                      </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between mt-4">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Ride Requests</p>
                        <p className="text-3xl font-black text-slate-900">{metrics.totalRides}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl shadow-sm flex items-center justify-between mt-4 relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Live Platforms</p>
                        <p className="text-3xl font-black text-white">2 Active</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white relative z-10">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activePortal === "anytrader" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <AnyTraderAdmin />
            </motion.div>
          )}
          {activePortal === "anyroller" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full bg-slate-50"
            >
              <AnyRollerAdmin />
            </motion.div>
          )}
      </div>
    </div>
  );
}
