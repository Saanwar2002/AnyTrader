import React from "react";
import { Star, ShieldAlert, BadgePoundSterling, Zap } from "lucide-react";

export default function PrioritySettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Priority Settings
          </h2>
          <p className="text-slate-500 font-medium">Configure priority dispatch and premium subscription rules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                 <Star className="w-5 h-5 text-amber-500" />
               </div>
               <div>
                 <h3 className="text-lg font-black text-slate-900">Priority Pass Configuration</h3>
                 <p className="text-xs font-medium text-slate-500">Global settings for the premium rider tier.</p>
               </div>
             </div>

             <div className="space-y-6">
                <div>
                   <label className="text-xs font-bold text-slate-700 mb-2 block">Monthly Subscription Fee</label>
                   <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                     <span className="text-slate-500 font-bold">£</span>
                     <input type="number" defaultValue="9.99" className="bg-transparent border-none text-sm font-bold text-slate-900 outline-none w-full" />
                   </div>
                </div>

                <div>
                   <label className="text-xs font-bold text-slate-700 mb-2 block">Dispatch Algorithm Priority Weighting</label>
                   <input type="range" min="1" max="5" defaultValue="3" className="w-full accent-amber-500" />
                   <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                     <span>Normal</span>
                     <span>Extreme</span>
                   </div>
                   <p className="text-[10px] text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                     A setting of 3 means Priority users are favored over standard users requested up to 3 minutes prior.
                   </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                   <div className="flex items-center justify-between mb-2">
                     <label className="text-xs font-bold text-slate-700">Waive Standard Surge Pricing</label>
                     <div className="relative inline-block w-8 h-4 cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                     </div>
                   </div>
                   <p className="text-[10px] text-slate-500 mt-1">If enabled, priority users will never pay more than 1.2x surge, regardless of overall market conditions.</p>
                </div>
             </div>
           </div>

           <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6 text-white relative overflow-hidden">
             <Zap className="absolute -right-6 -bottom-6 w-32 h-32 text-white/5" />
             <h3 className="text-lg font-black mb-1">One-Time Priority Boost</h3>
             <p className="text-xs font-medium text-slate-400 mb-6 w-3/4">Dynamic pricing configuration for riders who want to pay a one-off fee to skip the queue.</p>
             
             <div className="space-y-4 relative z-10">
               <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 block">Base Boost Fee</label>
                  <div className="flex items-center gap-2 bg-black/30 border border-slate-600 rounded-lg px-3 py-2">
                    <span className="text-slate-500 font-bold">£</span>
                    <input type="number" defaultValue="3.00" className="bg-transparent border-none text-sm font-bold text-white outline-none w-full" />
                  </div>
               </div>
               
               <div className="flex items-center justify-between pt-2">
                 <span className="text-xs font-bold text-slate-300">Driver Commission Split</span>
                 <span className="text-xs font-black text-amber-400">80% Driver / 20% Platform</span>
               </div>
               <input type="range" min="0" max="100" defaultValue="80" className="w-full accent-amber-500" />
             </div>
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-900 mb-4">Priority Access Rules</h3>
              <div className="space-y-3">
                 <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Revoke Priority on Low Rating</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Automatically suspend priority perks if rider rating drops below 4.5. Retains monthly billing.</p>
                      <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Configure Thresholds &rarr;</button>
                    </div>
                 </div>
                 <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                    <BadgePoundSterling className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Minimum Balance Requirement</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Require a linked card with a pre-auth success before granting priority match.</p>
                      <div className="mt-2 relative inline-block w-8 h-4 cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                      </div>
                    </div>
                 </div>
              </div>
           </div>
           
           <button className="w-full py-3 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors">
              Save Global Priority Settings
           </button>
        </div>
      </div>
    </div>
  );
}
