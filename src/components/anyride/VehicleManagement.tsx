import React from "react";
import { Car, ShieldCheck, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function VehicleManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Vehicle Management
          </h2>
          <p className="text-slate-500 font-medium">Manage vehicle categories and requirements.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Category Cards */}
        {[
          { name: "Standard", desc: "Everyday rides", req: "Max 10 years old, 4 doors", active: 245 },
          { name: "Executive", desc: "Premium rides", req: "Max 5 years old, Luxury brands", active: 42 },
          { name: "Minibus", desc: "Group travel 6-8", req: "Minibus license required", active: 18 },
          { name: "Accessible", desc: "Wheelchair friendly", req: "Approved ramp/lift integration", active: 12 },
        ].map(cat => (
           <div key={cat.name} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-start hover:border-emerald-500 transition-colors cursor-pointer group">
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
               <Car className="w-5 h-5 text-slate-600 group-hover:text-emerald-600" />
             </div>
             <h3 className="text-sm font-black text-slate-900">{cat.name}</h3>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 mb-3">{cat.desc}</p>
             <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded w-full border border-slate-100 mb-4 h-12">
               {cat.req}
             </div>
             <div className="mt-auto flex items-center justify-between w-full pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500">Active Vehicles</span>
                <span className="text-sm font-black text-slate-900">{cat.active}</span>
             </div>
           </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-8">
         <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
           <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
             <FileText className="w-4 h-4 text-slate-400" /> Compliance Queue (Pending Vehicles)
           </h3>
         </div>
         <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 whitespace-nowrap">Vehicle Info</th>
                  <th className="px-6 py-4 whitespace-nowrap">Driver</th>
                  <th className="px-6 py-4 whitespace-nowrap">MOT Exp.</th>
                  <th className="px-6 py-4 whitespace-nowrap">Insurance</th>
                  <th className="px-6 py-4 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { plate: "AB12 CDE", make: "Toyota Prius", driver: "Ahmed K.", mot: "2024-10-12", insStatus: "pending_upload" },
                  { plate: "WX89 YZK", make: "Mercedes E-Class", driver: "Lisa P.", mot: "2025-01-05", insStatus: "verified" },
                ].map((v) => (
                  <tr key={v.plate} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-xs font-bold text-slate-900">{v.plate}</div>
                       <div className="text-[10px] text-slate-500 font-medium">{v.make}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">{v.driver}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">{v.mot}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                         v.insStatus === "verified" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                       )}>
                         {v.insStatus.replace('_', ' ')}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100 transition-colors">Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
