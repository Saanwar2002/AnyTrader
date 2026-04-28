import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Car, Hammer, Repeat, Check } from "lucide-react";
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
  const [showConfirm, setShowConfirm] = useState(false);

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
    
    if (!showConfirm) {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 3000);
      return;
    }

    setShowConfirm(false);
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

  if (isAnyTrader) {
    return null;
  }

  // Moved to bottom-left to match bottom navigation bar
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] left-2 z-[110] pointer-events-none">
      <div className="pointer-events-auto relative flex items-center">
        <AnimatePresence>
          {quoteCount > 0 && !isAnyTrader && !showConfirm && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              className="absolute left-[2.9rem] ml-3 whitespace-nowrap bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1.5"
              onClick={handleSwitch}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
              {quoteCount} New {quoteCount === 1 ? 'Quote' : 'Quotes'}
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          onClick={handleSwitch}
          className={`relative flex items-center justify-center h-[2.75rem] rounded-xl shadow-lg transition-colors border-[1.5px] border-white ${
            isAnyTrader 
              ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/30" 
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/30"
          } ${showConfirm ? "px-3 w-auto gap-1.5" : "w-[2.75rem] flex-col"}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {showConfirm ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                Confirm
              </span>
            </>
          ) : (
            <>
              <div className="relative mt-0.5">
                {isAnyTrader ? <Car className="w-5 h-5 text-cyan-400" /> : <Hammer className="w-5 h-5 text-white" />}
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[1.5px] shadow-sm">
                  <Repeat className="w-2 h-2 text-slate-800" />
                </div>
              </div>
              <span className="text-[7.5px] font-black uppercase tracking-tighter mt-[0.25rem] truncate max-w-full px-[0.1rem] leading-none mb-0.5">
                {isAnyTrader ? "AnyRide" : "AnyTrader"}
              </span>
              
              {quoteCount > 0 && !isAnyTrader && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
