import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapContainer, TileLayer, Circle, Marker, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { Navigation, Power, Zap, ChevronDown, Check, X, Phone, MessageSquare, AlertCircle, MapPin, Grid, Inbox, Menu as MenuIcon, PoundSterling, Star } from "lucide-react";
import { db, doc, onSnapshot, collection, query, where, updateDoc } from "@/src/firebase";
import DriverEarnings from "./DriverEarnings";
import DriverInbox from "./DriverInbox";
import DriverMenu from "./DriverMenu";
import DriverDocuments from "./DriverDocuments";

// Custom pulsing blue dot for driver
const driverIcon = new L.DivIcon({
  html: `<div class="relative flex items-center justify-center w-8 h-8">
           <div class="absolute inset-0 bg-[#007AFF] rounded-full opacity-30 animate-ping"></div>
           <div class="bg-[#007AFF] border-2 border-white w-4 h-4 rounded-full shadow-lg z-10"></div>
         </div>`,
  className: "bg-transparent",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function SetupMapControls({ isOnline }: { isOnline: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.zoomControl?.remove();
  }, [map]);
  return null;
}

type RideState = 'idle' | 'incoming' | 'en_route_pickup' | 'waiting' | 'in_progress' | 'completed';

export default function DriverTerminal() {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [onlineDurationText, setOnlineDurationText] = useState("0 min");
  const [mapCenter, setMapCenter] = useState<[number, number]>([53.6458, -1.7850]); // Default to Huddersfield from spec
  const [demandZones, setDemandZones] = useState<any[]>([]);
  
  // Ride Simulation State
  const [rideState, setRideState] = useState<RideState>('idle');
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [incomingTimer, setIncomingTimer] = useState(15);
  
  // Rating State
  const [passengerRating, setPassengerRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  
  // Stats Card state
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isTopPanelHidden, setIsTopPanelHidden] = useState(false);

  // Auto-close stats after 5 seconds
  useEffect(() => {
    if (isStatsExpanded) {
      const timer = setTimeout(() => {
        setIsStatsExpanded(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isStatsExpanded]);

  // Dynamic Fare & Live Ride Tracking
  const [fareConfig, setFareConfig] = useState<{baseFare: number, distanceRate: number, minFare: number, commissionRate: number}>({ baseFare: 3.5, distanceRate: 1.3, minFare: 5.0, commissionRate: 0.12 });
  const [activeRide, setActiveRide] = useState<any>(null); // Stores live or simulated ride data

  // Listen to Taxi Command Settings (platform_config/rides)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "rides"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFareConfig({
          baseFare: Number(data.baseFare) || 3.5,
          distanceRate: Number(data.distanceRate) || 1.3,
          minFare: Number(data.minFare) || 5.0,
          commissionRate: data.commission ? Number(data.commission) / 100 : 0.12,
        });
      }
    });
    return () => unsub();
  }, []);

  // Listen for REAL incoming live ride requests
  useEffect(() => {
    if (!isOnline || rideState !== 'idle') return;

    const q = query(
      collection(db, "ride_requests"), 
      where("status", "==", "searching")
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      // Find the first searching request
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // Populate the active ride with real data
        setActiveRide({
          id: doc.id,
          userId: data.userId,
          name: data.passengerName || "Live Passenger",
          pickupAddress: data.pickupAddress,
          dropoffAddress: data.dropoffAddress,
          fareEstimate: data.fareEstimate,
          distanceMiles: data.distanceMiles,
          durationMinutes: data.durationMinutes,
          isReal: true // Flag to know whether to update Firestore on Accept
        });
        
        setIncomingTimer(15);
        setRideState('incoming');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      }
    });
    
    return () => unsub();
  }, [isOnline, rideState]);

  // Simulation: Add fake demand zones
  useEffect(() => {
    setDemandZones([
      { lat: 53.6458, lng: -1.7850, radius: 1200, type: "high", multiplier: "1.4x" },
      { lat: 53.6550, lng: -1.8000, radius: 1800, type: "moderate", multiplier: "1.2x" },
    ]);
  }, []);

  // Timer simulation for Incoming request
  useEffect(() => {
    let interval: any;
    if (rideState === 'incoming' && incomingTimer > 0) {
      interval = setInterval(() => setIncomingTimer(prev => prev - 1), 1000);
    } else if (rideState === 'incoming' && incomingTimer === 0) {
      handleDeclineRide();
    }
    return () => clearInterval(interval);
  }, [rideState, incomingTimer]);

  const handleToggleOnline = () => {
    if (rideState !== 'idle') return; // Cannot toggle while riding
    
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    if (newStatus) {
      setOnlineStartTime(new Date());
      setOnlineDurationText("0 min");
    } else {
      setOnlineStartTime(null);
    }
    
    if (navigator.vibrate) navigator.vibrate(100);
  };

  // Update session duration timer
  useEffect(() => {
    if (!isOnline || !onlineStartTime) return;

    const interval = setInterval(() => {
      const diffMs = new Date().getTime() - onlineStartTime.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      
      if (diffMin < 60) {
        setOnlineDurationText(`${diffMin} min`);
      } else {
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        setOnlineDurationText(`${hrs}h ${mins}m`);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline, onlineStartTime]);

  // Real-time GPS Tracking
  useEffect(() => {
    if (!isOnline) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
      },
      (err) => console.warn("GPS tracking error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline]);

  const simulateIncomingRide = () => {
    if (!isOnline) {
      setIsOnline(true);
    }
    
    // Create a dynamic simulation using real live fare configs
    const simulatedDist = Math.floor(Math.random() * 15) + 3; // 3 to 18 miles
    const simulatedTime = simulatedDist * 2.5; // Rough time
    const calcFare = Math.max(fareConfig.minFare, fareConfig.baseFare + (simulatedDist * fareConfig.distanceRate));
    
    // Add surge for the simulation (just for UI visuals)
    const surge = 1.4;
    const finalFare = calcFare * surge;
    
    setActiveRide({
      id: "simulated_ride_123",
      name: "Sarah T.",
      pickupAddress: "12 Elm Street, SE15",
      dropoffAddress: "Bristol Temple Meads",
      fareEstimate: finalFare,
      baseCalc: calcFare,
      surgeMultiplier: surge,
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      isReal: false
    });

    setIncomingTimer(15);
    setRideState('incoming');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]); // Custom ride tone haptic
  };

  const handleAcceptRide = async () => {
    // If it's a real ride from Firestore, claim it!
    if (activeRide?.isReal) {
      try {
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "accepted",
          driverId: user?.uid,
          acceptedAt: new Date()
        });
      } catch (err) {
        console.error("Failed to claim ride:", err);
      }
    }

    setRideState('en_route_pickup');
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDeclineRide = () => {
    setActiveRide(null);
    setRideState('idle');
  };

  const [activeTab, setActiveTab] = useState<'home' | 'earnings' | 'inbox' | 'menu' | 'documents'>('home');

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-hidden relative flex flex-col font-sans -mx-4 -mt-6"> {/* Full bleed container */}
      
      {activeTab === 'home' && (
      <>
      {/* Simulation Trigger (Dev Only) */}
      <button 
        onClick={simulateIncomingRide}
        className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] bg-purple-600 text-xs px-3 py-1 rounded-full font-bold opacity-50 hover:opacity-100"
      >
        Simulate Ride
      </button>

      {/* 1. Map Layer (Background) */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <SetupMapControls isOnline={isOnline} />
          {/* Switched to Voyager theme for much better visibility and clarity */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          />
          {isOnline && <Marker position={mapCenter} icon={driverIcon} />}
        </MapContainer>
        
        {/* Lighter, softer gradient overlays to preserve map visibility */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
      </div>

      {/* 2. Top UI: Privacy Drawer (Earning Bar & Gamification) */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        
        {/* Status indicator (Pulsing Online) - Always visible at top center */}
        <AnimatePresence>
          {(isOnline && activeTab === 'home') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 16 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="absolute left-1/2 -translate-x-1/2 bg-[#0D0D0F]/70 border border-[#00D26A]/40 text-[#00D26A] px-4 py-1.5 rounded-full flex items-center justify-center gap-2 backdrop-blur-md w-max shadow-[0_4px_20px_rgba(0,0,0,0.6)] z-40 pointer-events-auto"
            >
              <span className="w-2 h-2 rounded-full bg-[#00D26A] animate-pulse shadow-[0_0_5px_#00D26A]"></span>
              <span className="text-[10px] font-black uppercase tracking-widest leading-none pt-0.5">Online • {onlineDurationText}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="pointer-events-auto"
          drag="y"
          dragConstraints={{ top: -260, bottom: 0 }}
          dragElastic={0.05}
          onDragEnd={(_, info) => {
            // Logic to snap based on drag direction/distance
            if (info.velocity.y > 100) setIsTopPanelHidden(false);
            else if (info.velocity.y < -100) setIsTopPanelHidden(true);
            else if (info.offset.y > 50) setIsTopPanelHidden(false);
            else if (info.offset.y < -50) setIsTopPanelHidden(true);
          }}
          animate={{ 
            y: isTopPanelHidden ? -260 : 0,
            opacity: 1
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="px-4 pt-16 pb-2 flex flex-col gap-3 relative">
            
            {/* The Money-First Bar */}
            <div className="bg-[#1A1A1E]/95 backdrop-blur-xl border border-[#2C2C30] rounded-2xl shadow-2xl overflow-hidden relative">
              <div className="p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[10px] text-[#A0A0A8] font-black uppercase tracking-widest">Today</p>
                      {!isOnline && <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <h1 className="text-[32px] leading-none font-black tracking-tight text-white">£142.60</h1>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-sm font-bold text-white bg-[#252529] px-3 py-1.5 rounded-lg border border-[#333338] tracking-tight">8 rides • 5h</span>
                    <button 
                      onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                      className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-colors",
                        isStatsExpanded ? "text-emerald-500 bg-emerald-500/10" : "text-[#A0A0A8] hover:text-white"
                      )}
                    >
                      Stats
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isStatsExpanded && "rotate-180")} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-5">
                  <div className="flex justify-between items-baseline mb-1.5 font-bold">
                    <span className="text-[11px] text-[#A0A0A8] uppercase tracking-wider">Goal: £200</span>
                    <span className="text-xs text-[#00D26A]">71%</span>
                  </div>
                  <div className="h-[6px] w-full bg-[#252529] rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#00D26A] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "71%" }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Collapsible Session Stats Content */}
                <AnimatePresence>
                  {isStatsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    >
                      <div className="border-t border-[#2C2C30] pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black tracking-widest text-[#A0A0A8] uppercase">Live Session Performance</p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[8px] font-bold text-emerald-500 uppercase">Live</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                          <div>
                            <p className="text-[#6B6B73] text-[9px] font-bold uppercase mb-1">Acceptance</p>
                            <p className="text-white text-sm font-bold flex items-center gap-1.5">92% <Check className="w-3.5 h-3.5 text-emerald-500" /></p>
                          </div>
                          <div>
                            <p className="text-[#6B6B73] text-[9px] font-bold uppercase mb-1">Rating</p>
                            <p className="text-white text-sm font-bold flex items-center gap-1.5">4.9 <Star className="w-3.5 h-3.5 text-[#FF9500] fill-[#FF9500]" /></p>
                          </div>
                          <div>
                            <p className="text-[#6B6B73] text-[9px] font-bold uppercase mb-1">Avg Fare</p>
                            <p className="text-white text-sm font-bold">£17.80</p>
                          </div>
                          <div>
                            <p className="text-[#6B6B73] text-[9px] font-bold uppercase mb-1">Rides/Hour</p>
                            <p className="text-white text-sm font-bold">1.5</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Drawer Handle (Privacy Privacy Puller) */}
              <div 
                className="w-full h-8 flex items-end justify-center pb-2 cursor-grab active:cursor-grabbing group"
                onClick={() => setIsTopPanelHidden(!isTopPanelHidden)}
              >
                <div className={cn(
                  "w-12 h-1 rounded-full transition-colors",
                  isTopPanelHidden ? "bg-[#00D26A] shadow-[0_0_8px_rgba(0,210,106,0.5)]" : "bg-white/10 group-hover:bg-white/20"
                )} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 pointer-events-none"></div>

      {/* Screen 3: Incoming Ride Request Overlay (z-50) */}
      <AnimatePresence>
        {rideState === 'incoming' && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 bg-[#0D0D0F]/90 backdrop-blur-md flex flex-col justify-end p-4 pointer-events-auto pb-6"
          >
            {/* Same content as before */}
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5 shadow-2xl relative overflow-hidden">
              
              {/* Highlight header */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent"></div>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-black text-white px-1 tracking-tight flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                    NEW RIDE REQUEST
                  </h2>
                </div>
                
                {/* Circular Timer Ring */}
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="26" className="stroke-[#2C2C30] fill-none" strokeWidth="4" />
                    <motion.circle 
                      cx="28" cy="28" r="26" 
                      className={cn("fill-none", incomingTimer > 5 ? "stroke-[#00D26A]" : "stroke-[#FF3B30]")}
                      strokeWidth="4" 
                      strokeDasharray="163" 
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 163 - (163 * (incomingTimer / 15)) }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </svg>
                  <span className="absolute text-sm font-black text-white">{incomingTimer}s</span>
                </div>
              </div>

              {/* Fare Section */}
              <div className="bg-[#252529] rounded-2xl p-4 mb-4 relative overflow-hidden group/fare cursor-pointer" onClick={() => setShowFareBreakdown(!showFareBreakdown)}>
                <div className="flex justify-between items-end mb-1">
                  <h1 className="text-[36px] leading-[1] font-black text-white w-full">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</h1>
                  <span className="bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap">🔥 {activeRide?.surgeMultiplier || '1.4'}x</span>
                </div>
                <p className="text-[#00D26A] text-sm font-bold mt-1">You earn: £{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>

                {/* Collapsible Breakdown */}
                <AnimatePresence>
                  {showFareBreakdown && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[#333338] mt-3 pt-3 flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Base:</span><span>£{fareConfig.baseFare.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Distance ({activeRide?.distanceMiles?.toFixed(1) || '22'}mi):</span><span>£{((activeRide?.distanceMiles || 22) * fareConfig.distanceRate).toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Time (~{activeRide?.durationMinutes || 45}m):</span><span>£---</span></div>
                      <div className="flex justify-between text-xs text-[#FF9500]"><span>Surge:</span><span>+£{((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span></div>
                      <div className="flex justify-between text-[11px] font-bold text-[#FF3B30] mt-1 p-1.5 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20">
                        <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{((activeRide?.fareEstimate || 38.50) * fareConfig.commissionRate).toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {!showFareBreakdown && (
                  <div className="w-full text-center mt-2 group-hover/fare:bg-white/5 py-1 rounded transition-colors">
                    <ChevronDown className="w-4 h-4 text-[#6B6B73] mx-auto" />
                  </div>
                )}
              </div>

              {/* Rider Details */}
              <div className="border-t border-[#2C2C30] pt-4 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-800 text-lg border-2 border-white">
                    {(activeRide?.name || "S")[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white leading-tight">{activeRide?.name || "Sarah T."}</h3>
                    <p className="text-xs text-[#FF9500] font-bold">⭐ 4.7 <span className="text-[#A0A0A8] font-normal">(124 trips)</span></p>
                  </div>
                </div>

                <div className="relative pl-4 space-y-4">
                  {/* Route Line indicator */}
                  <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-[#2C2C30]"></div>
                  
                  <div className="relative">
                    <div className="absolute w-3.5 h-3.5 rounded-full bg-[#A0A0A8] border-2 border-[#1A1A1E] -left-[22px] top-0.5 z-10"></div>
                    <p className="text-[10px] font-black uppercase text-[#6B6B73] tracking-widest leading-none mb-1">Pickup</p>
                    <p className="text-sm font-bold text-white leading-tight">{activeRide?.pickupAddress || "12 Elm Street, SE15"}</p>
                    <p className="text-xs text-[#00D26A] font-bold mt-0.5">3 min • 1.2 miles</p>
                  </div>

                  <div className="relative">
                    <div className="absolute w-3.5 h-3.5 bg-[#FF9500] border-2 border-[#1A1A1E] -left-[22px] top-0.5 z-10"></div>
                    <p className="text-[10px] font-black uppercase text-[#6B6B73] tracking-widest leading-none mb-1">Drop-off</p>
                    <p className="text-sm border-b border-dashed border-[#6B6B73]/50 pb-0.5 inline-block text-white">{activeRide?.dropoffAddress || "Bristol Temple Meads"}</p>
                    <p className="text-xs text-[#A0A0A8] font-bold mt-1">~{activeRide?.durationMinutes || 45} min • {activeRide?.distanceMiles?.toFixed(1) || 22} miles</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mt-2">
                <button 
                  onClick={handleAcceptRide}
                  className="w-full h-14 bg-[#00D26A] text-[#0D0D0F] rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_25px_rgba(0,210,106,0.25)] transition-transform"
                >
                  <Check className="w-6 h-6 stroke-[3]" /> ACCEPT RIDE
                </button>
                <button 
                  onClick={handleDeclineRide}
                  className="w-full py-2.5 text-xs font-bold text-[#A0A0A8] uppercase tracking-wide hover:text-white transition-colors"
                >
                  Decline
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 4 & 5 & 6: Active Ride States (z-40) */}
      <AnimatePresence>
        {(rideState === 'en_route_pickup' || rideState === 'waiting' || rideState === 'in_progress') && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#1A1A1E] rounded-t-3xl border-t border-[#2C2C30] p-4 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto"
          >
            {rideState === 'en_route_pickup' && (
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#A0A0A8] tracking-widest mb-1">Picking up {activeRide?.name || "Sarah T."}</p>
                  <p className="text-xl font-black text-white">3 min <span className="text-sm font-bold text-[#6B6B73] ml-1">· 1.2 mi</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                </div>
              </div>
            )}

            {rideState === 'waiting' && (
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#FF9500] tracking-widest mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Waiting for Rider</p>
                  <p className="text-xl font-black text-white px-0.5">2:34</p>
                  <p className="text-xs text-[#A0A0A8] font-bold mt-0.5">Free cancel in: 2:26</p>
                </div>
                <div className="text-right">
                  <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                </div>
              </div>
            )}

            {rideState === 'in_progress' && (
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-widest mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#00D26A] animate-pulse"></span> Trip in Progress
                  </p>
                  <p className="text-xl font-black text-white truncate max-w-[200px]">{activeRide?.dropoffAddress?.split(',')[0] || "Bristol"} <span className="text-sm font-bold text-[#6B6B73] ml-1">· {activeRide?.durationMinutes || 38} min left</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                </div>
              </div>
            )}

            {/* Contextual Action Button */}
            <div className="mt-2">
              {rideState === 'en_route_pickup' && (
                <button 
                  onClick={() => setRideState('waiting')}
                  className="w-full h-14 bg-[#252529] text-white border border-[#333338] rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <MapPin className="w-5 h-5" /> ARRIVED AT PICKUP
                </button>
              )}
              {rideState === 'waiting' && (
                <button 
                  onClick={() => setRideState('in_progress')}
                  className="w-full h-14 bg-[#00D26A] text-[#0D0D0F] rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_25px_rgba(0,210,106,0.25)]"
                >
                  RIDER IS IN THE CAR
                </button>
              )}
              {rideState === 'in_progress' && (
                <button 
                  onClick={() => setRideState('completed')}
                  className="w-full h-14 bg-[#FF9500] text-[#0D0D0F] rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_25px_rgba(255,149,0,0.25)]"
                >
                  <Check className="w-6 h-6 stroke-[3]" /> COMPLETE TRIP
                </button>
              )}
            </div>

            {/* Cancel fallback */}
            {(rideState === 'en_route_pickup' || rideState === 'waiting') && (
              <button onClick={handleDeclineRide} className="w-full py-4 text-xs font-bold text-[#A0A0A8] uppercase tracking-wide hover:text-[#FF3B30] transition-colors mt-1">
                {rideState === 'waiting' ? 'Cancel (Free in 2:26)' : 'Cancel Ride'}
              </button>
            )}
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 7: Trip Completed (z-50) */}
      <AnimatePresence>
        {rideState === 'completed' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 bg-[#0D0D0F]/95 backdrop-blur-xl flex flex-col justify-center p-4 pointer-events-auto"
          >
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center max-h-[90vh] overflow-y-auto w-full">
              
              <div className="w-16 h-16 bg-[#00D26A]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00D26A]/30">
                <Check className="w-8 h-8 text-[#00D26A] stroke-[3]" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">Trip Complete</h2>
              
              <div className="mb-8">
                <motion.h1 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="text-[56px] leading-[1] font-black text-white tracking-tighter"
                >
                  £{activeRide?.fareEstimate?.toFixed(2) || '38.50'}
                </motion.h1>
                <div className="mt-4 bg-[#00D26A]/10 border border-[#00D26A]/20 py-2.5 px-4 rounded-xl inline-block">
                  <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider mb-0.5">You Earned</p>
                  <p className="text-2xl font-black text-[#00D26A]">£{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-[#252529] rounded-2xl p-4 text-left mb-6">
                <p className="text-[10px] font-black uppercase text-[#A0A0A8] tracking-widest mb-3 border-b border-[#333338] pb-2">Fare Breakdown</p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Base fare:</span><span className="text-white">£{fareConfig.baseFare.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Distance ({activeRide?.distanceMiles?.toFixed(1) || '22'}mi):</span><span className="text-white">£{((activeRide?.distanceMiles || 22) * fareConfig.distanceRate).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Time (~{activeRide?.durationMinutes || 45}min):</span><span className="text-white">£---</span></div>
                  <div className="flex justify-between text-xs text-[#FF9500]"><span>Surge ({activeRide?.surgeMultiplier || '1.4'}x):</span><span className="font-bold">+£{((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span></div>
                </div>
                <div className="border-t border-[#333338] pt-2 mb-2 flex justify-between text-sm font-bold text-white">
                  <span>Total fare:</span><span>£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[#FF3B30] p-1.5 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20 mb-3">
                  <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{((activeRide?.fareEstimate || 38.50) * fareConfig.commissionRate).toFixed(2)}</span>
                </div>
                <div className="border-t border-[#333338] pt-2 flex justify-between text-[15px] font-black text-[#00D26A]">
                  <span>YOUR EARNINGS:</span><span>£{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</span>
                </div>
              </div>

              {/* Passenger Rating Block */}
              <div className="bg-[#1A1A1E] rounded-2xl p-5 mb-6 border border-[#2C2C30] text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF9500] to-[#FFCC00]"></div>
                <h3 className="text-[13px] font-black uppercase text-white tracking-widest mb-4">Rate Passenger</h3>
                
                <div className="flex justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setPassengerRating(star)}
                      className="p-1.5 focus:outline-none active:scale-90 transition-transform"
                    >
                      <Star 
                        className={cn(
                          "w-10 h-10 transition-colors drop-shadow-sm", 
                          passengerRating >= star 
                             ? "fill-[#FF9500] text-[#FF9500]" 
                             : "text-[#333338] fill-transparent"
                        )} 
                      />
                    </button>
                  ))}
                </div>
                
                <AnimatePresence>
                  {passengerRating < 5 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Please provide details about your rating (Required)"
                        className="w-full bg-[#0D0D0F] border border-[#333338] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FF9500] transition-colors resize-none placeholder:text-[#6B6B73]"
                        rows={3}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => {
                  setRideState('idle');
                  setIsOnline(true);
                  setPassengerRating(5);
                  setRatingComment("");
                }}
                disabled={passengerRating < 5 && ratingComment.trim() === ""}
                className="disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed w-full h-14 bg-white text-[#0D0D0F] rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 uppercase tracking-widest active:scale-[0.98] transition-all shadow-xl shadow-white/5"
              >
                DONE — BACK TO MAP
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Bottom UI: Details and Call to Action */}
      <div className={cn("relative z-20 w-full px-4 pb-24 flex flex-col gap-3 transition-opacity", rideState !== 'idle' ? "opacity-0 pointer-events-none" : "opacity-100")}>
        
        {/* Primary Action Button moved to Menu - only map controls or status might remain here if needed */}
      </div>
      </>
      )}

      {/* Render Other Tabs */}
      {activeTab === 'earnings' && <DriverEarnings fareConfig={fareConfig} />}
      {activeTab === 'inbox' && <DriverInbox />}
      {activeTab === 'menu' && (
        <DriverMenu 
          onNavigate={(tab) => setActiveTab(tab as any)} 
          commissionRate={fareConfig.commissionRate}
          isOnline={isOnline}
          onToggleOnline={handleToggleOnline}
        />
      )}
      <AnimatePresence>
         {activeTab === 'documents' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute inset-0 z-50">
               <DriverDocuments onBack={() => setActiveTab('menu')} />
            </motion.div>
         )}
      </AnimatePresence>

      {/* Bottom Navigation (Sticky Fixed Widget) */}
      {(rideState === 'idle' && activeTab !== 'documents') && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 z-50 pointer-events-none flex flex-col items-center gap-0.5">
          
          {/* Status Indicator Bar (Height reduced by 40%) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "w-full max-w-sm h-6 px-4 rounded-xl flex items-center justify-between border backdrop-blur-md transition-all pointer-events-auto shadow-lg",
              isOnline 
                ? "bg-[#064e3b]/80 border-emerald-500/30 shadow-emerald-900/20" 
                : "bg-[#1A1A1E]/90 border-[#2C2C30]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isOnline ? "bg-[#00D26A] animate-pulse" : "bg-[#6B6B73]"
              )} />
              <span className={cn(
                "text-[8px] font-black uppercase tracking-widest",
                isOnline ? "text-white" : "text-[#6B6B73]"
              )}>
                {isOnline ? "Waiting for Jobs" : "Offline"}
              </span>
            </div>

            {isOnline && (
              <div className="flex-1 max-w-[100px] h-0.5 bg-white/10 rounded-full mx-4 overflow-hidden relative">
                <motion.div 
                  animate={{ left: ["-30%", "130%"] }}
                  transition={{ 
                    duration: 2.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent via-white to-transparent"
                />
              </div>
            )}

            <span className={cn(
              "text-[7px] font-bold",
              isOnline ? "text-white/60" : "text-[#6B6B73]"
            )}>
              {isOnline ? "ACTIVE" : "STANDBY"}
            </span>
          </motion.div>

          <div className="max-w-md mx-auto w-full h-18 bg-[#1A1A1E]/95 backdrop-blur-xl border border-[#2C2C30] rounded-2xl px-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.4)] pointer-events-auto">
            <button 
              onClick={() => setActiveTab('home')}
              className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", activeTab === 'home' ? "text-white" : "text-[#6B6B73] hover:text-[#A0A0A8]")}>
              <MapPin className={cn("w-5.5 h-5.5 transition-transform", activeTab === 'home' && "scale-110")} />
              <span className="text-[9px] uppercase font-black tracking-widest">Home</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('earnings')}
              className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", activeTab === 'earnings' ? "text-white" : "text-[#6B6B73] hover:text-[#A0A0A8]")}>
              <PoundSterling className={cn("w-5.5 h-5.5 transition-transform", activeTab === 'earnings' && "scale-110")} />
              <span className="text-[9px] uppercase font-black tracking-widest">Earnings</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('inbox')}
              className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", activeTab === 'inbox' ? "text-white" : "text-[#6B6B73] hover:text-[#A0A0A8]")}>
              <Inbox className={cn("w-5.5 h-5.5 transition-transform", activeTab === 'inbox' && "scale-110")} />
              <span className="text-[10px] uppercase font-black tracking-widest">Inbox</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('menu')}
              className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", activeTab === 'menu' ? "text-white" : "text-[#6B6B73] hover:text-[#A0A0A8]")}>
              <MenuIcon className={cn("w-5.5 h-5.5 transition-transform", activeTab === 'menu' && "scale-110")} />
              <span className="text-[10px] uppercase font-black tracking-widest">Menu</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
