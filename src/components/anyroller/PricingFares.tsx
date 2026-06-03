import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Tag, Save, Activity, Zap, CarFront, 
  MapPin, Clock, CreditCard, ShieldCheck,
  TrendingUp, RefreshCcw, HandCoins, Calculator
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

const PricingFares = () => {
  const [globalConfig, setGlobalConfig] = useState({
    baseFare: 3.50,
    distanceRate: 1.30,
    timeRate: 0.15,
    waitRatePerMinute: 0.25,
    minFare: 5.00,
    commissionRate: 12.0,
    fixedTripFee: 0.20,
    vehicleMultipliers: {
      standard: 1.0,
      '6seater': 1.4,
      executive: 1.5,
      '8seater': 2.0,
      luxury: 2.2,
      wav: 2.5
    }
  });

  const [originalConfig, setOriginalConfig] = useState(globalConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [simCategory, setSimCategory] = useState<string>('standard');
  const [simDistance, setSimDistance] = useState<number>(5.0);
  const [simDuration, setSimDuration] = useState<number>(15);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, "platform_config", "rides"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGlobalConfig(prev => {
            const newConfig = {
              baseFare: data.baseFare || prev.baseFare,
              distanceRate: data.distanceRate || prev.distanceRate,
              timeRate: data.timeRate || prev.timeRate,
              waitRatePerMinute: data.waitRatePerMinute || prev.waitRatePerMinute,
              minFare: data.minFare || prev.minFare,
              commissionRate: (data.commissionRate !== undefined ? data.commissionRate * 100 : prev.commissionRate),
              fixedTripFee: data.fixedTripFee !== undefined ? data.fixedTripFee : prev.fixedTripFee,
              vehicleMultipliers: data.vehicleMultipliers || prev.vehicleMultipliers
            };
            setOriginalConfig(newConfig);
            return newConfig;
          });
        }
      } catch (err) {
        console.error("Failed to load fare config", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_config", "rides"), {
        baseFare: globalConfig.baseFare,
        distanceRate: globalConfig.distanceRate,
        timeRate: globalConfig.timeRate,
        waitRatePerMinute: globalConfig.waitRatePerMinute,
        minFare: globalConfig.minFare,
        commissionRate: globalConfig.commissionRate / 100,
        fixedTripFee: globalConfig.fixedTripFee,
        vehicleMultipliers: globalConfig.vehicleMultipliers
      }, { merge: true });
      setOriginalConfig(globalConfig);
    } catch (err) {
      console.error("Failed to save fare config", err);
    } finally {
      setIsSaving(false);
    }
  };

  const Toggle = ({ enabled, onClick }: { enabled: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><Activity className="animate-spin text-black" /></div>;
  }

  const hasChanges = JSON.stringify(globalConfig) !== JSON.stringify(originalConfig);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <Tag className="mr-2 text-indigo-600" />
            Pricing & Fares Engine
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure global base rates synced to active ride pricing models.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            (!hasChanges || isSaving)
              ? 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed'
              : 'bg-black text-white shadow-[0_4px_0_rgb(100,100,100)] active:translate-y-[4px] active:shadow-none'
          }`}
        >
          {isSaving ? <Activity className="animate-spin" size={18} /> : <Save size={18} />}
          {isSaving ? "Syncing to Firebase..." : "Publish Rates"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: Global Rates */}
        <div className="space-y-6">
          <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-gray-50 border-b border-black px-6 py-4 flex items-center gap-2">
              <CarFront className="text-blue-600" size={20} />
              <h2 className="font-bold text-black text-lg">Global Live Variables</h2>
            </div>
            
            <div className="p-6 space-y-5">
               <div className="flex justify-between items-center bg-white border border-gray-200 p-4 rounded-xl">
                 <div>
                   <h3 className="font-bold text-black flex items-center gap-2"><Tag size={16} /> Base Departure Fare</h3>
                   <p className="text-xs text-gray-500 mt-1">Starting charge instantly applied per completed dispatch.</p>
                 </div>
                 <div className="flex items-center font-bold text-lg text-black">
                   £ <input type="number" step="0.1" value={globalConfig.baseFare} onChange={(e) => setGlobalConfig({...globalConfig, baseFare: parseFloat(e.target.value) || 0})} className="ml-1 w-20 px-2 py-1 border border-black rounded-lg text-center" />
                 </div>
               </div>
               
               <div className="flex justify-between items-center bg-white border border-gray-200 p-4 rounded-xl">
                 <div>
                   <h3 className="font-bold text-black flex items-center gap-2"><MapPin size={16} /> Distance Rate (Per Mile)</h3>
                   <p className="text-xs text-gray-500 mt-1">Rate multiplied by straight-line algorithm calculated route miles.</p>
                 </div>
                 <div className="flex items-center font-bold text-lg text-black">
                   £ <input type="number" step="0.1" value={globalConfig.distanceRate} onChange={(e) => setGlobalConfig({...globalConfig, distanceRate: parseFloat(e.target.value) || 0})} className="ml-1 w-20 px-2 py-1 border border-black rounded-lg text-center" />
                 </div>
               </div>

               <div className="flex justify-between items-center bg-white border border-gray-200 p-4 rounded-xl">
                 <div>
                   <h3 className="font-bold text-black flex items-center gap-2"><Clock size={16} /> Time Rate (Per Minute)</h3>
                   <p className="text-xs text-gray-500 mt-1">Live journey duration multiplier applied for transit estimates.</p>
                 </div>
                 <div className="flex items-center font-bold text-lg text-black">
                   £ <input type="number" step="0.05" value={globalConfig.timeRate} onChange={(e) => setGlobalConfig({...globalConfig, timeRate: parseFloat(e.target.value) || 0})} className="ml-1 w-20 px-2 py-1 border border-black rounded-lg text-center" />
                 </div>
               </div>

               <div className="flex justify-between items-center bg-white border border-gray-200 p-4 rounded-xl">
                 <div>
                   <h3 className="font-bold text-black flex items-center gap-2"><HandCoins size={16} /> Wait Rate (Per Minute)</h3>
                   <p className="text-xs text-gray-500 mt-1">Penalty applied per minute waiting beyond free grace period.</p>
                 </div>
                 <div className="flex items-center font-bold text-lg text-red-600">
                   £ <input type="number" step="0.05" value={globalConfig.waitRatePerMinute} onChange={(e) => setGlobalConfig({...globalConfig, waitRatePerMinute: parseFloat(e.target.value) || 0})} className="ml-1 w-20 px-2 py-1 border border-red-300 rounded-lg text-center bg-red-50 focus:border-red-600 outline-none" />
                 </div>
               </div>

               <div className="flex justify-between items-center bg-gray-50 border border-gray-200 p-4 rounded-xl">
                 <div>
                   <h3 className="font-bold text-black flex items-center gap-2"><ShieldCheck size={16} /> System Minimum Fare</h3>
                   <p className="text-xs text-gray-500 mt-1">Absolute lowest cap applicable for any dispatched vehicle.</p>
                 </div>
                 <div className="flex items-center font-bold text-lg text-black">
                   £ <input type="number" step="0.1" value={globalConfig.minFare} onChange={(e) => setGlobalConfig({...globalConfig, minFare: parseFloat(e.target.value) || 0})} className="ml-1 w-20 px-2 py-1 border border-black rounded-lg text-center" />
                 </div>
               </div>
            </div>
            
            <div className="bg-blue-50/50 p-4 border-t border-gray-200 text-sm text-gray-600 flex items-center gap-2 font-medium">
              <RefreshCcw size={16} className="text-blue-500" /> Live changes apply to the main app engine immediately upon save.
            </div>
          </div>
        </div>

        {/* Right Column: Information & Platform commission */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="text-emerald-400" size={20} /> Platform Commission
              </h2>
              <ShieldCheck className="text-emerald-400" size={20} />
            </div>
            <p className="text-sm text-slate-400 mb-6">Percentage deducted from gross fare prior to Stripe Connect driver payout routing globally.</p>
            
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-slate-300 block mb-1">Standard Take Rate</span>
                  <span className="text-xs text-slate-500 font-mono">platform_config.commissionRate</span>
                </div>
                <div className="flex items-center text-2xl font-black text-emerald-400">
                  <input type="number" step="0.1" value={globalConfig.commissionRate} onChange={(e) => setGlobalConfig({...globalConfig, commissionRate: parseFloat(e.target.value) || 0})} className="w-20 px-2 py-1 bg-transparent border-b-2 border-emerald-400 outline-none text-right mr-1" /> %
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-slate-300 block mb-1">Fixed Trip Fee</span>
                  <span className="text-xs text-slate-500 font-mono">platform_config.fixedTripFee</span>
                </div>
                <div className="flex items-center text-2xl font-black text-emerald-400">
                  £ <input type="number" step="0.05" value={globalConfig.fixedTripFee} onChange={(e) => setGlobalConfig({...globalConfig, fixedTripFee: parseFloat(e.target.value) || 0})} className="w-20 px-2 py-1 bg-transparent border-b-2 border-emerald-400 outline-none text-right mr-1 mr-1" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
             <h2 className="text-lg font-bold text-black mb-4">Vehicle Tier Mathematics</h2>
             <p className="text-sm text-gray-500 mb-4">Live adjustments to these multipliers instantly shift pricing for each respective vehicle class across the network.</p>
             
             <div className="space-y-2">
               <div className="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                 <span className="font-bold text-black">Standard Car</span>
                 <div className="flex items-center text-emerald-600 font-bold">
                   x <input type="number" step="0.1" value={globalConfig.vehicleMultipliers.standard} onChange={(e) => setGlobalConfig({...globalConfig, vehicleMultipliers: {...globalConfig.vehicleMultipliers, standard: parseFloat(e.target.value) || 0}})} className="ml-1 w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-center outline-none focus:border-emerald-500" />
                 </div>
               </div>
               <div className="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                 <span className="font-bold text-black">Executive</span>
                 <div className="flex items-center text-emerald-600 font-bold">
                   x <input type="number" step="0.1" value={globalConfig.vehicleMultipliers.executive} onChange={(e) => setGlobalConfig({...globalConfig, vehicleMultipliers: {...globalConfig.vehicleMultipliers, executive: parseFloat(e.target.value) || 0}})} className="ml-1 w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-center outline-none focus:border-emerald-500" />
                 </div>
               </div>
               <div className="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                 <span className="font-bold text-black">Luxury</span>
                 <div className="flex items-center text-emerald-600 font-bold">
                   x <input type="number" step="0.1" value={globalConfig.vehicleMultipliers.luxury} onChange={(e) => setGlobalConfig({...globalConfig, vehicleMultipliers: {...globalConfig.vehicleMultipliers, luxury: parseFloat(e.target.value) || 0}})} className="ml-1 w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-center outline-none focus:border-emerald-500" />
                 </div>
               </div>
               <div className="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                 <span className="font-bold text-black">6 Seater XL</span>
                 <div className="flex items-center text-emerald-600 font-bold">
                   x <input type="number" step="0.1" value={globalConfig.vehicleMultipliers['6seater']} onChange={(e) => setGlobalConfig({...globalConfig, vehicleMultipliers: {...globalConfig.vehicleMultipliers, '6seater': parseFloat(e.target.value) || 0}})} className="ml-1 w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-center outline-none focus:border-emerald-500" />
                 </div>
               </div>
               <div className="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                 <span className="font-bold text-black">8 Seater Max</span>
                 <div className="flex items-center text-emerald-600 font-bold">
                   x <input type="number" step="0.1" value={globalConfig.vehicleMultipliers['8seater']} onChange={(e) => setGlobalConfig({...globalConfig, vehicleMultipliers: {...globalConfig.vehicleMultipliers, '8seater': parseFloat(e.target.value) || 0}})} className="ml-1 w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-center outline-none focus:border-emerald-500" />
                 </div>
               </div>
               <div className="flex justify-between items-center text-sm py-2 border-b border-gray-100">
                 <span className="font-bold text-black">Wheelchair</span>
                 <div className="flex items-center text-emerald-600 font-bold">
                   x <input type="number" step="0.1" value={globalConfig.vehicleMultipliers.wav} onChange={(e) => setGlobalConfig({...globalConfig, vehicleMultipliers: {...globalConfig.vehicleMultipliers, wav: parseFloat(e.target.value) || 0}})} className="ml-1 w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-center outline-none focus:border-emerald-500" />
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Live Fare Simulator Section */}
      <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden mt-6">
        <div className="bg-slate-900 px-6 py-4 flex items-center gap-2 border-b border-black">
           <Calculator className="text-emerald-400" size={20} />
           <h2 className="font-bold text-white text-lg">Live Fare Simulator</h2>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Simulator Controls */}
           <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-800 flex justify-between mb-2">
                  <span>Trip Distance (Miles)</span>
                  <span className="text-emerald-600 font-bold">{simDistance.toFixed(1)} mi</span>
                </label>
                <input 
                  type="range" min="0.5" max="50" step="0.5" 
                  value={simDistance} 
                  onChange={(e)=>setSimDistance(parseFloat(e.target.value))} 
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-800 flex justify-between mb-2">
                  <span>Trip Duration (Minutes)</span>
                  <span className="text-emerald-600 font-bold">{simDuration} mins</span>
                </label>
                <input 
                  type="range" min="1" max="120" step="1" 
                  value={simDuration} 
                  onChange={(e)=>setSimDuration(parseInt(e.target.value))} 
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-800 mb-3 block">Vehicle Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                   {[
                     { id: 'standard', name: 'Standard Car' },
                     { id: 'executive', name: 'Executive' },
                     { id: 'luxury', name: 'Luxury' },
                     { id: '6seater', name: '6 Seater XL' },
                     { id: '8seater', name: '8 Seater Max' },
                     { id: 'wav', name: 'Wheelchair' },
                   ].map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => setSimCategory(cat.id)} 
                        className={`py-2.5 px-3 text-xs font-bold rounded-lg border transition-all ${
                          simCategory === cat.id 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                         {cat.name}
                      </button>
                   ))}
                </div>
              </div>
           </div>
           
           {/* Simulator Output */}
           {(() => {
              const subDist = simDistance * globalConfig.distanceRate;
              const subTime = simDuration * globalConfig.timeRate;
              const baseRaw = globalConfig.baseFare + subDist + subTime;
              const multiplier = globalConfig.vehicleMultipliers[simCategory] || 1.0;
              const catMinFare = globalConfig.minFare * multiplier;
              const multipliedFare = baseRaw * multiplier;
              const finalFare = Math.max(multipliedFare, catMinFare);
              const platformFee = finalFare * (globalConfig.commissionRate / 100);
              const driverPayout = finalFare - platformFee;
              const isMinFareApplied = catMinFare > multipliedFare;

              return (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
                   <div>
                     <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-4 border-b border-gray-200 pb-2">Estimated Fare Breakdown</h3>
                     <div className="space-y-2 text-sm">
                       <div className="flex justify-between text-gray-600">
                         <span>Base Departure Charge</span>
                         <span>£{globalConfig.baseFare.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between text-gray-600">
                         <span>Distance ({simDistance.toFixed(1)}mi × £{globalConfig.distanceRate.toFixed(2)})</span>
                         <span>£{subDist.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between text-gray-600">
                         <span>Time ({simDuration}m × £{globalConfig.timeRate.toFixed(2)})</span>
                         <span>£{subTime.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200 mt-1">
                         <span>Subtotal (Base)</span>
                         <span>£{baseRaw.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between font-bold text-emerald-600">
                         <span>Vehicle Multiplier ({multiplier.toFixed(2)}x)</span>
                         <span>× {multiplier.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200 mt-1">
                         <span>Multiplied Subtotal</span>
                         <span>£{multipliedFare.toFixed(2)}</span>
                       </div>
                       {isMinFareApplied && (
                         <div className="flex justify-between font-bold text-orange-600 text-xs bg-orange-50 p-2 rounded-lg mt-2 border border-orange-200">
                           <span>Bumped to Minimum Fare (£{globalConfig.minFare.toFixed(2)} × {multiplier.toFixed(2)})</span>
                           <span>£{catMinFare.toFixed(2)}</span>
                         </div>
                       )}
                     </div>
                   </div>

                   <div className="mt-6 border-t-[2px] border-black pt-4">
                      <div className="flex justify-between items-end mb-4">
                        <span className="text-sm font-black uppercase tracking-wider text-black">Total Customer Fare</span>
                        <span className="text-3xl font-black text-black">£{finalFare.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                         <div className="bg-white border text-center p-3 rounded-xl border-gray-200 shadow-sm">
                           <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Platform Cut ({globalConfig.commissionRate}%)</span>
                           <span className="block font-black text-slate-800 text-lg">£{platformFee.toFixed(2)}</span>
                         </div>
                         <div className="bg-emerald-50 border border-emerald-200 text-center p-3 rounded-xl shadow-sm">
                           <span className="block text-[10px] text-emerald-700 font-bold uppercase tracking-wider mb-0.5">Driver Payout</span>
                           <span className="block font-black text-emerald-700 text-lg">£{driverPayout.toFixed(2)}</span>
                         </div>
                      </div>
                   </div>
                </div>
              );
           })()}
        </div>
      </div>
    </div>
  );
};

export default PricingFares;

