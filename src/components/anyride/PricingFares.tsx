import React, { useState, useEffect } from "react";
import { Tag, Plus, Check, Settings2, MapPin, Receipt, ShieldQuestion, Loader2 } from "lucide-react";
import { doc, getDoc, setDoc } from "@/src/firebase";
import { db } from "@/src/firebase";

export default function PricingFares() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [surgeEnabled, setSurgeEnabled] = useState(true);
  const [surgeModel, setSurgeModel] = useState<"fixed" | "multiplier">("fixed");
  const [surgeFixedAmount, setSurgeFixedAmount] = useState<number>(2.0);
  const [surgeMultiplierValue, setSurgeMultiplierValue] = useState<number>(1.5);

  const [baseRates, setBaseRates] = useState({
     baseFare: 2.50,
     distanceRate: 1.00,
     timeRate: 0.15,
     minFare: 4.00,
     commissionRate: 12,
     priorityFee: 3.00,
     petFee: 3.00,
     cancelFee: 3.00
  });

  const [surgeRules, setSurgeRules] = useState({
     lowWaitMins: 5,
     mediumWaitMins: 10,
     highWaitMins: 20,
     lowFee: 1.0,
     mediumFee: 2.0,
     highFee: 3.5,
     lowMultiplier: 1.1,
     mediumMultiplier: 1.3,
     highMultiplier: 1.6
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const docRef = doc(db, "platform_config", "rides");
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
           const data = snapshot.data();
           if (data.surgeEnabled !== undefined) setSurgeEnabled(data.surgeEnabled);
           if (data.surgeModel) setSurgeModel(data.surgeModel);
           if (data.surgeFixedAmount) setSurgeFixedAmount(data.surgeFixedAmount);
           if (data.surgeMultiplierValue) setSurgeMultiplierValue(data.surgeMultiplierValue);
           
           if (data.baseFare) setBaseRates(prev => ({...prev, baseFare: data.baseFare, distanceRate: data.distanceRate || prev.distanceRate, timeRate: data.timeRate || prev.timeRate, minFare: data.minFare || prev.minFare, commissionRate: data.commissionRate ? data.commissionRate * 100 : prev.commissionRate, priorityFee: data.priorityFee || prev.priorityFee, petFee: data.petFee || prev.petFee, cancelFee: data.cancelFee || prev.cancelFee}));

           if (data.surgeRules) setSurgeRules(prev => ({...prev, ...data.surgeRules}));
        }
      } catch (err) {
        console.error("Error loading pricing config:", err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
       await setDoc(doc(db, "platform_config", "rides"), {
          surgeEnabled,
          surgeModel,
          surgeFixedAmount,
          surgeMultiplierValue,
          baseFare: baseRates.baseFare,
          distanceRate: baseRates.distanceRate,
          timeRate: baseRates.timeRate,
          minFare: baseRates.minFare,
          commissionRate: baseRates.commissionRate / 100,
          priorityFee: baseRates.priorityFee,
          petFee: baseRates.petFee,
          cancelFee: baseRates.cancelFee,
          surgeRules
       }, { merge: true });
       alert("Pricing config saved!");
    } catch (err) {
       console.error("Error saving pricing config:", err);
       alert("Error saving config.");
    } finally {
       setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Pricing & Fares
          </h2>
          <p className="text-slate-500 font-medium">Base rates, global fees, and commission settings.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
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
                   <input type="number" value={baseRates.baseFare} onChange={(e) => setBaseRates(p => ({...p, baseFare: Number(e.target.value)}))} step="0.10" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Mile</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" value={baseRates.distanceRate} onChange={(e) => setBaseRates(p => ({...p, distanceRate: Number(e.target.value)}))} step="0.10" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Per Minute</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" value={baseRates.timeRate} onChange={(e) => setBaseRates(p => ({...p, timeRate: Number(e.target.value)}))} step="0.01" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-500 font-medium">Min Fare</label>
                 <div className="flex items-center gap-1">
                   <span className="text-slate-400 font-medium">£</span>
                   <input type="number" value={baseRates.minFare} onChange={(e) => setBaseRates(p => ({...p, minFare: Number(e.target.value)}))} step="0.50" className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-emerald-500 outline-none pb-0.5" />
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
                   <input type="number" value={baseRates.commissionRate} onChange={(e) => setBaseRates(p => ({...p, commissionRate: Number(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                   <p className="text-[10px] text-slate-500 mt-1">Deducted automatically via Stripe Connect.</p>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Priority Booking Fee (£)</label>
                   <input type="number" value={baseRates.priorityFee} onChange={(e) => setBaseRates(p => ({...p, priorityFee: Number(e.target.value)}))} step="0.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Pet Add-on Fee (£)</label>
                   <input type="number" value={baseRates.petFee} onChange={(e) => setBaseRates(p => ({...p, petFee: Number(e.target.value)}))} step="0.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1">Cancel / No-show Fee (£)</label>
                   <input type="number" value={baseRates.cancelFee} onChange={(e) => setBaseRates(p => ({...p, cancelFee: Number(e.target.value)}))} step="0.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500" />
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                   <span className="text-xs font-bold text-slate-700 block">Enable Auto-Surge</span>
                   <span className="text-[10px] text-slate-500">Applies across the entire platform</span>
                </div>
                <div className="relative inline-block w-8 h-4 cursor-pointer">
                   <input type="checkbox" checked={surgeEnabled} onChange={(e) => setSurgeEnabled(e.target.checked)} className="sr-only peer" id="surge-toggle" />
                   <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                </div>
              </div>

              {/* Surge Type Selector (CSS-only toggle simulation via radio groups) */}
              <div className={`pt-4 border-t border-slate-100 transition-opacity ${!surgeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="text-xs font-bold text-slate-700 block mb-3">Surge Pricing Model</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <label className="relative cursor-pointer">
                    <input type="radio" name="surgeModel" value="fixed" checked={surgeModel === "fixed"} onChange={() => setSurgeModel("fixed")} className="peer sr-only" />
                    <div className="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-colors">
                      <span className="block text-xs font-black text-slate-900 peer-checked:text-indigo-700 mb-1">Fixed Amount</span>
                      <span className="block text-[10px] text-slate-500 font-medium">+£ per job</span>
                    </div>
                  </label>
                  <label className="relative cursor-pointer">
                    <input type="radio" name="surgeModel" value="multiplier" checked={surgeModel === "multiplier"} onChange={() => setSurgeModel("multiplier")} className="peer sr-only" />
                    <div className="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-colors">
                      <span className="block text-xs font-black text-slate-900 peer-checked:text-indigo-700 mb-1">Multiplier</span>
                      <span className="block text-[10px] text-slate-500 font-medium">1.x of base fare</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100 relative overflow-hidden">
                  <div className={`flex flex-col gap-1 transition-opacity ${surgeModel !== "fixed" ? 'opacity-40' : 'opacity-100'}`}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fixed Surge Amount</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-medium text-sm">£</span>
                      <input type="number" value={surgeFixedAmount} onChange={(e) => setSurgeFixedAmount(Number(e.target.value))} step="0.50" disabled={surgeModel !== "fixed"} className="w-full text-base font-black text-slate-900 border-b border-slate-200 bg-transparent focus:border-indigo-500 outline-none pb-0.5 disabled:bg-transparent" />
                    </div>
                  </div>

                  <div className={`flex flex-col gap-1 pt-3 border-t border-slate-200/50 relative transition-opacity ${surgeModel !== "multiplier" ? 'opacity-40' : 'opacity-100'}`}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Surge Multiplier</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={surgeMultiplierValue} onChange={(e) => setSurgeMultiplierValue(Number(e.target.value))} step="0.1" disabled={surgeModel !== "multiplier"} className="w-full text-base font-black text-slate-900 border-b border-slate-200 bg-transparent focus:border-indigo-500 outline-none pb-0.5 disabled:bg-transparent" />
                      <span className="text-slate-400 font-medium text-sm">x</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`space-y-1 pt-2 transition-opacity ${!surgeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="text-xs font-bold text-slate-700 flex justify-between">
                   Driver Surge Split <span className="text-slate-500">80% to Driver</span>
                 </label>
                 <input type="range" min="0" max="100" step="5" defaultValue="80" className="w-full accent-indigo-500" />
                 <p className="text-[10px] text-slate-500">Percentage of the surge overflow paid directly to the driver.</p>
              </div>

              <div className={`pt-4 border-t border-slate-100 transition-opacity ${!surgeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="text-xs font-bold text-slate-700 block mb-3">Surge Trigger Tiers (Wait Times & Extra Fees)</label>
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                     <span className="w-16 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mild</span>
                     <input type="number" min="0" title="Wait Time (Mins)" placeholder="Mins" value={surgeRules.lowWaitMins} onChange={(e) => setSurgeRules(p => ({...p, lowWaitMins: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                     <span className="text-[10px] text-slate-400">mins wait +</span>
                     <input type="number" step="0.5" title="Fee Added (£) if Fixed" placeholder="£" value={surgeRules.lowFee} onChange={(e) => setSurgeRules(p => ({...p, lowFee: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                     <span className="text-[10px] text-slate-400">or</span>
                     <input type="number" step="0.1" title="Multiplier if Multiplier Mode" placeholder="x" value={surgeRules.lowMultiplier} onChange={(e) => setSurgeRules(p => ({...p, lowMultiplier: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                   </div>
                   
                   <div className="flex items-center gap-2">
                     <span className="w-16 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-orange-500">Medium</span>
                     <input type="number" min="0" value={surgeRules.mediumWaitMins} onChange={(e) => setSurgeRules(p => ({...p, mediumWaitMins: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                     <span className="text-[10px] text-slate-400">mins wait +</span>
                     <input type="number" step="0.5" value={surgeRules.mediumFee} onChange={(e) => setSurgeRules(p => ({...p, mediumFee: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                     <span className="text-[10px] text-slate-400">or</span>
                     <input type="number" step="0.1" value={surgeRules.mediumMultiplier} onChange={(e) => setSurgeRules(p => ({...p, mediumMultiplier: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                   </div>
                   
                   <div className="flex items-center gap-2">
                     <span className="w-16 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-red-500">High</span>
                     <input type="number" min="0" value={surgeRules.highWaitMins} onChange={(e) => setSurgeRules(p => ({...p, highWaitMins: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                     <span className="text-[10px] text-slate-400">mins wait +</span>
                     <input type="number" step="0.5" value={surgeRules.highFee} onChange={(e) => setSurgeRules(p => ({...p, highFee: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                     <span className="text-[10px] text-slate-400">or</span>
                     <input type="number" step="0.1" value={surgeRules.highMultiplier} onChange={(e) => setSurgeRules(p => ({...p, highMultiplier: Number(e.target.value)}))} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                   </div>
                 </div>
              </div>
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
