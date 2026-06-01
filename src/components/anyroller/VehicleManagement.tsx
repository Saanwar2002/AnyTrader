import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { 
  Search, Car, Shield, AlertTriangle, CheckCircle, 
  X, UserCheck, Star, Activity, Info, Dog
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { id: 'standard', name: 'Standard', icon: Car, desc: 'Everyday rides (4 seats)' },
  { id: 'executive', name: 'Executive', icon: Shield, desc: 'Premium vehicles for business' },
  { id: 'luxury', name: 'Luxury', icon: Star, desc: 'High-end luxury vehicles' },
  { id: '6seater', name: '6-Seater', icon: UserCheck, desc: 'Large capacity vehicles' },
  { id: '8seater', name: '8-Seater', icon: UserCheck, desc: 'Extra large capacity vehicles' },
  { id: 'wav', name: 'WAV', icon: Activity, desc: 'Fully accessible vehicles' },
];

export default function VehicleManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pending">("all");
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>("all");
  
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Filter for drivers
      const drivers = allUsers.filter(u => 
        u.role === "driver" || 
        (u.memberId && u.memberId.startsWith("D-")) || 
        u.isDriver
      );
      setUsers(drivers);
      setLoading(false);
    });

    return () => unsubUsers();
  }, []);

  const changeFilterMode = (mode: "all" | "pending") => {
    setFilterMode(mode);
    setSelectedCatFilter("all");
  };

  const handleSaveCategories = async (driverId: string, updatedCategories: string[], clearRequested: string[], isPetFriendly: boolean) => {
    setIsSaving(true);
    try {
      const driver = users.find(u => u.id === driverId);
      const originalRequested = driver?.requestedVehicleCategories || [];
      const newRequested = originalRequested.filter((c: string) => !clearRequested.includes(c));

      await updateDoc(doc(db, "users", driverId), {
        vehicleCategories: updatedCategories,
        requestedVehicleCategories: newRequested,
        isPetFriendly: isPetFriendly
      });
      setSelectedDriver(null);
    } catch (err) {
      console.error("Failed to update vehicle details", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryCount = (catId: string) => {
    const baseDrivers = users.filter(driver => {
      if (filterMode === "pending") {
        return driver.requestedVehicleCategories && driver.requestedVehicleCategories.length > 0;
      }
      return true;
    });

    if (catId === "all") return baseDrivers.length;
    if (catId === "pet_friendly") return baseDrivers.filter(u => u.isPetFriendly).length;
    return baseDrivers.filter(driver => {
      if (filterMode === "pending") {
        const requested = driver.requestedVehicleCategories || [];
        return requested.includes(catId);
      } else {
        const driverCats = driver.vehicleCategories || [driver.vehicleCategory || "standard"];
        return driverCats.includes(catId);
      }
    }).length;
  };

  const filteredDrivers = users.filter(driver => {
    const searchLower = searchTerm.toLowerCase();
    const hasPending = driver.requestedVehicleCategories && driver.requestedVehicleCategories.length > 0;
    
    if (filterMode === "pending" && !hasPending) return false;

    if (selectedCatFilter !== "all") {
      if (selectedCatFilter === "pet_friendly") {
        if (!driver.isPetFriendly) return false;
      } else {
        if (filterMode === "pending") {
          const requested = driver.requestedVehicleCategories || [];
          if (!requested.includes(selectedCatFilter)) return false;
        } else {
          const driverCats = driver.vehicleCategories || [driver.vehicleCategory || "standard"];
          if (!driverCats.includes(selectedCatFilter)) return false;
        }
      }
    }

    return (
      driver.name?.toLowerCase().includes(searchLower) ||
      driver.email?.toLowerCase().includes(searchLower) ||
      driver.vehicle?.toLowerCase().includes(searchLower) ||
      driver.vehicleRegistration?.toLowerCase().includes(searchLower) ||
      driver.plate?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Car className="w-8 h-8 text-black" />
            Vehicle Approvals & Classes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Assign transport classes (Executive, Luxury) to driver vehicles.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-black/5">
            <button
              onClick={() => changeFilterMode("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === "all" ? "bg-white text-slate-900 shadow-sm border border-black/10" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Vehicles
            </button>
            <button
              onClick={() => changeFilterMode("pending")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                filterMode === "pending" ? "bg-white text-amber-700 shadow-sm border border-black/10" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Pending Approvals
              {users.filter(u => u.requestedVehicleCategories?.length > 0).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search make, model, plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 w-full sm:w-64 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Category Pills Row with Total Numbers */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1 pt-1">
        <button
          onClick={() => setSelectedCatFilter("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-[10px] uppercase tracking-tight rounded-lg transition-all border shrink-0 ${
            selectedCatFilter === "all"
              ? "bg-black text-white border-black"
              : "bg-white text-black border-black hover:bg-slate-50"
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          ALL ({getCategoryCount("all")})
        </button>

        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = getCategoryCount(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-[10px] uppercase tracking-tight rounded-lg transition-all border shrink-0 ${
                selectedCatFilter === cat.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-black border-black hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.name} ({count})
            </button>
          );
        })}

        <button
          onClick={() => setSelectedCatFilter("pet_friendly")}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-[10px] uppercase tracking-tight rounded-lg transition-all border shrink-0 ${
            selectedCatFilter === "pet_friendly"
              ? "bg-black text-white border-black"
              : "bg-white text-black border-black hover:bg-slate-50"
          }`}
        >
          <Dog className="w-3.5 h-3.5 text-emerald-600" />
          Pet Friendly ({getCategoryCount("pet_friendly")})
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Activity className="w-8 h-8 text-black animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-black/10">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Driver</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Vehicle Details</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Approved Classes</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Pet Friendly</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredDrivers.map(driver => {
                  const hasPending = driver.requestedVehicleCategories && driver.requestedVehicleCategories.length > 0;
                  const categories = driver.vehicleCategories || [driver.vehicleCategory || "standard"];

                  return (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={driver.id} 
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {driver.avatarUrl ? (
                            <img src={driver.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-black" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-black flex items-center justify-center text-slate-400">
                              <UserCheck className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{driver.name}</p>
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              {driver.memberId || `D-${driver.id.slice(0,6).toUpperCase()}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{driver.vehicle || 'Not Specified'}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 tracking-widest uppercase font-bold bg-slate-100 inline-block px-2 py-0.5 rounded border border-black/10">
                          {driver.vehicleRegistration || driver.plate || 'NO PLATE'}
                        </p>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {categories.map((c: string, idx: number) => {
                            const catInfo = CATEGORIES.find(cat => cat.id === c);
                            return (
                              <span key={`${c}-${idx}`} className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                                {catInfo?.name || c}
                              </span>
                            );
                          })}
                        </div>
                        {hasPending && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded inline-flex uppercase">
                            <AlertTriangle className="w-3 h-3" />
                            Pending Requests
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {driver.isPetFriendly ? (
                          <span className="text-[10px] font-black px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md inline-flex items-center gap-1 uppercase">
                            <Dog className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Pet Friendly
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-1 bg-slate-50 text-slate-400 border border-slate-200 rounded-md inline-flex items-center gap-1 uppercase">
                            No
                          </span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedDriver(driver)}
                          className="px-4 py-2 border border-black rounded-lg text-xs font-bold transition-all bg-white hover:bg-slate-50 relative overflow-hidden"
                        >
                          {hasPending && (
                            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                          )}
                          Manage Classes
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
                
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Car className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No vehicles found matching criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Management Modal */}
      <AnimatePresence>
        {selectedDriver && (
          <VehicleClassModal 
            driver={selectedDriver}
            onClose={() => setSelectedDriver(null)}
            onSave={handleSaveCategories}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VehicleClassModal({ driver, onClose, onSave, isSaving }: { driver: any, onClose: () => void, onSave: (driverId: string, updatedCategories: string[], clearRequested: string[], isPetFriendly: boolean) => void, isSaving: boolean }) {
  const currentCats = driver.vehicleCategories || [driver.vehicleCategory || "standard"];
  const pendingCats = driver.requestedVehicleCategories || [];
  
  const [localCategories, setLocalCategories] = useState<string[]>(currentCats);
  const [localPetFriendly, setLocalPetFriendly] = useState<boolean>(!!driver.isPetFriendly);

  const toggleCategory = (catId: string) => {
    if (localCategories.includes(catId)) {
      setLocalCategories(localCategories.filter(c => c !== catId));
    } else {
      setLocalCategories([...localCategories, catId]);
    }
  };

  const handleSave = () => {
    onSave(driver.id, localCategories, pendingCats, localPetFriendly);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-black/20"
      >
        <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-900">Manage Vehicle Classes</h2>
            <p className="text-xs text-slate-500 font-medium">Approve or revoke categories for this driver</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="flex bg-slate-50 rounded-2xl p-4 border border-black/5 items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white rounded-xl border border-black/10 flex items-center justify-center shadow-sm">
              <Car className="w-8 h-8 text-black/50" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{driver.vehicle || 'Unknown Vehicle'}</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                {driver.vehicleRegistration || driver.plate || 'NO PLATE'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Driver: {driver.name}</p>
            </div>
          </div>

          {/* Pet Friendly Selection Card */}
          <div className="mb-6">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 mb-2">Pet Settings</h4>
            <div 
              onClick={() => setLocalPetFriendly(!localPetFriendly)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left relative overflow-hidden cursor-pointer ${
                localPetFriendly 
                  ? 'border-emerald-500 bg-emerald-50/30' 
                  : 'border-black/10 bg-white hover:border-black/30'
              }`}
            >
              <div className={`p-2 rounded-lg border flex-shrink-0 ${localPetFriendly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-black/10'}`}>
                <Dog className="w-5 h-5" />
              </div>
              <div className="pr-12">
                <p className={`font-bold ${localPetFriendly ? 'text-emerald-900' : 'text-slate-700'}`}>Allow Pet Friendly Jobs</p>
                <p className="text-xs text-slate-500 mt-0.5">Allow this vehicle to accept passengers traveling with pets (+£3 fare bonus)</p>
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 right-4">
                <div className={`w-10 h-6 rounded-full transition-colors relative shadow-inner shrink-0 ${localPetFriendly ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${localPetFriendly ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Available Classes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const isSelected = localCategories.includes(cat.id);
                const isPending = pendingCats.includes(cat.id);
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                      isSelected 
                        ? 'border-black bg-slate-50 shadow-[inset_0_0_0_1px_rgba(0,0,0,1)]' 
                        : 'border-black/10 bg-white hover:border-black/30'
                    }`}
                  >
                    <div className={`p-2 rounded-lg border flex-shrink-0 ${isSelected ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-400 border-black/10'}`}>
                      <cat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-bold ${isSelected ? 'text-black' : 'text-slate-700'}`}>{cat.name}</p>
                        {isPending && !isSelected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase bg-amber-100 text-amber-700">Requested</span>
                        )}
                        {isPending && isSelected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase bg-emerald-100 text-emerald-700">Approved</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 pr-4">{cat.desc}</p>
                    </div>
                    
                    <div className="absolute top-4 right-4">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-black border-black' : 'border-black/30 bg-white'
                      }`}>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-xs font-medium">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Executive and Luxury vehicles require higher standards of maintenance, interior quality, and year of manufacture. 
              Only approve these requests if the vehicle meets the strict AnyRoller premium guidelines.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-black/10 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-black text-white hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? <Activity className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Save & Update Details
          </button>
        </div>
      </motion.div>
    </div>
  );
}
