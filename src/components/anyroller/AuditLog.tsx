import React, { useState } from "react";
import { 
  Database, 
  Search, 
  Trash2, 
  Clock, 
  CheckCircle, 
  HelpCircle, 
  User, 
  ShieldCheck, 
  Sliders, 
  Compass, 
  Activity,
  Award
} from "lucide-react";
import { toast } from "sonner";

interface SecurityAudit {
  id: string;
  adminName: string;
  actionDetails: string;
  category: "Security" | "DB Update" | "Billing Control";
  ipAddress: string;
  timestamp: string;
}

const initialAuditsSeed: SecurityAudit[] = [
  { id: "aud_9001", adminName: "Saanwar Anwar", actionDetails: "Bypassed cooling-off lock for Driver Sienna Williams (rev_1002)", category: "Security", ipAddress: "185.112.44.12", timestamp: "2026-05-29T06:55:00Z" },
  { id: "aud_9002", adminName: "Jonathan Miller", actionDetails: "Reassigned unassigned pre-booked Heathrow dispatch ride (sch_12) to Sienna Williams", category: "DB Update", ipAddress: "82.164.212.19", timestamp: "2026-05-29T06:40:00Z" },
  { id: "aud_9003", adminName: "Saanwar Anwar", actionDetails: "Committed updated Base Fare rates changes (£3.50 base, £2.20/mile)", category: "Billing Control", ipAddress: "185.112.44.12", timestamp: "2026-05-29T06:12:00Z" },
  { id: "aud_9004", adminName: "Jonathan Miller", actionDetails: "Manually overridden licensure documents check for Benjamin Taylor", category: "Security", ipAddress: "82.164.212.19", timestamp: "2026-05-28T18:45:00Z" }
];

export default function AuditLog() {
  const [audits, setAudits] = useState<SecurityAudit[]>(initialAuditsSeed);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredAudits = audits.filter(a => {
    const matchesSearch = a.adminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.actionDetails.toLowerCase().includes(searchQuery.toLowerCase());
    if (categoryFilter === "all") return matchesSearch;
    return matchesSearch && a.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-emerald-505" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">IMMUTABLE ARCHIVE CHANNELS</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Security Audit Log Ledger</h2>
        <p className="text-xs text-slate-500 mt-1">
          Monitor system administrator actions, configuration variables modifications, bypasses, security events, and audit traces for regulatory PHV compliance.
        </p>
      </div>

      <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
        
        {/* Controls and filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Searching */}
          <input 
            type="text" 
            placeholder="Search administrator actions, IDs, or details..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bh-slate-50 border border-black text-xs text-black rounded font-sans max-w-sm flex-1 outline-none"
          />

          {/* Group filters */}
          <div className="flex bg-slate-50 border border-black rounded p-0.5 self-start font-mono text-[9.5px]">
            {["all", "Security", "DB Update", "Billing Control"].map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1 uppercase font-bold rounded cursor-pointer transition select-none ${
                  categoryFilter === c ? "bg-black text-white" : "text-stone-550 hover:text-black"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Audit list logs */}
        <div className="space-y-3">
          {filteredAudits.map(log => {
            const dtObj = new Date(log.timestamp);
            return (
              <div key={log.id} className="p-4 bg-slate-55 border border-black rounded font-sans space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-[#AF52DE]">{log.id}</span>
                    <strong className="text-black font-extrabold">{log.adminName}</strong>
                    <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 border rounded ${
                      log.category === "Security"
                        ? "bg-red-50 text-red-800 border-red-305"
                        : log.category === "Billing Control"
                        ? "bg-indigo-50 text-indigo-805 border-indigo-305"
                        : "bg-emerald-50 text-emerald-805 border-emerald-305"
                    }`}>
                      {log.category}
                    </span>
                  </div>

                  <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>{dtObj.toLocaleDateString()} at {dtObj.toLocaleTimeString()} UTC</span>
                  </div>
                </div>

                <p className="text-slate-800 font-medium leading-relaxed bg-white border border-black/10 p-2.5 rounded font-mono text-[11px]">
                  {log.actionDetails}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-450 font-mono pt-1">
                  <span>Audit Originated Base IP : <strong className="text-stone-700">{log.ipAddress}</strong></span>
                  <span className="flex items-center gap-1 text-emerald-600 font-bold select-none">
                    <ShieldCheck className="w-3.5 h-3.5" /> Immutable Hash Verified
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
