import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, UserCircle, Star, Calendar, MessageSquare, CheckCircle } from "lucide-react";
import { db, collection, query, where, getDocs, addDoc, serverTimestamp } from "@/src/firebase";
import { getProMatches } from "@/src/services/gemini";

export function ProMatchmakerModal({ role, projectId, onClose }: { role: any, projectId: string, onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    async function findMatches() {
      try {
        setLoading(true);
        // Step 1: Fetch candidate professionals from Firebase
        // Public profiles provide non-PII directory information
        const profilesRef = collection(db, "public_profiles");
        const snapshot = await getDocs(profilesRef);
        
        let candidatePros = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        // Filter out those lacking meaningful data to avoid wasting tokens
        candidatePros = candidatePros.filter(p => p.businessName || p.fullName);

        // Schedule Availability Check (Phase D2)
        if (role.requiredDate) {
          const reqDateStr = role.requiredDate; // e.g. "2026-05-20"
          const eventsSnapshot = await getDocs(collection(db, "calendarEvents"));
          const events = eventsSnapshot.docs.map(d => d.data());
          // Map of consultantId to number of events on that day
          const busyPros = events.filter(e => e.startTime && e.startTime.startsWith(reqDateStr)).map(e => e.consultantId);
          // Filter candidate pros heavily booked (e.g. > 1 event, or any event)
          // For simplicity, if they have an event on that exact date, they are "busy"
          candidatePros = candidatePros.filter(p => !busyPros.includes(p.id));
        }

        if (candidatePros.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }

        // Prepare context for Gemini
        const candidatesContext = candidatePros.map(p => ({
          id: p.id,
          name: p.businessName || p.fullName,
          category: p.businessCategory || "General",
          rating: p.averageRating || 4.5,
          location: p.city || p.location || "Unknown"
        }));

        // Step 2: Use Gemini to identify top matches based on the required role
        const aiMatches = await getProMatches(role, candidatesContext);

        // Merge AI results with candidate data
        const enrichedMatches = aiMatches.map((m: any) => {
          const proObj = candidatePros.find(p => p.id === m.id);
          return {
            ...proObj,
            matchScore: m.matchScore,
            reason: m.reason
          };
        }).sort((a: any, b: any) => b.matchScore - a.matchScore);

        setMatches(enrichedMatches);
      } catch (err) {
        console.error("Matchmaker Error:", err);
      } finally {
        setLoading(false);
      }
    }

    findMatches();
  }, [role]);

  const handleShortlist = async (matchId: string) => {
    try {
      await addDoc(collection(db, "projectShortlists"), {
        projectId,
        roleId: role.id,
        consultantId: matchId,
        createdAt: serverTimestamp()
      });
      alert("Pro added to project shortlist!");
    } catch (err) {
      console.error(err);
      alert("Failed to shortlist.");
    }
  };

  const handleBroadcast = async (matchId: string) => {
    try {
      await addDoc(collection(db, "projectBids"), {
        projectId: projectId,
        projectRoleId: role.id,
        consultantId: matchId,
        amount: role.estimatedBudget, // Initial budget offer
        message: "You have been invited to bid for this role.",
        status: "pending",
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "notifications"), {
        userId: matchId,
        title: "New Project Invitation",
        message: `You've been invited to bid on the role: ${role.roleName}`,
        type: "system",
        read: false,
        createdAt: serverTimestamp(),
        visibleAt: serverTimestamp() // Instant visibility
      });

      alert("Invitation to bid sent successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to send invitation.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-black/10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-6 border-b border-black/10 flex items-center justify-between bg-indigo-50/50">
          <div>
            <h2 className="text-xl font-black text-black flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              AI Matchmaker
            </h2>
            <p className="text-sm text-black/60 mt-1 font-medium">Finding Pros for: <span className="font-bold text-black">{role.roleName}</span> (Budget: £{role.estimatedBudget})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <Sparkles className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-black">Scanning the Network...</p>
                <p className="text-xs text-black/60">Analyzing skills, availability, and budgets</p>
              </div>
            </div>
          ) : matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((m, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={m.id} 
                  className="bg-white p-5 rounded-2xl border border-black/10 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      {m.profileImage ? (
                        <img src={m.profileImage} alt={m.businessName} className="w-12 h-12 rounded-full object-cover border border-black/10" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-black/10">
                          <UserCircle className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                      
                      <div>
                        <h3 className="font-bold text-black text-lg leading-tight">{m.businessName || m.fullName}</h3>
                        <p className="text-xs text-indigo-600 font-black uppercase tracking-wider">{m.businessCategory || 'Professional'}</p>
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-black/60 font-medium">
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            {m.averageRating ? m.averageRating.toFixed(1) : "New"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            Available
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        {m.matchScore}% Match
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-black/70 italic border border-black/5">
                    " {m.reason} "
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleShortlist(m.id)}
                      className="flex-1 py-2 bg-white text-black font-bold text-sm rounded-xl border border-white/20 hover:bg-black/5 transition"
                    >
                      Shortlist
                    </button>
                    <button 
                      onClick={() => handleBroadcast(m.id)}
                      className="flex-1 py-2 bg-black text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition"
                    >
                      Invite to Bid
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-black">No Exact Matches found</h3>
              <p className="text-sm text-black/60 mt-1 max-w-md mx-auto">We couldn't immediately pinpoint highly rated professionals within that specific budget range and role constraint. Try inviting users directly or increasing the budget.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
