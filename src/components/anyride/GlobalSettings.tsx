import React from "react";
import { Settings, Key, Globe, Shield, Smartphone } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function GlobalSettings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-500" />
          Global Settings
        </h2>
        <p className="text-slate-500 font-medium">Platform-wide configurations, API keys, and system toggles.</p>
      </div>

      <div className="space-y-6">
        
        {/* Core Switches */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
             <Globe className="w-5 h-5 text-slate-400" /> Platform Status
           </h3>
           
           <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Accepting New Rides</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">If disabled, the rider app will show "Service Unavailable".</p>
                </div>
                <div className="relative inline-block w-12 h-6 cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6 peer-checked:after:border-white"></div>
                </div>
             </div>

             <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Driver Onboarding active</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">Allow new drivers to register via the Driver App.</p>
                </div>
                <div className="relative inline-block w-12 h-6 cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6 peer-checked:after:border-white"></div>
                </div>
             </div>

             <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">Automated Payout Mode (Stripe Connect)</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1 pr-6 hover:text-slate-700 transition-colors">
                    When active, passengers are charged automatically via card-on-file, and drivers receive background payouts.<br />
                    If disabled, the system defaults to the driver displaying a <strong>QR Code</strong> at drop-off.
                  </p>
                </div>
                <div className="relative inline-block w-14 h-7 cursor-pointer shrink-0">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-14 h-7 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-1.5 after:left-1.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-7 peer-checked:after:border-white shadow-inner"></div>
                </div>
             </div>
           </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
             <Key className="w-5 h-5 text-slate-400" /> External API Integrations
           </h3>
           
           <div className="space-y-6">
             {/* Stripe */}
             <div>
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">Stripe Connect</h4>
                 <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">Connected</span>
               </div>
               <p className="text-xs text-slate-500 font-medium mb-3">Live Secret Key (sk_live_...)</p>
               <input type="password" value="sk_live_testing1234567890" disabled className="w-full bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-500" />
             </div>

             {/* Mapbox */}
             <div>
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">Mapbox (Routing & Geocoding)</h4>
                 <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">Connected</span>
               </div>
               <p className="text-xs text-slate-500 font-medium mb-3">Public Access Token</p>
               <input type="password" value="pk.eyJ1IjoiYmFyc2t5M..." disabled className="w-full bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-500" />
             </div>

             {/* Twilio */}
             <div>
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">Twilio (SMS / Calls)</h4>
                 <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">Connected</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Account SID</p>
                   <input type="password" value="AC000000000000" disabled className="w-full bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-500" />
                 </div>
                 <div>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Auth Token</p>
                   <input type="password" value="xxxxxxxxxxxxxxxxxx" disabled className="w-full bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-500" />
                 </div>
               </div>
             </div>
           </div>

           <div className="mt-6 flex justify-end">
             <button className="px-6 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg shadow-sm hover:bg-slate-800 transition-colors">
               Unlock to Edit Keys
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
