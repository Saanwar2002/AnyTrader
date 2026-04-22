import React from "react";
import { motion } from "motion/react";
import { Car, Hammer, Repeat } from "lucide-react";
import { usePortal } from "../../lib/PortalContext";
import { useAuth } from "../AuthProvider";
import { useNavigate } from "react-router-dom";
import { triggerHaptic } from "@/src/lib/capacitor";

export default function PlatformSwitcher() {
  const { activePortal, switchPortal } = usePortal();
  const { profile } = useAuth();
  const navigate = useNavigate();

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
        dragConstraints={{ left: 16, right: window.innerWidth > 0 ? window.innerWidth - 80 : 300, top: 16, bottom: window.innerHeight > 0 ? window.innerHeight - 100 : 800 }}
        initial={{ x: window.innerWidth > 0 ? window.innerWidth - 80 : 300, y: window.innerHeight > 0 ? window.innerHeight - 200 : 700 }}
        className="pointer-events-auto absolute"
      >
        <motion.button
          onClick={handleSwitch}
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl shadow-xl transition-colors border-2 ${
            isAnyTrader 
              ? "bg-slate-900 text-white border-slate-700 hover:bg-slate-800 shadow-slate-900/30" 
              : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-blue-600/30"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
            {isAnyTrader ? <Car className="w-6 h-6 text-cyan-400" /> : <Hammer className="w-6 h-6 text-white" />}
            <div className="absolute -bottom-1 -right-2 bg-white rounded-full p-0.5 shadow-sm">
              <Repeat className="w-3 h-3 text-slate-800" />
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-tight mt-1 truncate max-w-full px-1">
            {isAnyTrader ? "AnyRide" : "AnyTrader"}
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
