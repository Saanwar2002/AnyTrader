import React, { useState, useEffect } from "react";
import { Search, Calendar, ChevronLeft, ChevronRight, Download, Filter, Car, Clock } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";

export default function RideHistory() {
  const [activeTab, setActiveTab] = useState("all");
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q;
    if (activeTab === "all") {
      q = query(collection(db, "ride_requests"), orderBy("createdAt", "desc"), limit(50));
    } else if (activeTab === "completed") {
      q = query(collection(db, "ride_requests"), where("status", "==", "completed"), orderBy("createdAt", "desc"), limit(50));
    } else if (activeTab === "cancelled") {
      q = query(collection(db, "ride_requests"), where("status", "==", "cancelled"), orderBy("createdAt", "desc"), limit(50));
    } else {
      q = query(collection(db, "ride_requests"), orderBy("createdAt", "desc"), limit(50));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRides(docs);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsub();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Ride History 
          </h2>
          <p className="text-slate-500 font-medium">Searchable archive of all completed, cancelled, and failed rides.</p>
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
              All Rides
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "completed" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveTab("cancelled")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "cancelled" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Cancelled
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search ID, name, plate..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
            <button className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0 flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold">Export</span>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="bg-slate-50 p-3 px-4 flex items-center gap-4 text-xs font-medium text-slate-600 overflow-x-auto no-scrollbar border-b border-slate-100">
           <span className="flex items-center gap-1.5 whitespace-nowrap bg-white border border-slate-200 px-2 py-1 rounded-md cursor-pointer hover:border-slate-300">
             Date: <span className="font-bold text-slate-900">Last 7 days</span> <span className="text-[10px]">▼</span>
           </span>
           <span className="flex items-center gap-1.5 whitespace-nowrap bg-white border border-slate-200 px-2 py-1 rounded-md cursor-pointer hover:border-slate-300">
             Vehicle: <span className="font-bold text-slate-900">All</span> <span className="text-[10px]">▼</span>
           </span>
           <span className="flex items-center gap-1.5 whitespace-nowrap bg-white border border-slate-200 px-2 py-1 rounded-md cursor-pointer hover:border-slate-300">
             Payment: <span className="font-bold text-slate-900">All</span> <span className="text-[10px]">▼</span>
           </span>
           <span className="flex items-center gap-1.5 whitespace-nowrap bg-white border border-slate-200 px-2 py-1 rounded-md cursor-pointer hover:border-slate-300">
             Priority: <span className="font-bold text-slate-900">All</span> <span className="text-[10px]">▼</span>
           </span>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 whitespace-nowrap">Date / Time</th>
                <th className="px-6 py-4 whitespace-nowrap">Ride ID</th>
                <th className="px-6 py-4 whitespace-nowrap">Rider</th>
                <th className="px-6 py-4 whitespace-nowrap">Driver</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Fare / Pay</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading rides...</td></tr>
              ) : rides.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No rides found.</td></tr>
              ) : rides.map((ride) => {
                const dateObj = ride.createdAt?.toDate ? ride.createdAt.toDate() : new Date();
                const displayDate = dateObj.toLocaleDateString([], { day: 'numeric', month: 'short' });
                const displayTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const fare = ride.fare ? `£${parseFloat(ride.fare).toFixed(2)}` : "—";
                return (
                 <tr key={ride.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="text-xs font-bold text-slate-900">{displayDate}</div>
                     <div className="text-[10px] text-slate-500 font-medium">{displayTime}</div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="text-xs font-mono font-bold text-slate-600">#{ride.id.slice(0, 6)}</div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {ride.riderName ? ride.riderName.charAt(0) : '?'}
                        </div>
                        <span className="text-xs font-bold text-slate-900">{ride.riderName || "Unknown"}</span>
                     </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     {ride.driverId ? (
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">
                            {ride.driverName ? ride.driverName.charAt(0) : '?'}
                          </div>
                          <span className="text-xs font-bold text-slate-900">{ride.driverName || "Unknown"}</span>
                       </div>
                     ) : (
                       <span className="text-xs text-slate-400 font-bold">—</span>
                     )}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right">
                     <div className="flex items-center justify-end gap-2">
                       <span className="text-xs font-black text-slate-900">{fare}</span>
                       {ride.status === "completed" && (
                         ride.paymentIntentId ? (
                           <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 text-emerald-600" title="Paid">
                             ✓
                           </span>
                         ) : (
                           <span className="flex items-center justify-center w-4 h-4 rounded bg-amber-100 text-amber-600 font-black text-[10px]" title="Unpaid">
                             !
                           </span>
                         )
                       )}
                     </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                        ride.status === "completed" ? "bg-emerald-50 text-emerald-600" : 
                        ride.status === "cancelled" ? "bg-rose-50 text-rose-600" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {ride.status}
                      </span>
                   </td>
                 </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Showing latest rides</span>
        </div>
      </div>
    </div>
  );
}
