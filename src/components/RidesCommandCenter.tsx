import React, { useState, useEffect } from "react";
import { db, doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from "@/src/firebase";
import { Car, MapPin, DollarSign, Plus, Trash2, Clock, Globe, AlertCircle, Save, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RideFees {
  baseFare: number;
  distanceRate: number; // per mile
  timeRate: number; // per minute
  minimumFare: number;
  platformCommission: number; // percentage (e.g. 12)
  multiplier6Seat?: number;
  multiplier8Seat?: number;
  multiplierExec?: number;
  maxSurgeCap?: number;
}

interface Surcharge {
  id: string;
  name: string;
  amount: number;
  type: string;
}

export default function RidesCommandCenter() {
  const [fees, setFees] = useState<RideFees>({
    baseFare: 2.50,
    distanceRate: 1.20,
    timeRate: 0.15,
    minimumFare: 5.00,
    platformCommission: 12.0,
    multiplier6Seat: 1.5,
    multiplier8Seat: 2.0,
    multiplierExec: 2.0,
    maxSurgeCap: 2.0
  });
  
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newSurchargeName, setNewSurchargeName] = useState("");
  const [newSurchargeAmount, setNewSurchargeAmount] = useState("");
  const [newSurchargeType, setNewSurchargeType] = useState("airport");

  // Simulator State
  const [simDistance, setSimDistance] = useState("5");
  const [simTime, setSimTime] = useState("15");
  const [simVehicle, setSimVehicle] = useState("standard");
  const [simSurge, setSimSurge] = useState("1.0");
  const [simSurchargeAmt, setSimSurchargeAmt] = useState("0");
  
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "ride_fees"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.fees) {
          setFees(prev => ({ ...prev, ...data.fees }));
        }
        if (data.surcharges) setSurcharges(data.surcharges);
        setHasUnsavedChanges(false);
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_config", "ride_fees"), {
        fees,
        surcharges,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Auto-sync Commission up to Admin Tiers Tab
      await setDoc(doc(db, "platform_config", "global_tiers"), {
        providerModels: {
          on_demand_transport: {
            tiers: {
              standard: {
                commission: fees.platformCommission / 100
              }
            }
          }
        }
      }, { merge: true });

      setHasUnsavedChanges(false);
      alert("Taxi limits and fares successfully updated and synced to ecosystem.");
    } catch (err) {
      console.error(err);
      alert("Failed to save ride configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const addSurcharge = () => {
    if (!newSurchargeName || !newSurchargeAmount) return;
    
    const amountVal = parseFloat(newSurchargeAmount);
    if (isNaN(amountVal)) {
      alert("Invalid amount for surcharge");
      return;
    }
    
    const s: Surcharge = {
      id: Date.now().toString(),
      name: newSurchargeName,
      amount: amountVal,
      type: newSurchargeType
    };
    setSurcharges([...surcharges, s]);
    setHasUnsavedChanges(true); // Mark unsaved
    setNewSurchargeName("");
    setNewSurchargeAmount("");
  };

  const removeSurcharge = (id: string) => {
    setSurcharges(surcharges.filter(s => s.id !== id));
    setHasUnsavedChanges(true); // Mark unsaved
  };

  // --- Simulator Engine ---
  const simDistNum = parseFloat(simDistance) || 0;
  const simTimeNum = parseFloat(simTime) || 0;
  let rawFare = fees.baseFare + (simDistNum * fees.distanceRate) + (simTimeNum * fees.timeRate);
  if (rawFare < fees.minimumFare) rawFare = fees.minimumFare;
  
  let vehMult = 1.0;
  if (simVehicle === "xl") vehMult = fees.multiplier6Seat ?? 1.5;
  if (simVehicle === "max") vehMult = fees.multiplier8Seat ?? 2.0;
  if (simVehicle === "exec") vehMult = fees.multiplierExec ?? 2.0;

  let surgeVal = parseFloat(simSurge) || 1.0;
  // Apply visual cap to simulator
  const maxCap = fees.maxSurgeCap ?? 2.0;
  if (surgeVal > maxCap) surgeVal = maxCap;

  const surgedFare = (rawFare * vehMult) * surgeVal;
  const passThrough = parseFloat(simSurchargeAmt) || 0;
  
  const finalPassengerPrice = surgedFare + passThrough;
  const platformFee = surgedFare * (fees.platformCommission / 100);
  const finalDriverPayout = surgedFare - platformFee + passThrough;

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 border-l-4 border-emerald-500 pl-3">
            Rides Command Center
          </h2>
          <p className="text-slate-500 mt-1">Manage global taxi fares, commissions, and surcharges.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Core Engine Dials */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Car className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Base Engine Dials</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Car className="w-3 h-3" /> Base Fare (£)
              </label>
              <input
                type="number"
                step="0.10"
                value={fees.baseFare}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setFees({...fees, baseFare: isNaN(val) ? 0 : val});
                  setHasUnsavedChanges(true);
                }}
                className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Distance (per mile)
              </label>
              <input
                type="number"
                step="0.10"
                value={fees.distanceRate}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setFees({...fees, distanceRate: isNaN(val) ? 0 : val});
                  setHasUnsavedChanges(true);
                }}
                className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Time (per min)
              </label>
              <input
                type="number"
                step="0.05"
                value={fees.timeRate}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setFees({...fees, timeRate: isNaN(val) ? 0 : val});
                  setHasUnsavedChanges(true);
                }}
                className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Minimum Fare
              </label>
              <input
                type="number"
                step="0.50"
                value={fees.minimumFare}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setFees({...fees, minimumFare: isNaN(val) ? 0 : val});
                  setHasUnsavedChanges(true);
                }}
                className="w-full p-3 rounded-lg border border-orange-200 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold text-orange-700"
              />
              <p className="text-[10px] text-orange-600/70">Guardrail for trips &lt; 1.5 miles.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-2">
               <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                 <Globe className="w-3 h-3" /> Platform Commission (%)
               </label>
               <input
                 type="number"
                 step="0.1"
                 value={fees.platformCommission}
                 onChange={e => {
                   const val = parseFloat(e.target.value);
                   setFees({...fees, platformCommission: isNaN(val) ? 0 : val});
                   setHasUnsavedChanges(true);
                 }}
                 className="w-full p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 font-black text-xl text-emerald-800"
               />
               <p className="text-xs font-medium text-emerald-600/80 leading-snug pt-1">
                 12% commission destroys Uber margins.
               </p>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                 <AlertCircle className="w-3 h-3" /> AI Surge Cap (Max)
               </label>
               <input
                 type="number"
                 step="0.1"
                 value={fees.maxSurgeCap ?? 2.0}
                 onChange={e => {
                   const val = parseFloat(e.target.value);
                   setFees({...fees, maxSurgeCap: isNaN(val) ? 0 : val});
                   setHasUnsavedChanges(true);
                 }}
                 className="w-full p-4 rounded-xl border-2 border-rose-200 bg-rose-50/50 focus:outline-none focus:ring-4 focus:ring-rose-500/20 font-black text-xl text-rose-800"
               />
               <p className="text-xs font-medium text-rose-600/80 leading-snug pt-1">
                 Strict limit on demand-based dynamic pricing (e.g., 2.0x).
               </p>
            </div>
          </div>
        </div>

        {/* Vehicle Class Multipliers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 md:col-span-2">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Vehicle Class Multipliers</h3>
              <p className="text-xs text-slate-500">Standard 4-seater is 1.0x. Set the fare multipliers for larger or premium vehicles.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                6 Seater (XL)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={fees.multiplier6Seat ?? 1.5}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFees({...fees, multiplier6Seat: isNaN(val) ? 0 : val});
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full p-3 pl-8 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                8 Seater (Max)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={fees.multiplier8Seat ?? 2.0}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFees({...fees, multiplier8Seat: isNaN(val) ? 0 : val});
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full p-3 pl-8 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Executive
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={fees.multiplierExec ?? 2.0}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFees({...fees, multiplierExec: isNaN(val) ? 0 : val});
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full p-3 pl-8 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Geofence Surcharges */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="text-indigo-500" /> Geofenced Surcharges
            </h3>
            <p className="text-xs text-slate-500">Tolls & airport fees. Commission = 0% on these.</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto min-h-[200px]">
             {surcharges.map(s => (
               <motion.div key={s.id} layout className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                 <div>
                   <span className="text-sm font-bold block text-slate-800">{s.name}</span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.type}</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">£{s.amount.toFixed(2)}</span>
                   <button onClick={() => removeSurcharge(s.id)} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md">
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               </motion.div>
             ))}
             {surcharges.length === 0 && (
               <div className="text-center p-6 text-sm text-slate-400 font-medium">No surcharges configured.</div>
             )}
          </div>

          <div className="pt-4 mt-auto border-t border-slate-100">
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="e.g. Heathrow"
                value={newSurchargeName}
                onChange={e => setNewSurchargeName(e.target.value)}
                className="col-span-8 sm:col-span-4 lg:col-span-5 p-2 text-sm rounded-lg border border-slate-200 min-w-0"
              />
              <input
                type="number"
                placeholder="£"
                value={newSurchargeAmount}
                onChange={e => setNewSurchargeAmount(e.target.value)}
                className="col-span-4 sm:col-span-3 lg:col-span-2 p-2 text-sm rounded-lg border border-slate-200 min-w-0"
              />
              <select 
                value={newSurchargeType}
                onChange={e => setNewSurchargeType(e.target.value)}
                className="col-span-8 sm:col-span-3 lg:col-span-3 p-2 text-sm rounded-lg border border-slate-200 bg-white min-w-0"
              >
                <option value="airport">Airport</option>
                <option value="toll">Toll</option>
                <option value="ulez">ULEZ</option>
              </select>
              <button 
                onClick={addSurcharge}
                className="col-span-4 sm:col-span-2 lg:col-span-2 flex items-center justify-center p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      </div>
      
      {/* Fare Simulator */}
      <div className="bg-slate-900 rounded-2xl shadow-xl p-6 text-white overflow-hidden relative">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
                Live Fare Simulator
              </h3>
              <p className="text-sm text-slate-400 mt-1">Test your current dials instantly without an app.</p>
            </div>
            <div className="flex gap-2 text-xs font-medium px-3 py-1 bg-slate-800 rounded-lg text-slate-300">
              Surge Cap constraint active: {fees.maxSurgeCap ?? 2.0}x
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Simulator Inputs */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Miles</label>
                  <input
                    type="number"
                    value={simDistance}
                    onChange={e => setSimDistance(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Minutes</label>
                  <input
                    type="number"
                    value={simTime}
                    onChange={e => setSimTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Vehicle Class</label>
                  <select
                    value={simVehicle}
                    onChange={e => setSimVehicle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                  >
                    <option value="standard">Standard (4 Seat)</option>
                    <option value="xl">6 Seater (XL)</option>
                    <option value="max">8 Seater (Max)</option>
                    <option value="exec">Executive</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase text-rose-400">Surge Map (x)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simSurge}
                    onChange={e => setSimSurge(e.target.value)}
                    className="w-full bg-slate-800 border-2 border-rose-900 rounded-lg p-2 text-white outline-none focus:border-rose-500"
                  />
                  {parseFloat(simSurge) > (fees.maxSurgeCap ?? 2.0) && (
                    <p className="text-[10px] text-rose-400 mt-1">Capped at {fees.maxSurgeCap ?? 2.0}x by logic engine.</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Geofence / Tolls (£)</label>
                <div className="flex gap-2">
                  <select
                    onChange={e => setSimSurchargeAmt(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                  >
                    <option value="0">No Surcharges</option>
                    {surcharges.map(s => (
                      <option key={s.id} value={s.amount}>{s.name} (£{s.amount})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={simSurchargeAmt}
                    onChange={e => setSimSurchargeAmt(e.target.value)}
                    className="w-20 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Simulator Output Tickets */}
            <div className="space-y-4">
               {/* Passenger Ticket */}
               <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                 <div className="flex justify-between items-end mb-2">
                   <p className="text-xs font-bold uppercase text-slate-400">Passenger Upfront Price</p>
                   <p className="text-3xl font-black text-white">£{finalPassengerPrice.toFixed(2)}</p>
                 </div>
                 <div className="text-[10px] text-slate-500 font-mono tracking-tighter">
                   [(B:{fees.baseFare.toFixed(2)} + D:{(simDistNum * fees.distanceRate).toFixed(2)} + T:{(simTimeNum * fees.timeRate).toFixed(2)}) * V:{vehMult} * S:{surgeVal}] + TS:{passThrough.toFixed(2)}
                 </div>
               </div>

               {/* Driver Ticket */}
               <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-800/30 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-emerald-600 px-3 py-1 text-[10px] font-bold rounded-bl-lg">
                   DRIVER EARNS {(fees.platformCommission === 0 ? 0 : (finalDriverPayout / finalPassengerPrice) * 100).toFixed(0)}%
                 </div>
                 <div className="flex justify-between items-end mb-2 mt-2">
                   <p className="text-xs font-bold uppercase text-emerald-400">Driver Take-Home</p>
                   <p className="text-3xl font-black text-emerald-400">£{finalDriverPayout.toFixed(2)}</p>
                 </div>
                 <div className="text-[10px] text-emerald-700 font-mono tracking-tighter flex gap-2">
                   <span>Fare: £{(surgedFare).toFixed(2)}</span>
                   <span>Fee: -£{platformFee.toFixed(2)}</span>
                   <span>Reimb: +£{passThrough.toFixed(2)}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Spacer so the sticky toast doesn't obscure the very bottom elements */}
      <div className="h-24" />

      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex justify-center"
          >
            <div className="bg-orange-600 shadow-2xl shadow-orange-600/30 text-white rounded-full p-2 pr-6 pl-4 flex items-center gap-4 border border-orange-500/50">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm">Unsaved Changes</p>
                <p className="text-orange-100 text-xs">Sync changes to network below</p>
              </div>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="ml-4 flex items-center gap-2 bg-white text-orange-600 px-5 py-2 rounded-full font-bold shadow-sm hover:bg-orange-50 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sync Fleet Dials
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
