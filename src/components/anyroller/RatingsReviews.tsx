import React, { useState, useEffect } from "react";
import { 
  Star, 
  MapPin, 
  ShieldAlert, 
  Calendar, 
  User, 
  Clock, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  Settings,
  AlertOctagon,
  Award
} from "lucide-react";
import { toast } from "sonner";

interface ClientReview {
  id: string;
  driverName: string;
  riderName: string;
  starsCount: number;
  comments: string;
  coolingOffDaysLeft: number; // 0 means active public, >0 means cooling off
  fuzzingApplied: boolean;
  status: "cooling_off_lock" | "fuzzed_live" | "public_verified";
}

const initialReviewsSeed: ClientReview[] = [
  { id: "rev_1001", driverName: "Benjamin Taylor", riderName: "S. Connor (Anonymous)", starsCount: 5, comments: "Outstanding commute. Vehicle was pristine clean, fast charger available on demand.", coolingOffDaysLeft: 0, fuzzingApplied: false, status: "public_verified" },
  { id: "rev_1002", driverName: "Sienna Williams", riderName: "D. Jenkins", starsCount: 2, comments: "Re-routed through crowded backstreets. Extremely delayed arrival.", coolingOffDaysLeft: 12, fuzzingApplied: true, status: "cooling_off_lock" },
  { id: "rev_1003", driverName: "Marcus Sterling", riderName: "C. Henderson (Anonymous)", starsCount: 1, comments: "Extremely reckless breaking near central crossings. Driver seemed highly distracted.", coolingOffDaysLeft: 14, fuzzingApplied: true, status: "cooling_off_lock" }
];

export default function RatingsReviews() {
  const [reviews, setReviews] = useState<ClientReview[]>(initialReviewsSeed);
  const [coolingOffFilter, setCoolingOffFilter] = useState(false);

  const handleBypassCoolingOff = (id: string) => {
    setReviews(prev => prev.map(r => {
      if (r.id === id) {
        toast.success(`Cooling-off bypass: review released to driver dashboard.`);
        return { ...r, coolingOffDaysLeft: 0, status: "public_verified" };
      }
      return r;
    }));
  };

  const handleEscalateIncident = (id: string) => {
    toast.success(`Escalated ride incident safety ticket associated with review ${id}.`);
  };

  const filteredReviews = reviews.filter(r => 
    coolingOffFilter ? r.coolingOffDaysLeft > 0 : true
  );

  return (
    <div className="space-y-6">
      {/* HUD Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">TRUST & FAIRNESS REVIEWS MODULE</span>
          </div>
          <h2 className="text-xl font-bold text-black font-sans">Ratings, Reviews & Cooling-Off Locks</h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse public verified ratings logs, monitor 14-day cooling-off locks on low scores, and manage ratings fuzzing indices.
          </p>
        </div>

        {/* Dynamic Trust Flag Badge */}
        <div className="p-3 bg-indigo-50/75 border border-indigo-200 text-indigo-900 rounded font-mono text-[10px] max-w-sm flex items-start gap-2 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <strong className="text-black block">Equal Opportunity Core</strong>
            Low scores (2 stars or below) undergo a mandatory 14-day hold to protect drivers from targeted retaliatory feedback.
          </div>
        </div>
      </div>

      <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1">
            <Award className="w-4 h-4 text-emerald-555" /> Feedback Archives
          </h3>

          <button
            onClick={() => setCoolingOffFilter(!coolingOffFilter)}
            className={`px-3 py-1 text-xs font-mono font-bold border rounded transition cursor-pointer select-none ${
              coolingOffFilter 
                ? "bg-amber-50 text-amber-800 border-amber-350" 
                : "bg-white text-slate-705 border-black hover:bg-slate-55"
            }`}
          >
            {coolingOffFilter ? "Displaying Holds only" : "Filter Under Hold Records"}
          </button>
        </div>

        <div className="space-y-4">
          {filteredReviews.map(rev => (
            <div key={rev.id} className="p-4 bg-slate-50 border border-black rounded font-sans space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  
                  {/* Rating Stars */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-black text-[#AF52DE]">{rev.id}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${
                            i < rev.starsCount 
                              ? "text-amber-400 fill-amber-400" 
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                    </div>

                    <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded ${
                      rev.status === 'public_verified'
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-305"
                        : "bg-amber-50 text-amber-800 border border-amber-305 animate-pulse"
                    }`}>
                      {rev.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-xs text-black font-medium leading-relaxed font-sans mt-2">
                    "{rev.comments}"
                  </p>
                </div>

                {/* Clock indicator */}
                {rev.coolingOffDaysLeft > 0 && (
                  <div className="flex items-center gap-1 text-[10.5px] font-mono text-amber-800 bg-amber-50 border border-amber-200 p-1 px-2.5 rounded shrink-0">
                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span>Cooling-off Hold: {rev.coolingOffDaysLeft} days left</span>
                  </div>
                )}
              </div>

              {/* Associations */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-105 text-xs text-slate-500 font-mono">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>Rider: <strong className="text-black font-black">{rev.riderName}</strong></span>
                  <span>Target Driver: <strong className="text-black font-bold">{rev.driverName}</strong></span>
                  {rev.fuzzingApplied && (
                    <span className="text-indigo-850 font-bold bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                      Anonymity Fuzz Active
                    </span>
                  )}
                </div>

                {rev.coolingOffDaysLeft > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBypassCoolingOff(rev.id)}
                      className="px-2.5 py-1 text-[10px] uppercase font-mono font-bold bg-white text-stone-750 hover:bg-slate-50 border border-black rounded transition cursor-pointer select-none"
                    >
                      Bypass lock
                    </button>
                    <button
                      onClick={() => handleEscalateIncident(rev.id)}
                      className="px-2.5 py-1 text-[10px] uppercase font-mono font-bold bg-black hover:bg-slate-900 border border-black text-white rounded transition cursor-pointer select-none"
                    >
                      Escalate Team
                    </button>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
