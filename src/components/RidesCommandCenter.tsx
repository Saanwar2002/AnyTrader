import React, { useState, useEffect } from "react";
import { db, doc, onSnapshot, updateDoc, setDoc, serverTimestamp, query, collection, orderBy, limit, where } from "@/src/firebase";
import { 
  Car, MapPin, DollarSign, Clock, Globe, AlertCircle, Save, Loader2, 
  Settings2, Activity, Play, CheckCircle2, Calendar, ClipboardList, TrendingUp, Users, X,
  Map, Navigation, Send, CheckCircle, Trash2, QrCode, Banknote
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { 
  assignDriverToRide, 
  pickupRider, 
  completeRideWithHandshake, 
  cancelRide 
} from "@/src/services/taxiIntegrationService";

export default function RidesCommandCenter() {
  const [activeTab, setActiveTab] = useState<"monitor" | "drivers" | "dials" | "simulator">("monitor");
  const [rideRequests, setRideRequests] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    baseFare: 2.5,
    distanceRate: 1.2,
    timeRate: 0.15,
    waitRatePerMinute: 0.25,
    minFare: 5.0,
    commission: 12,
    fixedTripFee: 0.20,
    allowRiderAbandonment: false,
    dispatchRadiusMiles: 15,
    dispatchTimeoutSeconds: 15,
    autoDispatchEnabled: true,
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
    },
    surcharges: [
      { id: "airport", name: "Airport Drop-off", amount: 5.0, description: "Standard airport terminal entry fee", type: "flat" },
      { id: "ulez", name: "ULEZ Charge", amount: 12.5, description: "Ultra Low Emission Zone fee", type: "flat" },
      { id: "congestion", name: "Congestion Charge", amount: 15, description: "London central zone fee", type: "flat" }
    ]
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverConfig, setServerConfig] = useState<any>(null);
  
  // Simulator States
  const [simDistance, setSimDistance] = useState("10");
  const [simTime, setSimTime] = useState("20");
  const [simSurge, setSimSurge] = useState("1.0");
  const [simVehicleType, setSimVehicleType] = useState("standard");
  const [simPeakMode, setSimPeakMode] = useState<"none" | "morning" | "evening" | "lateNight">("none");
  const [simSelectedSurcharges, setSimSelectedSurcharges] = useState<string[]>([]);
  const [simSurgeLevel, setSimSurgeLevel] = useState<"none" | "low" | "medium" | "high" | "custom">("none");
  const [simOverrideMode, setSimOverrideMode] = useState<"system" | "fixed" | "multiplier">("system");
  const [dispatchingRide, setDispatchingRide] = useState<any | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

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
        const defaultVehicles = [
          { id: "standard", name: "AnyTrader Standard", multiplier: 1.0 },
          { id: "executive", name: "AnyTrader Executive", multiplier: 1.5 },
          { id: "mpv", name: "AnyTrader XL (6-Seater)", multiplier: 1.4 },
          { id: "van", name: "AnyTrader Pro Van", multiplier: 1.8 },
          { id: "vip", name: "AnyTrader VIP Luxury", multiplier: 2.2 }
        ];

        const merged = {
          ...data,
          vehicleTypes: data.vehicleTypes || defaultVehicles,
          surcharges: data.surcharges || [
            { id: "airport", name: "Airport Drop-off", amount: 5.0, description: "Standard airport terminal entry fee", type: "flat" },
            { id: "ulez", name: "ULEZ Charge", amount: 12.5, description: "Ultra Low Emission Zone fee", type: "flat" },
            { id: "congestion", name: "Congestion Charge", amount: 15, description: "London central zone fee", type: "flat" }
          ],
          surgeEnabled: data.surgeEnabled ?? true,
          surgeModel: data.surgeModel || 'fixed',
          surgeRules: data.surgeRules || {
             lowWaitMins: 5, mediumWaitMins: 10, highWaitMins: 20,
             lowFee: 1.0, mediumFee: 2.0, highFee: 3.5,
             lowMultiplier: 1.1, mediumMultiplier: 1.3, highMultiplier: 1.6
          }
        };

        setServerConfig(merged);

        setConfig((prev: any) => {
          // If the user is currently looking at dials and we just got a remote update, 
          // we might want to be careful about overwriting. But for most cases:
          return {
            ...prev,
            ...merged
          };
        });
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

  const isConfigEqual = (c1: any, c2: any) => {
    if (!c1 || !c2) return false;
    const keys = ['baseFare', 'distanceRate', 'timeRate', 'waitRatePerMinute', 'minFare', 'commission', 'fixedTripFee', 'vehicleTypes', 'peakMultipliers', 'surcharges', 'allowRiderAbandonment', 'dispatchRadiusMiles', 'dispatchTimeoutSeconds', 'autoDispatchEnabled'];
    return keys.every(key => JSON.stringify(c1[key]) === JSON.stringify(c2[key]));
  };

  const hasUnsavedChanges = serverConfig && !isConfigEqual(config, serverConfig);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      // Sanitize NaNs and types before saving
      const sanitizedConfig = {
        ...config,
        baseFare: Number(config.baseFare) || 0,
        distanceRate: Number(config.distanceRate) || 0,
        timeRate: Number(config.timeRate) || 0,
        waitRatePerMinute: Number(config.waitRatePerMinute) || 0,
        minFare: Number(config.minFare) || 0,
        commission: Number(config.commission) || 0,
        commissionRate: (Number(config.commission) || 12) / 100,
        fixedTripFee: Number(config.fixedTripFee) || 0,
        allowRiderAbandonment: Boolean(config.allowRiderAbandonment),
        dispatchRadiusMiles: Number(config.dispatchRadiusMiles) || 15,
        dispatchTimeoutSeconds: Number(config.dispatchTimeoutSeconds) || 15,
        autoDispatchEnabled: Boolean(config.autoDispatchEnabled),
        surgeEnabled: Boolean(config.surgeEnabled ?? true),
        surgeModel: config.surgeModel || 'fixed',
        surgeRules: {
           lowWaitMins: Number(config.surgeRules?.lowWaitMins) || 5,
           mediumWaitMins: Number(config.surgeRules?.mediumWaitMins) || 10,
           highWaitMins: Number(config.surgeRules?.highWaitMins) || 20,
           lowFee: Number(config.surgeRules?.lowFee) || 1.0,
           mediumFee: Number(config.surgeRules?.mediumFee) || 2.0,
           highFee: Number(config.surgeRules?.highFee) || 3.5,
           lowMultiplier: Number(config.surgeRules?.lowMultiplier) || 1.1,
           mediumMultiplier: Number(config.surgeRules?.mediumMultiplier) || 1.3,
           highMultiplier: Number(config.surgeRules?.highMultiplier) || 1.6,
        },
        vehicleTypes: (config.vehicleTypes || []).map((vt: any) => ({
          ...vt,
          multiplier: Number(vt.multiplier) || 1
        })),
        peakMultipliers: {
          morning: Number(config.peakMultipliers?.morning) || 1,
          evening: Number(config.peakMultipliers?.evening) || 1,
          lateNight: Number(config.peakMultipliers?.lateNight) || 1,
        },
        surcharges: (config.surcharges || []).map((s: any) => ({
          ...s,
          amount: Number(s.amount) || 0
        }))
      };

      await setDoc(doc(db, "platform_config", "rides"), {
        ...sanitizedConfig,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setServerConfig(sanitizedConfig);
      setConfig(sanitizedConfig);
      toast.success("Fleet engine dials synced!");
    } catch (error) {
      toast.error("Failed to save dials");
    } finally {
      setSaving(false);
    }
  };

  const selectedVehicle = config.vehicleTypes?.find((v: any) => v.id === simVehicleType) || { multiplier: 1.0 };
  const peakMultiplier = simPeakMode === "none" ? 1.0 : (config.peakMultipliers?.[simPeakMode] || 1.0);
  
  const rawFare = (parseFloat(simDistance || "0") * config.distanceRate) + 
                  (parseFloat(simTime || "0") * config.timeRate) + 
                  config.baseFare;
                  
  const simulationSurchargeTotal = (config.surcharges || [])
    .filter((s: any) => simSelectedSurcharges.includes(s.id))
    .reduce((acc: number, s: any) => acc + s.amount, 0);

  // Active Surge Model in Simulation
  const simulatedSurgeModel = simOverrideMode === "system" ? (config.surgeModel || "fixed") : simOverrideMode;

  // Determine surge multipliers and fixed fees based on level
  let calculatedSurgeMultiplier = 1.0;
  let calculatedSurgeFixedFee = 0.0;

  if (simSurgeLevel === "custom") {
    if (simulatedSurgeModel === "multiplier") {
      calculatedSurgeMultiplier = parseFloat(simSurge || "1.0");
    } else {
      // Map 1.0x-5.0x slider onto a simulated fee: (slider - 1.0) * £5.00
      calculatedSurgeFixedFee = (parseFloat(simSurge || "1.0") - 1.0) * 5.0; 
    }
  } else if (simSurgeLevel === "low") {
    calculatedSurgeMultiplier = config.surgeRules?.lowMultiplier || 1.1;
    calculatedSurgeFixedFee = config.surgeRules?.lowFee || 1.0;
  } else if (simSurgeLevel === "medium") {
    calculatedSurgeMultiplier = config.surgeRules?.mediumMultiplier || 1.3;
    calculatedSurgeFixedFee = config.surgeRules?.mediumFee || 2.0;
  } else if (simSurgeLevel === "high") {
    calculatedSurgeMultiplier = config.surgeRules?.highMultiplier || 1.6;
    calculatedSurgeFixedFee = config.surgeRules?.highFee || 3.5;
  }

  // Calculate pricing based on the active simulated model
  let transitPriceWithGuardrail = 0;
  let displayedPrice = 0;
  let platformFee = 0;

  if (simulatedSurgeModel === "multiplier") {
    const finalPassengerTransitPrice = (rawFare * selectedVehicle.multiplier * calculatedSurgeMultiplier * peakMultiplier);
    transitPriceWithGuardrail = Math.max(finalPassengerTransitPrice, config.minFare * selectedVehicle.multiplier);
    displayedPrice = transitPriceWithGuardrail + simulationSurchargeTotal;
    platformFee = transitPriceWithGuardrail * (config.commission / 100);
  } else {
    // Fixed Fee Surcharge model
    const fareBeforeSurge = (rawFare * selectedVehicle.multiplier * peakMultiplier);
    transitPriceWithGuardrail = Math.max(fareBeforeSurge, config.minFare * selectedVehicle.multiplier);
    displayedPrice = transitPriceWithGuardrail + calculatedSurgeFixedFee + simulationSurchargeTotal;
    platformFee = (transitPriceWithGuardrail + calculatedSurgeFixedFee) * (config.commission / 100);
  }

  const finalDriverPayout = displayedPrice - platformFee;

  // Filtered Job Lists
  const filters = {
    pending: rideRequests.filter(r => r.status === "pending" && !r.scheduledAt),
    live: rideRequests.filter(r => ["accepted", "in_transit"].includes(r.status)),
    scheduled: rideRequests.filter(r => r.status === "pending" && r.scheduledAt),
    completed: rideRequests.filter(r => r.status === "completed").slice(0, 5),
    cancelled: rideRequests.filter(r => r.status === "cancelled").slice(0, 5)
  };

  const handleDispatch = async (driverId: string) => {
    if (!dispatchingRide) return;
    try {
      setSaving(true);
      await assignDriverToRide(dispatchingRide.id, driverId);
      toast.success("Ride dispatched successfully");
      setIsDispatchModalOpen(false);
      setDispatchingRide(null);
    } catch (error) {
      toast.error("Failed to dispatch ride");
    } finally {
      setSaving(false);
    }
  };

  const handlePickup = async (rideId: string) => {
    try {
      await pickupRider(rideId);
      toast.success("Rider picked up");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleComplete = async (rideId: string, driverId: string) => {
    try {
      // Phase 11.2: Simulating QR Handshake
      toast.info("Verifying QR Handshake...");
      setTimeout(async () => {
        await completeRideWithHandshake(rideId, driverId);
        toast.success("Ride completed & verified via QR");
      }, 1500);
    } catch (error) {
      toast.error("Verification failed");
    }
  };

  const handleCancelClick = async (rideId: string, driverId?: string) => {
    if (!confirm("Are you sure you want to cancel this ride?")) return;
    try {
      await cancelRide(rideId, driverId);
      toast.success("Ride cancelled");
    } catch (error) {
      toast.error("Failed to cancel ride");
    }
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
                <div key={stat.label} className={cn("p-4 rounded-3xl border border-black shadow-sm flex flex-col items-center justify-center text-center bg-white", stat.bg)}>
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
                      section.status === "live" ? "bg-emerald-500 animate-pulse" : 
                      section.status === "pending" ? "bg-amber-500" :
                      section.status === "scheduled" ? "bg-blue-500" : "bg-slate-300"
                    )} />
                    {section.title}
                    <span className="text-xs font-bold text-slate-400">({section.data.length})</span>
                  </h3>
                </div>

                <div className="bg-white rounded-[32px] border border-black shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-black text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-6 py-4">Rider</th>
                          <th className="px-6 py-4">Pickup / Dropoff</th>
                          <th className="px-6 py-4">Fare</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Driver</th>
                          <th className="px-6 py-4">Time</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {section.data.map((ride) => (
                          <tr key={`${section.status}-${ride.id}`} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 overflow-hidden relative">
                                  {ride.status === 'in_transit' && (
                                    <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                                  )}
                                  {ride.riderId?.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900">{ride.riderId?.slice(0, 8)}</div>
                                  {ride.urgency === 'emergency' && (
                                    <span className="text-[8px] font-black uppercase text-rose-500 tracking-tighter">Emergency</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                  <MapPin className="w-2.5 h-2.5 text-emerald-500" />
                                  <span className="truncate max-w-[150px]">{ride.pickup}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                                  <Navigation className="w-2.5 h-2.5 text-slate-300" />
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
                                ride.status === "in_transit" ? "bg-emerald-100 text-emerald-600" :
                                ride.status === "accepted" ? "bg-blue-100 text-blue-600" :
                                ride.status === "pending" ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-600"
                              )}>
                                {ride.status?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {ride.driverId ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[8px] font-black text-blue-600 border border-blue-100">
                                    {drivers.find(d => d.id === ride.driverId)?.name?.slice(0, 1) || "D"}
                                  </div>
                                  <span className="text-xs font-medium text-slate-500">
                                    {drivers.find(d => d.id === ride.driverId)?.name || ride.driverId.slice(0, 8)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-[10px] font-bold text-slate-400">
                              {ride.scheduledAt ? new Date(ride.scheduledAt.toDate?.() || ride.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                               (ride.createdAt?.toDate?.() || new Date(ride.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                {ride.status === 'pending' && (
                                  <button 
                                    onClick={() => { setDispatchingRide(ride); setIsDispatchModalOpen(true); }}
                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                    title="Dispatch Driver"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {ride.status === 'accepted' && (
                                  <button 
                                    onClick={() => handlePickup(ride.id)}
                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                    title="Mark Picked Up"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {ride.status === 'in_transit' && (
                                  <button 
                                    onClick={() => handleComplete(ride.id, ride.driverId)}
                                    className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                                    title="Verify QR Handshake"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {['pending', 'accepted'].includes(ride.status) && (
                                  <button 
                                    onClick={() => handleCancelClick(ride.id, ride.driverId)}
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                    title="Cancel Ride"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
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
            <div className="bg-white rounded-[32px] border border-black shadow-sm overflow-hidden">
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
                    <tr className="bg-slate-50 border-b border-black text-[10px] font-black text-slate-400 uppercase tracking-widest">
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
            <div className="bg-white rounded-[32px] border border-black shadow-2xl p-8 max-w-xl w-full space-y-8">
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
                    className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
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
                    className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
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
                    className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3 text-warning" /> Paid Wait Time (Per Min)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={isNaN(config.waitRatePerMinute) ? "" : config.waitRatePerMinute} 
                    onChange={e => setConfig({...config, waitRatePerMinute: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                  />
                  <p className="text-[9px] font-medium text-slate-500 italic">Charged after initial 3 min free wait</p>
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
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-red-500" /> Rider Abandonment Protection
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl bg-slate-50 border-2 border-black hover:border-black transition-colors">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={config.allowRiderAbandonment} 
                        onChange={(e) => setConfig({ ...config, allowRiderAbandonment: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">Enable abandonment fee collection & termination</span>
                  </label>
                  <p className="text-[9px] font-medium text-slate-500 italic">When enabled, drivers can charge £5.00 after 7 minutes of unresponsiveness at a stop.</p>
                </div>

                {/* Auto Dispatch Engine UI */}
                <div className="col-span-2 pt-6 border-t border-slate-50">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Auto-Dispatch Engine</h4>
                  
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl bg-slate-50 border-2 border-black hover:border-black transition-colors">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={config.autoDispatchEnabled} 
                          onChange={(e) => setConfig({ ...config, autoDispatchEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900">Enable algorithmic Auto-Dispatch</span>
                    </label>

                    {config.autoDispatchEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dispatch Radius (Miles)</label>
                          <input 
                            type="number" step="0.5" 
                            className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                            value={config.dispatchRadiusMiles}
                            onChange={(e) => setConfig({ ...config, dispatchRadiusMiles: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Driver Offer Timeout (Seconds)</label>
                          <input 
                            type="number" step="1" 
                            className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                            value={config.dispatchTimeoutSeconds}
                            onChange={(e) => setConfig({ ...config, dispatchTimeoutSeconds: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
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
                    <div key={`vt-${idx}`} className="p-4 bg-slate-50 border border-black rounded-2xl space-y-3 relative group/vt">
                      <button 
                        onClick={() => {
                          const newTypes = config.vehicleTypes.filter((_: any, i: number) => i !== idx);
                          setConfig({...config, vehicleTypes: newTypes});
                        }}
                        className="absolute top-2 right-2 p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm border border-black transition-all z-10"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                        <input 
                          type="text" 
                          value={vt.name}
                          onChange={e => {
                            const newTypes = config.vehicleTypes.map((vt: any, i: number) => 
                              i === idx ? { ...vt, name: e.target.value } : vt
                            );
                            setConfig({...config, vehicleTypes: newTypes});
                          }}
                          placeholder="e.g. Executive"
                          className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all"
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
                            const newTypes = config.vehicleTypes.map((vt: any, i: number) => 
                              i === idx ? { ...vt, multiplier: isNaN(val) ? 1 : val } : vt
                            );
                            setConfig({...config, vehicleTypes: newTypes});
                          }}
                          className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
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
                        className="w-full bg-slate-50 border border-black rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Geofenced Surcharges</h4>
                  <button 
                    onClick={() => {
                      const id = `surcharge_${Date.now()}`;
                      const newSurcharges = [...(config.surcharges || []), { id, name: "New Surcharge", amount: 0, type: "flat", description: "" }];
                      setConfig({...config, surcharges: newSurcharges});
                    }}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    + Add Surcharge
                  </button>
                </div>
                <p className="text-[9px] font-medium text-slate-500 italic pb-2">These fees bypass platform commission and go 100% to the driver (e.g. Airport fees, ULEZ).</p>
                
                <div className="space-y-3">
                  {(config.surcharges || []).map((s: any, idx: number) => (
                    <div key={`surcharge-${idx}`} className="p-4 bg-slate-50 border border-black rounded-2xl flex flex-col gap-3 relative group/s">
                      <button 
                        onClick={() => {
                          const newSurcharges = config.surcharges.filter((_: any, i: number) => i !== idx);
                          setConfig({...config, surcharges: newSurcharges});
                        }}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                          <input 
                            type="text" 
                            value={s.name}
                            onChange={e => {
                              const newS = config.surcharges.map((s: any, i: number) => 
                                i === idx ? { ...s, name: e.target.value } : s
                              );
                              setConfig({...config, surcharges: newS});
                            }}
                            className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount (£)</label>
                          <input 
                            type="number" 
                            value={isNaN(s.amount) ? "" : s.amount}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              const newS = config.surcharges.map((s: any, i: number) => 
                                i === idx ? { ...s, amount: isNaN(val) ? 0 : val } : s
                              );
                              setConfig({...config, surcharges: newS});
                            }}
                            className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs font-bold"
                          />
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={s.description}
                        onChange={e => {
                          const newS = config.surcharges.map((s: any, i: number) => 
                            i === idx ? { ...s, description: e.target.value } : s
                          );
                          setConfig({...config, surcharges: newS});
                        }}
                        placeholder="Short description..."
                        className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs text-slate-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-50">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Live Demand Surge Engine</h4>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl bg-slate-50 border-2 border-black hover:border-black transition-colors">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={config.surgeEnabled ?? true} 
                        onChange={(e) => setConfig({ ...config, surgeEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </div>
                    <div>
                        <span className="text-sm font-bold text-slate-900 block">Enable Dynamic Surging</span>
                        <span className="text-[10px] text-slate-500 font-medium">Automatically calculate surge in busy areas.</span>
                    </div>
                  </label>

                  {(config.surgeEnabled ?? true) && (
                    <div className="p-4 bg-slate-50 border border-black rounded-2xl flex flex-col gap-4">
                        <div className="flex items-center justify-between pb-3 border-b border-black">
                           <div>
                               <span className="text-xs font-bold text-slate-900 block">Surge Model</span>
                               <span className="text-[10px] text-slate-500 font-medium">Use fixed additions or multipliers.</span>
                           </div>
                           <select 
                             value={config.surgeModel || "fixed"}
                             onChange={(e) => setConfig({ ...config, surgeModel: e.target.value })}
                             className="bg-white border rounded p-1 text-sm font-bold outline-none"
                           >
                              <option value="fixed">Fixed Amount (£)</option>
                              <option value="multiplier">Multiplier (x)</option>
                           </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block h-auto sm:h-8">Max Surge / Fee (High)</label>
                            <input 
                              type="number" 
                              step="0.5"
                              value={config.surgeModel === 'multiplier' ? (config.surgeRules?.highMultiplier || 1.6) : (config.surgeRules?.highFee || 3.5)}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (config.surgeModel === 'multiplier') {
                                    setConfig({...config, surgeRules: { ...config.surgeRules, highMultiplier: isNaN(val) ? 1.6 : val }});
                                } else {
                                    setConfig({...config, surgeRules: { ...config.surgeRules, highFee: isNaN(val) ? 3.5 : val }});
                                }
                              }}
                              className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block h-auto sm:h-8">Max Wait Time Warning</label>
                            <input 
                              type="number" 
                              step="5"
                              value={config.surgeRules?.highWaitMins || 20}
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                setConfig({...config, surgeRules: { ...config.surgeRules, highWaitMins: isNaN(val) ? 20 : val }});
                              }}
                              className="w-full bg-white border border-black rounded-xl px-3 py-2 text-xs font-bold"
                            />
                          </div>
                        </div>
                    </div>
                  )}
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

              <div className="space-y-3 p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <Banknote className="w-3 h-3" /> Fixed Trip Fee (£)
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  value={isNaN(config.fixedTripFee) ? "" : config.fixedTripFee} 
                  onChange={e => setConfig({...config, fixedTripFee: parseFloat(e.target.value)})}
                  className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 font-black text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-all" 
                />
                <p className="text-[10px] font-medium text-emerald-700">Flat fee charged to driver per completed trip (e.g. £0.20).</p>
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
            <div className="bg-slate-900 rounded-[32px] sm:rounded-[40px] shadow-2xl p-6 sm:p-10 text-white overflow-hidden max-w-2xl w-full border border-white/20/5 relative">
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
                          className="w-full bg-white/5 border border-black/10 rounded-2xl p-4 text-sm text-white font-bold focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                          {config.vehicleTypes?.map((v: any, idx: number) => (
                            <option key={`sim-vt-${idx}`} value={v.id} className="bg-slate-900">{v.name} (x{v.multiplier})</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Distance (Mi)</label>
                          <input type="number" value={simDistance} onChange={e => setSimDistance(e.target.value)} className="w-full bg-white/5 border border-black/10 rounded-2xl p-4 text-white font-bold focus:border-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duration (Min)</label>
                          <input type="number" value={simTime} onChange={e => setSimTime(e.target.value)} className="w-full bg-white/5 border border-black/10 rounded-2xl p-4 text-white font-bold focus:border-emerald-500 outline-none transition-all" />
                        </div>
                      </div>

                      {/* Simulated Surge Model Selection */}
                      <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Simulated Surge Format</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "system", label: `Auto (System: ${config.surgeModel || 'fixed'})`, desc: "Matches live ruleset" },
                            { id: "fixed", label: "Fixed Surcharge", desc: "Flat fee addition" },
                            { id: "multiplier", label: "Multiplier", desc: "Percentage product" }
                          ].map((m) => {
                            const isChosen = simOverrideMode === m.id;
                            const isSystemActiveModel = (m.id === "system") || 
                                                       (m.id === "fixed" && config.surgeModel === "fixed" && simOverrideMode === "system") ||
                                                       (m.id === "multiplier" && config.surgeModel === "multiplier" && simOverrideMode === "system");
                            return (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => setSimOverrideMode(m.id as any)}
                                className={cn(
                                  "p-3 rounded-xl border text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[58px]",
                                  isChosen 
                                    ? "bg-slate-800 text-white border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.15)]" 
                                    : "opacity-45 bg-white/5 border-white/10 text-slate-400 hover:opacity-85"
                                )}
                              >
                                {isSystemActiveModel && (
                                  <span className="absolute top-1 right-1 px-1 py-[1.5px] bg-indigo-500 text-white text-[6.5px] font-extrabold uppercase rounded tracking-wider scale-90">
                                    LIVE
                                  </span>
                                )}
                                <span className="text-[9px] font-black uppercase tracking-tight block">{m.label}</span>
                                <span className="text-[8px] text-slate-400 font-medium block mt-1 leading-tight">{m.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Simulated Surge Severity Levels */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Simulated Surge Level</label>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[
                            { id: "none", label: "None", val: "0.0" },
                            { id: "low", label: "Low", val: simulatedSurgeModel === "multiplier" ? `${config.surgeRules?.lowMultiplier}x` : `+£${config.surgeRules?.lowFee?.toFixed(1)}` },
                            { id: "medium", label: "Medium", val: simulatedSurgeModel === "multiplier" ? `${config.surgeRules?.mediumMultiplier}x` : `+£${config.surgeRules?.mediumFee?.toFixed(1)}` },
                            { id: "high", label: "High", val: simulatedSurgeModel === "multiplier" ? `${config.surgeRules?.highMultiplier}x` : `+£${config.surgeRules?.highFee?.toFixed(1)}` },
                            { id: "custom", label: "Custom", val: "Slider" }
                          ].map((lvl) => (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() => setSimSurgeLevel(lvl.id as any)}
                              className={cn(
                                "py-2 px-1 rounded-xl text-[9px] font-black uppercase text-center border transition-all flex flex-col items-center justify-between min-h-[48px]",
                                simSurgeLevel === lvl.id 
                                  ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20" 
                                  : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                              )}
                            >
                              <span className="block leading-none">{lvl.label}</span>
                              <span className={cn(
                                "text-[7.5px] font-bold block mt-1",
                                simSurgeLevel === lvl.id ? "text-white" : "text-emerald-400"
                              )}>{lvl.val}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Manual Slider, only shown for custom mode */}
                      {simSurgeLevel === "custom" && (
                        <div className="space-y-2 p-3 bg-white/5 border border-white/10 rounded-2xl">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">
                            {simulatedSurgeModel === "multiplier" ? "Custom Multiplier" : "Custom Multiplier Equivalent"}
                          </label>
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
                            <span className="text-sm font-black text-emerald-400 w-16">
                              {simulatedSurgeModel === "multiplier" 
                                ? `${simSurge}x` 
                                : `+£${((parseFloat(simSurge) - 1.0) * 5.0).toFixed(2)}`
                              }
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 italic leading-snug">
                            {simulatedSurgeModel === "multiplier" 
                              ? "Multiplies distance, base, and time rates."
                              : "Calculates an equivalent flat-rate surcharge increment directly added to total."
                            }
                          </p>
                        </div>
                      )}

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
                                  : "bg-white/5 border-black/5 text-slate-400 hover:bg-white/10"
                              )}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Geofenced Surcharges</label>
                        <div className="flex flex-wrap gap-2">
                          {(config.surcharges || []).map((s: any, idx: number) => (
                            <button
                              key={`sim-s-${idx}`}
                              onClick={() => {
                                setSimSelectedSurcharges(prev => 
                                  prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                );
                              }}
                              className={cn(
                                "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all",
                                simSelectedSurcharges.includes(s.id)
                                  ? "bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20"
                                  : "bg-white/5 border-black/5 text-slate-400 hover:bg-white/10"
                              )}
                            >
                              {s.name} (£{s.amount})
                            </button>
                          ))}
                        </div>
                        {(!config.surcharges || config.surcharges.length === 0) && (
                          <p className="text-[9px] text-slate-500 italic pb-2">No surcharges configured in Engine Dials.</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-center gap-10 bg-white/5 rounded-[32px] p-8 border border-black/10">
                       <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Passenger Estimates
                          </p>
                          <p className="text-6xl font-black text-white tracking-tighter">£{displayedPrice.toFixed(2)}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {displayedPrice === (config.minFare * selectedVehicle.multiplier) && (
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[9px] font-black rounded-lg border border-orange-500/30">MIN FARE APPLIED</span>
                            )}
                            {(simSurgeLevel !== "none" || (simSurgeLevel === "custom" && parseFloat(simSurge) > 1.0)) && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30 uppercase">
                                SURGE ACTIVE ({simulatedSurgeModel})
                              </span>
                            )}
                            {simPeakMode !== 'none' && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-black rounded-lg border border-blue-500/30">PEAK PRICING</span>
                            )}
                          </div>
                       </div>
                       
                       <div className="space-y-1 pt-8 border-t border-black/10 relative">
                          <div className="absolute -top-3 left-0 right-0 flex justify-center">
                            <div className="bg-slate-900 px-3 py-1 text-[9px] font-black text-slate-500 border border-white/20/10 rounded-full">
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

        <AnimatePresence>
          {hasUnsavedChanges && activeTab === "dials" && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-24 left-0 right-0 z-[100] px-4 flex justify-center pointer-events-none"
            >
              <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20/10 rounded-[28px] p-2 pl-6 shadow-2xl flex items-center gap-6 pointer-events-auto max-w-sm w-full">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Unsaved Changes</p>
                  <p className="text-xs font-bold text-white">Pricing engine is out of sync.</p>
                </div>
                <button 
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  SYNC
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dispatch Modal */}
        <AnimatePresence>
          {isDispatchModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDispatchModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden"
              >
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Dispatch Driver</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Assign available fleet capacity</p>
                    </div>
                    <button 
                      onClick={() => setIsDispatchModalOpen(false)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6 text-slate-400" />
                    </button>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-3xl border border-black flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-black flex items-center justify-center shadow-sm">
                      <Navigation className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Request</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{dispatchingRide?.pickup}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Online Drivers ({drivers.filter(d => d.status === 'online').length})</h3>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {drivers.filter(d => d.status === 'online').map(driver => (
                        <button
                          key={driver.id}
                          onClick={() => handleDispatch(driver.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-[24px] border border-slate-50 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group text-left"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white border border-black flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors uppercase">
                            {driver.name?.slice(0, 2).toUpperCase() || "DR"}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-slate-900">{driver.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{driver.vehicleType || "Standard"}</p>
                          </div>
                          <Send className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                      {drivers.filter(d => d.status === 'online').length === 0 && (
                        <div className="p-8 text-center text-slate-400 border border-dashed border-black rounded-[24px]">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No available drivers found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}

