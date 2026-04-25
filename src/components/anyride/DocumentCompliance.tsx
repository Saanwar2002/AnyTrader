import React from "react";
import { ShieldCheck, FileCheck, FileWarning, Search, Filter, AlertTriangle } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function DocumentCompliance() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Documents & Compliance
          </h2>
          <p className="text-slate-500 font-medium">Monitor licenses, MOTs, insurance, and DBS expirations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-2xl shadow-sm text-white flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">Expired (Action Req)</p>
            <h3 className="text-4xl font-black">12</h3>
            <p className="text-xs font-bold text-white/80 mt-2">Drivers temporarily suspended</p>
          </div>
          <AlertTriangle className="w-8 h-8 text-white/20" />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Expiring &lt; 30 Days</p>
            <h3 className="text-4xl font-black text-amber-500">45</h3>
            <p className="text-xs font-medium text-slate-500 mt-2">Automated warnings active</p>
          </div>
          <FileWarning className="w-8 h-8 text-amber-100" />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pending Review</p>
            <h3 className="text-4xl font-black text-slate-900">8</h3>
            <p className="text-xs font-medium text-slate-500 mt-2">Newly uploaded docs</p>
          </div>
          <FileCheck className="w-8 h-8 text-blue-100 text-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
           <h3 className="text-sm font-black text-slate-900">Compliance Action Center</h3>
           <div className="flex items-center gap-2">
            <div className="relative w-64 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search driver..." className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <button className="p-1.5 border border-slate-200 text-slate-600 rounded flex items-center gap-2 hover:bg-slate-50">
              <Filter className="w-4 h-4" /> <span className="text-xs font-bold">Filter status</span>
            </button>
           </div>
        </div>
        
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 whitespace-nowrap">Driver</th>
                <th className="px-6 py-4 whitespace-nowrap">Document Type</th>
                <th className="px-6 py-4 whitespace-nowrap">Expiration / Status</th>
                <th className="px-6 py-4 whitespace-nowrap">System Action</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { id: 1, driver: "Ahmed K.", type: "MOT Certificate", date: "Expires in 4 days", status: "expiring", action: "Warning SMS sent" },
                { id: 2, driver: "Sarah M.", type: "Insurance", date: "Uploaded 2h ago", status: "review", action: "Awaiting Admin" },
                { id: 3, driver: "Mike T.", type: "DBS Check", date: "Expired 2 days ago", status: "expired", action: "Account Suspended Auto" },
                { id: 4, driver: "Ali R.", type: "Driving License", date: "Expires in 15 days", status: "expiring", action: "Warning Email sent" },
              ].map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">{doc.driver}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">{doc.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                     <span className={cn(
                       "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                       doc.status === "expiring" ? "bg-amber-50 text-amber-600" :
                       doc.status === "review" ? "bg-blue-50 text-blue-600" :
                       "bg-rose-50 text-rose-600"
                     )}>
                       {doc.date}
                     </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {doc.action}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100 transition-colors">
                      Action Required
                    </button>
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
