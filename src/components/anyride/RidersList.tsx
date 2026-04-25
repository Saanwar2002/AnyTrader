import React, { useState, useEffect } from "react";
import { UserCircle, Search, Filter, ShieldAlert, ChevronRight, Activity, Ban } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function RidersList() {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In AnyTrader, standard users / riders have the "homeowner" role
    const q = query(
      collection(db, "users"),
      where("role", "==", "homeowner")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const riderData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRiders(riderData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching riders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalUsers = riders.length;
  const suspendedUsers = riders.filter(r => r.isDisabled || r.fairnessScore !== undefined && r.fairnessScore < 50).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Riders
          </h2>
          <p className="text-slate-500 font-medium">Manage user accounts, history, and sanctions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Users</p>
             <p className="text-2xl font-black text-slate-900">{totalUsers || "0"}</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
             <UserCircle className="w-5 h-5 text-slate-600" />
           </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition-colors">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority Pass Active</p>
             <p className="text-2xl font-black text-emerald-500">0</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
             <Activity className="w-5 h-5 text-emerald-500" />
           </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Suspended / Strikes</p>
             <p className="text-2xl font-black text-rose-500">{suspendedUsers || "0"}</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
             <Ban className="w-5 h-5 text-rose-500" />
           </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-full">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search rider name, phone, or email..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
            <button className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 whitespace-nowrap">Rider Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Tier</th>
                <th className="px-6 py-4 whitespace-nowrap">Lifetime Rides</th>
                <th className="px-6 py-4 whitespace-nowrap">Rating</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading riders...</td></tr>
              ) : riders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No riders found.</td></tr>
              ) : riders.map((rider) => {
                 let status = "Active";
                 if (rider.isDisabled) status = "Suspended";
                 else if (rider.fairnessScore !== undefined && rider.fairnessScore < 50) status = "Warning";

                 return (
                  <tr key={rider.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                           {rider.name ? rider.name.charAt(0) : '?'}
                         </div>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold text-slate-900">{rider.name || "Unknown"}</span>
                           <span className="text-[10px] text-slate-500">{rider.email}</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                         "bg-slate-50 text-slate-500"
                       )}>
                         Standard
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">
                      {rider.totalRides || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-slate-900">{(rider.rating || 5.0).toFixed(1)}</span>
                        <span className="text-[10px] text-amber-500">★</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "flex items-center gap-1 px-2 py-1 w-fit rounded text-[10px] font-black uppercase tracking-widest",
                         status === "Active" ? "bg-emerald-50 text-emerald-600" : 
                         status === "Warning" ? "bg-amber-50 text-amber-600" :
                         "bg-rose-50 text-rose-600 border border-rose-100"
                       )}>
                         {status === "Warning" && <ShieldAlert className="w-3 h-3" />}
                         {status === "Suspended" && <Ban className="w-3 h-3" />}
                         {status}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                       <button className="p-1.5 text-slate-400 group-hover:bg-slate-200 rounded transition-colors group-hover:text-slate-900">
                         <ChevronRight className="w-4 h-4" />
                       </button>
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
