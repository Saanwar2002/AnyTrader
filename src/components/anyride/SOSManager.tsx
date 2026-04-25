import React from "react";
import { ShieldAlert, Radio, Activity, AlertTriangle, PhoneCall, Mic, Users, MapPin } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function SOSManager() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-rose-600 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-8 h-8" />
            SOS & Safety Operations
          </h2>
          <p className="text-slate-500 font-medium">Critical incident monitoring and audio access.</p>
        </div>
      </div>

      <div className="bg-rose-600 text-white rounded-2xl shadow-xl overflow-hidden relative">
         <Radio className="absolute -right-10 -bottom-10 w-48 h-48 text-black/10" />
         <div className="p-6 relative z-10">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-3 h-3 rounded-full bg-white animate-ping"></div>
             <h3 className="text-xl font-black uppercase tracking-widest">Active Alerts (1)</h3>
           </div>

           <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                   <div className="px-2 py-0.5 bg-black/30 rounded text-[10px] font-black uppercase tracking-widest">Code Red</div>
                   <div className="text-sm font-bold opacity-80 flex items-center gap-1"><MapPin className="w-3 h-3"/> M6 Motorway J6</div>
                </div>
                <h4 className="text-2xl font-black mb-1">Ride #4892 — SOS Triggered</h4>
                <p className="text-sm font-medium opacity-90"><Users className="w-4 h-4 inline mr-1" /> Driver: Ahmed K. • Rider: Dave R.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                 <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-rose-600 font-black px-6 py-3 rounded-lg shadow-lg hover:bg-slate-50 transition-transform hover:scale-105 active:scale-95">
                   <Mic className="w-5 h-5" /> Listen Live
                 </button>
                 <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-black/30 text-white font-bold px-6 py-3 rounded-lg hover:bg-black/40 transition-colors">
                   <PhoneCall className="w-5 h-5" /> Dispatch Police
                 </button>
              </div>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
         {/* Audio Logs */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
           <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
             <Mic className="w-4 h-4 text-slate-400" /> Recent Audio Recordings
           </h3>
           <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">Retained for 14 Days max</p>
           
           <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar">
              {[
                { id: "AUD-4819", date: "Today, 14:30", type: "Manual SOS", length: "4m 12s", status: "investigating" },
                { id: "AUD-4702", date: "Yesterday", type: "Crash Detect", length: "1m 05s", status: "resolved" },
                { id: "AUD-4699", date: "16 Apr", type: "Manual SOS", length: "8m 40s", status: "resolved" },
              ].map(log => (
                <div key={log.id} className="p-3 border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-50">
                   <div>
                     <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                       {log.id} 
                       <span className={cn(
                         "text-[8px] uppercase tracking-widest px-1.5 rounded",
                         log.type === "Manual SOS" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                       )}>{log.type}</span>
                     </div>
                     <div className="text-[10px] text-slate-500 font-medium mt-1">{log.date} • {log.length}</div>
                   </div>
                   <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
                     <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                   </button>
                </div>
              ))}
           </div>
         </div>

         {/* Configuration */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
             <Activity className="w-4 h-4 text-slate-400" /> Safety Triggers & Config
           </h3>
           
           <div className="space-y-4">
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-900">Auto-Record on Crash Detect</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Start mic recording if sudden deceleration detected.</div>
                </div>
                <div className="relative inline-block w-8 h-4 cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                </div>
             </div>
             
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-900">Route Deviation Alert</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Flag ride if vehicle leaves route by &gt; 2 miles.</div>
                </div>
                <div className="relative inline-block w-8 h-4 cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                </div>
             </div>

             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-900">Unusual Stop Alert</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Flag ride if stationary &gt; 5 mins mid-route.</div>
                </div>
                <div className="relative inline-block w-8 h-4 cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                </div>
             </div>
           </div>
         </div>
      </div>
    </div>
  );
}
