import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, handleFirestoreError, OperationType, deleteDoc } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { usePortal } from "@/src/lib/PortalContext";
import { motion, AnimatePresence } from "motion/react";
import { Briefcase, Clock, MapPin, ChevronRight, AlertCircle, AlertTriangle, Settings, Edit2, RotateCcw, XCircle, Loader2, Plus, Image as ImageIcon, Video as VideoIcon, Trash2, History, Zap, Building2 } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { cn, getOutwardPostcode } from "@/src/lib/utils";
import { EmergencyTimer } from "./EmergencyTimer";
import MediaGalleryModal from "./MediaGalleryModal";

export default function MyJobs() {
  const { user, profile } = useAuth();
  const { activeRole } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const isBusiness = profile?.subscriptionType === "business";
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  const isHistoryView = new URLSearchParams(location.search).get("history") === "true";
  const propertyId = new URLSearchParams(location.search).get("propertyId");

  const [filter, setFilter] = useState<"all" | "pending" | "cancelled" | "completed">(propertyId ? "all" : "pending");
  const [selectedJobMedia, setSelectedJobMedia] = useState<any | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "jobs"),
      where("homeownerId", "==", user.uid),
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
    if (propertyId && job.assetId !== propertyId) return false;

    const jobDate = job.createdAt?.seconds ? job.createdAt.seconds * 1000 : new Date(job.createdAt).getTime();
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const isRecent = jobDate > fourteenDaysAgo;
    const isArchivableStatus = job.status === "completed" || job.status === "cancelled";

    // If filtering by a specific property, show all its jobs (unless a specific tab is selected)
    if (propertyId) {
      if (filter === "all") return true;
      if (filter === "pending") return job.status !== "completed" && job.status !== "cancelled";
      if (filter === "cancelled") return job.status === "cancelled";
      if (filter === "completed") return job.status === "completed";
      return true;
    }

    if (isHistoryView) {
      // History view shows archived jobs (completed/cancelled > 14 days)
      return isArchivableStatus && !isRecent;
    }

    // Main view shows pending jobs OR recent completed/cancelled jobs
    const isVisibleInMain = !isArchivableStatus || isRecent;
    if (!isVisibleInMain) return false;

    // Apply UI filters on top of visibility logic
    if (filter === "all") return true;
    if (filter === "pending") return job.status !== "completed" && job.status !== "cancelled";
    if (filter === "cancelled") return job.status === "cancelled";
    if (filter === "completed") return job.status === "completed";
    return true;
  });

  const handleCancel = async (jobId: string) => {
    setIsProcessing(jobId);
    try {
      await updateDoc(doc(db, "jobs", jobId), {
        status: "cancelled"
      });
      setActionId(null);
    } catch (error) {
      console.error("Error cancelling job:", error);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRepost = async (job: any) => {
    setIsProcessing(job.id);
    try {
      await updateDoc(doc(db, "jobs", job.id), {
        status: "posted",
        createdAt: serverTimestamp()
      });
      setActionId(null);
    } catch (error) {
      console.error("Error reposting job:", error);
    } finally {
      setIsProcessing(null);
    }
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    
    setIsProcessing(jobToDelete);
    try {
      await updateDoc(doc(db, "jobs", jobToDelete), { clientDeleted: true });
      setActionId(null);
      setJobToDelete(null);
    } catch (error) {
      console.error("Error deleting job:", error);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = (jobId: string) => {
    setJobToDelete(jobId);
  };

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

  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (jobs.length === 0) return;

    const unsubscribes = jobs.map(job => {
      return onSnapshot(collection(db, "jobs", job.id, "quotes"), (snapshot) => {
        setQuoteCounts(prev => ({
          ...prev,
          [job.id]: snapshot.size
        }));
      }, (error) => {
        console.error(`Error fetching quotes for job ${job.id}:`, error);
        handleFirestoreError(error, OperationType.LIST, `jobs/${job.id}/quotes`);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [jobs]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-slate-900">
            {isHistoryView ? 
              (isBusiness ? "Project History" : "Job History") : 
              (isBusiness ? "My Hiring Projects" : "My Hiring Jobs")}
          </h1>
          {!isHistoryView && filter !== "completed" && filter !== "cancelled" && (
            <Link 
              to="/post-job"
              className="text-orange-500 font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-5 h-5" />
              {isBusiness ? "Post Project" : "Post new"}
            </Link>
          )}
        </div>

        {/* Filter Tabs - Only show in main view */}
        {!isHistoryView && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" }
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
        )}

        {displayJobs.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-black text-center space-y-6 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
              {isHistoryView ? <History className="w-10 h-10" /> : <Briefcase className="w-10 h-10" />}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">
                {isHistoryView 
                  ? (isBusiness ? "No archived projects" : "No archived jobs")
                  : (filter === "completed" || filter === "cancelled")
                    ? `No recent ${filter} ${isBusiness ? "projects" : "jobs"}`
                    : (isBusiness ? "No projects posted yet" : "No jobs posted yet")}
              </h3>
              <p className="text-slate-500 max-w-xs mx-auto">
                {isHistoryView 
                  ? (isBusiness ? "Completed or cancelled projects older than 14 days will appear here." : "Completed or cancelled jobs older than 14 days will appear here.")
                  : (filter === "completed" || filter === "cancelled")
                    ? (isBusiness ? "Projects older than 14 days are automatically moved to your history to keep things tidy." : "Jobs older than 14 days are automatically moved to your history to keep things tidy.")
                    : (isBusiness ? "Post your first project to get AI estimates and quotes from local tradespeople." : "Post your first job to get AI estimates and quotes from local tradespeople.")}
              </p>
            </div>
            {!isHistoryView && (
              filter === "completed" || filter === "cancelled" ? (
                <Link 
                  to="/my-jobs?history=true"
                  className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline"
                >
                  Go to your {isBusiness ? "project" : "job"} history in profile to see old {isBusiness ? "projects" : "jobs"} <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link 
                  to="/post-job"
                  className="inline-block bg-[#1e3a5f] text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-900 transition-all active:scale-95 shadow-lg shadow-blue-100"
                >
                  {isBusiness ? "Post a Project" : "Post a Job"}
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {displayJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-[2.5rem] border border-black shadow-sm hover:shadow-md transition-all overflow-hidden relative group"
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
                  {/* Header: Category and Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Category & Subcategory */}
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

                    {/* Status Badges */}
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
                        job.status === "posted" ? "bg-blue-50 text-blue-600" : 
                        job.status === "accepted" ? "bg-green-50 text-green-600" :
                        job.status === "completed" ? "bg-slate-100 text-slate-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {job.status === 'posted' ? 'Seeking Quotes' : job.status.replace(/_/g, " ")}
                      </span>
                      {job.status === "posted" && job.boostTier === "instant_match" && (
                        <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black shadow-sm uppercase tracking-wider flex items-center gap-1 animate-pulse border border-amber-200">
                          <Zap className="w-3 h-3" />
                          Finding Pro
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2 cursor-pointer" onClick={() => navigate(`/job/${job.id}`)}>
                    {job.assetName && (
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{job.assetName}</span>
                      </div>
                    )}
                    <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-slate-500 font-medium line-clamp-2 text-sm leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  {/* Location & Time */}
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

                  <div className="h-px bg-slate-50 my-4" />

                  {/* Footer: Urgency & Quotes */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {job.urgency === "emergency" ? (
                        <div className="text-[10px]">
                          <EmergencyTimer postedDate={job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : job.createdAt} />
                        </div>
                      ) : (
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider">
                          {job.urgency === "specific_date" && job.jobDate ? `Date: ${new Date(job.jobDate).toLocaleDateString()}` : job.urgency || "Flexible"}
                        </span>
                      )}
                      {job.estimatedCompletionTime && (
                        <span className="bg-green-50 text-green-600 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.estimatedCompletionTime} {job.estimatedCompletionTimeUnit}
                        </span>
                      )}
                      {(job.photos?.length > 0 || job.videos?.length > 0) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedJobMedia(job);
                          }}
                          className="bg-orange-50 text-orange-600 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1 hover:bg-orange-100 transition-colors"
                        >
                          {job.photos?.length > 0 ? <ImageIcon className="w-3 h-3" /> : <VideoIcon className="w-3 h-3" />}
                          { (job.photos?.length || 0) + (job.videos?.length || 0) } Media
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <p className="text-orange-500 font-black text-sm">
                        {quoteCounts[job.id] || 0} quotes
                      </p>
                      
                      <div className="relative flex items-center gap-1">
                        {(job.status === "cancelled" || job.status === "completed") && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRepost(job);
                              }}
                              disabled={isProcessing === job.id}
                              className="p-2 hover:bg-blue-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"
                              title="Repost Job"
                            >
                              {isProcessing === job.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(job.id);
                              }}
                              disabled={isProcessing === job.id}
                              className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete Job"
                            >
                              {isProcessing === job.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                            </button>
                          </>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionId(actionId === job.id ? null : job.id);
                          }}
                          className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        
                        <AnimatePresence>
                          {actionId === job.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActionId(null)} />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-xl border border-black z-20 py-2 overflow-hidden"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/post-job`, { state: { editJob: job } });
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-400" />
                                  Edit Job
                                </button>
                                
                                {(job.status === "posted" || job.status === "accepted" || job.status === "pending_admin_review") && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirmCancelId === job.id) {
                                        handleCancel(job.id);
                                        setConfirmCancelId(null);
                                      } else {
                                        setConfirmCancelId(job.id);
                                        setTimeout(() => setConfirmCancelId(null), 3000);
                                      }
                                    }}
                                    disabled={isProcessing === job.id}
                                    className={cn("w-full px-4 py-2.5 text-left text-sm font-bold flex items-center gap-3 disabled:opacity-50",
                                      confirmCancelId === job.id ? "text-red-600 hover:bg-red-50" : "text-amber-600 hover:bg-amber-50"
                                    )}
                                  >
                                    {isProcessing === job.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : confirmCancelId === job.id ? (
                                      <AlertTriangle className="w-4 h-4 text-red-600" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                    {confirmCancelId === job.id ? "Confirm Cancel" : "Cancel Job"}
                                  </button>
                                )}
                                
                                {(job.status === "cancelled" || job.status === "completed") && (
                                  <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRepost(job);
                                    }}
                                    disabled={isProcessing === job.id}
                                    className="w-full px-4 py-2.5 text-left text-sm font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-3 disabled:opacity-50"
                                  >
                                    {isProcessing === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    Repost / Request Quote
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(job.id);
                                    }}
                                    disabled={isProcessing === job.id}
                                    className="w-full px-4 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 disabled:opacity-50"
                                  >
                                    {isProcessing === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Delete Job
                                  </button>
                                  </>
                                )}
                                
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <MediaGalleryModal
          isOpen={!!selectedJobMedia}
          onClose={() => setSelectedJobMedia(null)}
          photos={selectedJobMedia?.photos}
          videos={selectedJobMedia?.videos}
          title={selectedJobMedia?.title || "Job Media"}
        />

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {jobToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
              >
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Delete Job?</h3>
                <p className="text-center text-slate-500 mb-6">
                  Are you sure you want to delete this job? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setJobToDelete(null)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isProcessing === jobToDelete}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing === jobToDelete ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }
