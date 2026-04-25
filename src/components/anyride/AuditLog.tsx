import React, { useState, useEffect } from "react";
import { Database, Search, ArrowDownToLine, Clock } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "audit_logs"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(docs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2">
             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Audit Log</h2>
             <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-amber-200">Immutable</span>
           </div>
          <p className="text-slate-500 font-medium">System-wide tracking of all admin actions and configuration changes.</p>
        </div>
        <button className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4" /> Download Logs
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
           <div className="relative w-full sm:w-96">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Search logs (e.g. 'refund', 'Super User')..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-500/20 shadow-sm" />
           </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4 whitespace-nowrap">Timestamp</th>
                <th className="px-6 py-4 whitespace-nowrap">Admin</th>
                <th className="px-6 py-4 whitespace-nowrap">Category</th>
                <th className="px-6 py-4">Action Details</th>
                <th className="px-6 py-4 whitespace-nowrap">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs shadow-inner">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500 font-mono">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500 font-mono">No audit logs found.</td></tr>
              ) : logs.map((log, i) => {
                const dateObj = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
                const displayDate = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`;
                
                return (
                 <tr key={log.id || i} className="hover:bg-slate-50 transition-colors font-mono">
                   <td className="px-6 py-4 whitespace-nowrap text-slate-500 flex items-center gap-2">
                     <Clock className="w-3 h-3 text-slate-400" /> {displayDate}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-800">{log.adminId || "System"}</span>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                        log.action?.includes("Config") ? "bg-rose-50 text-rose-600" :
                        log.action?.includes("Refund") ? "bg-amber-50 text-amber-600" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {log.targetType || "System"}
                      </span>
                   </td>
                   <td className="px-6 py-4 text-slate-700">
                     {log.action} {log.details ? `- ${log.details}` : ''}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-[10px]">
                     {log.ip || "Internal"}
                   </td>
                 </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
