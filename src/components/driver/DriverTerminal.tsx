import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue } from "motion/react";
import { MapPin, Navigation, Clock, PoundSterling, Shield, AlertTriangle, X, Check, Eye, Zap, Flame, ChevronRight, Menu, Coffee } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { generateGeohash } from "@/src/services/taxiIntegrationService";

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
        onDragEnd={(e, info: any) => {
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

const SlidingEarningsWidget = ({ isOnline, onToggleBreak, breakMode }: { isOnline: boolean, onToggleBreak: () => void, breakMode: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <motion.div 
      className="absolute top-20 left-4 right-4 bg-slate-900 rounded-3xl p-4 shadow-xl border border-slate-700 z-30"
      initial={{ height: 60 }}
      animate={{ height: isOpen ? 200 : 60, y: isOnline ? 0 : -100 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex justify-between items-center h-full">
        <div className="text-white">
          <p className="text-[10px] uppercase font-black text-slate-400">Today's Earnings</p>
          <p className="text-xl font-black font-mono">£84.50</p>
        </div>
        <div className="text-white text-right">
          <p className="text-[10px] uppercase font-black text-slate-400">Last Job</p>
          <p className="text-xl font-black font-mono">£24.50</p>
        </div>
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-700 text-white space-y-2">
          <p className="text-xs font-bold text-slate-400">Status: {breakMode ? "Taking Break Next" : "Searching for Jobs"}</p>
          <button onClick={(e) => { e.stopPropagation(); onToggleBreak(); }} className="w-full bg-slate-800 p-3 rounded-xl font-black text-xs uppercase">{breakMode ? "Cancel Break" : "Take Break Next"}</button>
        </div>
      )}
    </motion.div>
  );
};

export default function DriverTerminal() {
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [breakMode, setBreakMode] = useState(false);

  // Live Location Polling
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const hash = generateGeohash(latitude, longitude);
        
        // Push update to Firebase: live_tracking collection
        console.log("Updated location", { latitude, longitude, geohash: hash });
      });
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [isOnline]);

  return (
    <div className="relative h-screen bg-[#0A0F1C] overflow-hidden">
      {/* 1. LAYER 1: Full-screen Map Simulation */}
      <div className="absolute inset-0 z-0">
          {/* Animated "Looking for rides" visualizer */}
          {isOnline && (
            <motion.div 
              className="absolute inset-0 flex items-center justify-center opacity-30"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            >
              <div className="w-96 h-96 border-4 border-blue-500 rounded-full" />
            </motion.div>
          )}
      </div>

      {/* 2. LAYER 2: Overlay UI */}
      <div className="absolute inset-0 p-4 z-20 flex flex-col justify-between pointer-events-none">
        {/* Header */}
        <div className="flex justify-between items-start pt-2 pointer-events-auto">
          <button onClick={() => setMenuOpen(!menuOpen)}>
             <Menu className="text-white w-8 h-8" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs font-black uppercase">{isOnline ? "Online" : "Offline"}</span>
            <button onClick={() => setIsOnline(!isOnline)} className={cn("w-12 h-6 rounded-full p-1", isOnline ? "bg-orange-500" : "bg-slate-700")}>
              <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", isOnline ? "translate-x-6" : "")} />
            </button>
          </div>
        </div>

        {/* 3. Earnings Slider */}
        <SlidingEarningsWidget isOnline={isOnline} breakMode={breakMode} onToggleBreak={() => setBreakMode(!breakMode)} />

        {/* 4. Bottom Break Trigger */}
        <motion.div 
          className="pointer-events-auto h-24 flex items-center justify-center"
          drag="y"
          dragConstraints={{ top: -50, bottom: 0 }}
          onDragEnd={(event, info: PanInfo) => {
            if (info.offset.y < -30) setBreakMode(true);
          }}
        >
          <div className="w-16 h-16 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center justify-center border-4 border-red-300">
             <Coffee className="text-white w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* 5. Hamburger Menu Panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            className="absolute top-16 left-4 w-64 bg-white rounded-3xl p-6 shadow-2xl z-40"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="font-black text-xl mb-4">Menu</h2>
            <nav className="space-y-4 font-bold text-slate-700">
              <p>Earnings Dashboard</p>
              <p>Trip History</p>
              <p>Documents & Compliance</p>
              <p>Support</p>
            </nav>
            <button onClick={() => setMenuOpen(false)} className="mt-8 text-xs font-black text-red-500">Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
