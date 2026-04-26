import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { db, doc, updateDoc, arrayRemove } from "@/src/firebase";
import { motion } from "motion/react";
import { MapPin, Bookmark, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SavedJourneys() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const savedJourneys = profile?.regularJourneys || [];

  const handleRemoveJourney = async (journey: any) => {
    if (!user) return;
    if (!window.confirm("Remove this saved journey?")) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        regularJourneys: arrayRemove(journey)
      });
    } catch (err) {
      console.error("Failed to remove journey:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookJourney = (journey: any, reverse = false) => {
    const params = new URLSearchParams();
    if (reverse) {
      if (journey.to) params.set("pickup", journey.to);
      if (journey.from) params.set("dropoff", journey.from);
    } else {
      if (journey.from) params.set("pickup", journey.from);
      if (journey.to) params.set("dropoff", journey.to);
    }
    navigate(`/book-ride?${params.toString()}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface pb-24 min-h-0">
      {/* Header */}
      <div className="bg-card px-4 py-6 border-b border-border-main flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text-main leading-tight">Saved Journeys</h1>
          <p className="text-text-muted font-medium text-sm mt-1">Book your regular trips instantly</p>
        </div>
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
          <Bookmark className="w-6 h-6" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {savedJourneys.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border-main shadow-sm">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-bold text-text-main">No saved journeys</h3>
            <p className="text-sm text-text-muted mt-1 mb-6 max-w-[250px] mx-auto">
              Save your frequent routes from the My Rides tab to quickly book them here.
            </p>
            <button
              onClick={() => navigate("/my-rides")}
              className="bg-text-main text-surface px-6 py-3 rounded-2xl font-black text-sm hover:opacity-90 transition-colors"
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
              key={`${journey.from}-${journey.to}-${idx}`}
              className="bg-card rounded-3xl border border-border-main shadow-sm overflow-hidden p-4 group"
            >
              <div className="space-y-4 mb-4">
                {journey.name && (
                  <h3 className="text-sm font-black text-slate-800">{journey.name}</h3>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface border border-border-main flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Pickup</p>
                    <p className="text-sm font-bold text-text-main line-clamp-1">{journey.from}</p>
                  </div>
                </div>

                <div className="w-0.5 h-4 bg-border-main ml-[15px] -my-2" />

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface border border-border-main flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-trust" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Dropoff</p>
                    <p className="text-sm font-bold text-text-main line-clamp-1">{journey.to}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-main">
                <button
                  onClick={() => handleRemoveJourney(journey)}
                  disabled={loading}
                  className="p-3 text-text-muted bg-surface rounded-xl hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex w-full gap-2 hidden group-hover:flex">
                  <button
                    onClick={() => handleBookJourney(journey, false)}
                    className="flex-1 flex items-center justify-center gap-1 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors"
                  >
                    Go
                  </button>
                  <button
                    onClick={() => handleBookJourney(journey, true)}
                    className="flex-1 flex items-center justify-center gap-1 py-3 bg-orange-50 text-orange-700 rounded-xl font-bold text-xs hover:bg-orange-100 transition-colors"
                  >
                    Return
                  </button>
                </div>
                <button
                  onClick={() => handleBookJourney(journey, false)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 group-hover:hidden"
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
