import React from "react";
import { ChevronLeft, ShieldCheck, AlertTriangle, XCircle, ArrowRight, Wrench } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function DriverDocuments({ onBack }: { onBack: () => void }) {
  const documents = [
    {
      id: "dvla_license",
      name: "DVLA Driving License",
      status: "valid",
      expiry: "Expires 12 Oct 2028",
      color: "text-[#00D26A]",
      bg: "bg-[#00D26A]/10",
      icon: ShieldCheck
    },
    {
      id: "phv_license",
      name: "Private Hire License",
      status: "valid",
      expiry: "Expires 05 May 2025",
      color: "text-[#00D26A]",
      bg: "bg-[#00D26A]/10",
      icon: ShieldCheck
    },
    {
      id: "insurance",
      name: "Hire & Reward Insurance",
      status: "valid",
      expiry: "Expires 22 Nov 2024",
      color: "text-[#00D26A]",
      bg: "bg-[#00D26A]/10",
      icon: ShieldCheck
    },
    {
      id: "mot",
      name: "MOT Certificate",
      status: "expiring",
      expiry: "Expires in 14 Days",
      color: "text-[#FF9500]",
      bg: "bg-[#FF9500]/10",
      icon: AlertTriangle,
      action: "Renew"
    },
    {
      id: "logbook",
      name: "V5C Logbook",
      status: "missing",
      expiry: "Upload required",
      color: "text-[#FF3B30]",
      bg: "bg-[#FF3B30]/10",
      icon: XCircle,
      action: "Upload"
    }
  ];

  return (
      <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto font-sans pb-24 absolute inset-0 z-50">
        <div className="sticky top-0 bg-[#0D0D0F]/90 backdrop-blur-xl z-20 px-4 py-4 flex items-center gap-3 border-b border-[#2C2C30]">
           <button onClick={onBack} className="p-2 -ml-2 bg-transparent text-[#E4E4E7] active:text-white transition-colors">
             <ChevronLeft className="w-6 h-6" />
           </button>
           <h1 className="text-xl font-black tracking-tight">Vehicle & Docs</h1>
        </div>

        <div className="px-4 py-6">
           {/* Summary Card */}
           <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-5 mb-6 flex items-center justify-between">
              <div>
                 <p className="text-[10px] font-black uppercase text-[#A1A1AA] tracking-widest mb-1">Active Vehicle</p>
                 <h2 className="text-lg font-black text-white leading-tight">Toyota Prius Hybrid</h2>
                 <p className="text-sm font-bold text-[#E4E4E7] mt-1 border border-[#333338] bg-[#252529] px-2.5 py-1 rounded-md inline-block uppercase tracking-wider">YT68 XYZ</p>
              </div>
              <img src="https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=150&q=80" alt="Toyota Prius" className="w-16 h-16 object-cover rounded-xl border border-[#2C2C30]" />
           </div>

           {/* Documents List */}
           <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-xs font-black uppercase text-[#A1A1AA] tracking-widest">Required Documents</h3>
                <span className="text-[10px] font-black text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full uppercase tracking-wider border border-[#FF3B30]/20">1 Action</span>
              </div>

              {documents.map((doc) => {
                 const Icon = doc.icon;
                 return (
                    <div key={doc.id} className={cn("bg-[#1A1A1E] border rounded-2xl p-4 transition-colors", doc.status === 'expiring' ? "border-[#FF9500]/50 shadow-[0_0_15px_rgba(255,149,0,0.05)]" : doc.status === 'missing' ? "border-[#FF3B30]/50" : "border-[#2C2C30]")}>
                       <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", doc.bg)}>
                             <Icon className={cn("w-5 h-5", doc.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <h4 className="text-sm font-bold text-white tracking-tight truncate">{doc.name}</h4>
                             <p className={cn("text-xs font-bold mt-0.5 truncate", doc.status === 'valid' ? "text-[#A1A1AA] font-medium" : doc.color)}>{doc.expiry}</p>
                          </div>
                          {doc.action && (
                             <button className={cn("px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ml-2 shrink-0 border active:scale-95 transition-transform", doc.status === 'expiring' ? "bg-[#FF9500] text-[#0D0D0F] border-transparent" : "bg-[#FF3B30] text-white border-transparent")}>
                                {doc.action}
                             </button>
                          )}
                       </div>

                       {/* Cross-Sell AnyTrader Widget inside the MOT document if expiring */}
                       {doc.id === 'mot' && doc.status === 'expiring' && (
                          <div className="mt-4 pt-4 border-t border-[#333338]">
                             <div className="bg-gradient-to-r from-[#FF9500]/10 to-transparent p-3.5 rounded-xl border border-[#FF9500]/20 flex items-start gap-3">
                                <div className="mt-0.5 text-[#FF9500]"><Wrench className="w-4 h-4" /></div>
                                <div className="flex-1">
                                   <p className="text-[12px] font-black text-white leading-tight mb-1">Book an MOT via AnyTrader</p>
                                   <p className="text-[11px] text-[#E4E4E7] mb-2.5 leading-relaxed font-medium">Top-rated mechanics near you. We verify the certificate automatically once passed.</p>
                                   <button className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-[#FF9500] hover:text-white transition-colors bg-[#FF9500]/20 px-3 py-1.5 rounded-lg w-max">
                                      Find a Mechanic <ArrowRight className="w-3 h-3 ml-1" />
                                   </button>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>
                 );
              })}
           </div>
        </div>
      </div>
  );
}
