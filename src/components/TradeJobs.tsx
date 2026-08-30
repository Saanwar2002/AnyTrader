import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { Briefcase, Clock, MapPin, Loader2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, getOutwardPostcode, formatJobLocation } from "@/src/lib/utils";

export default function TradeJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "jobs"),
      where("acceptedTradespersonId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((job: any) => !job.clientDeleted);
      
      setJobs(jobsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching jobs:", error);
      handleFirestoreError(error, OperationType.LIST, "jobs");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const displayJobs = jobs.filter(job => {
    if (filter === "all") return true;
    if (filter === "active") return job.status === "in_progress" || job.status === "accepted";
    if (filter === "completed") return job.status === "completed";
    return true;
  });

  const formatRelativeTime = (date: any) => {
    if (!date) return "Just now";
    const now = new Date();
    const jobDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    const diffInMs = now.getTime() - jobDate.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMins < 1) return "Just now";
    if (diffInMins < 60) return `${diffInMins}m ago`;
    
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return jobDate.toLocaleDateString('en-GB');
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900">
          My Trade Jobs
        </h1>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: "all", label: "All" },
          { id: "active", label: "Active" },
          { id: "completed", label: "Completed" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shrink-0 border",
              filter === tab.id 
                ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                : "bg-white text-slate-500 border-black hover:border-black"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {displayJobs.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-black text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <Briefcase className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">
              {filter === "completed"
                ? "No completed jobs"
                : filter === "active" ? "No active jobs" : "No jobs found"}
            </h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              {filter === "completed"
                ? "Your completed work will appear here."
                : "Jobs you win or accept will appear here."}
            </p>
          </div>
          <Link 
            to="/my-quotes"
            className="inline-block bg-[#1e3a5f] text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-900 transition-all active:scale-95 shadow-lg shadow-blue-100"
          >
            View Quotes Instead
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {displayJobs.map((job) => {
            const isEmergency = job.urgency === "emergency" || job.isEmergency === true || job.isBoosted;
            const isUrgentAsap = !isEmergency && (job.urgency === "asap" || job.urgency === "urgent");
            const isInstantMatch = !isEmergency && !isUrgentAsap && (job.boostTier === "instant_match" || job.isInstantMatch);

            return (
            <Link
              key={job.id}
              to={`/job/${job.id}`}
              className={cn(
                "block bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all overflow-hidden relative group",
                isEmergency 
                  ? "border-2 border-red-500 shadow-red-500/10" 
                  : isUrgentAsap || isInstantMatch
                  ? "border-2 border-amber-400"
                  : "border border-black"
              )}
            >
              {isInstantMatch ? (
                <div className="bg-[#E6A020] text-slate-950 font-black text-xs uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-[#D4921E] shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="truncate">Instant Match Priority Lead</span>
                  </div>
                  <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                    Instant Lead
                  </span>
                </div>
              ) : isEmergency ? (
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black text-xs tracking-widest uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-red-700 shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0 animate-bounce" />
                    <span className="truncate">Emergency Job • Immediate Dispatch</span>
                  </div>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-white/30 shrink-0">
                    High Urgency
                  </span>
                </div>
              ) : isUrgentAsap ? (
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black text-xs tracking-widest uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-amber-600 shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Urgent Job • ASAP Required</span>
                  </div>
                  <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    Priority
                  </span>
                </div>
              ) : job.urgency === "specific_date" && job.jobDate ? (
                <div className="bg-slate-900 text-white font-black text-[11px] tracking-widest uppercase py-1.5 px-4 sm:px-5 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">Scheduled Date: {new Date(job.jobDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <span className="text-slate-400 text-[10px] shrink-0">Open For Quotes</span>
                </div>
              ) : (
                <div className="bg-slate-900 text-white font-black text-[11px] tracking-widest uppercase py-1.5 px-4 sm:px-5 flex items-center justify-between border-b border-slate-800">
                  <span className="truncate">Standard Job Opportunity</span>
                  <span className="text-slate-400 text-[10px] shrink-0">Open For Quotes</span>
                </div>
              )}
              <div className={cn(
                "p-5 sm:p-6 space-y-3",
                isEmergency ? "bg-red-50/15" : ""
              )}>
                <div className="space-y-2">
                  {/* Category & Subcategory - Single Line Row */}
                  <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
                    <div className={cn(
                      "w-5 h-5 rounded-lg flex items-center justify-center shrink-0",
                      job.urgency === "emergency" ? "bg-red-100" : "bg-orange-50"
                    )}>
                      <Briefcase className={cn(
                        "w-3 h-3",
                        job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                      )} />
                    </div>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest truncate whitespace-nowrap min-w-0 flex-1",
                      job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                    )}>
                      {job.category} {job.subcategory ? `• ${job.subcategory}` : ''}
                    </p>
                  </div>

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {job.jobNo && (
                      <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-sm uppercase tracking-widest">
                        #{job.jobNo}
                      </span>
                    )}
                    {job.urgency === 'emergency' && (
                      <span className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-sm uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Emergency
                      </span>
                    )}
                    {(() => {
                      const qCount = job.quoteCount || (job.quotes ? job.quotes.length : 0);
                      const isFull = qCount >= 5;
                      return (
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                          job.status === "posted"
                            ? isFull
                              ? "border-2 border-red-500 text-red-700 bg-red-50"
                              : "border-2 border-emerald-500 text-emerald-800 bg-emerald-50 pulse-green-border"
                            : job.status === "in_progress" ? "bg-blue-50 text-blue-600"
                            : job.status === "accepted" ? "bg-indigo-50 text-indigo-600"
                            : job.status === "completed" ? "bg-green-50 text-green-600"
                            : "bg-slate-50 text-slate-600"
                        )}>
                          {job.status === 'posted' ? (isFull ? 'Max Quotes Reached' : 'Seeking Quotes') : job.status.replace(/_/g, " ")}
                        </span>
                      );
                    })()}
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border transition-all",
                      (job.quoteCount || (job.quotes ? job.quotes.length : 0)) >= 5
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : (job.quoteCount || (job.quotes ? job.quotes.length : 0)) > 0
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    )}>
                      <span>{(job.quoteCount || (job.quotes ? job.quotes.length : 0))} Quotes</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                    {job.title}
                  </h3>
                  <p className="text-slate-500 font-medium line-clamp-2 text-sm leading-relaxed">
                    {job.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {formatJobLocation(job)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {formatRelativeTime(job.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        </div>
      )}
    </div>
  );
}
