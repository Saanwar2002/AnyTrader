import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, CheckCircle2, Users, Briefcase, Video, Sparkles, X, Wrench, ArrowRight } from "lucide-react";

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    // Countdown timer for display number (5s)
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, 5000); // 5 seconds display time

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] bg-slate-950 text-slate-900 flex flex-col justify-between p-3 sm:p-6 md:p-8 overflow-y-auto w-screen h-screen"
        >
          {/* Top Run-Down Countdown Timer Bar (100% -> 0% in 5s) */}
          <div className="fixed top-0 left-0 right-0 z-50 h-2 bg-slate-800">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="h-full bg-gradient-to-r from-amber-400 via-blue-500 to-emerald-400"
            />
          </div>

          {/* Full Screen Header Navigation & Controls */}
          <div className="w-full max-w-6xl mx-auto pt-2 flex items-center justify-between shrink-0">
            <motion.div 
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2.5"
            >
              <motion.div 
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center text-white shadow-lg border border-white/20"
              >
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              </motion.div>
              <div>
                <motion.span 
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                  className="text-2xl sm:text-3xl font-black tracking-tight text-white block sm:inline-block"
                >
                  Any<span className="text-amber-400">Trader</span>
                </motion.span>
                <span className="hidden sm:inline-block ml-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">
                  Official Platform
                </span>
              </div>
            </motion.div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-semibold text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Auto-close in <strong className="text-white font-mono">{timeLeft}s</strong></span>
              </span>

              <button
                onClick={() => {
                  setIsVisible(false);
                  if (onFinish) onFinish();
                }}
                className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/20 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-lg active:scale-95"
              >
                <span>Skip</span>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Responsive Full-Screen Main Poster Canvas */}
          <div className="w-full max-w-6xl mx-auto my-auto py-3 sm:py-6 flex flex-col justify-center">
            {/* Poster Card Container */}
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full bg-white rounded-3xl border-2 border-black shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Title Header */}
              <div className="bg-slate-900 text-white p-4 sm:p-6 text-center space-y-2 border-b border-slate-800">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                  The All-In-One Local Trade & Service App
                </h1>

                <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-1.5 bg-slate-800/90 border border-slate-700 rounded-full text-xs sm:text-sm font-bold text-slate-200">
                  <span className="flex items-center gap-1 text-amber-400">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    100% Verified UK Pros
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-400 font-extrabold">0% Lead Fees</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-sky-300">86+ Service Categories</span>
                </div>
              </div>

              {/* Dual Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* Left Column: For Homeowners & Landlords */}
                <div className="bg-slate-50 p-4 sm:p-6 md:p-8 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                        <span>🏡</span> For Homeowners & Landlords
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                        Free Post & Track
                      </span>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                      <li className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-blue-600 text-base">🆔</span>
                        <div>
                          <strong className="block text-slate-900">ID/Video Verification</strong>
                          <span className="text-[11px] text-slate-500 font-normal">DBS & Live Video Selfie Credentials</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-blue-600 text-base">📊</span>
                        <div>
                          <strong className="block text-slate-900">AI Price Transparency</strong>
                          <span className="text-[11px] text-slate-500 font-normal">Benchmark local cost guides</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-blue-600 text-base">📘</span>
                        <div>
                          <strong className="block text-slate-900">Digital Property Passport</strong>
                          <span className="text-[11px] text-slate-500 font-normal">CP12, EICR & Maintenance history</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-blue-600 text-base">💳</span>
                        <div>
                          <strong className="block text-slate-900">Stripe Escrow Protection</strong>
                          <span className="text-[11px] text-slate-500 font-normal">Release funds when job is complete</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Category Pills Bar */}
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Popular Categories Available Now:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="bg-red-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        🚨 Emergency 24/7
                      </span>
                      <span className="bg-blue-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        🚰 Plumbing
                      </span>
                      <span className="bg-sky-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        ⚡ Electrics
                      </span>
                      <span className="bg-emerald-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        🌱 Garden Digging
                      </span>
                      <span className="bg-purple-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        🔨 Trade Mates & Helpers
                      </span>
                      <span className="bg-amber-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        📦 Bulky Delivery
                      </span>
                    </div>
                    <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white text-xs font-black uppercase tracking-wider text-center py-2 rounded-xl shadow-md">
                      PLUS 86+ MORE SERVICE CATEGORIES
                    </div>
                  </div>
                </div>

                {/* Right Column: For Trades & Service Pros */}
                <div className="bg-slate-950 text-white p-4 sm:p-6 md:p-8 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-amber-400 flex items-center gap-2">
                        <span>🔧</span> For Trades & Service Pros
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                        Zero Commission
                      </span>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm font-medium text-slate-200">
                      <li className="flex items-center gap-2.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <strong className="block text-white font-extrabold">ZERO LEAD FEES</strong>
                          <span className="text-[11px] text-slate-400">Keep 100% of your money</span>
                        </div>
                      </li>
                      <li className="flex items-center gap-2.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <Users className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <strong className="block text-white">Site Helpers & Mates</strong>
                          <span className="text-[11px] text-slate-400">Hire extra hands on-demand</span>
                        </div>
                      </li>
                      <li className="flex items-center gap-2.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <Briefcase className="w-5 h-5 text-blue-400 shrink-0" />
                        <div>
                          <strong className="block text-white">TradeOS Business Suite</strong>
                          <span className="text-[11px] text-slate-400">Quotes, Invoices & Tax reserve</span>
                        </div>
                      </li>
                      <li className="flex items-center gap-2.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <Video className="w-5 h-5 text-purple-400 shrink-0" />
                        <div>
                          <strong className="block text-white">Video Selfie Badge</strong>
                          <span className="text-[11px] text-slate-400">+35% higher client trust</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Yellow High-Impact Banner */}
                  <div className="bg-amber-400 text-slate-950 p-3 sm:p-4 rounded-2xl text-center space-y-1 shadow-xl border-2 border-amber-300 transform hover:scale-[1.01] transition-transform">
                    <p className="text-sm sm:text-base font-black uppercase tracking-tight leading-none text-slate-950">
                      NO HIDDEN COSTS • NO PAY-PER-LEAD
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Join Thousands of Verified UK Trades & Service Specialists
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Full Screen Footer Bar */}
          <div className="w-full max-w-6xl mx-auto pb-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-medium gap-2 shrink-0 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>TradeOS Ecosystem</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Verified Local Services Across the UK</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-bold text-white tracking-wider text-sm bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                www.anytrader.co.uk
              </span>
              <button
                onClick={() => {
                  setIsVisible(false);
                  if (onFinish) onFinish();
                }}
                className="text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 group"
              >
                <span>Enter App Now</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
