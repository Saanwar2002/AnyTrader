import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Zap } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface InstantMatchTraderAlertProps {
  job: any;
  expiresAt: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const InstantMatchTraderAlert = ({ job, expiresAt, onAccept, onDecline }: InstantMatchTraderAlertProps) => {
  const [timeLeft, setTimeLeft] = useState(60);
  
  useEffect(() => {
    const calcTimeLeft = () => {
      const now = new Date().getTime();
      const expiration = new Date(expiresAt).getTime();
      const diffSeconds = Math.ceil((expiration - now) / 1000);
      return Math.max(0, diffSeconds);
    };

    setTimeLeft(calcTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onDecline();
    }
  }, [timeLeft, onDecline]);

  const progressPercentage = (timeLeft / 60) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-zinc-900 w-full max-w-sm rounded-[32px] overflow-hidden border border-zinc-800 shadow-2xl relative"
      >
        {/* Header / Timer Arc Area */}
        <div className="relative pt-10 pb-6 px-6 flex flex-col items-center justify-center text-center">
          
          {/* Subtle Radar/Pulse background */}
          <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none">
            <div className="w-[300px] h-[300px] rounded-full border border-red-500/20 absolute animate-[ping_3s_linear_infinite]" />
            <div className="w-[200px] h-[200px] rounded-full border border-red-500/30 absolute animate-[ping_2s_linear_infinite]" />
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent" />
          </div>

          <div className="relative z-10 w-24 h-24 mb-6 rounded-full flex items-center justify-center">
            {/* SVG Arc for Timer */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle 
                cx="48" cy="48" r="44" 
                className="stroke-zinc-800 fill-none" strokeWidth="6"
              />
              <circle 
                cx="48" cy="48" r="44" 
                className={cn(
                  "fill-none transition-all duration-1000 ease-linear",
                  timeLeft > 15 ? "stroke-red-500" : "stroke-red-600"
                )} 
                strokeWidth="6"
                strokeDasharray="276"
                strokeDashoffset={276 - (276 * progressPercentage) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-3xl font-black text-white tabular-nums tracking-tighter">
              00:{timeLeft.toString().padStart(2, '0')}
            </span>
          </div>

          {/* AnyTrader Exclusive Badge */}
          <div className="bg-red-500/20 border border-red-500/50 text-red-500 px-3 py-1 rounded-full flex items-center gap-1.5 mb-4 z-10">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span className="text-[10px] font-black uppercase tracking-widest">AnyTrader Exclusive</span>
          </div>

          <h2 className="text-sm font-bold text-red-400 mb-2 tracking-wider z-10 uppercase">Trader Emergency Alert</h2>
          <p className="text-3xl font-black text-white leading-tight shadow-sm z-10 mb-1">{job?.title || "Burst Pipe"}</p>
          
          <div className="flex items-center gap-1.5 mt-3 text-black font-black bg-yellow-400 px-3 py-1.5 rounded-full z-10">
            <MapPin className="w-4 h-4" />
            <span>0.8 miles away</span>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="h-40 bg-zinc-800 relative w-full border-y border-zinc-700">
           <img 
             src={`https://picsum.photos/seed/map${job?.id || '1'}/600/300`} 
             alt="Map"
             className="w-full h-full object-cover opacity-80"
           />
           {/* Gradient fade to integrate map into layout */}
           <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
           
           <div className="absolute bottom-4 left-4 right-4 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 p-3 rounded-2xl">
             <p className="text-sm font-bold text-white truncate">{job?.location?.address || "123 Maple Street, Apt 4B"}</p>
           </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-zinc-900 flex flex-col gap-3">
          <div className="flex items-start gap-2 bg-yellow-400 border border-yellow-500 p-3 rounded-xl mb-1">
            <Zap className="w-4 h-4 shrink-0 text-black mt-0.5" />
            <p className="text-[11px] font-black text-black uppercase tracking-wide leading-relaxed">
              Only accept if you are free to travel to this job straight away.
            </p>
          </div>
          <button 
            onClick={onAccept}
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-black text-lg py-4 rounded-2xl transition-colors shadow-[0_0_20px_rgba(34,197,94,0.3)]"
          >
            ACCEPT
          </button>
          <button 
            onClick={onDecline}
            className="w-full bg-transparent border-2 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-white font-bold text-lg py-4 rounded-2xl transition-all"
          >
            DECLINE
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
