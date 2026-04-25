import React, { useState, useEffect } from "react";
import { Users, Search, Filter, ShieldCheck, Mail, Phone, ChevronRight, Car, DollarSign } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function DriversList() {
  const [activeTab, setActiveTab] = useState("all");
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tradespeople offering Taxi & Transport are considered drivers
    const q = query(
      collection(db, "users"),
      where("role", "==", "tradesperson"),
      where("trades", "array-contains", "Taxi & Transport")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driverData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDrivers(driverData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching drivers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalActive = drivers.filter(d => !d.isDisabled).length;
  const pendingApproval = drivers.filter(d => d.verificationStatus === "pending" || d.verificationStatus === "unverified").length;
  const stripeUnlinked = drivers.filter(d => !d.stripeAccountId).length;

  const filteredDrivers = drivers.filter(d => {
    if (activeTab === "pending") {
      return d.verificationStatus === "pending" || d.verificationStatus === "unverified";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Drivers
          </h2>
          <p className="text-slate-500 font-medium">Manage driver network, profiles, and compliance status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {/* Stats mini */}
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Active</p>
             <p className="text-2xl font-black text-slate-900">{totalActive}</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
             <Users className="w-5 h-5 text-emerald-600" />
           </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500 transition-colors" onClick={() => setActiveTab("pending")}>
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Approval</p>
             <p className="text-2xl font-black text-amber-500">{pendingApproval}</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
             <ShieldCheck className="w-5 h-5 text-amber-500" />
           </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Document Issues</p>
             <p className="text-2xl font-black text-rose-500">0</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
             <ShieldCheck className="w-5 h-5 text-rose-500" />
           </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stripe Unlinked</p>
             <p className="text-2xl font-black text-slate-900">{stripeUnlinked}</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
             <DollarSign className="w-5 h-5 text-slate-600" />
           </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Drivers
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "pending" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Approval Queue ({pendingApproval})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search name, phone, plate..." 
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
                <th className="px-6 py-4 whitespace-nowrap">Driver</th>
                <th className="px-6 py-4 whitespace-nowrap">Contact</th>
                <th className="px-6 py-4 whitespace-nowrap">Vehicle</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Payment Ops</th>
                <th className="px-6 py-4 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading drivers...</td></tr>
              ) : filteredDrivers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No drivers found.</td></tr>
              ) : filteredDrivers.map((driver) => {
                const status = driver.isDisabled ? "Suspended" : driver.verificationStatus === "verified" ? "Active" : "Pending";
                const isStripeLinked = !!driver.stripeAccountId;
                
                return (
                  <tr key={driver.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                           {driver.name ? driver.name.charAt(0) : '?'}
                         </div>
                         <div>
                           <div className="text-xs font-bold text-slate-900">{driver.name || "Unknown"}</div>
                           <div className="text-[10px] text-slate-500 font-medium">ID: {driver.memberId || driver.id.substring(0,8)}</div>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col gap-1">
                         <div className="text-xs text-slate-600 font-medium flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400"/> {driver.phone || "N/A"}</div>
                         <div className="text-[10px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400"/> {driver.email}</div>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col gap-1">
                         <div className="text-xs font-mono font-bold text-slate-900 flex items-center gap-1"><Car className="w-3 h-3 text-slate-400"/> {driver.vehiclePlate || "N/A"}</div>
                         <div className="text-[10px] text-slate-500">{driver.vehicleMake || "N/A"}</div>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                         status === "Active" ? "bg-emerald-50 text-emerald-600" : 
                         status === "Pending" ? "bg-amber-50 text-amber-600" :
                         "bg-rose-50 text-rose-600"
                       )}>
                         {status}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       {isStripeLinked ? (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md w-fit">
                           <DollarSign className="w-3 h-3" /> Stripe Active
                         </span>
                       ) : (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded-md w-fit">
                           <DollarSign className="w-3 h-3" /> Needs Setup
                         </span>
                       )}
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
