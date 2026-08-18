import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  Users, 
  Briefcase, 
  Video, 
  Sparkles, 
  X, 
  Wrench, 
  ArrowRight,
  Zap,
  Home,
  Flame,
  Truck,
  FileCheck
} from "lucide-react";

const SHOULD_SHOW_EVERY_N_OPENS = 5;

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [isVisible, setIsVisible] = useState(() => {
    try {
      const raw = localStorage.getItem("anytrader_splash_open_count");
      const count = raw ? parseInt(raw, 10) : 0;
      const newCount = count + 1;
      localStorage.setItem("anytrader_splash_open_count", newCount.toString());
      // Show on 1st opening, 6th opening, 11th opening, etc. (once every 5 openings)
      return newCount === 1 || (newCount - 1) % SHOULD_SHOW_EVERY_N_OPENS === 0;
    } catch (e) {
      return true;
    }
  });
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!isVisible) {
      if (onFinish) onFinish();
      return;
    }

    // Countdown timer for 10s auto-dismiss
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, 10000); // 10 seconds display time

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [isVisible, onFinish]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onFinish) onFinish();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-5 md:p-6 overflow-hidden select-none"
        >
          {/* Top 10-Second Linear Countdown Progress Bar */}
          <div className="fixed top-0 left-0 right-0 z-50 h-1.5 bg-slate-800 pointer-events-none">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 10, ease: "linear" }}
              className="h-full bg-gradient-to-r from-amber-400 via-blue-500 to-emerald-400"
            />
          </div>

          {/* 1. Header Bar: Logo & Skip Control */}
          <div className="w-full max-w-6xl mx-auto flex items-center justify-between shrink-0 pt-1">
            <div className="inline-flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center text-white shadow-md border border-white/20">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white inline-block">
                  Any<span className="text-amber-400">Trader</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  UK Trade Ecosystem
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 bg-slate-900/90 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="hidden xs:inline">Closing in</span>
                <strong className="text-white font-mono">{timeLeft}s</strong>
              </span>

              <button
                onClick={handleDismiss}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border border-white/20 text-xs sm:text-sm font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Skip</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Main High-Impact Responsive Poster Card (Zero Scroll, Auto-Fitted) */}
          <div className="w-full max-w-6xl mx-auto flex-1 min-h-0 my-1.5 sm:my-2 flex flex-col justify-center">
            <motion.div
              initial={{ scale: 0.97, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="w-full h-full max-h-[82vh] bg-white text-slate-900 rounded-2xl sm:rounded-3xl border-2 border-black shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Top Banner & Core Slogan */}
              <div className="bg-slate-900 text-white px-3 py-2 sm:px-5 sm:py-3 text-center border-b border-slate-800 shrink-0">
                <h1 className="text-base sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                  The All-In-One Local Trade & Service Platform
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-xs font-bold text-slate-300 mt-1">
                  <span className="flex items-center gap-1 text-amber-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    100% Verified UK Pros
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-extrabold">0% Lead Fees</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-sky-300">90+ Categories</span>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="text-amber-300 hidden sm:inline">TradeOS Free Suite</span>
                </div>
              </div>

              {/* Dual Use-Case Split (Homeowners vs Tradespeople) */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
                {/* Left Side: For Homeowners, Landlords & Tenants */}
                <div className="bg-slate-50 p-2.5 sm:p-4 md:p-5 flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 sm:pb-1.5 mb-2">
                      <h2 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-1.5">
                        <Home className="w-4 h-4 text-blue-600" />
                        <span>For Homeowners & Landlords</span>
                      </h2>
                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                        100% Free To Post
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <div className="bg-white p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-blue-600 font-bold text-[11px] sm:text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-slate-900">ID & Video Verified</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                          DBS checks & live video selfie credentials
                        </p>
                      </div>

                      <div className="bg-white p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-600 font-bold text-[11px] sm:text-xs">
                          <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-slate-900">AI Price Guides</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                          Instant transparent local cost benchmarks
                        </p>
                      </div>

                      <div className="bg-white p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-indigo-600 font-bold text-[11px] sm:text-xs">
                          <FileCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-slate-900">Property Passport</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                          CP12, EICR & digital specs compliance
                        </p>
                      </div>

                      <div className="bg-white p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-amber-600 font-bold text-[11px] sm:text-xs">
                          <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-slate-900">Emergency & Deals</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                          24/7 callouts & off-peak flash discounts
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Popular Categories Chips */}
                  <div className="pt-1.5 sm:pt-2 border-t border-slate-200 mt-1.5">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 mb-1">
                      90+ On-Demand Categories:
                    </p>
                    <div className="flex flex-wrap gap-1 sm:gap-1.5">
                      <span className="bg-red-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full">
                        🚨 Emergency 24/7
                      </span>
                      <span className="bg-blue-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full">
                        🚰 Plumbing & Gas
                      </span>
                      <span className="bg-sky-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full">
                        ⚡ Electrics
                      </span>
                      <span className="bg-emerald-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full">
                        🌱 Gardening
                      </span>
                      <span className="bg-purple-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full">
                        🔨 Labour & Mates
                      </span>
                      <span className="bg-amber-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full">
                        📦 Bulky Delivery
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: For Trades, Contractors & Drivers */}
                <div className="bg-slate-950 text-white p-2.5 sm:p-4 md:p-5 flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1 sm:pb-1.5 mb-2">
                      <h2 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight text-amber-400 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-amber-400" />
                        <span>For Trades & Service Pros</span>
                      </h2>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                        Zero Lead Fees
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-slate-200">
                      <div className="bg-slate-900 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-400 font-extrabold text-[11px] sm:text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-white">0% Upfront Lead Fees</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                          Never pay for quotes or leads. Pay only on paid jobs
                        </p>
                      </div>

                      <div className="bg-slate-900 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-blue-400 font-bold text-[11px] sm:text-xs">
                          <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-white">TradeOS Suite</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                          Invoices, quotes & tax reserve tools
                        </p>
                      </div>

                      <div className="bg-slate-900 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-amber-400 font-bold text-[11px] sm:text-xs">
                          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-white">Trade Mates</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                          Hire extra site helpers on-demand
                        </p>
                      </div>

                      <div className="bg-slate-900 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-purple-400 font-bold text-[11px] sm:text-xs">
                          <Video className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="text-white">Video Badges</span>
                        </div>
                        <p className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                          Selfie credential videos for +35% trust
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* High-Impact Yellow Banner */}
                  <div className="bg-amber-400 text-slate-950 p-2 sm:p-2.5 rounded-xl text-center space-y-0.5 shadow-md border border-amber-300 mt-1.5">
                    <p className="text-xs sm:text-sm font-black uppercase tracking-tight leading-none text-slate-950">
                      NO PAY-PER-LEAD • DIRECT CLIENT MESSAGING
                    </p>
                    <p className="text-[10px] sm:text-xs font-extrabold text-slate-900 leading-tight">
                      Join Thousands of Verified UK Trades & Service Specialists
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 3. Bottom Action & Status Footer */}
          <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400 font-medium pt-1 shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-semibold text-slate-300 text-[11px] sm:text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>TradeOS Ecosystem</span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400 hidden sm:inline text-[11px]">Verified Local Services Across the UK</span>
            </div>

            <button
              onClick={handleDismiss}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer transition-all"
            >
              <span>Enter App Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
