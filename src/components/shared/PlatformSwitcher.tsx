import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Car, Hammer, Repeat } from "lucide-react";
import { usePortal } from "../../lib/PortalContext";
import { useAuth } from "../AuthProvider";
import { useNavigate } from "react-router-dom";
import { triggerHaptic } from "@/src/lib/capacitor";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";

export default function PlatformSwitcher() {
  const { activePortal, switchPortal } = usePortal();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [quoteCount, setQuoteCount] = useState(0);

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
      if (profile?.role === "fleet_driver") {
        navigate("/driver-terminal");
      } else {
        navigate("/book-ride");
      }
    } else {
      switchPortal("anytrader");
      navigate("/");
    }
  };

  const isAnyTrader = activePortal === "anytrader";

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <motion.div
        drag
        dragElastic={0.1}
        dragMomentum={false}
        // approximate bounds so it doesn't get lost off-screen
        dragConstraints={{ left: 16, right: window.innerWidth > 0 ? window.innerWidth - 60 : 340, top: 16, bottom: window.innerHeight > 0 ? window.innerHeight - 100 : 800 }}
        initial={{ x: window.innerWidth > 0 ? window.innerWidth - 60 : 340, y: window.innerHeight > 0 ? window.innerHeight - 200 : 700 }}
        className="pointer-events-auto absolute"
      >
        <AnimatePresence>
          {quoteCount > 0 && !isAnyTrader && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              className="absolute -left-28 -top-8 bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-blue-500 whitespace-nowrap flex items-center gap-1.5 pointer-events-auto cursor-pointer"
              onClick={handleSwitch}
            >
              📋 {quoteCount} new quote{quoteCount > 1 ? 's' : ''}
              <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rotate-45 border-r border-t border-blue-500"></div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          onClick={handleSwitch}
          className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-xl shadow-lg transition-colors border ${
            isAnyTrader 
              ? "bg-slate-900 text-white border-slate-700 hover:bg-slate-800 shadow-slate-900/30" 
              : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-blue-600/30"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
            {isAnyTrader ? <Car className="w-4 h-4 text-cyan-400" /> : <Hammer className="w-4 h-4 text-white" />}
            <div className="absolute -bottom-1 -right-1.5 bg-white rounded-full p-0.5 shadow-sm">
              <Repeat className="w-2 h-2 text-slate-800" />
            </div>
          </div>
          <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5 truncate max-w-full px-0.5">
            {isAnyTrader ? "AnyRide" : "AnyTrader"}
          </span>
          
          {quoteCount > 0 && !isAnyTrader && (
             <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
