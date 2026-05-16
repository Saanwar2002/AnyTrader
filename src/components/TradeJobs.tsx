import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { Briefcase, Clock, MapPin, Loader2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, getOutwardPostcode } from "@/src/lib/utils";

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
          {displayJobs.map((job) => (
            <Link
              key={job.id}
              to={`/job/${job.id}`}
              className="block bg-white rounded-[2.5rem] shadow-sm hover:shadow-md transition-all overflow-hidden relative group border border-black"
            >
              {(job.boostTier === 'instant_match' || job.isInstantMatch) ? (
                <div className="bg-[#E6A020] text-center py-2 text-slate-900 font-black text-3xl tracking-wide uppercase border-b border-[#D4921E]">
                  Instant Match
                </div>
              ) : job.urgency === 'emergency' ? (
                <div className="bg-red-600 text-center py-2 text-white font-black text-xl tracking-wide uppercase border-b border-red-700">
                  Emergency
                </div>
              ) : (
                <div className="bg-blue-500 text-center py-2 text-white font-black text-xl tracking-wide uppercase border-b border-blue-600">
                  Normal Job
                </div>
              )}
              <div className={cn(
                "p-8 space-y-4",
                job.urgency === "emergency" ? "bg-red-50/30" : ""
              )}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded-lg flex items-center justify-center",
                      job.urgency === "emergency" ? "bg-red-100" : "bg-orange-50"
                    )}>
                      <Briefcase className={cn(
                        "w-3 h-3",
                        job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                      )} />
                    </div>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                    )}>
                      {job.category} {job.subcategory ? `• ${job.subcategory}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.jobNo && (
                      <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm uppercase tracking-widest">
                        #{job.jobNo}
                      </span>
                    )}
                    {job.urgency === 'emergency' && (
                      <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black shadow-sm uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Emergency
                      </span>
                    )}
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider",
                      job.status === "in_progress" ? "bg-blue-50 text-blue-600" : 
                      job.status === "accepted" ? "bg-indigo-50 text-indigo-600" :
                      job.status === "completed" ? "bg-green-50 text-green-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      {job.status.replace(/_/g, " ")}
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
                      {getOutwardPostcode(job.postcode)} • {job.city || "Area Hidden"}
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
          ))}
        </div>
      )}
    </div>
  );
}
