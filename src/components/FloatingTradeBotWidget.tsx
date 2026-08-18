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
    <div className="fixed bottom-20 right-1 sm:bottom-8 sm:right-2 z-[95] pointer-events-none select-none">
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{
          top: -window.innerHeight + 120,
          bottom: 10,
          left: -window.innerWidth + 60,
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
          {/* Subtle Ambient Vertical Pulse Ring */}
          <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-600 via-indigo-600 to-amber-500 rounded-2xl blur-[2px] opacity-70 group-hover:opacity-100 animate-pulse transition-opacity" />

          <button
            onClick={handleOpenBot}
            id="floating-tradebot-widget-btn"
            aria-label="Ask AnyTrader AI"
            className="relative flex flex-col items-center justify-center gap-1 bg-slate-950/95 text-white border border-white/30 hover:border-blue-400 rounded-2xl px-1.5 py-2 shadow-xl backdrop-blur-md transition-transform active:scale-90 hover:scale-105"
          >
            {/* Mini Robot Avatar with Live Online Beacon */}
            <div className="relative w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-white/30 shadow-inner shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1.5 ring-slate-950 animate-pulse" />
            </div>

            {/* Vertical Stacked Label: "Ask AI" */}
            <div className="flex flex-col items-center justify-center leading-none text-center">
              <span className="font-bold text-[8.5px] tracking-tight text-white leading-tight">
                Ask
              </span>
              <span className="font-black text-[9.5px] tracking-tight text-blue-400 leading-tight">
                AI
              </span>
            </div>

            {/* Compact 24/7 Badge */}
            <span className="bg-amber-400 text-slate-950 font-black text-[7.5px] px-1 py-0.5 rounded uppercase leading-none">
              24/7
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
