import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { 
  Search, UserCircle, Shield, AlertTriangle, CheckCircle, 
  XOctagon, Clock, UserCheck, Star, Activity, MapPin, Trash
} from "lucide-react";
import { motion } from "framer-motion";

export default function RidersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Listen to users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Filter for riders (role rider/passenger, or homeowner from AnyTrader, or starts with R-)
      const riders = allUsers.filter(u => 
        u.role === "rider" || 
        u.role === "passenger" ||
        u.role === "homeowner" ||
        (u.memberId && u.memberId.startsWith("R-")) ||
        (!u.isDriver && u.role !== "driver" && u.role !== "tradesperson" && u.role !== "admin")
      );
      setUsers(riders);
      setLoading(false);
    });

    return () => {
      unsubUsers();
    };
  }, []);

  const toggleSuspension = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isDisabled: !currentStatus
      });
    } catch (err) {
      console.error("Failed to update suspension status", err);
    }
  };

  const deleteRider = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this rider account? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (err) {
      console.error("Failed to delete rider", err);
    }
  };

  const filteredRiders = users.filter(rider => {
    const searchLower = searchTerm.toLowerCase();
    return (
      rider.name?.toLowerCase().includes(searchLower) ||
      rider.email?.toLowerCase().includes(searchLower) ||
      rider.memberId?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-black" />
            Rider Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Review and manage the AnyRoller passenger fleet.</p>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search riders, emails..."
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
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Rider</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Activity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Ratings</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredRiders.map(rider => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={rider.id} 
                    className={`hover:bg-slate-50/50 transition-colors ${rider.isDisabled ? 'opacity-60 bg-red-50/30' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {rider.avatarUrl ? (
                          <img src={rider.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-black/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-black/5 flex items-center justify-center text-slate-400">
                            <UserCheck className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{rider.name || 'Anonymous User'}</p>
                            {rider.emailVerified && (
                              <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{rider.email}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
                            {rider.memberId || `R-${rider.id.slice(0,6).toUpperCase()}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-900">{rider.totalRides || 0} Total Rides</p>
                      {rider.lastActive && (
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last active: {new Date(rider.lastActive?.toDate?.() || rider.lastActive).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {rider.rating?.toFixed(1) || 'N/A'}
                      </div>
                      <p className="text-[10px] text-slate-400">{rider.totalReviews || 0} reviews</p>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleSuspension(rider.id, !!rider.isDisabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            rider.isDisabled 
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                              : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                          }`}
                        >
                          {rider.isDisabled ? 'Reactivate' : 'Suspend'}
                        </button>
                        <button
                          onClick={() => deleteRider(rider.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-red-600"
                          title="Delete Rider"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                
                {filteredRiders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Shield className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No riders found matching criteria.</p>
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

