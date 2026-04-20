import React from "react";
import { motion } from "motion/react";
import { Car, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/src/lib/utils";

import { triggerHaptic } from "@/src/lib/capacitor";

export default function MagicBubble() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleTap = () => {
    triggerHaptic();
    navigate("/book-ride");
  };

  // Don't show the bubble on the booking page itself or onboarding/login
  const hideOnPaths = ["/book-ride", "/login", "/onboarding"];
  if (hideOnPaths.includes(location.pathname)) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.1}
        initial={{ x: 20, y: 100 }}
        className="pointer-events-auto absolute right-6 bottom-32 md:bottom-24"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleTap}
          className={cn(
            "w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all border-4 border-white",
            "bg-gradient-to-br from-slate-900 to-slate-800 text-white"
          )}
        >
          <Car className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5">Book Taxi</span>
        </motion.button>
        
        {/* Tooltip hint */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 2 }}
          className="absolute right-20 top-1/2 -translate-y-1/2 bg-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-100 whitespace-nowrap hidden md:block"
        >
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Need a Ride? Tap Here</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
