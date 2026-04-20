import React, { useState, useEffect } from "react";
import { db, doc, onSnapshot, updateDoc, setDoc, serverTimestamp, query, collection, orderBy, limit, where } from "@/src/firebase";
import { 
  Car, MapPin, DollarSign, Clock, Globe, AlertCircle, Save, Loader2, 
  Settings2, Activity, Play, CheckCircle2, Calendar, ClipboardList, TrendingUp, Users, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

export default function RidesCommandCenter() {
  const [activeTab, setActiveTab] = useState<"monitor" | "drivers" | "dials" | "simulator">("monitor");
  const [rideRequests, setRideRequests] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    baseFare: 2.5,
    distanceRate: 1.2,
    timeRate: 0.15,
    minFare: 5.0,
    commission: 12,
    vehicleTypes: [
      { id: "standard", name: "AnyTrader Standard", multiplier: 1.0 },
      { id: "executive", name: "AnyTrader Executive", multiplier: 1.5 },
      { id: "mpv", name: "AnyTrader XL (6-Seater)", multiplier: 1.4 },
      { id: "van", name: "AnyTrader Pro Van", multiplier: 1.8 },
      { id: "vip", name: "AnyTrader VIP Luxury", multiplier: 2.2 }
    ],
    peakMultipliers: {
      morning: 1.2,
      evening: 1.3,
      lateNight: 1.5
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Simulator States
  const [simDistance, setSimDistance] = useState("10");
  const [simTime, setSimTime] = useState("20");
  const [simSurge, setSimSurge] = useState("1.0");
  const [simVehicleType, setSimVehicleType] = useState("standard");
  const [simPeakMode, setSimPeakMode] = useState<"none" | "morning" | "evening" | "lateNight">("none");

  useEffect(() => {
    // 1. Listen for rides
    const q = query(collection(db, "ride_requests"), orderBy("createdAt", "desc"), limit(100));
    const unsubRides = onSnapshot(q, (snapshot) => {
      setRideRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 2. Listen for config
    const unsubConfig = onSnapshot(doc(db, "platform_config", "rides"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Merge with defaults to ensure new fields like vehicleTypes exist
        setConfig((prev: any) => ({
          ...prev,
          ...data,
          vehicleTypes: data.vehicleTypes || [
            { id: "standard", name: "AnyTrader Standard", multiplier: 1.0 },
            { id: "executive", name: "AnyTrader Executive", multiplier: 1.5 },
            { id: "mpv", name: "AnyTrader XL (6-Seater)", multiplier: 1.4 },
            { id: "van", name: "AnyTrader Pro Van", multiplier: 1.8 },
            { id: "vip", name: "AnyTrader VIP Luxury", multiplier: 2.2 }
          ]
        }));
      }
    });

    // 3. Listen for drivers
    const unsubDrivers = onSnapshot(collection(db, "driver_status"), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubRides();
      unsubConfig();
      unsubDrivers();
    };
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "platform_config", "rides"), {
        ...config,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success("Fleet engine dials synced!");
    } catch (error) {
      toast.error("Failed to save dials");
    } finally {
      setSaving(false);
    }
  };

  const selectedVehicle = config.vehicleTypes?.find((v: any) => v.id === simVehicleType) || { multiplier: 1.0 };
  const peakMultiplier = simPeakMode === "none" ? 1.0 : (config.peakMultipliers?.[simPeakMode] || 1.0);
  
  const rawFare = (parseFloat(simDistance) * config.distanceRate) + 
                  (parseFloat(simTime) * config.timeRate) + 
                  config.baseFare;
                  
  const finalPassengerPrice = (rawFare * selectedVehicle.multiplier * parseFloat(simSurge) * peakMultiplier);
  const displayedPrice = Math.max(finalPassengerPrice, config.minFare * selectedVehicle.multiplier);
  const finalDriverPayout = displayedPrice * (1 - config.commission / 100);

  // Filtered Job Lists
  const filters = {
    pending: rideRequests.filter(r => r.status === "pending" && !r.scheduledAt),
    live: rideRequests.filter(r => ["accepted", "in_transit"].includes(r.status)),
    scheduled: rideRequests.filter(r => r.status === "pending" && r.scheduledAt),
    completed: rideRequests.filter(r => r.status === "completed"),
    cancelled: rideRequests.filter(r => r.status === "cancelled")
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Car className="w-8 h-8 text-emerald-500" />
            Taxi Control Center
          </h2>
          <p className="text-slate-500 font-medium">Global fleet management & pricing engine.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: "monitor", label: "Fleet Monitor", icon: Activity },
            { id: "drivers", label: "Drivers", icon: Users },
            { id: "dials", label: "Engine Dials", icon: Settings2 },
            { id: "simulator", label: "Simulator", icon: Play },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0",
                activeTab === tab.id 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "monitor" && (
          <motion.div
            key="monitor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Live Trips", value: filters.live.length, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Pending", value: filters.pending.length, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Scheduled", value: filters.scheduled.length, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Today", value: filters.completed.length, icon: CheckCircle2, color: "text-slate-600", bg: "bg-slate-50" },
              ].map((stat, i) => (
                <div key={i} className={cn("p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center bg-white", stat.bg)}>
                  <stat.icon className={cn("w-6 h-6 mb-2", stat.color)} />
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* List Sections */}
            {[
              { title: "Live Rides", data: filters.live, status: "live" },
              { title: "Pending Dispatch", data: filters.pending, status: "pending" },
              { title: "Scheduled Bookings", data: filters.scheduled, status: "scheduled" },
              { title: "Recent Completions", data: filters.completed, status: "completed" },
            ].map((section) => (
              <div key={section.status} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", 
                      section.status === 'live' ? "bg-emerald-500 animate-pulse" : 
                      section.status === 'pending' ? "bg-amber-500" :
                      section.status === 'scheduled' ? "bg-blue-500" : "bg-slate-300"
                    )} />
                    {section.title}
                    <span className="text-xs font-bold text-slate-400">({section.data.length})</span>
                  </h3>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-6 py-4">Rider</th>
                          <th className="px-6 py-4">Pickup / Dropoff</th>
                          <th className="px-6 py-4">Fare</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Driver</th>
                          <th className="px-6 py-4">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {section.data.map((ride) => (
                          <tr key={ride.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                  {ride.riderId?.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-slate-900">{ride.riderId?.slice(0, 8)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="truncate max-w-[150px]">{ride.pickup}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                  <span className="truncate max-w-[150px]">{ride.dropoff}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-black text-slate-900">£{ride.totalFare?.toFixed(2) || "0.00"}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                ride.status === 'in_transit' ? "bg-emerald-100 text-emerald-600" :
                                ride.status === 'accepted' ? "bg-blue-100 text-blue-600" :
                                ride.status === 'pending' ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-600"
                              )}>
                                {ride.status?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-medium text-slate-500">
                                {ride.driverId ? ride.driverId.slice(0, 8) : "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-400">
                              {ride.scheduledAt ? new Date(ride.scheduledAt.toDate?.() || ride.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                               (ride.createdAt?.toDate?.() || new Date(ride.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {section.data.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-sm">No {section.status} jobs found.</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "drivers" && (
          <motion.div
            key="drivers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                   <Users className="w-5 h-5 text-emerald-500" />
                   Active Fleet
                </h3>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500" />
                     <span className="text-xs font-bold text-slate-500">{drivers.filter(d => d.status === "online").length} Online</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-slate-300" />
                     <span className="text-xs font-bold text-slate-500">{drivers.filter(d => d.status !== "online").length} Offline</span>
                   </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Driver</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Vehicle</th>
                      <th className="px-6 py-4">Last Active</th>
                      <th className="px-6 py-4">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {drivers.map((driver) => (
                      <tr key={driver.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 capitalize">
                          {driver.id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            driver.status === "online" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
                          )}>
                            {driver.status || "offline"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {driver.vehicle || "Standard Hatchback"}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-400">
                          {driver.lastActiveAt ? new Date(driver.lastActiveAt.toDate?.() || driver.lastActiveAt).toLocaleString() : "Never"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${Math.floor(Math.random() * 40) + 60}%` }} />
                             </div>
                             <span className="text-[10px] font-black text-slate-900">High</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {drivers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No drivers found in the system.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "dials" && (
          <motion.div
            key="dials"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-center py-12"
          >
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-8 max-w-xl w-full space-y-8">
              <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Base Engine Dials</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Adjust global taxi pricing logic</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Car className="w-3 h-3" /> Base Fare (£)
                  </label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={isNaN(config.baseFare) ? "" : config.baseFare} 
                    onChange={e => setConfig({...config, baseFare: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Distance (Per Mile)
                  </label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={isNaN(config.distanceRate) ? "" : config.distanceRate} 
                    onChange={e => setConfig({...config, distanceRate: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Time (Per Min)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={isNaN(config.timeRate) ? "" : config.timeRate} 
                    onChange={e => setConfig({...config, timeRate: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-3 h-3 text-orange-500" /> Minimum Fare
                  </label>
                  <input 
                    type="number" 
                    step="1" 
                    value={isNaN(config.minFare) ? "" : config.minFare} 
                    onChange={e => setConfig({...config, minFare: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border-2 border-orange-100 rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-orange-500 outline-none transition-all" 
                  />
                  <p className="text-[9px] font-medium text-orange-600 italic">Guardrail for short trips.</p>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Vehicle Multipliers</h4>
                  <button 
                    onClick={() => {
                      const id = `vehicle_${Date.now()}`;
                      const newTypes = [...(config.vehicleTypes || []), { id, name: "New Class", multiplier: 1.0 }];
                      setConfig({...config, vehicleTypes: newTypes});
                    }}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    + Add Type
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(config.vehicleTypes || []).map((vt: any, idx: number) => (
                    <div key={vt.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 relative group/vt">
                      <button 
                        onClick={() => {
                          const newTypes = config.vehicleTypes.filter((_: any, i: number) => i !== idx);
                          setConfig({...config, vehicleTypes: newTypes});
                        }}
                        className="absolute top-2 right-2 p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm border border-slate-100 transition-all z-10"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                        <input 
                          type="text" 
                          value={vt.name}
                          onChange={e => {
                            const newTypes = [...config.vehicleTypes];
                            newTypes[idx].name = e.target.value;
                            setConfig({...config, vehicleTypes: newTypes});
                          }}
                          placeholder="e.g. Executive"
                          className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Multiplier (x)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={isNaN(vt.multiplier) ? "" : vt.multiplier}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            const newTypes = [...config.vehicleTypes];
                            newTypes[idx].multiplier = isNaN(val) ? 1 : val;
                            setConfig({...config, vehicleTypes: newTypes});
                          }}
                          className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {(!config.vehicleTypes || config.vehicleTypes.length === 0) && (
                  <p className="text-[10px] text-slate-400 italic text-center py-4">No vehicle classes defined. Use "+ Add Type" to start.</p>
                )}
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-50">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Peak Multipliers</h4>
                <div className="grid grid-cols-3 gap-4">
                  {['morning', 'evening', 'lateNight'].map((peak) => (
                    <div key={peak} className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 capitalize">{peak.replace(/([A-Z])/g, ' $1')}</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={isNaN(config.peakMultipliers?.[peak]) ? "" : config.peakMultipliers?.[peak]}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setConfig({
                            ...config, 
                            peakMultipliers: {
                              ...config.peakMultipliers,
                              [peak]: isNaN(val) ? 1.0 : val
                            }
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-3 h-3" /> Platform Commission (%)
                </label>
                <input 
                  type="number" 
                  value={isNaN(config.commission) ? "" : config.commission} 
                  onChange={e => setConfig({...config, commission: parseFloat(e.target.value)})}
                  className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 font-black text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-all" 
                />
                <p className="text-[10px] font-medium text-emerald-700">Disrupter Value! {config.commission}% commission leaves £{(100-config.commission)/100 * 10} take home on £10.</p>
              </div>

              <button 
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Sync Engine Dials
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === "simulator" && (
          <motion.div
            key="simulator"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-center"
          >
            <div className="bg-slate-900 rounded-[32px] sm:rounded-[40px] shadow-2xl p-6 sm:p-10 text-white overflow-hidden max-w-2xl w-full border border-white/5 relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 hidden sm:block">
                   <TrendingUp className="w-32 h-32 text-emerald-500" />
                </div>
                
                <h3 className="text-xl sm:text-2xl font-black text-emerald-400 mb-8 font-mono tracking-tighter flex items-center gap-3">
                   <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                   AnyTrader Fare Engine Simulator
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative z-10">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicle Type</label>
                        <select 
                          value={simVehicleType} 
                          onChange={e => setSimVehicleType(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white font-bold focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                          {config.vehicleTypes?.map((v: any) => (
                            <option key={v.id} value={v.id} className="bg-slate-900">{v.name} (x{v.multiplier})</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Distance (Mi)</label>
                          <input type="number" value={simDistance} onChange={e => setSimDistance(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duration (Min)</label>
                          <input type="number" value={simTime} onChange={e => setSimTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-emerald-500 outline-none transition-all" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Surge Multiplier (x)</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            step="0.1" 
                            value={simSurge} 
                            onChange={e => setSimSurge(e.target.value)} 
                            className="flex-1 accent-emerald-500" 
                          />
                          <span className="text-xl font-black text-emerald-400 w-12">{simSurge}x</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Peak Time Period</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "none", label: "None (1.0x)" },
                            { id: "morning", label: `Morning (${config.peakMultipliers?.morning}x)` },
                            { id: "evening", label: `Evening (${config.peakMultipliers?.evening}x)` },
                            { id: "lateNight", label: `Late Night (${config.peakMultipliers?.lateNight}x)` }
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() => setSimPeakMode(mode.id as any)}
                              className={cn(
                                "py-3 px-4 rounded-xl text-[10px] font-bold border transition-all",
                                simPeakMode === mode.id 
                                  ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20" 
                                  : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                              )}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-center gap-10 bg-white/5 rounded-[32px] p-8 border border-white/10">
                       <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Passenger Estimates
                          </p>
                          <p className="text-6xl font-black text-white tracking-tighter">£{displayedPrice.toFixed(2)}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {displayedPrice === (config.minFare * selectedVehicle.multiplier) && (
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[9px] font-black rounded-lg border border-orange-500/30">MIN FARE APPLIED</span>
                            )}
                            {parseFloat(simSurge) > 1 && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30">SURGE ACTIVE</span>
                            )}
                            {simPeakMode !== 'none' && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-black rounded-lg border border-blue-500/30">PEAK PRICING</span>
                            )}
                          </div>
                       </div>
                       
                       <div className="space-y-1 pt-8 border-t border-white/10 relative">
                          <div className="absolute -top-3 left-0 right-0 flex justify-center">
                            <div className="bg-slate-900 px-3 py-1 text-[9px] font-black text-slate-500 border border-white/10 rounded-full">
                              - {config.commission}% PLATFORM FEE
                            </div>
                          </div>
                          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-2">Driver Net Earnings</p>
                          <p className="text-6xl font-black text-emerald-400 tracking-tighter">£{finalDriverPayout.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-500 font-medium italic">Full take-home after digital processing fees.</p>
                       </div>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

