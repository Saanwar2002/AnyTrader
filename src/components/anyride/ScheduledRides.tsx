import React, { useState, useEffect } from "react";
import { Search, Calendar as CalendarIcon, Clock, CheckCircle2, UserPlus, MapPin, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function ScheduledRides() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch upcoming rides (where scheduledAt is in the future or not ASAP)
    const q = query(
      collection(db, "ride_requests"),
      where("status", "in", ["pending", "accepted"])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rideData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRides(rideData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching scheduled rides:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRides = rides.filter(ride => {
    // Basic filter simulation: if no driver assigned, it's auto or needs assignment
    if (activeTab === "unassigned") return !ride.driverId;
    return true; // For 'today', 'upcoming' etc we would filter by scheduledAt normally if we had it
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Scheduled Rides
          </h2>
          <p className="text-slate-500 font-medium">Manage future bookings and auto-dispatch rules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
            {[ 
              { id: "upcoming", label: "Upcoming" }, 
              { id: "today", label: "Today" }, 
              { id: "this_week", label: "This Week" }, 
              { id: "unassigned", label: "Unassigned" } 
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4 whitespace-nowrap">Time</th>
                    <th className="px-6 py-4 whitespace-nowrap">Rider / Route</th>
                    <th className="px-6 py-4 whitespace-nowrap">Vehicle</th>
                    <th className="px-6 py-4 whitespace-nowrap">Driver</th>
                    <th className="px-6 py-4 whitespace-nowrap text-right">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading rides...</td></tr>
                  ) : filteredRides.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No scheduled rides found.</td></tr>
                  ) : filteredRides.map((ride) => {
                    const time = ride.scheduledAt ? new Date(ride.scheduledAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date(ride.createdAt?.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    return (
                      <tr key={ride.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                             <Clock className="w-3 h-3 text-slate-400" />
                             <span className="text-xs font-black text-slate-900">{time}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 w-64">
                             <span className="text-xs font-bold text-slate-900">{ride.riderName || ride.riderId.substring(0,8)}</span>
                             <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 truncate">
                               <span className="truncate">{ride.pickupAddress || ride.pickup}</span>
                               <span className="text-slate-400">→</span>
                               <span className="truncate">{ride.dropoffAddress || ride.dropoff}</span>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded capitalize">{ride.rideType || "Standard"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                             {ride.driverId ? (
                               <>
                                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                 <span className="text-xs font-bold text-slate-900">{ride.driverName || "Assigned"}</span>
                               </>
                             ) : ride.status === "pending" && ride.scheduledAt ? (
                               <>
                                 <Clock className="w-3.5 h-3.5 text-blue-500" />
                                 <span className="text-xs font-bold text-blue-600">Auto-match (15m before)</span>
                               </>
                             ) : (
                               <>
                                 <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                 <span className="text-xs font-bold text-amber-600">Needs Assignment</span>
                               </>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                           <button className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded transition-colors">
                             <UserPlus className="w-4 h-4" />
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

        {/* Schedule Settings Sidebar */}
        <div className="lg:col-span-1 space-y-4">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Global Settings</h3>
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Advance Booking</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <input type="number" defaultValue={30} className="w-full bg-transparent border-none text-sm font-bold text-slate-900 outline-none" />
                   <span className="text-xs font-bold text-slate-400">min</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Advance Booking</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <input type="number" defaultValue={7} className="w-full bg-transparent border-none text-sm font-bold text-slate-900 outline-none" />
                   <span className="text-xs font-bold text-slate-400">days</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auto-dispatch Start</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <input type="number" defaultValue={15} className="w-full bg-transparent border-none text-sm font-bold text-slate-900 outline-none" />
                   <span className="text-xs font-bold text-slate-400">min before</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Driver Pre-assignment</span>
                <div className="relative inline-block w-8 h-4 cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white"></div>
                </div>
              </div>
              <button className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors">
                Save Settings
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
