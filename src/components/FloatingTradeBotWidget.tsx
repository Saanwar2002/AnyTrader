import React, { useState } from "react";
import { motion } from "motion/react";
import { Bot } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { usePortal } from "@/src/lib/PortalContext";
import { triggerHaptic } from "@/src/lib/capacitor";

export function FloatingTradeBotWidget() {
  const { isTradeBotOpen, setIsTradeBotOpen } = useAuth();
  const { activePortal, activeRole } = usePortal();
  const location = useLocation();

  const [isDragging, setIsDragging] = useState(false);

  // Check if user is on Taxi / Rides side
  const isTaxiSide =
    activePortal === "anyroller" ||
    activeRole === "driver" ||
    location.pathname.startsWith("/book-ride") ||
    location.pathname.startsWith("/driver-terminal") ||
    location.pathname.startsWith("/my-rides") ||
    location.pathname.startsWith("/saved-journeys") ||
    location.pathname.startsWith("/platform-fee-success");

  const handleOpenBot = () => {
    if (isDragging) return;
    triggerHaptic();
    setIsTradeBotOpen(true);
  };

  // Strictly hide on Taxi side or when TradeBot dialog is open
  if (isTaxiSide || isTradeBotOpen) return null;

  return (
    <div className="fixed bottom-24 right-2 sm:bottom-10 sm:right-4 z-[95] pointer-events-none select-none pb-[env(safe-area-inset-bottom,0px)]">
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{
          top: -window.innerHeight + 140,
          bottom: 10,
          left: -window.innerWidth + 70,
          right: 5,
        }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          setTimeout(() => setIsDragging(false), 150);
        }}
        className="pointer-events-auto flex flex-col items-end gap-1.5 cursor-grab active:cursor-grabbing"
      >
        {/* Permanent Vertical Compact Sticky Pulsing Pill */}
        <div className="relative group">
          {/* Soft Pulsing Bright Orange Ambient Glow Ring */}
          <div className="absolute -inset-0.5 bg-gradient-to-b from-orange-400 via-orange-500 to-amber-500 rounded-xl blur-[2.5px] opacity-75 group-hover:opacity-100 animate-pulse transition-opacity" />

          <button
            onClick={handleOpenBot}
            id="floating-tradebot-widget-btn"
            aria-label="Ask AnyTrader AI"
            className="relative w-[30px] sm:w-[32px] flex flex-col items-center justify-center gap-1 bg-slate-950/95 text-white border border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.45),0_4px_10px_rgba(0,0,0,0.4)] hover:border-orange-400 rounded-xl px-0.5 py-1.5 backdrop-blur-md transition-all active:scale-90 hover:scale-105"
          >
            {/* Mini Robot Avatar in Blue with Live Online Beacon */}
            <div className="relative w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-blue-300/40 shadow-inner shrink-0">
              <Bot className="w-3 h-3 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full ring-1 ring-slate-950 animate-pulse" />
            </div>

            {/* Vertical Stacked Label: "Ask AI" */}
            <div className="flex flex-col items-center justify-center leading-none text-center">
              <span className="font-bold text-[7.5px] tracking-tighter text-white leading-tight">
                Ask
              </span>
              <span className="font-black text-[8.5px] tracking-tighter text-blue-400 leading-tight">
                AI
              </span>
            </div>

            {/* Compact 24/7 Badge */}
            <span className="bg-orange-500 text-slate-950 font-black text-[6.5px] px-0.5 py-0.5 rounded uppercase leading-none shadow-sm">
              24/7
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
