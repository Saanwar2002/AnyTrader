import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, arrayUnion, deleteDoc, serverTimestamp } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { Car, Clock, MapPin, ChevronRight, CheckCircle2, XCircle, Loader2, Edit2, Bookmark, Trash2, AlertCircle, Info, Calendar, User, FileText, X, ArrowDownToLine, HelpCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

export default function PassengerRideHistory() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "cancelled" | "completed">(
    location.state?.tab || "active"
  );

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);
  const [selectedRideDetails, setSelectedRideDetails] = useState<any | null>(null);

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
        cancelledBy: "passenger",
        updatedAt: serverTimestamp()
      });
      toast.success("Ride cancelled successfully");
      setActiveTab("cancelled");
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
      return ride.status !== "completed" && ride.status !== "cancelled" && ride.status !== "draft";
    }
    if (activeTab === "cancelled") {
      return ride.status === "cancelled" || ride.status === "draft";
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
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 group"
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
                    {(ride.status === "cancelled" || ride.status === "draft") && (
                      <div className="relative flex items-center justify-center">
                        {confirmDeleteId === ride.id && (
                          <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap bg-amber-400 text-slate-900 text-[11px] font-black tracking-tight py-1.5 px-3 rounded-xl shadow-lg z-10 pointer-events-none origin-bottom-right flex items-center gap-1.5 border border-amber-500/30">
                            <span className="text-[10px]">⚠️</span> Double tap to delete
                            <div className="absolute -bottom-1 right-3 w-2 h-2 bg-amber-400 rotate-45 border-r border-b border-amber-500/30" />
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
                  {ride.status === "completed" && (
                     <button
                       onClick={() => setSelectedRideDetails(ride)}
                       className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100"
                     >
                       <FileText className="w-4 h-4" />
                       Show job detail
                     </button>
                  )}
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

                {["accepted", "arrived", "in_progress"].includes(ride.status) && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => navigate(`/book-ride`)}
                      className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-[#0a1930] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      <MapPin className="w-4 h-4" />
                      Track Live Map
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
                      {confirmCancelId === ride.id ? "Confirm" : "Cancel"}
                    </button>
                  </div>
                )}
              </motion.div>
              )
            })
          )}
      </div>
      
      {/* Job Details Modal */}
      <AnimatePresence>
        {selectedRideDetails && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setSelectedRideDetails(null)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
             <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <div>
                   <h2 className="text-xl font-black text-slate-900">Job Details</h2>
                   <p className="text-xs font-bold text-slate-500 mt-1">{selectedRideDetails.createdAt?.toDate ? new Date(selectedRideDetails.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
                </div>
                <button onClick={() => setSelectedRideDetails(null)} className="p-2 bg-slate-200/50 hover:bg-slate-200 text-slate-500 rounded-full transition-colors active:scale-95">
                  <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="p-5 overflow-y-auto w-full max-h-[70vh]">
                {/* Route */}
                <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup</p>
                      <p className="text-sm font-bold text-slate-700">{selectedRideDetails.pickup}</p>
                    </div>
                  </div>

                  {selectedRideDetails.stops && selectedRideDetails.stops.length > 0 && selectedRideDetails.stops.map((stop: any, index: number) => (
                    <div key={index} className="relative">
                      <div className="absolute -top-4 left-4 w-0.5 h-4 bg-slate-200" />
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stop {index + 1}</p>
                          <p className="text-sm font-bold text-slate-700">{stop.address || stop.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="relative">
                     <div className="absolute -top-4 left-4 w-0.5 h-4 bg-slate-200" />
                     <div className="flex items-start gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                         <MapPin className="w-4 h-4 text-emerald-500" />
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dropoff</p>
                         <p className="text-sm font-bold text-slate-700">{selectedRideDetails.dropoff}</p>
                       </div>
                     </div>
                  </div>
                </div>
                
                {/* Driver & Vehicle */}
                <div className="mb-6 grid gap-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Driver & Vehicle</h3>
                  <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
                     <div className="flex items-center gap-3">
                       <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedRideDetails.driverName || 'Driver')}`} alt={selectedRideDetails.driverName} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                       <div>
                         <p className="text-sm font-bold text-slate-900">{selectedRideDetails.driverName || 'Unknown Driver'}</p>
                         <p className="text-xs font-semibold text-slate-500">{selectedRideDetails.vehicleInfo || 'Vehicle Unknown'}</p>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="bg-yellow-100 text-yellow-800 font-mono text-xs font-bold px-2 py-1 rounded-md border border-yellow-200 shadow-sm uppercase tracking-wider">
                         {selectedRideDetails.vehiclePlate || 'UNKNOWN'}
                       </div>
                     </div>
                  </div>
                </div>
                
                {/* Trip Stats & Receipt */}
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center mb-6">
                  <p className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">Total Paid</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                    £{parseFloat(selectedRideDetails.finalFare || selectedRideDetails.fareEstimate || selectedRideDetails.price || 0).toFixed(2)}
                  </h2>
                  <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">Payment Successful</p>
                </div>

                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 border-b border-slate-100 pb-2">Receipt Breakdown</p>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm font-bold text-slate-500">
                    <span>Base Fare & Distance</span>
                    <span className="text-slate-900">£{((selectedRideDetails.finalFare || selectedRideDetails.fareEstimate || selectedRideDetails.price || 5) - (selectedRideDetails.tipAmount || 0) - (selectedRideDetails.cancellationFee || 0)).toFixed(2)}</span>
                  </div>
                  {(selectedRideDetails.cancellationFee || 0) > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-500">
                      <span>Unpaid Cancellation Fee</span>
                      <span>+£{selectedRideDetails.cancellationFee.toFixed(2)}</span>
                    </div>
                  )}
                  {(selectedRideDetails.tipAmount || 0) > 0 && (
                    <div className="flex justify-between text-sm font-bold text-emerald-600">
                      <span>Driver Tip</span>
                      <span>+£{selectedRideDetails.tipAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Support Actions */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button onClick={() => toast.success("Receipt sent to your email!")} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-colors">
                    <ArrowDownToLine className="w-5 h-5 mb-1.5 text-slate-400" />
                    <span className="text-xs font-bold">Get Receipt</span>
                  </button>
                  <button onClick={() => toast.info("Opening support chat...")} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-colors">
                    <HelpCircle className="w-5 h-5 mb-1.5 text-blue-400" />
                    <span className="text-xs font-bold">Report Issue</span>
                  </button>
                </div>
             </div>
             <div className="p-4 border-t border-slate-100 bg-white">
                <button onClick={() => setSelectedRideDetails(null)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold active:scale-95 transition-transform">Close</button>
             </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
