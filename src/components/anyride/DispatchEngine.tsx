import React, { useState } from "react";
import { Activity, Clock, Zap, Target, Sliders, Layers } from "lucide-react";

export default function DispatchEngine() {
  const [activeTab, setActiveTab] = useState("fairness");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Dispatch Engine
          </h2>
          <p className="text-slate-500 font-medium">Master controls for driver matching, stacking, and fairness.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Active
        </div>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
        {[ {id: "fairness", label: "Fairness & Scoring"}, {id: "dispatch", label: "Dispatch & Queue"}, {id: "stacking", label: "Ride Stacking"} ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === "fairness" && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" /> Scoring Algorithm Weights
              </h3>
              <p className="text-xs text-slate-500 mb-6">Weight adjustments for scoring matching formula. Base formula: (1/ETA)^W_eta × Rating^W_rating... </p>
              
              <div className="space-y-6">
                 {[{ label: "W_eta (ETA Importance)", value: "1.0", range: "0.5 - 2.0" },
                   { label: "W_fair (Fairness Boost)", value: "1.0", range: "0.0 - 2.0" },
                   { label: "W_rating (Rating Weight)", value: "0.5", range: "0.0 - 1.0" },
                   { label: "W_accept (Acceptance Weight)", value: "0.3", range: "0.0 - 1.0" }
                 ].map(weight => (
                   <div key={weight.label} className="space-y-1">
                     <label className="text-xs font-bold text-slate-700 flex justify-between">
                       {weight.label} <span className="text-emerald-600">{weight.value}</span>
                     </label>
                     <input type="range" min="0" max="2" step="0.1" defaultValue={weight.value} className="w-full accent-emerald-500" />
                   </div>
                 ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-400" /> Fairness Guardrails
              </h3>
              
              <div className="space-y-6">
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-700 flex justify-between">
                     Max ETA Stretch <span className="text-slate-500">3 mins</span>
                   </label>
                   <input type="range" min="1" max="5" step="1" defaultValue="3" className="w-full accent-emerald-500" />
                   <p className="text-[10px] text-slate-500">Max minutes a rider waits extra to pick a "fairer" driver over closer one.</p>
                 </div>
                 
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-700 flex justify-between">
                     Idle Boost Start <span className="text-slate-500">15 mins</span>
                   </label>
                   <input type="range" min="5" max="30" step="5" defaultValue="15" className="w-full accent-emerald-500" />
                   <p className="text-[10px] text-slate-500">Wait time before driver starts gaining idle fairness multipliers.</p>
                 </div>

                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-700 flex justify-between">
                     Idle Boost Max <span className="text-slate-500">2.0x</span>
                   </label>
                   <input type="range" min="1.5" max="3" step="0.1" defaultValue="2.0" className="w-full accent-emerald-500" />
                 </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "dispatch" && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-400" /> Search & Offers
              </h3>
              <div className="space-y-6">
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-700 flex justify-between">
                     Hard Search Radius <span className="text-slate-500">3.0 Miles</span>
                   </label>
                   <input type="range" min="1" max="10" step="0.5" defaultValue="3" className="w-full accent-emerald-500" />
                   <p className="text-[10px] text-slate-500">Radius to find "available" and "soon-to-be-available" drivers.</p>
                 </div>
                 
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-700 flex justify-between">
                     Driver Offer Timeout <span className="text-slate-500">15 sec</span>
                   </label>
                   <input type="range" min="10" max="30" step="5" defaultValue="15" className="w-full accent-emerald-500" />
                 </div>

                 <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-3">
                   <div className="flex items-center justify-between mb-2">
                     <h4 className="text-xs font-bold text-red-900">Decline Policies</h4>
                     <div className="relative inline-block w-8 h-4 cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-8 h-4 bg-red-200 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                     </div>
                   </div>
                   <div className="flex justify-between items-center bg-white p-2 rounded border border-red-100">
                     <span className="text-xs font-medium text-red-800">Decline Limit</span>
                     <span className="text-xs font-bold w-12 bg-slate-100 text-center py-1 rounded">3</span>
                   </div>
                   <div className="flex justify-between items-center bg-white p-2 rounded border border-red-100">
                     <span className="text-xs font-medium text-red-800">Auto-Offline Cooldown</span>
                     <span className="text-xs font-bold w-16 bg-slate-100 text-center py-1 rounded">10 min</span>
                   </div>
                 </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Ride Request Queue
              </h3>
              
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-slate-700">Enable Async Queue</span>
                   <div className="relative inline-block w-8 h-4 cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                   </div>
                 </div>

                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-700 flex justify-between">
                     Queue Expiry (Auto-cancel) <span className="text-slate-500">30 mins</span>
                   </label>
                   <input type="range" min="10" max="60" step="5" defaultValue="30" className="w-full accent-emerald-500" />
                 </div>

                 <div className="flex items-center justify-between">
                   <div>
                     <span className="text-xs font-bold text-slate-700 block">Lock Fares in Queue</span>
                     <span className="text-[10px] text-slate-500">Riders don't pay added surge while waiting.</span>
                   </div>
                   <div className="relative inline-block w-8 h-4 cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                   </div>
                 </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "stacking" && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" /> Ride Stacking Engine
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <div>
                        <span className="text-xs font-black text-emerald-900 block uppercase tracking-widest">Global Stacking</span>
                        <span className="text-[10px] text-emerald-700">Allow drivers to accept their next job while finishing their current.</span>
                      </div>
                      <div className="relative inline-block w-8 h-4 cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Driver Overrides</span>
                        <span className="text-[10px] text-slate-500">Can drivers pause stacking from their app?</span>
                      </div>
                      <div className="relative inline-block w-8 h-4 cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-700 flex justify-between">
                       Stack Window Start <span className="text-slate-500">5 min before drop-off</span>
                     </label>
                     <input type="range" min="2" max="10" step="1" defaultValue="5" className="w-full accent-emerald-500" />
                   </div>

                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-700 flex justify-between">
                       Min Stack Window <span className="text-slate-500">2 min to drop-off</span>
                     </label>
                     <input type="range" min="1" max="5" step="1" defaultValue="2" className="w-full accent-emerald-500" />
                     <p className="text-[10px] text-slate-500">Don't offer if driver is less than 2 mins from finishing, to avoid distraction.</p>
                   </div>
                 </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="flex justify-end">
         <button className="px-6 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors">
            Save Engine Configuration
         </button>
      </div>
    </div>
  );
}
