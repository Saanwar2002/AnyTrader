import React from "react";
import { Tag, Plus, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Promotions() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-500" />
            Promotions & Campaigns
          </h2>
          <p className="text-slate-500 font-medium">Create promo codes, discounts, and priority pass overrides.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Promo Card List */}
         {[
           { code: "NEWUSER50", type: "Discount", value: "50% Off (Max £10)", uses: "412 / 1000", expires: "Active (Never)", status: "active", claims: 412 },
           { code: "LATEPRIORITY", type: "Upgrade", value: "Free Priority Pass", uses: "28 / ∞", expires: "Active (30 Days)", status: "active", claims: 28 },
           { code: "FESTIVAL25", type: "Discount", value: "25% Off Base Fare", uses: "140 / 500", expires: "Expired", status: "expired", claims: 140 },
         ].map((promo, i) => (
           <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col relative group">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <h3 className="text-xl font-mono font-black text-indigo-600 tracking-tight">{promo.code}</h3>
                   <span className={cn(
                     "mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                     promo.type === "Discount" ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"
                   )}>
                     {promo.type}
                   </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><Settings2 className="w-4 h-4"/></button>
                  <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>

              <div className="text-2xl font-black text-slate-900 mb-6">{promo.value}</div>
              
              <div className="mt-auto space-y-3">
                 <div className="flex justify-between text-xs font-medium">
                   <span className="text-slate-500">Usage Limit:</span>
                   <span className="text-slate-900 font-bold">{promo.uses}</span>
                 </div>
                 {/* Progress bar */}
                 {promo.status === "active" && (
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (promo.claims / 1000) * 100)}%` }}></div>
                   </div>
                 )}
                 <div className="flex justify-between text-xs font-medium">
                   <span className="text-slate-500">Expiration:</span>
                   <span className={promo.status === "active" ? "text-emerald-600 font-bold" : "text-slate-400"}>{promo.expires}</span>
                 </div>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
