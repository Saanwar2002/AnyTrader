import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { MapPin, Navigation, Clock, PoundSterling, Shield, AlertTriangle, X, Check, Eye, Zap, Flame, MoveRight, ChevronRight, Ban } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";

// --- Draggable Slider Component ---
function SlideAction({ label, onComplete, resetDelay = 1000 }: { label: string, onComplete: () => void, resetDelay?: number }) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  return (
    <div className="relative w-full h-16 bg-slate-900 rounded-full flex items-center justify-center overflow-hidden" ref={containerRef}>
      <AnimatePresence>
        {!isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          >
            <span className="text-white/50 text-sm font-black uppercase tracking-[0.2em]">{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        drag="x"
        dragConstraints={containerRef}
        dragElastic={0.05}
        dragSnapToOrigin={!isCompleted}
        style={{ x }}
        onDragEnd={(e, info) => {
          const containerWidth = containerRef.current?.offsetWidth || 0;
          if (info.offset.x > containerWidth * 0.6) {
            setIsCompleted(true);
            onComplete();
            setTimeout(() => {
              setIsCompleted(false);
            }, resetDelay);
          }
        }}
        className="absolute left-1 w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </motion.div>
    </div>
  );
}

export default function DriverTerminal() {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState<"offline" | "searching" | "pinged" | "arriving" | "in_transit">("offline");
  
  // Mock Incoming Ping Data
  const [incomingPing, setIncomingPing] = useState<any>(null);
  const [shattered, setShattered] = useState(false);

  // Toggle online status
  const handleToggleOnline = () => {
    if (isOnline) {
      setIsOnline(false);
      setStatus("offline");
      setIncomingPing(null);
    } else {
      setIsOnline(true);
      setStatus("searching");
      // Simulate ping after 4 seconds
      setTimeout(() => {
        setIncomingPing({
          pickup: "123 Tool Street, LDN",
          dropoff: "45 Fixer Ave, LDN",
          distance: "4.2 mi",
          time: "14 min",
          passenger: "Jane D.",
          rating: 4.9,
          totalFare: 24.50,
          commissionPercent: 12, // Transparent commission
        });
        setStatus("pinged");
      }, 4000);
    }
  };

  const driverPayout = incomingPing ? (incomingPing.totalFare * (1 - incomingPing.commissionPercent / 100)).toFixed(2) : 0;
  const platformCut = incomingPing ? (incomingPing.totalFare * (incomingPing.commissionPercent / 100)).toFixed(2) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 relative pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-display tracking-tight text-slate-900">Driver Terminal</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{profile?.name || "Driver"}</p>
        </div>
        <button
          onClick={handleToggleOnline}
          className={cn(
            "relative w-20 h-10 rounded-full flex items-center p-1 transition-colors duration-300",
            isOnline ? "bg-orange-500 shadow-lg shadow-orange-500/20" : "bg-slate-200"
          )}
        >
          <div className="absolute inset-0 flex justify-between items-center px-3 text-[10px] font-black uppercase text-white z-0">
            <span>On</span>
            <span>Off</span>
          </div>
          <motion.div
            layout
            initial={false}
            animate={{ x: isOnline ? 40 : 0 }}
            className="w-8 h-8 bg-white rounded-full shadow-md z-10 flex items-center justify-center"
          >
            {isOnline ? <Navigation className="w-4 h-4 text-orange-500" /> : <Navigation className="w-4 h-4 text-slate-400" />}
          </motion.div>
        </button>
      </div>

      {status === "offline" && (
        <div className="bg-slate-50 rounded-[2.5rem] p-8 text-center space-y-4 border border-slate-100 flex flex-col items-center justify-center h-64">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center opacity-50">
            <Eye className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">You're Offline</h3>
            <p className="text-sm text-slate-500 mt-1">Go online to receive ride request pings.</p>
          </div>
        </div>
      )}

      {(status === "searching" || status === "pinged") && (
        <div className="relative h-[60vh] bg-[#0A0F1C] rounded-[2.5rem] overflow-hidden flex items-center justify-center border-4 border-slate-900 shadow-2xl">
          {/* Heatmap Radar Simulation */}
          <div className="absolute inset-0 bg-[#0A0F1C]">
             {/* Map Grid Lines */}
             <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
             
             <motion.div
               animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
               transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-blue-500 rounded-full blur-xl"
             />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,1)]" />

             {/* Surge Zones */}
             <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl" />
             <div className="absolute top-1/4 left-1/4 w-12 h-12 bg-orange-500/40 rounded-full blur-xl flex items-center justify-center">
                <span className="text-orange-500 font-black text-xs">1.5x</span>
             </div>

             <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-red-500/20 rounded-full blur-3xl" />
             <div className="absolute bottom-1/3 right-1/4 w-16 h-16 bg-red-500/30 rounded-full blur-xl flex items-center justify-center">
                <span className="text-red-500 font-black text-sm">2.0x</span>
             </div>
          </div>
          
          <div className="absolute top-6 left-6 z-10 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-700">
            <p className="text-blue-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3" /> Finding Rides
            </p>
          </div>

          <AnimatePresence>
            {status === "pinged" && incomingPing && (
              <motion.div
                initial={{ y: 100, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 200, opacity: 0, scale: 0.9 }}
                className="absolute bottom-6 left-4 right-4 bg-white rounded-3xl p-5 shadow-2xl z-20 space-y-4 border border-slate-100"
              >
                <div className="flex justify-between items-start">
                  <div className="flex bg-orange-50 text-orange-700 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest items-center gap-1 border border-orange-100">
                    <Clock className="w-3.5 h-3.5" />
                    New Request
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">£{driverPayout}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Payout Estimate</p>
                  </div>
                </div>

                {/* Radical Transparency Section */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                   <div className="flex justify-between text-xs font-black uppercase text-slate-600 mb-2">
                     <span>Pax Pays: £{incomingPing.totalFare.toFixed(2)}</span>
                     <span className="text-red-500">-£{platformCut} ({incomingPing.commissionPercent}% Comm)</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                      <div className="h-full bg-slate-900" style={{ width: `${100 - incomingPing.commissionPercent}%` }} />
                      <div className="h-full bg-red-400" style={{ width: `${incomingPing.commissionPercent}%` }} />
                   </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center shrink-0 mt-1">
                      <Navigation className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pickup</p>
                      <p className="text-sm font-bold text-slate-900">{incomingPing.pickup}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center shrink-0 mt-1">
                      <MapPin className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dropoff</p>
                      <p className="text-sm font-bold text-slate-900">{incomingPing.dropoff}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{incomingPing.distance} • {incomingPing.time}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setIncomingPing(null); setStatus("searching"); }} className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors shrink-0">
                    <X className="w-6 h-6" />
                  </button>
                  <button onClick={() => setStatus("arriving")} className="flex-1 h-14 rounded-2xl flex items-center justify-center bg-slate-900 text-white font-black hover:bg-slate-800 transition-colors shadow-xl shadow-slate-900/20 text-lg">
                    Accept Ride
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Active Trip UI */}
      {(status === "arriving" || status === "in_transit") && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white space-y-6 overflow-hidden relative shadow-2xl">
            {/* Map Accents */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
             
             <div className="relative z-10 flex justify-between items-start">
               <div>
                 <p className="text-sm font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20 inline-block mb-3">
                   {status === "arriving" ? "Arriving at Pickup" : "In Transit to Dropoff"}
                 </p>
                 <h2 className="text-3xl font-display font-black tracking-tight mt-1">
                   {status === "arriving" ? "Jane D." : incomingPing?.dropoff?.split(',')[0]}
                 </h2>
                 <p className="text-blue-100 font-medium">
                   {status === "arriving" ? `${incomingPing?.pickup}` : `${incomingPing?.time} remaining`}
                 </p>
               </div>
               
               {/* Shatter Button */}
               {status === "in_transit" && (
                 <button
                   onClick={() => setShattered(true)}
                   className={cn(
                     "flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all",
                     shattered 
                      ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]" 
                      : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                   )}
                 >
                   <Flame className={cn("w-6 h-6", shattered && "animate-pulse")} />
                   <span className="text-[8px] font-black uppercase mt-1">Shatter</span>
                 </button>
               )}
             </div>

             {/* Dynamic Earnings / Meter */}
             <div className={cn(
               "p-5 rounded-2xl border transition-all duration-500",
               shattered 
                 ? "bg-red-500/10 border-red-500/30" 
                 : "bg-white/5 border-white/10"
             )}>
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                     {shattered ? "Live Meter (Traffic Mode)" : "Fixed Payout"}
                   </p>
                   <p className={cn(
                     "text-3xl font-black font-mono tracking-tight",
                     shattered ? "text-red-400" : "text-white"
                   )}>
                     £{shattered ? (Number(driverPayout) + 2.50).toFixed(2) : driverPayout}
                   </p>
                 </div>
                 {shattered && (
                   <div className="flex items-center gap-1 text-red-500 animate-pulse bg-red-500/10 px-2 py-1 rounded-lg">
                     <div className="w-2 h-2 bg-red-500 rounded-full" />
                     <span className="text-xs font-black uppercase">Live</span>
                   </div>
                 )}
               </div>
             </div>

             {/* Slider Action */}
             <div className="pt-2">
               {status === "arriving" ? (
                 <SlideAction 
                   label="Slide to Start Ride >>>" 
                   onComplete={() => setStatus("in_transit")} 
                 />
               ) : (
                 <SlideAction 
                   label="Slide to Complete >>>" 
                   onComplete={() => {
                     setStatus("searching");
                     setShattered(false);
                     setIncomingPing(null);
                     alert("Trip Completed! Earnings added to wallet.");
                   }} 
                 />
               )}
             </div>
          </div>
        </motion.div>
      )}

      {/* Shatter Modal Context */}
      <AnimatePresence>
        {shattered && status === "in_transit" && (
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-red-50 border border-red-100 p-5 rounded-3xl"
           >
             <div className="flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
               <div>
                 <p className="text-sm font-black text-red-900 tracking-tight">Price Protection Active</p>
                 <p className="text-xs text-red-700 mt-1">You requested a recalculation due to changed conditions. A live meter will track the rest of your trip to ensure fair compensation. Passenger will be notified.</p>
               </div>
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
