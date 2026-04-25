import React, { useState } from "react";
import { BarChart3, TrendingUp, Calendar, Download, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30d");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Platform Analytics
          </h2>
          <p className="text-slate-500 font-medium">Deep dive into operational and financial metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-lg p-1 border border-slate-200 flex">
            {['7d', '30d', '90d', 'YTD'].map(r => (
              <button 
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-colors",
                  timeRange === r ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <button className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Rides</span>
             <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">+12.4%</span>
          </div>
          <div className="text-3xl font-black text-slate-900">14,289</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Revenue</span>
             <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">+8.1%</span>
          </div>
          <div className="text-3xl font-black text-slate-900">£214.5k</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Wait Time</span>
             <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">-42s</span>
          </div>
          <div className="text-3xl font-black text-slate-900">4m 12s</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Driver Earn/Hr</span>
             <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">+£1.20</span>
          </div>
          <div className="text-3xl font-black text-slate-900">£18.40</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Fake Chart 1 */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-[400px]">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-slate-900">Ride Volume by Region</h3>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center">View Map <ChevronRight className="w-3 h-3"/></button>
           </div>
           <div className="flex-1 border border-slate-100 rounded-xl bg-slate-50 relative flex items-center justify-center p-8">
              {/* Simulated stacked bar chart */}
              <div className="w-full h-full flex items-end justify-between gap-2 px-4">
                 {[40, 60, 45, 80, 50, 90, 75].map((h, i) => (
                   <div key={i} className="flex-1 bg-emerald-100 rounded-t-sm flex flex-col justify-end" style={{ height: '100%' }}>
                      <div className="w-full bg-emerald-500 rounded-t-sm transition-all" style={{ height: `${h}%` }}></div>
                   </div>
                 ))}
              </div>
           </div>
         </div>

         {/* Fake Chart 2 */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-[400px]">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-slate-900">Conversion Funnel</h3>
           </div>
           <div className="flex-1 flex flex-col gap-4">
               {[
                 { label: "App Opened", val: "45,120", pct: "100%", width: "100%", color: "bg-slate-200" },
                 { label: "Entered Destination", val: "32,400", pct: "71.8%", width: "71.8%", color: "bg-indigo-200" },
                 { label: "Viewed Fares", val: "30,150", pct: "66.8%", width: "66.8%", color: "bg-indigo-300" },
                 { label: "Confirmed Ride", val: "14,289", pct: "31.6%", width: "31.6%", color: "bg-indigo-500" },
                 { label: "Completed Ride", val: "12,980", pct: "28.7%", width: "28.7%", color: "bg-emerald-500" },
               ].map((step, i) => (
                 <div key={i} className="flex-1 flex flex-col justify-center">
                    <div className="flex justify-between text-xs font-bold text-slate-900 mb-1">
                      <span>{step.label}</span>
                      <span className="text-slate-500">{step.val} <span className="font-medium text-[10px] ml-1">({step.pct})</span></span>
                    </div>
                    <div className="h-4 bg-slate-50 rounded-full overflow-hidden w-full">
                       <div className={cn("h-full rounded-full transition-all duration-1000", step.color)} style={{ width: step.width }}></div>
                    </div>
                 </div>
               ))}
           </div>
         </div>
      </div>
    </div>
  );
}
