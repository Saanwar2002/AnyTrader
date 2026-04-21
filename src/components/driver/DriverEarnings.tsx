import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PoundSterling, TrendingUp, Calendar, ChevronRight, Activity, ArrowUpRight, Zap } from "lucide-react";

export default function DriverEarnings({ fareConfig }: { fareConfig: any }) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-6 font-sans pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black tracking-tight">Earnings</h1>
        <div className="bg-[#1A1A1E] rounded-full p-1 flex">
          {(['today', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider capitalize ${period === p ? 'bg-[#252529] text-white shadow-sm' : 'text-[#A0A0A8]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stat */}
      <motion.div 
        key={period}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1A1A1E] rounded-3xl p-6 border border-[#2C2C30] shadow-2xl mb-4 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <p className="text-[10px] font-black uppercase text-[#A0A0A8] tracking-widest mb-1 shadow-sm">
          {period === 'today' ? 'Today so far' : period === 'week' ? 'This week' : 'This month'}
        </p>
        <div className="flex items-baseline gap-2 mb-4">
          <h1 className="text-[48px] leading-[1] font-black tracking-tighter text-white">
            {period === 'today' ? '£142.60' : period === 'week' ? '£845.20' : '£2,104.50'}
          </h1>
        </div>

        {/* Goal bar */}
        <div className="mb-2">
          <div className="flex justify-between items-baseline mb-1.5 font-bold">
            <span className="text-[11px] text-[#A0A0A8] uppercase tracking-wider">Goal: £{period === 'today' ? '200' : '1000'}</span>
            <span className="text-xs text-[#00D26A]">{period === 'today' ? '71%' : '84%'}</span>
          </div>
          <div className="h-[6px] w-full bg-[#252529] rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#00D26A] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: period === 'today' ? '71%' : '84%' }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Math-Based Analytics Module */}
      <div className="mb-6">
         <h2 className="text-sm font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-[#00D26A]" /> Breakdown</h2>
         <div className="space-y-2">
            <div className="bg-[#1A1A1E] rounded-2xl p-4 flex justify-between items-center border border-[#2C2C30]">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-[#252529] flex items-center justify-center">
                   <PoundSterling className="w-5 h-5 text-white" />
                 </div>
                 <div>
                   <p className="text-xs font-bold text-white leading-tight">Gross Fares</p>
                   <p className="text-[10px] text-[#A0A0A8] mt-0.5">Base + Distance + Time</p>
                 </div>
               </div>
               <p className="text-sm font-black text-white">£124.50</p>
            </div>
            
            <div className="bg-[#1A1A1E] rounded-2xl p-4 flex justify-between items-center border border-[#2C2C30]">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-[#FF9500]/10 border border-[#FF9500]/20 flex items-center justify-center">
                   <Zap className="w-5 h-5 text-[#FF9500]" />
                 </div>
                 <div>
                   <p className="text-xs font-bold text-white leading-tight">Surge & Boosts</p>
                   <p className="text-[10px] text-[#A0A0A8] mt-0.5">High demand areas</p>
                 </div>
               </div>
               <p className="text-sm font-black text-[#FF9500]">+£32.10</p>
            </div>

            <div className="bg-[#1A1A1E] rounded-2xl p-4 flex justify-between items-center border border-[#2C2C30]">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-[#00D26A]/10 border border-[#00D26A]/20 flex items-center justify-center">
                   <ArrowUpRight className="w-5 h-5 text-[#00D26A]" />
                 </div>
                 <div>
                   <p className="text-xs font-bold text-white leading-tight">Tips</p>
                   <p className="text-[10px] text-[#A0A0A8] mt-0.5">100% yours</p>
                 </div>
               </div>
               <p className="text-sm font-black text-[#00D26A]">+£4.50</p>
            </div>

            <div className="bg-[#FF3B30]/10 rounded-2xl p-4 flex justify-between items-center border border-[#FF3B30]/20">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-[#FF3B30]/20 flex items-center justify-center">
                   <PoundSterling className="w-5 h-5 text-[#FF3B30]" />
                 </div>
                 <div>
                   <p className="text-xs font-bold text-[#FF3B30] leading-tight">Platform Fee</p>
                   <p className="text-[10px] text-[#FF3B30]/80 mt-0.5">Fixed {(fareConfig.commissionRate * 100).toFixed(0)}% rate</p>
                 </div>
               </div>
               <p className="text-sm font-black text-[#FF3B30]">-£{(124.50 * fareConfig.commissionRate).toFixed(2)}</p>
            </div>
         </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:bg-[#252529] transition-colors">
          <Calendar className="w-6 h-6 text-[#A0A0A8]" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Payouts</span>
        </button>
        <button className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:bg-[#252529] transition-colors">
           <TrendingUp className="w-6 h-6 text-[#A0A0A8]" />
           <span className="text-[10px] font-bold text-white uppercase tracking-wider">Ride History</span>
        </button>
      </div>

    </div>
  );
}
