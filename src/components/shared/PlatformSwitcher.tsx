import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Car, Hammer, Repeat, Check } from "lucide-react";
import { usePortal } from "../../lib/PortalContext";
import { useAuth } from "../AuthProvider";
import { useNavigate, useLocation } from "react-router-dom";
import { triggerHaptic } from "@/src/lib/capacitor";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";

export default function PlatformSwitcher() {
  const { activePortal, switchPortal } = usePortal();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [quoteCount, setQuoteCount] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const pressTimeout = useRef<NodeJS.Timeout | null>(null);
  const hintTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || activePortal === 'anytrader') return;
    
    // When on AnyRide we want to alert them about quotes on AnyTrader
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false),
      where("type", "==", "quote")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setQuoteCount(snapshot.docs.length);
    }, () => {});

    return () => unsub();
  }, [user, activePortal]);

  const handleSwitch = () => {
    triggerHaptic();
    
    if (activePortal === "anytrader") {
      switchPortal("anyride");
      // Use setTimeout so PortalContext can update activeRole first to avoid routing flicker
      setTimeout(() => navigate("/", { replace: true }), 50);
    } else {
      switchPortal("anytrader");
      setTimeout(() => navigate("/", { replace: true }), 50);
    }
  };

  const startPress = () => {
    triggerHaptic();
    setIsPressing(true);
    setShowHint(false);
    pressTimeout.current = setTimeout(() => {
      clearTimeout(pressTimeout.current!);
      setIsPressing(false);
      handleSwitch();
    }, 2000); // 2 seconds hold
  };

  const cancelPress = () => {
    if (isPressing) {
      setShowHint(true);
      if (hintTimeout.current) clearTimeout(hintTimeout.current);
      hintTimeout.current = setTimeout(() => setShowHint(false), 3000);
    }
    setIsPressing(false);
    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current);
      pressTimeout.current = null;
    }
  };

  const isAnyTrader = activePortal === "anytrader";

  if (isAnyTrader) {
    return null;
  }

  // Moved to bottom-left to match bottom navigation bar
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] left-2 z-[110] pointer-events-none">
      <div className="pointer-events-auto relative flex items-center">
        <AnimatePresence>
          {showHint && (
            <motion.div 
               initial={{ opacity: 0, y: 10, scale: 0.9 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: 10, scale: 0.9 }}
               className="absolute -top-12 left-0 whitespace-nowrap bg-slate-800 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-[120]"
            >
               Hold for 2s to switch to AnyTrader
               <div className="absolute -bottom-1 left-4 w-2.5 h-2.5 bg-slate-800 rotate-45"></div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {quoteCount > 0 && !isAnyTrader && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              className="absolute left-[2.9rem] ml-3 whitespace-nowrap bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1.5"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
              {quoteCount} New {quoteCount === 1 ? 'Quote' : 'Quotes'}
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          className={`relative overflow-hidden flex items-center justify-center h-[2.75rem] rounded-xl shadow-lg transition-colors border-[1.5px] border-white ${
            isAnyTrader 
              ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/30" 
              : "bg-blue-600 text-white shadow-blue-600/30"
          } w-[2.75rem] flex-col select-none touch-none`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isPressing && (
             <motion.div 
               initial={{ scale: 0, opacity: 0.5 }}
               animate={{ scale: 20, opacity: 0 }}
               transition={{ duration: 2.0, ease: "easeOut" }}
               className="absolute inset-0 bg-white rounded-full z-0 pointer-events-none"
             />
          )}
          <div className="relative z-10 flex flex-col items-center justify-center w-full">
            <div className="relative mt-0.5">
              {isAnyTrader ? <Car className="w-5 h-5 text-cyan-400" /> : <Hammer className="w-5 h-5 text-white" />}
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[1.5px] shadow-sm">
                <Repeat className="w-2 h-2 text-slate-800" />
              </div>
            </div>
            <span className="text-[7px] font-black uppercase tracking-tighter mt-[0.25rem] truncate max-w-full px-[0.1rem] leading-none mb-0.5">
              {isPressing ? "HOLD..." : "AnyTrader"}
            </span>
            
            {quoteCount > 0 && !isAnyTrader && !isPressing && (
               <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse z-20"></span>
            )}
          </div>
        </motion.button>
      </div>
    </div>
  );
}
