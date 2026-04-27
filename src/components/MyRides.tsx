import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, arrayUnion, deleteDoc, serverTimestamp } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion } from "motion/react";
import { Car, Clock, MapPin, ChevronRight, CheckCircle2, XCircle, Loader2, Edit2, Bookmark, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function MyRides() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "cancelled" | "completed">("active");

  const handleSaveJourney = async (ride: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        regularJourneys: arrayUnion({
          from: ride.pickup,
          to: ride.dropoff
        })
      });
      toast.success("Journey saved to regulars!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save journey");
    }
  };

  const handleCancelRide = async (rideId: string) => {
    setCancellingId(rideId);
    try {
      await updateDoc(doc(db, "ride_requests", rideId), {
        status: "cancelled",
        updatedAt: serverTimestamp()
      });
      toast.success("Ride cancelled successfully");
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast.error("Failed to cancel ride. Please try again.");
    } finally {
      setCancellingId(null);
      setConfirmCancelId(null);
    }
  };

  const handleDeleteRide = async (rideId: string) => {
    setDeletingId(rideId);
    try {
      await deleteDoc(doc(db, "ride_requests", rideId));
      toast.success("Ride deleted successfully");
    } catch (error) {
      console.error("Error deleting ride:", error);
      toast.error("Failed to delete ride. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "ride_requests"),
      where("riderId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRides(ridesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching rides:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading your rides...</p>
      </div>
    );
  }

  const filteredRides = rides.filter(ride => {
    if (activeTab === "active") {
      return ride.status !== "completed" && ride.status !== "cancelled";
    }
    return ride.status === activeTab;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-6 border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">My Rides</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">View your ride history and receipts</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Car className="w-6 h-6" />
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
                activeTab === "active" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab("cancelled")}
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
                activeTab === "cancelled" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              Cancelled
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
                activeTab === "completed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {filteredRides.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No {activeTab} rides yet</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6 max-w-[250px] mx-auto">
              When you have {activeTab} rides, they will appear here.
            </p>
          </div>
        ) : (
            filteredRides.map((ride, idx) => {
              const isSaved = profile?.regularJourneys?.some((j: any) => j.from === ride.pickup && j.to === ride.dropoff);
              
              return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={ride.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-4 group"
              >
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                      ride.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      ride.status === "cancelled" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    )}>
                      {ride.status}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {ride.createdAt?.toDate ? new Date(ride.createdAt.toDate()).toLocaleDateString() : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {ride.price && (
                      <span className="font-extrabold text-slate-900">£{parseFloat(ride.price).toFixed(2)}</span>
                    )}
                    {ride.status === "cancelled" && (
                      <div className="relative flex items-center justify-center">
                        {confirmDeleteId === ride.id && (
                          <div className="absolute bottom-full mb-2 right-1/2 translate-x-1/2 md:translate-x-0 md:right-0 md:left-auto whitespace-nowrap bg-amber-400 text-slate-900 text-[11px] font-black tracking-tight py-1.5 px-3 rounded-xl shadow-lg z-10 pointer-events-none origin-bottom flex items-center gap-1.5 border border-amber-500/30">
                            <span className="text-[10px]">⚠️</span> Double tap to delete
                            <div className="absolute -bottom-1 right-1/2 translate-x-1/2 md:translate-x-0 md:right-3 w-2 h-2 bg-amber-400 rotate-45 border-r border-b border-amber-500/30" />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirmDeleteId === ride.id) {
                              handleDeleteRide(ride.id);
                            } else {
                              setConfirmDeleteId(ride.id);
                              // reset confirm state after 2.5 sec
                              setTimeout(() => setConfirmDeleteId(null), 2500);
                            }
                          }}
                          disabled={deletingId === ride.id}
                          className={cn(
                            "p-1.5 rounded-full transition-colors flex items-center justify-center",
                            confirmDeleteId === ride.id ? "bg-red-100 text-red-600 shadow-sm" : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                          )}
                        >
                          {deletingId === ride.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup</p>
                      <p className="text-sm font-bold text-slate-700 line-clamp-1">{ride.pickup}</p>
                    </div>
                  </div>

                  <div className="w-0.5 h-4 bg-slate-200 ml-[15px] -my-2" />

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dropoff</p>
                      <p className="text-sm font-bold text-slate-700 line-clamp-1">
                        {ride.rideType === "hourly" ? `${ride.duration}h Hourly Ride` : ride.dropoff}
                      </p>
                    </div>
                  </div>
                </div>
                
                {ride.driverName && (
                  <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
                     <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(ride.driverName)}`} alt={ride.driverName} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                     <div>
                       <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Driver</p>
                       <p className="text-xs font-bold text-slate-700">{ride.driverName}</p>
                     </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleSaveJourney(ride)}
                    disabled={isSaved}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors",
                      isSaved ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    )}
                  >
                    <Bookmark className="w-4 h-4" />
                    {isSaved ? "Saved to Regulars" : "Save as Regular"}
                  </button>
                </div>
                
                {ride.status === "pending" && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => navigate(`/book-ride?edit=${ride.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirmCancelId === ride.id) {
                          handleCancelRide(ride.id);
                        } else {
                          setConfirmCancelId(ride.id);
                          setTimeout(() => setConfirmCancelId(null), 3000);
                        }
                      }}
                      disabled={cancellingId === ride.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {cancellingId === ride.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : confirmCancelId === ride.id ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {confirmCancelId === ride.id ? "Confirm Cancel" : "Cancel"}
                    </button>
                  </div>
                )}
              </motion.div>
              )
            })
          )}
      </div>
    </div>
  );
}
