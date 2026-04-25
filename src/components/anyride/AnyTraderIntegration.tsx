import React from "react";
import { Link, ArrowRightLeft, Users, Briefcase, TrendingUp } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function AnyTraderIntegration() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Link className="w-6 h-6 text-indigo-500" />
            AnyTrader Cross-Platform Analytics
          </h2>
          <p className="text-slate-500 font-medium">Track users transitioning between Trade services and Ride services.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
           <ArrowRightLeft className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500/50" />
           <div className="relative z-10">
             <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Total Cross-Platform Users</p>
             <div className="text-4xl font-black mb-2">4,812</div>
             <p className="text-xs font-bold text-indigo-100 bg-indigo-500/50 inline-block px-2 py-1 rounded">21% of total user base</p>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0"><Briefcase className="w-4 h-4 text-blue-500"/></div>
             <div className="text-sm font-black text-slate-900">Tradesmen who Drive</div>
           </div>
           <div className="text-3xl font-black text-slate-900 ml-11">142</div>
           <p className="text-xs text-slate-500 font-medium ml-11 mt-1">Users operating as both Trader & AnyRide Driver</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-emerald-500"/></div>
             <div className="text-sm font-black text-slate-900">AnyRide → AnyTrader</div>
           </div>
           <div className="text-3xl font-black text-slate-900 ml-11">84%</div>
           <p className="text-xs text-slate-500 font-medium ml-11 mt-1">Acquisition direction (Ride app drives Trade conversion)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
         <h3 className="text-sm font-black text-slate-900 mb-6">Cross-Sell Campaigns</h3>
         
         <div className="space-y-4">
           {[
             { name: "Post-Ride Property Prompt", desc: "Show 'Need a tradesman?' after completing a ride to home.", ctr: "4.2%", converts: "812 Jobs" },
             { name: "Driver Trade Onboarding", desc: "Prompt drivers to offer trade skills during off-peak hours.", ctr: "12.5%", converts: "45 New Traders" },
             { name: "Trade Material Courier", desc: "Traders using AnyRide to deliver small parts/materials.", ctr: "N/A", converts: "2,150 Rides" },
           ].map((c, i) => (
             <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors cursor-pointer group">
               <div className="mb-4 md:mb-0">
                 <div className="text-sm font-bold text-slate-900">{c.name}</div>
                 <div className="text-[10px] text-slate-500 font-medium mt-1">{c.desc}</div>
               </div>
               <div className="flex gap-6 items-center">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Click-Through</p>
                   <p className="text-sm font-bold text-slate-900">{c.ctr}</p>
                 </div>
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Generated</p>
                   <p className="text-sm font-black text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> {c.converts}</p>
                 </div>
                 <button className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                   Configure
                 </button>
               </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
}
