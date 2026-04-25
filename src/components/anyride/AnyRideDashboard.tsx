import React, { useState, useEffect } from "react";
import { Activity, Car, Users, Clock, CheckCircle2, AlertCircle, Megaphone, Gift, Map } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function AnyRideDashboard() {
  const [metrics, setMetrics] = useState({
    onlineDrivers: 0,
    activeDrivers: 0,
    queuedRides: 0,
    activeRiders: 0, 
    sosAlerts: 0,
    todayRides: 0,
    todayRevenue: 0,
    pendingDrivers: 0
  });

  useEffect(() => {
    // Listen to live tracking for drivers
    const unsubTracking = onSnapshot(collection(db, "live_tracking"), (snapshot) => {
      let online = 0;
      let active = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === "available") online++;
        if (data.status === "in-ride") active++;
      });
      setMetrics(prev => ({ ...prev, onlineDrivers: online, activeDrivers: active }));
    });

    // Listen to ride requests
    const unsubRides = onSnapshot(collection(db, "ride_requests"), (snapshot) => {
      let queued = 0;
      let todayCompleted = 0;
      let todayRev = 0;
      
      const today = new Date();
      today.setHours(0,0,0,0);

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === "pending") queued++;
        
        if (data.createdAt && data.createdAt.toDate) {
          const rideDate = data.createdAt.toDate();
          if (rideDate >= today && data.status === "completed") {
            todayCompleted++;
            todayRev += (data.totalFare || 0);
          }
        }
      });
      setMetrics(prev => ({ 
        ...prev, 
        queuedRides: queued,
        todayRides: todayCompleted,
        todayRevenue: todayRev
      }));
    });

    // Listen to users for pending drivers
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      let pending = 0;
      let riders = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === "tradesperson" && data.services?.includes("Taxi & Transport") && data.verificationStatus === "pending") {
          pending++;
        }
        if (data.role === "homeowner") {
          riders++;
        }
      });
      setMetrics(prev => ({ ...prev, pendingDrivers: pending, activeRiders: riders }));
    });
    
    // Listen to SOS alerts
    const unsubSOS = onSnapshot(collection(db, "sos_alerts"), (snapshot) => {
      let activeSos = 0;
      snapshot.forEach(doc => {
        if (doc.data().status === "active") activeSos++;
      });
      setMetrics(prev => ({ ...prev, sosAlerts: activeSos }));
    });

    return () => {
      unsubTracking();
      unsubRides();
      unsubUsers();
      unsubSOS();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Dashboard
          </h2>
          <p className="text-slate-500 font-medium">Live status and daily performance.</p>
        </div>
      </div>

      {/* Live Status Bar */}
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mt-8 mb-4">Live Status Bar</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Available", value: metrics.onlineDrivers, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-500" },
          { label: "Active", value: metrics.activeDrivers, icon: Car, color: "text-blue-600", bg: "bg-blue-50", ring: "" },
          { label: "Queued", value: metrics.queuedRides, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", ring: "" },
          { label: "Riders", value: metrics.activeRiders, icon: Users, color: "text-purple-600", bg: "bg-purple-50", ring: "" },
          { label: "SOS", value: metrics.sosAlerts, icon: AlertCircle, color: metrics.sosAlerts > 0 ? "text-rose-600" : "text-slate-400", bg: metrics.sosAlerts > 0 ? "bg-rose-50" : "bg-slate-50", ring: metrics.sosAlerts > 0 ? "ring-rose-500" : "" },
        ].map((stat) => (
          <div key={stat.label} className={cn("p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center bg-white relative", stat.ring && `ring-1 ${stat.ring}`)}>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", stat.bg, stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Today's KPIs */}
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mt-8 mb-4">Today's KPIs</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-1">Rides Completed</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.todayRides}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-1">Revenue</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-slate-900">£{metrics.todayRevenue.toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-1">Avg Wait Time</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-slate-900">--</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-1">QR Payment Rate</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-slate-900">100%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Alerts Requiring Action */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Alerts Requiring Action</h3>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {metrics.pendingDrivers > 0 ? (
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{metrics.pendingDrivers} drivers pending approval</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">Review &rarr;</span>
                </div>
              ) : (
                <div className="p-4 text-center text-sm font-medium text-slate-500">No alerts requiring action.</div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Quick Actions</h3>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600">
              <Megaphone className="w-5 h-5 text-indigo-500" />
              <span className="text-xs font-bold">Broadcast</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600">
              <Users className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold">Drivers</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600">
              <Gift className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold">Create Promo</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600">
              <Map className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-bold">Live Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
