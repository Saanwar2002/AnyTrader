import React from "react";
import { Share2, Gift, TrendingUp, Users } from "lucide-react";

export default function Referrals() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Share2 className="w-6 h-6 text-purple-500" />
            Referrals System
          </h2>
          <p className="text-slate-500 font-medium">Manage driver and rider referral bonuses and performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rider Referrals Config */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 text-slate-50 pointer-events-none">
               <Users className="w-48 h-48" />
             </div>
             
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Rider Refer-a-Friend</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Growth mechanic for passenger acquisition</p>
                  </div>
                  <div className="relative inline-block w-10 h-5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white"></div>
                  </div>
               </div>

               <div className="space-y-4 mb-8">
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Referrer Reward (Existing User)</label>
                   <div className="flex items-center gap-2 w-full">
                     <span className="text-sm font-bold text-slate-500">£</span>
                     <input type="number" defaultValue={5} className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                     <span className="text-xs text-slate-500 font-medium">Ride Credit</span>
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Referred Reward (New User)</label>
                   <div className="flex items-center gap-2 w-full">
                     <span className="text-sm font-bold text-slate-500">£</span>
                     <input type="number" defaultValue={10} className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                     <span className="text-xs text-slate-500 font-medium">Off First Ride</span>
                   </div>
                 </div>
               </div>

               <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Given Away YTD</p>
                   <p className="text-xl font-black text-slate-900">£14,250</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Users Acquired</p>
                   <p className="text-xl font-black flex items-center text-emerald-600 gap-1"><TrendingUp className="w-4 h-4"/> 1,425</p>
                 </div>
               </div>
             </div>
         </div>

         {/* Driver Referrals Config */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 text-slate-50 pointer-events-none">
               <Gift className="w-48 h-48" />
             </div>
             
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Driver Referral Bonus</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">High-value acquisition for supply fleet</p>
                  </div>
                  <div className="relative inline-block w-10 h-5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white"></div>
                  </div>
               </div>

               <div className="space-y-4 mb-8">
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Referrer Cash Bonus (Existing Driver)</label>
                   <div className="flex items-center gap-2 w-full">
                     <span className="text-sm font-bold text-slate-500">£</span>
                     <input type="number" defaultValue={150} className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                     <span className="text-xs text-slate-500 font-medium">Cash to Balance</span>
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Conditions to unlock</label>
                   <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                     <option>New driver completes 50 trips</option>
                     <option>New driver completes 10 trips</option>
                     <option>New driver is approved (instant)</option>
                   </select>
                 </div>
               </div>

               <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid Out YTD</p>
                   <p className="text-xl font-black text-slate-900">£4,800</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Drivers Acquired</p>
                   <p className="text-xl font-black flex items-center text-emerald-600 gap-1"><TrendingUp className="w-4 h-4"/> 32</p>
                 </div>
               </div>
             </div>
         </div>
      </div>
    </div>
  );
}
