import React from "react";
import { Tag, Plus, Check, Settings2, MapPin } from "lucide-react";

export default function PricingFares() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Pricing & Fares
          </h2>
          <p className="text-slate-500 font-medium">Base rates, multipliers, and surge configurations.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Rate Card
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Default Rate Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Standard Vehicle Rates</h3>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active Default
                  </p>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded bg-white border border-slate-200">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Base Fare</label>
                 <div className="text-xl font-black text-slate-900">£3.50</div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Mile</label>
                 <div className="text-xl font-black text-slate-900">£1.50</div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Minute</label>
                 <div className="text-xl font-black text-slate-900">£0.20</div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Min Fare</label>
                 <div className="text-xl font-black text-slate-900">£5.00</div>
               </div>
            </div>
          </div>
          
          {/* Executive Rate Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Executive Vehicle Rates</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    Active
                  </p>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded bg-white border border-slate-200">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Base Fare</label>
                 <div className="text-xl font-black text-slate-900">£5.00</div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Mile</label>
                 <div className="text-xl font-black text-slate-900">£2.20</div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Minute</label>
                 <div className="text-xl font-black text-slate-900">£0.35</div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Min Fare</label>
                 <div className="text-xl font-black text-slate-900">£10.00</div>
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-900 mb-4">Surge Rules</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
                <div>
                  <div className="text-xs font-bold text-slate-900">High Demand (Auto)</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">When rider:driver &gt; 3:1</div>
                </div>
                <div className="text-sm font-black text-indigo-600">x1.5</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-400" /> Airport Pickup
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">Fixed surcharge based on zone</div>
                </div>
                <div className="text-sm font-black text-slate-700">+£3.00</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900">Late Night</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">00:00 - 05:00</div>
                </div>
                <div className="text-sm font-black text-slate-700">x1.2</div>
              </div>
            </div>
            <button className="w-full mt-4 py-2 border border-dashed border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
              + Add Surcharge Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
