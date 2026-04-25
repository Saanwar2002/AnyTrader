import React, { useState } from "react";
import { Megaphone, Users, Smartphone, Mail, Send, History } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function BroadcastMessaging() {
  const [target, setTarget] = useState("all-drivers");
  const [channel, setChannel] = useState("push");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-emerald-500" />
            Broadcast Center
          </h2>
          <p className="text-slate-500 font-medium">Send push, SMS, or emails to segments of users.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Builder */}
         <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-black text-slate-900 mb-6 border-b border-slate-100 pb-4">Compose Broadcast</h3>
            
            <div className="space-y-6">
               <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">1. Target Audience</label>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {[
                     { id: 'all-drivers', label: "All Drivers" },
                     { id: 'active-drivers', label: "Online Drivers" },
                     { id: 'all-riders', label: "All Riders" },
                     { id: 'custom', label: "Custom Segment..." },
                   ].map(t => (
                     <button
                       key={t.id}
                       onClick={() => setTarget(t.id)}
                       className={cn(
                         "p-3 rounded-xl border text-sm font-bold text-center transition-all",
                         target === t.id ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                       )}
                     >
                       {t.label}
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">2. Delivery Channel</label>
                 <div className="flex gap-3">
                   <button
                     onClick={() => setChannel("push")}
                     className={cn(
                       "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all",
                       channel === "push" ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                     )}
                   >
                     <Smartphone className="w-4 h-4" /> Push Notification
                   </button>
                   <button
                     onClick={() => setChannel("sms")}
                     className={cn(
                       "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all",
                       channel === "sms" ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                     )}
                   >
                     <Smartphone className="w-4 h-4" /> SMS Fast
                   </button>
                   <button
                     onClick={() => setChannel("email")}
                     className={cn(
                       "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all",
                       channel === "email" ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                     )}
                   >
                     <Mail className="w-4 h-4" /> Email
                   </button>
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">3. Message Content</label>
                 <input 
                   type="text" 
                   placeholder="Notification Title (Short)" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold mb-3 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" 
                 />
                 <textarea 
                   placeholder="Type your message here..." 
                   className="w-full p-4 h-32 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none font-medium"
                 ></textarea>
               </div>

               <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                 <p className="text-xs font-medium text-slate-500"><Users className="w-4 h-4 inline mr-1" /> Estimated Reach: <strong className="text-slate-900">482 users</strong></p>
                 <button className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-600 transition-colors flex items-center gap-2">
                   <Send className="w-4 h-4" /> Send Broadcast Now
                 </button>
               </div>
            </div>
         </div>

         {/* History */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-black text-slate-900">Recent Broadcasts</h3>
            </div>
            <div className="flex-1 overflow-y-auto split-y divide-slate-50 p-2">
               {[
                 { title: "App Update Required", target: "All Drivers", sent: "Yesterday", reach: 480, channel: "Push" },
                 { title: "System Maintenance", target: "All Users", sent: "10 Apr", reach: 12500, channel: "Email" },
                 { title: "Free Priority Pass", target: "Top Riders", sent: "1 Apr", reach: 120, channel: "Push" },
               ].map((b, i) => (
                 <div key={i} className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">{b.title}</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">{b.channel}</span>
                      <span className="text-[10px] text-slate-500 font-medium">To: {b.target}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-2">
                      <span>{b.reach} delivered</span>
                      <span>{b.sent}</span>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
