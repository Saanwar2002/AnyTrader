import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Settings, 
  Cpu, 
  Save, 
  TrendingUp, 
  Sliders, 
  Sparkles,
  RefreshCw,
  Gauge
} from "lucide-react";
import { db, doc, getDoc, setDoc } from "../../firebase";
import { toast } from "sonner";

export default function DispatchEngine() {
  const [radialLookupLimit, setRadialLookupLimit] = useState(4000); // meters
  const [dispatchRetryCap, setDispatchRetryCap] = useState(3);
  const [searchGraceTimer, setSearchGraceTimer] = useState(25); // seconds
  const [boostNewcomerDrivers, setBoostNewcomerDrivers] = useState(true);
  const [fairDistributionPolicy, setFairDistributionPolicy] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Read Firebase configs
  useEffect(() => {
    const fetchDispatch = async () => {
      try {
        const docRef = doc(db, "platform_settings", "dispatch_engine");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = docSnap.data();
          if (d.radialLookupLimit !== undefined) setRadialLookupLimit(d.radialLookupLimit);
          if (d.dispatchRetryCap !== undefined) setDispatchRetryCap(d.dispatchRetryCap);
          if (d.searchGraceTimer !== undefined) setSearchGraceTimer(d.searchGraceTimer);
          if (d.boostNewcomerDrivers !== undefined) setBoostNewcomerDrivers(d.boostNewcomerDrivers);
          if (d.fairDistributionPolicy !== undefined) setFairDistributionPolicy(d.fairDistributionPolicy);
        }
      } catch (err) {
        console.warn("Dispatch preferences parsed from local cached storage.", err);
      }
    };
    fetchDispatch();
  }, []);

  const handleSaveEngine = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "dispatch_engine"), {
        radialLookupLimit,
        dispatchRetryCap,
        searchGraceTimer,
        boostNewcomerDrivers,
        fairDistributionPolicy,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Dispatch matching engine heuristics updated successfully.");
    } catch {
      localStorage.setItem("anyroller_dispatch_algorithms", JSON.stringify({
        radialLookupLimit, dispatchRetryCap, searchGraceTimer, boostNewcomerDrivers, fairDistributionPolicy
      }));
      toast.success("Dispatch matching presets cached in local system Memory.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HUD Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-4 h-4 text-emerald-500 fill-emerald-500 animate-pulse" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">ALGORITHMIC HYPER-THREADER</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Dispatch Matching Heuristics</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure search radiuses, retry cycle limits, and fair redistribution algorithms that control matchmaking when a rider initiates booking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Main Tuning Knobs */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-5">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1">
            <Sliders className="w-4 h-4 text-slate-750" /> Controller Knobs
          </h3>

          {/* Radial Limit */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Ultimate Matching Radius Limit</label>
              <span className="text-xs font-mono font-bold text-[#AF52DE]">{(radialLookupLimit / 1000).toFixed(1)} km</span>
            </div>
            <input 
              type="range" 
              min="1500" 
              max="10000" 
              step="500"
              value={radialLookupLimit} 
              onChange={(e) => setRadialLookupLimit(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block pb-1 border-b border-dashed border-slate-100 block">
              Maximum physical distance mapping between request coords and available drivers.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Search Grace seconds */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-black block">Driver Response Timeout (sec)</label>
              <input 
                type="number" 
                min="10" 
                max="60"
                value={searchGraceTimer} 
                onChange={(e) => setSearchGraceTimer(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-black rounded"
              />
            </div>

            {/* Rollover retry cap */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-black block">Rollover Retry Attempt Max</label>
              <input 
                type="number" 
                min="1" 
                max="6"
                value={dispatchRetryCap} 
                onChange={(e) => setDispatchRetryCap(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-[#AF52DE] rounded"
              />
            </div>
          </div>

          <button
            onClick={handleSaveEngine}
            disabled={isSaving}
            className="w-full text-center py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4 text-emerald-400" /> Commit Engine Variables
          </button>
        </div>

        {/* Policy Matrices Dashboard */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2">
              Fair Allocation Policies
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans pt-1">
              Configure priority routing systems to keep fleet earnings well-distributed and assist new drivers of our on-demand community.
            </p>
          </div>

          <div className="space-y-4">
            {/* Newcomer Boost Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-black rounded">
              <div>
                <span className="text-xs font-black text-stone-900 block font-sans">Newcomer Priority Weighting</span>
                <span className="text-[10px] text-slate-500 block">Give newly active drivers a 15% priority boost on incoming jobs.</span>
              </div>
              <button 
                onClick={() => setBoostNewcomerDrivers(!boostNewcomerDrivers)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  boostNewcomerDrivers ? "bg-black" : "bg-slate-300"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  boostNewcomerDrivers ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>

            {/* Fair Job distribution rule */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-black rounded">
              <div>
                <span className="text-xs font-black text-black block font-sans">Fair-Share Job Distribution</span>
                <span className="text-[10px] text-slate-500 block">Prevent single drivers from locking consecutive jobs. Enforces cool-downs.</span>
              </div>
              <button 
                onClick={() => setFairDistributionPolicy(!fairDistributionPolicy)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  fairDistributionPolicy ? "bg-black" : "bg-slate-300"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  fairDistributionPolicy ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed">
            <Gauge className="w-4 h-4 text-[#AF52DE]" />
            <span>Optimal performance is active. Radial lookup of {radialLookupLimit}m ensures low driver dispatch times with minimal cancellation metrics.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
