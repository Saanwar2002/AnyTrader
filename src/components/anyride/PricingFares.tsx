import React from "react";
import { Tag, Plus, Check, Settings2, MapPin, Receipt, ShieldQuestion } from "lucide-react";

export default function PricingFares() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Pricing & Fares
          </h2>
          <p className="text-slate-500 font-medium">Base rates, global fees, and commission settings.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-2">
          Save Changes
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
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                Edit Base Rates
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Base Fare</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" defaultValue="2.50" step="0.10" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Mile</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" defaultValue="1.00" step="0.10" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Minute</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" defaultValue="0.15" step="0.01" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Min Fare</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" defaultValue="4.00" step="0.50" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
               <Receipt className="w-4 h-4 text-slate-400" /> Platform & Global Fees
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Platform Commission (%)</label>
                   <input type="number" defaultValue="12" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                   <p className="text-[10px] text-slate-500 mt-1">Deducted automatically via Stripe Connect.</p>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Priority Booking Fee (£)</label>
                   <input type="number" defaultValue="3.00" step="0.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Pet Add-on Fee (£)</label>
                   <input type="number" defaultValue="3.00" step="0.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Cancel / No-show Fee (£)</label>
                   <input type="number" defaultValue="3.00" step="0.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
               </div>
               
               <div className="space-y-6">
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Free Pickup Radius (Miles)</label>
                   <input type="number" defaultValue="1.5" step="0.1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Far Pickup Fee (£/Mile excess)</label>
                   <input type="number" defaultValue="0.50" step="0.1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                   <p className="text-[10px] text-slate-500 mt-1">Charged for distance beyond Free Pickup Radius.</p>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Cancel Free Window (Mins)</label>
                   <input type="number" defaultValue="2" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
               </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
               <ShieldQuestion className="w-4 h-4 text-indigo-400" /> Dynamic Surge
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Enable Auto-Surge</span>
                <div className="relative inline-block w-8 h-4 cursor-pointer">
                   <input type="checkbox" defaultChecked className="sr-only peer" />
                   <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
                <div>
                  <div className="text-xs font-bold text-slate-900">Highest Tier Active</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">When rider:driver &gt; 3:1</div>
                </div>
                <div className="text-sm font-black text-indigo-600">x1.5</div>
              </div>
              
              <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-700 flex justify-between">
                   Driver Surge Split <span className="text-slate-500">80% to Driver</span>
                 </label>
                 <input type="range" min="0" max="100" step="5" defaultValue="80" className="w-full accent-indigo-500" />
                 <p className="text-[10px] text-slate-500">Percentage of the surge overflow paid directly to the driver.</p>
              </div>

              <button className="w-full mt-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                Configure Surge Tiers
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="text-sm font-black text-slate-900 mb-4">Add-ons & Zones</h3>
             <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer mb-2">
               <div>
                 <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                   <MapPin className="w-3 h-3 text-slate-400" /> Airport Pickup
                 </div>
               </div>
               <div className="text-sm font-black text-slate-700">+£3.00</div>
             </div>
             <button className="w-full mt-2 py-2 border border-dashed border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
               + Add Config Rule
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
