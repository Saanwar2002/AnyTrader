import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Car, Hammer, AlertTriangle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePortal } from "@/src/lib/PortalContext";
import { triggerHaptic } from "@/src/lib/capacitor";

export default function PlatformSwitcher() {
  const { activePortal, switchPortal, preventPortalSwitch, activeRole } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [quoteCount, setQuoteCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSwitchClick = () => {
    triggerHaptic();
    setShowConfirm(true);
  };

  const handleConfirmYes = () => {
    setShowConfirm(false);
    if (activePortal === "anytrader") {
      switchPortal("anyroller");
      setTimeout(() => navigate("/", { replace: true }), 50);
    } else {
      switchPortal("anytrader");
      setTimeout(() => navigate("/", { replace: true }), 50);
    }
  };

  const handleConfirmNo = () => {
    setShowConfirm(false);
  };

  const isAnyTrader = activePortal === "anytrader";

  // Hide the widget from the driver terminal dashboard, and hide from AnyTrader (as there's a top left button already)!
  if (preventPortalSwitch || (activeRole === "driver" && activePortal === "anyroller") || activePortal === "anytrader") {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] left-2 z-[110] pointer-events-none">
        <div className="pointer-events-auto relative flex items-center">
          <AnimatePresence>
            {quoteCount > 0 && !isAnyTrader && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -10 }}
                className="absolute -top-3 -right-3 z-[120]"
              >
                <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-[#1A1A1E] flex items-center justify-center shadow-lg">
                  <span className="text-[10px] font-black text-white">{quoteCount}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.button
            onClick={handleSwitchClick}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: 'none' }}
            className={`relative overflow-hidden flex items-center justify-center h-[2.75rem] rounded-xl shadow-lg transition-colors border-[1.5px] border-white ${
              isAnyTrader 
                ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/30" 
                : "bg-blue-600 text-white shadow-blue-600/30 cursor-pointer"
            } w-[2.75rem] flex-col select-none user-select-none`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="relative z-10 flex flex-col items-center justify-center w-full">
              <div className="relative mt-0.5">
                {isAnyTrader ? <Car className="w-5 h-5 text-cyan-400" /> : <Hammer className="w-5 h-5 text-white" />}
                <div className="absolute inset-0 blur-sm opacity-50 mix-blend-screen -z-10">
                  {isAnyTrader ? <Car className="w-5 h-5 text-cyan-200" /> : <Hammer className="w-5 h-5 text-blue-200" />}
                </div>
              </div>
              <span className="text-[7px] font-black uppercase tracking-tighter mt-[0.25rem] truncate max-w-full px-[0.1rem] leading-none mb-0.5">
                {isAnyTrader ? "AnyRoller" : "AnyTrader"}
              </span>
              
              {quoteCount > 0 && !isAnyTrader && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse z-20"></span>
              )}
            </div>
          </motion.button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={handleConfirmNo}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative p-6 pt-5 bg-white rounded-[24px] shadow-2xl max-w-xs w-full flex flex-col items-center text-center border overflow-hidden"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <Hammer className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-display font-black text-slate-900 mb-2 leading-tight">Switch to AnyTrader?</h3>
              <p className="text-sm font-medium text-slate-500 mb-6 leading-snug">
                You will leave the taxi booking screen. Are you sure?
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={handleConfirmNo}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors active:scale-95"
                >
                  No
                </button>
                <button 
                  onClick={handleConfirmYes}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-colors active:scale-95"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
