import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { Clock, Car, ChevronRight, History, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";

export default function ActivityTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "ride_requests"),
      where("riderId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const completedRides = rides.filter(r => r.status === "completed");

  return (
    <div className="flex-1 bg-surface overflow-y-auto pb-24 min-h-0">
      <div className="p-6">
        <h1 className="text-2xl font-black text-text-main mb-6">Activity</h1>
        
        {loading ? (
          <div className="text-center text-text-muted">Loading your rides...</div>
        ) : (
          <div className="space-y-4">
            {completedRides.length > 0 ? (
              completedRides.map((ride) => (
                <button 
                  key={ride.id} 
                  onClick={() => setSelectedRide(ride)}
                  className="w-full bg-card p-5 rounded-3xl border border-border-main shadow-sm flex items-center justify-between group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center text-text-muted">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text-main">
                        {ride.dropoff?.split(',')[0] || "Destination"}
                      </h4>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                        {new Date(ride.createdAt?.seconds * 1000).toLocaleDateString()} • £{ride.fareEstimate?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary" />
                </button>
              ))
            ) : (
              <div className="text-center py-12 text-text-muted">No past rides found.</div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRide && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setSelectedRide(null)}
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="bg-card rounded-3xl p-6 w-full max-w-sm space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-text-main">Receipt</h3>
                <button onClick={() => setSelectedRide(null)} className="p-2 bg-surface rounded-full hover:bg-border-main text-text-main"><X className="w-4 h-4"/></button>
              </div>
              
              <div className="space-y-3 font-bold text-sm text-text-main">
                <div className="flex justify-between text-text-muted"><span>Base fare</span><span>£2.50</span></div>
                <div className="flex justify-between text-text-muted"><span>Distance</span><span>£{(selectedRide.fareEstimate * 0.7).toFixed(2)}</span></div>
                <div className="flex justify-between text-text-muted"><span>Time</span><span>£{(selectedRide.fareEstimate * 0.3).toFixed(2)}</span></div>
                <div className="border-t border-border-main pt-3 mt-3 flex justify-between font-black text-text-main text-lg"><span>Total</span><span>£{selectedRide.fareEstimate?.toFixed(2)}</span></div>
              </div>
              
              <button 
                onClick={() => {
                  navigate(`/book-ride?pickup=${encodeURIComponent(selectedRide.pickup)}&dropoff=${encodeURIComponent(selectedRide.dropoff)}`);
                  setSelectedRide(null);
                }}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-colors mt-6 shadow-lg shadow-primary/20"
              >
                Rebook this route
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
