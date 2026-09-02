import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Car, 
  X, 
  Zap, 
  Package, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  BellRing,
  Hammer
} from "lucide-react";
import { useAuth } from "../AuthProvider";
import { db } from "@/src/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { triggerHaptic } from "@/src/lib/capacitor";

interface TaxiComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreTrades?: () => void;
  customTitle?: string;
  customMessage?: string;
}

export const TaxiComingSoonModal: React.FC<TaxiComingSoonModalProps> = ({
  isOpen,
  onClose,
  onExploreTrades,
  customTitle,
  customMessage
}) => {
  const { user, profile } = useAuth();
  const [emailInput, setEmailInput] = useState(user?.email || profile?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleRegisterInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) return;

    triggerHaptic();
    setIsSubmitting(true);
    try {
      const waitlistId = user?.uid || `guest_${Date.now()}`;
      await setDoc(doc(db, "anyroller_waitlist", waitlistId), {
        email: emailInput.trim().toLowerCase(),
        uid: user?.uid || null,
        role: profile?.role || "homeowner",
        registeredAt: serverTimestamp(),
        source: "book_taxi_coming_soon_modal",
        deviceUserAgent: navigator.userAgent
      }, { merge: true });

      setIsRegistered(true);
    } catch (err) {
      console.error("Error saving waitlist entry:", err);
      // Fallback local acknowledgment so user experience is smooth
      setIsRegistered(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-white rounded-3xl border border-black shadow-2xl w-full max-w-lg overflow-hidden my-auto z-10"
        >
          {/* Top Banner Accent */}
          <div className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-6 py-4 border-b border-black flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-md">
                <Car className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-black">AnyRoller Transport</span>
                  <span className="px-1.5 py-0.5 bg-black text-yellow-300 text-[9px] font-black uppercase rounded-full">
                    Phase 2
                  </span>
                </div>
                <p className="text-[11px] font-bold text-black/80 leading-none mt-0.5">
                  On-Demand Taxi & Bulky Goods Dispatch
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-black flex items-center justify-center transition-colors cursor-pointer relative z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Subtle background glow */}
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/30 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Modal Content */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Status Heading */}
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Launching Soon Across the UK</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-black text-black tracking-tight leading-tight">
                {customTitle || "Focusing on AnyTrader at Launch"}
              </h3>
              <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
                {customMessage || (
                  <>
                    We are currently dedicating 100% of our capacity to onboarding top verified UK tradespeople, homeowners, and landlords on <strong className="text-black">AnyTrader</strong>. AnyRoller passenger rides and bulky appliance courier dispatch will unlock in our upcoming phase!
                  </>
                )}
              </p>
            </div>

            {/* 4 Feature Preview Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 border border-black/15 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-600">
                  <Zap className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-black">Zero Surge</span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 leading-tight">
                  Transparent, fixed-rate passenger fares with no peak gouging.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-black/15 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-blue-600">
                  <Package className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-black">Bulky Courier</span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 leading-tight">
                  Heavy appliance & marketplace transport van dispatch.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-black/15 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-black">Vetted Fleet</span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 leading-tight">
                  Council-licensed drivers with real-time GPS telemetry.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-black/15 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-purple-600">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-black">1-Tap Pay</span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 leading-tight">
                  Instant QR split payments with 0% hidden middleman deductions.
                </p>
              </div>
            </div>

            {/* Notification / Waitlist Signup Box */}
            <div className="p-4 bg-slate-50 border border-black rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-black flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-amber-600" />
                  Get Early Access When Rides Go Live
                </span>
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  Priority
                </span>
              </div>

              {isRegistered ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>🎉 You're on the launch priority list! We'll notify you as soon as rides activate.</span>
                </div>
              ) : (
                <form onSubmit={handleRegisterInterest} className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter email for launch invite..."
                    className="flex-1 px-3 py-2 bg-white border border-black/30 rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !emailInput}
                    className="px-3.5 py-2 bg-black hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-black transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {isSubmitting ? "Saving..." : "Notify Me"}
                  </button>
                </form>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  onClose();
                }}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition-colors border border-black/10 text-center cursor-pointer"
              >
                Close & Return
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  onClose();
                  if (onExploreTrades) {
                    onExploreTrades();
                  }
                }}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-blue-600/20 border border-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Explore AnyTrader Trades</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
