import React from "react";
import { Activity, Clock, Zap, Target } from "lucide-react";

export default function DispatchEngine() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Dispatch Engine
          </h2>
          <p className="text-slate-500 font-medium">Configure algorithm weighting, matching radius, and step-ups.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Radius & Expansion */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
             <Target className="w-4 h-4 text-slate-400" /> Radius & Expansion Strategies
           </h3>

           <div className="space-y-6">
             <div className="space-y-1">
               <label className="text-xs font-bold text-slate-700 flex justify-between">
                 Initial Search Radius <span className="text-slate-500">1.0 Miles</span>
               </label>
               <input type="range" min="0.5" max="5" step="0.5" defaultValue="1" className="w-full accent-emerald-500" />
               <p className="text-[10px] text-slate-500">The immediate zone scanned for available drivers when a requests is made.</p>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-bold text-slate-700 flex justify-between">
                 Maximum Search Radius <span className="text-slate-500">3.5 Miles</span>
               </label>
               <input type="range" min="1" max="10" step="0.5" defaultValue="3.5" className="w-full accent-emerald-500" />
               <p className="text-[10px] text-slate-500">The absolute maximum distance the system will attempt to match a driver.</p>
             </div>

             <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <h4 className="text-xs font-bold text-slate-900 mb-2">Expansion Timing (Step-ups)</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Step +1 Mile Every</span>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full">
                       <input type="number" defaultValue="30" className="w-full bg-transparent border-none text-sm font-bold text-slate-900 outline-none" />
                       <span className="text-xs font-bold text-slate-400">sec</span>
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-slate-300 mt-4" />
                </div>
             </div>
           </div>
         </div>

         {/* Algorithm Weighting */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
             <Activity className="w-4 h-4 text-slate-400" /> Scoring Algorithm Weights
           </h3>
           <p className="text-xs text-slate-500 mb-6">Allocate 100 points across the parameters used to select the "best" driver for a given request.</p>

           <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Distance Traveled (Proximity)</span>
                  <span className="text-emerald-600">60%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-emerald-500 w-[60%] h-full rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Driver Rating & Completion Rate</span>
                  <span className="text-emerald-600">25%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-emerald-500 w-[25%] h-full rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Earnings Equity (Fair dispatching)</span>
                  <span className="text-emerald-600">15%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-emerald-500 w-[15%] h-full rounded-full"></div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-start gap-3 mt-4">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                   <h4 className="text-xs font-bold text-slate-900">Long-trip Favoritism (Experimental)</h4>
                   <p className="text-[10px] text-slate-500 mt-1 mb-2">Slightly favor drivers who have had a string of short, low-paying trips when a high-value route appears.</p>
                   <div className="relative inline-block w-8 h-4 cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                   </div>
                </div>
              </div>
           </div>
         </div>
      </div>
      
      <div className="flex justify-end">
         <button className="px-6 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors">
            Deploy Engine Configuration
         </button>
      </div>
    </div>
  );
}
