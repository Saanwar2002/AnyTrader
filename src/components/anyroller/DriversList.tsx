import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { 
  Search, Car, Shield, AlertTriangle, CheckCircle, 
  XOctagon, Clock, UserCheck, Star, Activity, Trash
} from "lucide-react";
import { motion } from "framer-motion";

export default function DriversList() {
  const [users, setUsers] = useState<any[]>([]);
  const [driverStatuses, setDriverStatuses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Listen to users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Filter for drivers (either role is driver, or has D- member prefix, or has vehicle data)
      const drivers = allUsers.filter(u => 
        u.role === "driver" || 
        (u.memberId && u.memberId.startsWith("D-")) || 
        u.isDriver
      );
      setUsers(drivers);
      setLoading(false);
    });

    // Listen to real-time driver status
    const unsubStatus = onSnapshot(collection(db, "driver_status"), (snapshot) => {
      const statuses: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        statuses[doc.id] = doc.data();
      });
      setDriverStatuses(statuses);
    });

    return () => {
      unsubUsers();
      unsubStatus();
    };
  }, []);

  const toggleDriverSuspension = async (driverId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", driverId), {
        isDisabled: !currentStatus
      });
    } catch (err) {
      console.error("Failed to update suspension status", err);
    }
  };

  const deleteDriver = async (driverId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this driver account? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "users", driverId));
    } catch (err) {
      console.error("Failed to delete driver", err);
    }
  };

  const filteredDrivers = users.filter(driver => {
    const searchLower = searchTerm.toLowerCase();
    return (
      driver.name?.toLowerCase().includes(searchLower) ||
      driver.email?.toLowerCase().includes(searchLower) ||
      driver.memberId?.toLowerCase().includes(searchLower) ||
      driver.vehicle?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Car className="w-8 h-8 text-black" />
            Driver Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Review, approve, and manage the AnyRoller driver fleet.</p>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search drivers, vehicles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 w-full sm:w-64 shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Activity className="w-8 h-8 text-black animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-black/10">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Driver</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Live Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Vehicle</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Performance</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredDrivers.map(driver => {
                  const statusDoc = driverStatuses[driver.id] || {};
                  const isOnline = statusDoc.status === 'online';
                  
                  return (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={driver.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${driver.isDisabled ? 'opacity-60 bg-red-50/30' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {driver.avatarUrl ? (
                            <img src={driver.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-black/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-black/5 flex items-center justify-center text-slate-400">
                              <UserCheck className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{driver.name}</p>
                              {driver.stripeOnboardingComplete && (
                                <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                              )}
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              {driver.memberId || `D-${driver.id.slice(0,6).toUpperCase()}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className={`text-xs font-bold ${isOnline ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                        {statusDoc.lastActiveAt && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(statusDoc.lastActiveAt?.toDate?.() || statusDoc.lastActiveAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">{driver.vehicle || 'Not specified'}</p>
                        <p className="text-xs text-slate-500">{driver.vehicleType || 'Standard'}</p>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              {driver.rating?.toFixed(1) || 'N/A'}
                            </p>
                            <p className="text-[10px] text-slate-400">{driver.totalReviews || 0} reviews</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{driver.totalJobsDone || driver.totalRides || 0}</p>
                            <p className="text-[10px] text-slate-400">Rides</p>
                          </div>
                        </div>
                      </td>
                      
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggleDriverSuspension(driver.id, !!driver.isDisabled)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          driver.isDisabled 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                            : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                        }`}
                      >
                        {driver.isDisabled ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => deleteDriver(driver.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-red-600"
                        title="Delete Driver"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                    </motion.tr>
                  );
                })}
                
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Shield className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No drivers found matching criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
