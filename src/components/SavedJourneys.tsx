import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, doc, updateDoc, arrayRemove } from "@/src/firebase";
import { motion } from "motion/react";
import { Car, MapPin, Loader2, Bookmark, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SavedJourneys() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const savedJourneys = profile?.savedJourneys || [];

  const handleRemoveJourney = async (journey: any) => {
    if (!user) return;
    if (!window.confirm("Remove this saved journey?")) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        savedJourneys: arrayRemove(journey)
      });
    } catch (err) {
      console.error("Failed to remove journey:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookJourney = (journey: any) => {
    const params = new URLSearchParams();
    if (journey.pickup) params.set("pickup", journey.pickup);
    if (journey.dropoff) params.set("dropoff", journey.dropoff);
    navigate(`/book-ride?${params.toString()}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">Saved Journeys</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Book your regular trips instantly</p>
        </div>
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
          <Bookmark className="w-6 h-6" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {savedJourneys.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No saved journeys</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6 max-w-[250px] mx-auto">
              Save your frequent routes from the My Rides tab to quickly book them here.
            </p>
            <button
              onClick={() => navigate("/my-rides")}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-colors"
            >
              Go to My Rides
            </button>
          </div>
        ) : (
          savedJourneys.map((journey: any, idx: number) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={`${journey.pickup}-${journey.dropoff}-${idx}`}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-4 group"
            >
              <div className="space-y-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup</p>
                    <p className="text-sm font-bold text-slate-700 line-clamp-1">{journey.pickup}</p>
                  </div>
                </div>

                <div className="w-0.5 h-4 bg-slate-200 ml-[15px] -my-2" />

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dropoff</p>
                    <p className="text-sm font-bold text-slate-700 line-clamp-1">{journey.dropoff}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleRemoveJourney(journey)}
                  disabled={loading}
                  className="p-3 text-slate-400 bg-slate-50 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleBookJourney(journey)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  Book This Journey <ArrowRight className="w-4 h-4 opacity-70" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
