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
        dragConstraints={{ left: 16, right: window.innerWidth > 0 ? window.innerWidth - 60 : 340, top: 16, bottom: window.innerHeight > 0 ? window.innerHeight - 100 : 800 }}
        initial={{ x: window.innerWidth > 0 ? window.innerWidth - 60 : 340, y: window.innerHeight > 0 ? window.innerHeight - 200 : 700 }}
        className="pointer-events-auto absolute"
      >
        <motion.button
          onClick={handleSwitch}
          className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl shadow-lg transition-colors border ${
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
            {isAnyTrader ? "AnyRide" : "Anytrader"}
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
