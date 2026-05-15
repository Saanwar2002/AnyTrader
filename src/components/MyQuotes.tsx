import React, { useEffect, useState } from "react";
import { db, collection, collectionGroup, query, where, orderBy, onSnapshot, handleFirestoreError, OperationType, doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { PoundSterling, Clock, MapPin, ChevronRight, AlertCircle, CheckCircle2, XCircle, Briefcase, Trash2, Sparkles, Calendar } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/src/lib/utils";

export default function MyQuotes() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [jobs, setJobs] = useState<Record<string, any>>({});
  const [jobsLoading, setJobsLoading] = useState(false);

  const [filter, setFilter] = useState<string>("all");
  const [withdrawingQuote, setWithdrawingQuote] = useState<any | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [deletingQuote, setDeletingQuote] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteQuote = async () => {
    if (!deletingQuote) return;
    setIsDeleting(true);
    
    try {
      const { deleteDoc } = await import("firebase/firestore");
      const quoteRef = doc(db, "jobs", deletingQuote.jobId, "quotes", deletingQuote.id);
      await deleteDoc(quoteRef);
      
      // Update local state to remove the quote immediately
      setQuotes(prev => prev.filter(q => q.id !== deletingQuote.id));
    } catch (error) {
      console.error("Error deleting quote:", error);
      handleFirestoreError(error, OperationType.DELETE, `jobs/${deletingQuote.jobId}/quotes/${deletingQuote.id}`);
    } finally {
      setIsDeleting(false);
      setDeletingQuote(null);
    }
  };

  const handleWithdrawQuote = async () => {
    if (!withdrawingQuote || !withdrawReason.trim()) return;
    setIsWithdrawing(true);
    
    try {
      const quoteRef = doc(db, "jobs", withdrawingQuote.jobId, "quotes", withdrawingQuote.id);
      await updateDoc(quoteRef, {
        status: "withdrawn",
        withdrawReason: withdrawReason.trim(),
        updatedAt: serverTimestamp(),
        history: arrayUnion({
          amount: withdrawingQuote.amount,
          message: withdrawingQuote.message,
          paymentPreference: withdrawingQuote.paymentPreference,
          quoteScope: withdrawingQuote.quoteScope,
          timestamp: new Date().toISOString(),
          reason: `Withdrawn by tradesperson: ${withdrawReason.trim()}`
        })
      });
    } catch (error) {
      console.error("Error updating quote status:", error);
      handleFirestoreError(error, OperationType.UPDATE, `jobs/${withdrawingQuote.jobId}/quotes/${withdrawingQuote.id}`);
      setIsWithdrawing(false);
      return;
    }

    try {
      // Decrement quoteCount on job
      const { increment } = await import("firebase/firestore");
      await updateDoc(doc(db, "jobs", withdrawingQuote.jobId), {
        quoteCount: increment(-1)
      });
    } catch (error) {
      console.error("Error decrementing quote count on job:", error);
    }

    setWithdrawingQuote(null);
    setWithdrawReason("");
    setIsWithdrawing(false);
  };

  useEffect(() => {
    if (!user) return;

    // Fetch recurring schedules
    setLoadingRecurring(true);
    const recurringQuery = query(
      collection(db, "recurring_schedules"),
      where("tradespersonId", "==", user.uid)
    );

    const unsubscribeRecurring = onSnapshot(recurringQuery, (snapshot) => {
      const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecurringSchedules(schedules);
      setLoadingRecurring(false);
    }, (error) => {
      console.error("Error fetching recurring schedules:", error);
      setLoadingRecurring(false);
    });

    // Fetch all quotes submitted by this tradesperson
    // Using collectionGroup to find quotes across all jobs
    const q = query(
      collectionGroup(db, "quotes"),
      where("tradespersonId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setQuotes(quotesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching quotes:", error);
      handleFirestoreError(error, OperationType.LIST, "quotes");
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeRecurring();
    };
  }, [user]);

  // Fetch job data for each quote to check status
  useEffect(() => {
    const fetchJobs = async () => {
      const jobIds = [...new Set(quotes.map(q => q.jobId as string).filter(Boolean))];
      const missingJobIds = jobIds.filter(id => !jobs[id]);
      
      if (missingJobIds.length === 0) return;

      setJobsLoading(true);
      const newJobs = { ...jobs };
      
      try {
        await Promise.all(missingJobIds.map(async (jobId: string) => {
          const jobDoc = await getDoc(doc(db, "jobs", jobId));
          if (jobDoc.exists()) {
            newJobs[jobId] = jobDoc.data();
          }
        }));
        setJobs(newJobs);
      } catch (error) {
        console.error("Error fetching jobs for quotes:", error);
      } finally {
        setJobsLoading(false);
      }
    };

    if (quotes.length > 0) {
      fetchJobs();
    }
  }, [quotes]);

  const filteredQuotes = quotes.filter(q => {
    // Just filter by status
    if (filter === "all") return true;
    return q.status === filter;
  });

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusFilters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "accepted", label: "Accepted" },
    { id: "rejected", label: "Rejected" },
    { id: "recurring", label: "Recurring" },
    { id: "requote_requested", label: "Requote" },
    { id: "withdrawn", label: "Withdrawn" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-slate-900">
          My Quotes
        </h1>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar mt-2">
          {statusFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                filter === f.id 
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200" 
                  : "bg-white text-slate-600 border-black hover:border-blue-300"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filter === "recurring" ? (
        loadingRecurring ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : recurringSchedules.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-black text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">No recurring services</h3>
              <p className="text-slate-500">You don't have any recurring scheduled jobs yet.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {recurringSchedules.map((schedule) => (
              <div key={schedule.id} className="bg-white p-5 rounded-xl border border-black shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 group relative">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                  schedule.status === "active" ? "bg-green-50 text-green-600" :
                  schedule.status === "pending_approval" ? "bg-amber-50 text-amber-600" :
                  schedule.status === "paused" ? "bg-slate-50 text-slate-600" : "bg-red-50 text-red-600"
                )}>
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 truncate pr-4">
                      {schedule.title}
                    </h3>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0",
                      schedule.status === "active" ? "bg-green-100 text-green-700" :
                      schedule.status === "pending_approval" ? "bg-amber-100 text-amber-700" :
                      schedule.status === "paused" ? "bg-slate-200 text-slate-600" : "bg-red-100 text-red-700"
                    )}>
                      {schedule.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {schedule.frequency}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <PoundSterling className="w-3.5 h-3.5" />
                      {schedule.amount}/visit
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <Link
                    to={`/profile`}
                    className="flex-1 sm:flex-none text-center bg-white border border-black text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                  >
                    Manage in Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-black text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <PoundSterling className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              {filter === "all" ? "No active quotes" : `No ${filter} quotes found`}
            </h3>
            <p className="text-slate-500">
              {filter === "all" 
                  ? "Browse the job feed to find opportunities and submit your first quote."
                  : "Try changing your filter to see more quotes."}
            </p>
          </div>
          {filter === "all" && (
            <Link 
              to="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Browse Jobs
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuotes.map((quote) => (
            <Link
              key={quote.id}
              to={`/job/${quote.jobId}`}
              className="bg-white p-5 rounded-xl border border-black shadow-sm hover:border-blue-600 transition-all flex flex-col sm:flex-row sm:items-center gap-4 group relative"
            >
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                quote.status === "accepted" ? "bg-green-50 text-green-600" :
                quote.status === "rejected" ? "bg-red-50 text-red-600" :
                quote.status === "withdrawn" ? "bg-slate-50 text-slate-500" :
                "bg-amber-50 text-amber-600"
              )}>
                {quote.status === "accepted" ? <CheckCircle2 className="w-7 h-7" /> :
                 quote.status === "rejected" ? <XCircle className="w-7 h-7" /> :
                 quote.status === "withdrawn" ? <XCircle className="w-7 h-7" /> :
                 <Clock className="w-7 h-7" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    quote.status === "accepted" ? "bg-green-100 text-green-700" :
                    quote.status === "rejected" ? "bg-red-100 text-red-700" :
                    quote.status === "withdrawn" ? "bg-slate-100 text-slate-600" :
                    "bg-amber-100 text-amber-700"
                  )}>
                    {quote.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(quote.createdAt?.toDate?.() || quote.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-bold text-lg text-slate-900 truncate">
                  {quote.jobTitle || `Quote for Job #${quote.jobId.slice(-4)}`}
                </h4>
                {quote.jobNo && (
                  <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit uppercase tracking-wider">
                    {quote.jobNo}
                  </p>
                )}
                <p className="text-sm text-slate-500 line-clamp-1">{quote.message || "No message provided."}</p>
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <PoundSterling className="w-4 h-4 text-slate-400" />
                    <span>£{quote.amount}</span>
                  </div>
                  {quote.startDate && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>{quote.isImmediateStart ? "Immediately" : `Starts: ${new Date(quote.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}</span>
                    </div>
                  )}
                  {quote.estimatedTimeline && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{quote.estimatedTimeline}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {quote.paymentPreference && (
                      <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-tight border border-purple-100">
                        {quote.paymentPreference.replace('_', ' ')}
                      </span>
                    )}
                    {quote.quoteScope && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tight border border-indigo-100">
                        {quote.quoteScope.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {quote.status === "rejected" && quote.rejectionFeedback && (
                  <div className="mt-4 p-4 bg-red-50/50 rounded-2xl border border-red-100/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-red-600" />
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">AI Rejection Feedback</p>
                    </div>
                    <p className="text-xs text-red-800 font-medium leading-relaxed">
                      <span className="font-bold">Reason:</span> {quote.rejectionFeedback.reason}
                    </p>
                    <div className="pt-2 border-t border-red-100/50">
                      <p className="text-xs text-red-700 italic">
                        <span className="font-bold not-italic">Pro Tip:</span> {quote.rejectionFeedback.improvementTip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden sm:block">
                <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
              {quote.status === "pending" && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWithdrawingQuote(quote);
                  }}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10"
                  title="Withdraw Quote"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              {(quote.status === "withdrawn" || quote.status === "rejected") && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeletingQuote(quote);
                  }}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10"
                  title="Delete Quote"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Delete Quote Modal */}
      <AnimatePresence>
        {deletingQuote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Quote</h3>
                <p className="text-slate-600 mb-6">
                  Are you sure you want to permanently delete this quote? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingQuote(null)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteQuote}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Quote"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdraw Quote Modal */}
      <AnimatePresence>
        {withdrawingQuote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Withdraw Quote</h3>
                    <p className="text-sm text-slate-500">Are you sure you want to withdraw this quote?</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">
                    Reason for withdrawal <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    placeholder="e.g., No longer available, fully booked..."
                    className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm resize-none h-24"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setWithdrawingQuote(null);
                      setWithdrawReason("");
                    }}
                    className="flex-1 px-4 py-3 border border-black text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdrawQuote}
                    disabled={isWithdrawing || !withdrawReason.trim()}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isWithdrawing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/30 border-t-white rounded-full animate-spin" />
                        Withdrawing...
                      </>
                    ) : (
                      "Withdraw Quote"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
