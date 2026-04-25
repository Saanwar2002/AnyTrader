import React from "react";
import { Plus, Settings2, Map as MapIcon, Check, MapPin } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function ZonesGeofences() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Zones & Geofences
          </h2>
          <p className="text-slate-500 font-medium">Manage operational boundaries and surcharges.</p>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Draw New Zone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Sidebar List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-black text-slate-900">Active Zones (4)</h3>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-100">
             {[
               { name: "City Center", type: "Core Operations", status: "Active", surcharge: "None", color: "bg-emerald-500" },
               { name: "Airport Access", type: "Surcharge Zone", status: "Active", surcharge: "+£3.00 Fixed", color: "bg-indigo-500" },
               { name: "Festival Park", type: "Temp Surge", status: "Active (Ends 22 Apr)", surcharge: "x1.5 Multiplier", color: "bg-amber-500" },
               { name: "East Suburbs", type: "Expansion", status: "Off-Peak Only", surcharge: "None", color: "bg-slate-400" },
             ].map((zone) => (
               <div key={zone.name} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between">
                     <div className="flex items-center gap-2">
                       <div className={cn("w-2 h-2 rounded-full", zone.color)}></div>
                       <h4 className="text-sm font-bold text-slate-900">{zone.name}</h4>
                     </div>
                     <button className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-900">
                       <Settings2 className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="mt-2 space-y-1 pl-4">
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{zone.type}</div>
                     <div className="text-xs text-slate-600 flex justify-between">
                       <span>Status:</span> <span className="font-medium text-slate-900">{zone.status}</span>
                     </div>
                     <div className="text-xs text-slate-600 flex justify-between">
                       <span>Surcharge:</span> <span className="font-bold text-emerald-600">{zone.surcharge}</span>
                     </div>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* Map Area Mockup */}
        <div className="lg:col-span-2 bg-slate-100 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex items-center justify-center">
           {/* Placeholder for actual Mapbox integration */}
           <div className="absolute inset-0 bg-slate-200/50" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
           
           {/* Mock Zones on Map */}
           <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-xl backdrop-blur-[1px] flex items-center justify-center">
             <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-emerald-100 flex items-center gap-2">
               <Check className="w-3 h-3 text-emerald-600" />
               <span className="text-xs font-bold text-slate-900">City Center</span>
             </div>
           </div>

           <div className="absolute top-10 right-10 w-32 h-32 bg-indigo-500/20 border-2 border-indigo-500/50 rounded-full flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur px-2 py-1 rounded shadow-sm border border-indigo-100">
               <span className="text-[10px] font-bold text-indigo-700 block text-center">Airport</span>
               <span className="text-[8px] font-black text-indigo-500 uppercase block text-center">+£3.00</span>
             </div>
           </div>

           {/* Toolbar overlays */}
           <div className="absolute top-4 right-4 bg-white rounded-lg shadow-sm border border-slate-200 p-1 flex shadow-lg">
              <button className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Draw Polygon"><MapPin className="w-4 h-4" /></button>
              <button className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Map Layers"><MapIcon className="w-4 h-4" /></button>
           </div>
           
           <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur py-2 px-4 rounded-xl shadow-lg border border-slate-200 flex items-center justify-between text-xs font-medium text-slate-600">
             <span className="flex items-center gap-2"><MapPin className="w-3 h-3 text-emerald-500"/> Dispatch actively matching in 3 zones.</span>
             <button className="font-bold text-slate-900 hover:text-emerald-600">Sync Map Data &rarr;</button>
           </div>
        </div>
      </div>
    </div>
  );
}
