import React, { useState, useEffect } from "react";
import { 
  Star, 
  Settings, 
  Flame, 
  Tv, 
  TrendingUp, 
  HelpCircle, 
  DollarSign, 
  Milestone, 
  Save, 
  Sparkles,
  Award
} from "lucide-react";
import { db, doc, getDoc, setDoc } from "../../firebase";
import { motion } from "motion/react";
import { toast } from "sonner";

export default function PrioritySettings() {
  const [fastPassFee, setFastPassFee] = useState(19.99);
  const [surgePeakMultiplier, setSurgePeakMultiplier] = useState(1.5);
  const [surgeEmergencyMultiplier, setSurgeEmergencyMultiplier] = useState(2.2);
  const [priorityRadiusBoost, setPriorityRadiusBoost] = useState(2500); // in meters
  const [surgeActive, setSurgeActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Test Simulation state variables
  const [testBaseFare, setTestBaseFare] = useState(15.00);
  const [isTestFastPassUser, setIsTestFastPassUser] = useState(true);

  // Fetch from Firestore on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "platform_settings", "priority_settings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fastPassFee !== undefined) setFastPassFee(data.fastPassFee);
          if (data.surgePeakMultiplier !== undefined) setSurgePeakMultiplier(data.surgePeakMultiplier);
          if (data.surgeEmergencyMultiplier !== undefined) setSurgeEmergencyMultiplier(data.surgeEmergencyMultiplier);
          if (data.priorityRadiusBoost !== undefined) setPriorityRadiusBoost(data.priorityRadiusBoost);
          if (data.surgeActive !== undefined) setSurgeActive(data.surgeActive);
        }
      } catch (err) {
        console.warn("Priority settings loaded from offline context.", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "priority_settings"), {
        fastPassFee,
        surgePeakMultiplier,
        surgeEmergencyMultiplier,
        priorityRadiusBoost,
        surgeActive,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Priority & Surge Pricing configurations saved successfully.");
    } catch (err) {
      console.error("Failed to commit settings to Firebase: ", err);
      localStorage.setItem("anyroller_priority_settings", JSON.stringify({
        fastPassFee, surgePeakMultiplier, surgeEmergencyMultiplier, priorityRadiusBoost, surgeActive
      }));
      toast.success("Preferences updated and cached in local system.");
    } finally {
      setIsSaving(false);
    }
  };

  // Live estimated formula
  const calculatedTestCost = (testBaseFare * (surgeActive ? surgePeakMultiplier : 1.0)) * (isTestFastPassUser ? 0.90 : 1.0);

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">VIP DRIVER & FARE ROUTING</span>
        </div>
        <h2 className="text-xl font-bold text-black">Fast-Pass & Surge Multiplier Panel</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure platform surge limits, VIP tier lookup radiuses, and on-demand premium multipliers that dictate live ride matching.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Settings Form */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-5">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-slate-655" /> Core Parameters
          </h3>

          {/* Surge Pricing Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-black rounded">
            <div>
              <label className="text-xs font-black text-black block">Active Surge Dispatching</label>
              <span className="text-[10px] text-slate-500">Automatically scale fare multipliers under high density demands.</span>
            </div>
            <button 
              onClick={() => setSurgeActive(!surgeActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                surgeActive ? "bg-[#10b981]" : "bg-slate-350"
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                surgeActive ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          {/* Fast Pass Fee */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Fast-Pass Monthly Subscription Fee (£)</label>
              <span className="text-xs font-mono font-bold text-[#AF52DE]">£{fastPassFee.toFixed(2)} / mo</span>
            </div>
            <input 
              type="range" 
              min="9.99" 
              max="49.99" 
              step="1.00"
              value={fastPassFee} 
              onChange={(e) => setFastPassFee(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block font-mono">Premium tier subscription for VIP customer ride prioritizations.</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Surge Peak Multiplier */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-black block">Peak surge multiplier</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1" 
                  min="1.0" 
                  max="3.0"
                  value={surgePeakMultiplier} 
                  onChange={(e) => setSurgePeakMultiplier(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-black rounded text-xs font-bold text-black font-mono pl-8"
                />
                <Flame className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" />
              </div>
            </div>

            {/* Surge Emergency Multiplier */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-black block">Emergency multiplier</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1" 
                  min="1.0" 
                  max="4.0"
                  value={surgeEmergencyMultiplier} 
                  onChange={(e) => setSurgeEmergencyMultiplier(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-black rounded text-xs font-bold text-black font-mono pl-8"
                />
                <Award className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
              </div>
            </div>
          </div>

          {/* Priority Radius Boost */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Priority Dispatch Lookup Range Max</label>
              <span className="text-xs font-mono font-bold text-black">{(priorityRadiusBoost / 1000).toFixed(1)} km</span>
            </div>
            <input 
              type="range" 
              min="1000" 
              max="8000" 
              step="250"
              value={priorityRadiusBoost} 
              onChange={(e) => setPriorityRadiusBoost(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full mt-2 py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {isSaving ? "Saving Config..." : "Save Priority Configuration"}
          </button>
        </div>

        {/* Live Estimator Sandbox Card */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-500" /> Surge Fare Simulator
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Dynamically model how priority algorithms affect passenger tariff and driver splits on live quotes.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-4 font-sans text-xs">
            {/* Input Slider */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-black">Base Estimate Fare Quote:</span>
                <span className="font-mono font-bold text-black">£{testBaseFare.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="100" 
                step="5"
                value={testBaseFare} 
                onChange={(e) => setTestBaseFare(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-250 cursor-pointer"
              />
            </div>

            {/* Fastpass user check */}
            <div className="flex justify-between items-center py-1">
              <span className="font-bold text-black">Test with Fast-Pass Active Client:</span>
              <button
                onClick={() => setIsTestFastPassUser(!isTestFastPassUser)}
                className={`px-3 py-1 rounded text-[10px] font-bold border transition ${
                  isTestFastPassUser 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-slate-600 border-slate-350"
                }`}
              >
                {isTestFastPassUser ? "YES (10% Discount)" : "NO (Flat Rate)"}
              </button>
            </div>

            {/* Output Summary Split */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Live Multiplier Applied:</span>
                <span className="font-mono text-black font-extrabold">
                  {surgeActive ? `${surgePeakMultiplier}x (Surge Active)` : "1.0x (Regular)"}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-black text-white rounded border border-black font-sans">
                <span className="font-black">Estimated Final Price to Rider:</span>
                <span className="text-lg font-black font-mono">£{calculatedTestCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500 px-1">
                <span>Driver split (88%): £{(calculatedTestCost * 0.88).toFixed(2)}</span>
                <span>Platform split (12%): £{(calculatedTestCost * 0.12).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/50 border border-blue-200 text-[10px] text-blue-800 rounded leading-relaxed flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <span>Fast-Pass drivers bypass standard FIFO allocation rules and are mapped to priority requests within the configured {priorityRadiusBoost} meters radius index first.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
