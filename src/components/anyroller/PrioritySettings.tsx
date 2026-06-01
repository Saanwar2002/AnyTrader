import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, ArrowRight, UserPlus, Zap, ToggleRight, 
  Settings2, Activity, Save, AlertTriangle, ArrowUpCircle
} from "lucide-react";

// Mock configuration state
const initialConfig = {
  driverNewcomerBoost: true,
  driverNewcomerDurationDays: 14,
  passengerSerialCancellerProtection: true,
  passengerCancelThreshold: 3, // Cancelled rides per week
  driverFairDistribution: true,
  vipPriorityMatching: true,
  highRatingPriority: true,
  highRatingThreshold: 4.8,
};

const PrioritySettings = () => {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  const Toggle = ({ enabled, onClick }: { enabled: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <ShieldCheck className="mr-2 text-emerald-600" />
            Trust & Fairness Engine
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure automated rules for fair dispatching and platform integrity.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-[0_4px_0_rgb(100,100,100)] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50"
        >
          {isSaving ? <Activity className="animate-spin" size={18} /> : <Save size={18} />}
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Driver Fairness Section */}
        <div className="bg-white border border-black rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b border-black px-6 py-4 flex items-center gap-2">
            <Zap className="text-blue-600" size={20} />
            <h2 className="font-bold text-black text-lg">Driver Dispatch Priority</h2>
          </div>
          
          <div className="p-6 space-y-8">
            <div className="flex items-start justify-between">
              <div className="pr-8">
                <h3 className="font-bold text-black mb-1">New Driver Boost</h3>
                <p className="text-sm text-gray-500">Temporarily boost dispatch priority for new drivers to help them secure their first rides and get established on the platform.</p>
                {config.driverNewcomerBoost && (
                  <div className="mt-4 flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100 w-max">
                    <label className="text-xs font-bold text-blue-800 uppercase">Boost Duration</label>
                    <div className="flex items-center text-sm font-bold text-black">
                      <input 
                        type="number" 
                        min="1" 
                        max="30"
                        value={config.driverNewcomerDurationDays} 
                        onChange={(e) => setConfig({...config, driverNewcomerDurationDays: parseInt(e.target.value)})}
                        className="w-16 px-2 py-1 border border-black rounded-md mr-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      Days
                    </div>
                  </div>
                )}
              </div>
              <Toggle enabled={config.driverNewcomerBoost} onClick={() => setConfig({...config, driverNewcomerBoost: !config.driverNewcomerBoost})} />
            </div>

            <div className="w-full h-px bg-gray-200"></div>

            <div className="flex items-start justify-between">
              <div className="pr-8">
                <h3 className="font-bold text-black mb-1">High-Rating Priority Route</h3>
                <p className="text-sm text-gray-500">Drivers maintaining exceptional ratings gain micro-priority over standard drivers in densely populated request zones.</p>
                {config.highRatingPriority && (
                  <div className="mt-4 flex items-center gap-3 bg-yellow-50 p-3 rounded-lg border border-yellow-100 w-max">
                    <label className="text-xs font-bold text-yellow-800 uppercase">Qualifying Threshold</label>
                    <div className="flex items-center text-sm font-bold text-black">
                      <input 
                        type="number" 
                        step="0.1"
                        min="4.0" 
                        max="5.0"
                        value={config.highRatingThreshold} 
                        onChange={(e) => setConfig({...config, highRatingThreshold: parseFloat(e.target.value)})}
                        className="w-20 px-2 py-1 border border-black rounded-md mr-2 text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                      Stars
                    </div>
                  </div>
                )}
              </div>
              <Toggle enabled={config.highRatingPriority} onClick={() => setConfig({...config, highRatingPriority: !config.highRatingPriority})} />
            </div>

            <div className="w-full h-px bg-gray-200"></div>

            <div className="flex items-start justify-between">
              <div className="pr-8">
                <h3 className="font-bold text-black mb-1">Fair Job Distribution</h3>
                <p className="text-sm text-gray-500">Ensure drivers who have been online the longest without receiving a ride get bumped up the allocation queue.</p>
              </div>
              <Toggle enabled={config.driverFairDistribution} onClick={() => setConfig({...config, driverFairDistribution: !config.driverFairDistribution})} />
            </div>
          </div>
        </div>

        {/* Passenger Integrity Section */}
        <div className="bg-white border border-black rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b border-black px-6 py-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={20} />
            <h2 className="font-bold text-black text-lg">Passenger Integrity Engine</h2>
          </div>
          
          <div className="p-6 space-y-8">
            <div className="flex items-start justify-between">
              <div className="pr-8">
                <h3 className="font-bold text-black mb-1">Serial Canceller Protection</h3>
                <p className="text-sm text-gray-500">Automatically delay or deprioritize ride requests from passengers who repeatedly cancel rides after drivers have been dispatched.</p>
                {config.passengerSerialCancellerProtection && (
                  <div className="mt-4 flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100 w-max">
                    <label className="text-xs font-bold text-red-800 uppercase">Cancellation Threshold</label>
                    <div className="flex items-center text-sm font-bold text-black">
                      <input 
                        type="number" 
                        min="1" 
                        max="10"
                        value={config.passengerCancelThreshold} 
                        onChange={(e) => setConfig({...config, passengerCancelThreshold: parseInt(e.target.value)})}
                        className="w-16 px-2 py-1 border border-black rounded-md mr-2 text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      Per rolling 7 days
                    </div>
                  </div>
                )}
              </div>
              <Toggle enabled={config.passengerSerialCancellerProtection} onClick={() => setConfig({...config, passengerSerialCancellerProtection: !config.passengerSerialCancellerProtection})} />
            </div>

            <div className="w-full h-px bg-gray-200"></div>

            <div className="flex items-start justify-between">
              <div className="pr-8">
                <h3 className="font-bold text-black flex items-center gap-2">
                  <ArrowUpCircle className="text-purple-600" size={18} />
                  VIP Rider Priority Matching
                </h3>
                <p className="text-sm text-gray-500">Users with premium business accounts or exceptional lifetime value receive priority routing during peak hours or driver shortages.</p>
              </div>
              <Toggle enabled={config.vipPriorityMatching} onClick={() => setConfig({...config, vipPriorityMatching: !config.vipPriorityMatching})} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrioritySettings;

