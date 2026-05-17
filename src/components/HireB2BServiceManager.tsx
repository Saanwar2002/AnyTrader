import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { db, handleFirestoreError, OperationType } from "@/src/firebase";
import { collectionGroup, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Building2, MapPin, ChevronDown, ChevronUp, PoundSterling, Clock, FileText } from "lucide-react";

export function HireB2BServiceManager() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, accepted, rejected
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collectionGroup(db, "quotes"),
      where("homeownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setQuotes(quotesData);

      // Fetch corresponding job info to show property/venue at top
      const jobIds = [...new Set(quotesData.map(q => q.jobId))];
      const jobsMap: Record<string, any> = {};
      
      for (const jId of jobIds) {
        if (!jId) continue;
        const jobDoc = await getDoc(doc(db, "jobs", jId));
        if (jobDoc.exists()) {
          jobsMap[jId] = { id: jobDoc.id, ...jobDoc.data() };
        }
      }
      setJobs(jobsMap);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "quotes");
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const filteredQuotes = quotes.filter(q => {
    if (filter === "all") return true;
    return q.status === filter;
  });

  const statusFilters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "accepted", label: "Accepted" },
    { id: "rejected", label: "Rejected" },
  ];

  if (loading) {
    return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          My Hiring Quotes
        </h1>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {statusFilters.map((f) => (
             <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                filter === f.id 
                  ? "bg-slate-900 text-white border-black shadow-md shadow-slate-300" 
                  : "bg-white text-slate-600 border-black/20 hover:border-black"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredQuotes.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-black/20 bg-slate-50/50 rounded-2xl text-center space-y-3">
          <div className="w-16 h-16 bg-white border border-black/10 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              No quotes received yet
            </h3>
            <p className="text-sm font-medium text-slate-500 max-w-[250px] mx-auto">
              Any quotes submitted by traders for your B2B jobs will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuotes.map((quote) => {
            const job = jobs[quote.jobId];
            const isExpanded = expandedQuoteId === quote.id;
            
            return (
              <div
                key={quote.id}
                className="bg-white rounded-2xl border border-black shadow-sm overflow-hidden"
              >
                {/* Header: Property / Venue info */}
                {job && (
                  <div className="bg-slate-50 px-4 py-3 border-b border-black/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                        {job.linkedPropertyName || job.title || "Unknown Project"}
                      </h4>
                      {job.city && (
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.city}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Main Quote Card */}
                <div 
                  onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors relative"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2 min-w-0">
                       <div className="flex items-center gap-2">
                         <span className={cn(
                           "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0",
                           quote.status === "accepted" ? "bg-green-50 text-green-700 border-green-200" :
                           quote.status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                           quote.status === "withdrawn" ? "bg-slate-50 text-slate-600 border-slate-200" :
                           "bg-amber-50 text-amber-700 border-amber-200"
                         )}>
                           {quote.status}
                         </span>
                         <span className="text-[11px] font-bold text-slate-400 shrink-0">
                           {new Date(quote.createdAt?.toDate?.() || quote.createdAt).toLocaleDateString()}
                         </span>
                       </div>
                       
                       <p className="text-sm font-bold text-slate-900 truncate">
                         Quote from {quote.tradespersonName || "Trader"}
                       </p>
                       
                       <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                           <PoundSterling className="w-4 h-4 text-slate-400" />
                           <span>£{quote.amount}</span>
                         </div>
                         {quote.estimatedTimeline && (
                           <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                             <Clock className="w-3.5 h-3.5 text-blue-600" />
                             <span>{quote.estimatedTimeline}</span>
                           </div>
                         )}
                       </div>
                    </div>
                    
                    <div className="shrink-0 p-2 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-black/10"
                    >
                      <div className="p-4 bg-slate-50/50 space-y-4">
                        {quote.message && (
                          <div>
                            <p className="text-[11px] font-black uppercase text-slate-400 mb-1 tracking-widest">Message</p>
                            <div className="bg-white p-3 rounded-xl border border-black/10 text-sm font-medium text-slate-700 leading-relaxed">
                              {quote.message}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-start pt-2">
                          <Link
                            to={`/job/${quote.jobId}`}
                            className="bg-black text-white text-center py-3 px-8 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-800 transition-colors"
                          >
                            Manage the quote
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
