import { getEmergencyRideRequestsQuery } from "@/src/services/taxiIntegrationService";
import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import MediaGalleryModal from "./MediaGalleryModal";
import { 
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, onAuthStateChanged, type FirebaseUser, serverTimestamp, addDoc, runTransaction, writeBatch,
  db, auth, storage, handleFirestoreError, OperationType
} from "@/src/firebase";
import { motion } from "motion/react";
import { 
  Briefcase, Clock, MessageSquare, CheckCircle2, 
  ChevronRight, Plus, Loader2, AlertCircle, Star,
  Search, BarChart3, Zap as EmergencyIcon, Bot, Bell,
  MapPin, Image as ImageIcon, Video as VideoIcon,
  ShieldCheck, Activity, Calendar as CalendarIcon, Car
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn, getOutwardPostcode } from "@/src/lib/utils";
import { TRADE_CATEGORIES } from "@/src/constants";
import { EmergencyTimer } from "./EmergencyTimer";
import { toast } from "sonner";
import { SEO } from "./SEO";
import { getMaintenancePredictions } from "@/src/services/gemini";
import HomeownerPerks from "./HomeownerPerks";
import PartnerAdvertisement from "./shared/PartnerAdvertisement";
import HomeHealthWidget from "./HomeHealthWidget";

const iconMap: Record<string, any> = {
  Search, BarChart3, Briefcase, Plus, ChevronRight, Clock, ImageIcon, VideoIcon
};

export default function Dashboard() {
  const { user, profile, setIsTradeBotOpen } = useAuth();
  const navigate = useNavigate();
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJobMedia, setSelectedJobMedia] = useState<any | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [maintenancePredictions, setMaintenancePredictions] = useState<any[]>([]);
  const [isGeneratingPredictions, setIsGeneratingPredictions] = useState(false);
  const [emergencyRides, setEmergencyRides] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile || profile.role !== 'admin') return;

    const query = getEmergencyRideRequestsQuery();
    const unsubscribe = onSnapshot(query, (snapshot) => {
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmergencyRides(rides);
    }, (error) => {
      console.error("Error fetching taxi emergency requests:", error);
    });

    return () => unsubscribe();
  }, [user, profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch recent quotes across all jobs
    const quotesQuery = query(
      collectionGroup(db, "quotes"),
      where("homeownerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribeQuotes = onSnapshot(quotesQuery, (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentQuotes(quotesData);
    }, (error) => {
      console.error("Error fetching recent quotes:", error);
      // Don't show error to user as it might be a rules issue for collectionGroup
    });

    // Fetch all jobs for stats
    const allJobsQuery = query(
      collection(db, "jobs"),
      where("homeownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeAllJobs = onSnapshot(allJobsQuery, (snapshot) => {
      let jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      jobsData = jobsData.filter(j => j.clientDeleted !== true);
      setAllJobs(jobsData);
      setActiveJobs(jobsData.filter(j => j.status !== "completed" && j.status !== "cancelled"));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching all jobs:", error);
      handleFirestoreError(error, OperationType.LIST, "jobs");
      setLoading(false);
    });

    return () => {
      unsubscribeAllJobs();
      unsubscribeQuotes();
    };
  }, [user]);

  useEffect(() => {
    if (allJobs.length > 0 && maintenancePredictions.length === 0 && !isGeneratingPredictions) {
      const completedJobs = allJobs.filter(j => j.status === "completed");
      if (completedJobs.length > 0) {
        const fetchPredictions = async () => {
          setIsGeneratingPredictions(true);
          try {
            const predictions = await getMaintenancePredictions(completedJobs);
            setMaintenancePredictions(predictions);
          } catch (err) {
            console.error("Error fetching maintenance predictions:", err);
          } finally {
            setIsGeneratingPredictions(false);
          }
        };
        fetchPredictions();
      }
    }
  }, [allJobs]);

  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (activeJobs.length === 0) return;

    const unsubscribes = activeJobs.map(job => {
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
  }, [activeJobs]);

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

  const stats = {
    total: allJobs.length,
    active: allJobs.filter(j => j.status !== "completed" && j.status !== "cancelled").length,
    done: allJobs.filter(j => j.status === "completed").length
  };

  const displayQuotes = recentQuotes
    .filter((q) => {
      // Only show accepted quotes
      if (q.status !== "accepted") return false;
      // Find the associated job
      const job = allJobs.find((j) => j.id === q.jobId);
      // Hide if job is not found, completed, or cancelled
      if (!job || job.status === "completed" || job.status === "cancelled") return false;
      return true;
    })
    .slice(0, 5);

  return (
    <div className="space-y-8 pb-24">
      <SEO 
        title="Homeowner Dashboard" 
        description="Manage your home improvement projects, view quotes, and hire tradespeople on AnyTrader."
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-black shadow-sm p-4 sm:p-6 text-center content-center transition-all hover:shadow-md">
          <p className="text-3xl font-display font-black text-slate-900">{stats.total}</p>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Jobs</p>
        </div>
        <div className="bg-white rounded-2xl border border-black shadow-sm p-4 sm:p-6 text-center content-center transition-all hover:shadow-md">
          <p className="text-3xl font-display font-black text-slate-900">{stats.active}</p>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-black shadow-sm p-4 sm:p-6 text-center content-center transition-all hover:shadow-md">
          <p className="text-3xl font-display font-black text-slate-900">{stats.done}</p>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Done</p>
        </div>
      </div>
      
      {/* Auto-scrolling Advertisement Banner */}
      <PartnerAdvertisement role="homeowner" />

      {/* TradeBot Banner */}
      <button 
        onClick={() => setIsTradeBotOpen(true)}
        className="w-full bg-primary/5 border border-primary/10 p-4 rounded-[24px] flex items-center gap-4 text-left group hover:bg-primary/10 transition-all shadow-sm"
      >
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shadow-primary/10 border border-primary/10 shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-slate-900 text-base leading-tight">Ask AnyTrader AI</h3>
          <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">Get instant UK pricing advice and project planning tips</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:translate-x-1 transition-transform shrink-0">
          <ChevronRight className="w-4 h-4 text-primary" />
        </div>
      </button>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Link to="/find-trades" className="bg-white border border-black p-2.5 sm:p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm group min-w-0 min-h-0 aspect-[4/5] sm:aspect-square">
          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </div>
          <span className="text-[10px] sm:text-xs text-center leading-[1.1] truncate w-full px-1">Find Trades</span>
        </Link>
        <Link 
          to="/analytics" 
          className="bg-white border border-black p-2.5 sm:p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm group min-w-0 min-h-0 aspect-[4/5] sm:aspect-square"
        >
          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-green-50 transition-colors shrink-0">
            <BarChart3 className="w-4 h-4 text-green-500" />
          </div>
          <span className="text-[10px] sm:text-xs text-center leading-[1.1] truncate w-full px-1">Analytics</span>
        </Link>
        <Link 
          to="/post-emergency-job" 
          className="bg-red-50 border border-black p-2.5 sm:p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-red-700 hover:bg-red-100 transition-all shadow-sm group min-w-0 min-h-0 aspect-[4/5] sm:aspect-square"
        >
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors border border-black/20 shrink-0">
            <EmergencyIcon className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-[9px] sm:text-[10px] text-center leading-[1.1]">Emergency<br/>Fast Job Post</span>
        </Link>
      </div>

      {/* Prominent Post New Job Section */}
      <Link 
        to="/post-job" 
        className="w-full bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50/80 border border-black p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 shadow-sm hover:shadow-md transition-all group cursor-pointer"
      >
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black text-white rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-black/20 group-hover:bg-slate-900 transition-colors mt-0.5 sm:mt-0">
            <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-black text-black text-base sm:text-lg leading-tight">
                Post a New Job
              </h3>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-orange-200/90 text-orange-950 px-2 py-0.5 rounded-full border border-black/20 whitespace-nowrap">
                Free Quotes
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 font-extrabold mt-1 leading-snug">
              Connect with top-rated local tradespeople in minutes
            </p>
          </div>
        </div>

        <div className="bg-black text-white text-xs sm:text-sm font-bold px-4 py-2.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 shrink-0 shadow-sm group-hover:bg-slate-900 transition-all border border-black w-full sm:w-auto">
          <span>Post Job Now</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Emergency Taxi Requests Section */}
        {emergencyRides.length > 0 && (
          <div className="space-y-6 lg:col-span-2 bg-red-50 p-8 rounded-[2.5rem] border border-red-100 shadow-sm">
            <h2 className="text-2xl font-bold text-red-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <EmergencyIcon className="w-5 h-5 text-red-600 animate-pulse" />
              </div>
              Active Emergency Ride Requests
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {emergencyRides.map(ride => (
                <div key={ride.id} className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Emergency Ride</span>
                    <span className="text-[10px] font-bold text-slate-400">£{ride.fare}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Pickup</h4>
                    <p className="text-xs text-slate-600 truncate">{ride.pickupLocation?.address || "Location unavailable"}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Drop off</h4>
                    <p className="text-xs text-slate-600 truncate">{ride.destinationLocation?.address || "Location unavailable"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Active Jobs List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              Your Jobs
            </h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="bg-slate-50 p-8 rounded-3xl border border-black animate-pulse flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm font-bold text-slate-700">Loading your active jobs...</span>
              </div>
            ) : activeJobs.length === 0 ? (
              <div className="bg-slate-50 p-12 rounded-3xl border border-dashed border-black text-center space-y-3">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-black">
                  <Briefcase className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                  <p className="text-slate-900 font-bold">No active jobs</p>
                  <p className="text-slate-500 text-sm">Post your first job to get started.</p>
                </div>
                <Link to="/post-job" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                  Post your first job
                </Link>
              </div>
            ) : (
              activeJobs.map((job) => (
                <div
                  key={job.id}
                  className={cn(
                    "bg-white rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all overflow-hidden relative group",
                    job.urgency === "emergency" ? "border-red-500 bg-red-50/30" : "border-black"
                  )}
                >
                  {/* Status Badge */}
                  <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
                    {job.urgency === 'emergency' && (
                      <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[9px] font-black shadow-sm uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Emergency
                      </span>
                    )}
                    {job.status === 'completed' ? (
                      <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-emerald-600 border-[3px] border-emerald-600 px-3 py-1 rounded-md rotate-[-12deg] inline-block shadow-sm bg-white/90 backdrop-blur-sm mr-2 mt-2 whitespace-pre-line text-center">
                        COMPLETED{job.completedAt ? ` ON\n${new Date(job.completedAt?.seconds ? job.completedAt.seconds * 1000 : job.completedAt).toLocaleDateString('en-GB')}` : ''}
                      </span>
                    ) : (
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider",
                        job.status === "posted" ? ((quoteCounts[job.id] || 0) >= 5 ? "bg-yellow-50 text-yellow-700 border border-black" : "bg-blue-50 text-blue-600") : 
                        job.status === "accepted" ? "bg-green-50 text-green-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {job.status === 'posted' ? ((quoteCounts[job.id] || 0) >= 5 ? 'Max Quotes Reached' : 'Seeking Quotes') : job.status.replace("_", " ")}
                      </span>
                    )}
                  </div>

                  <div className="p-6 space-y-3">
                    {/* Category & Subcategory */}
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-lg flex items-center justify-center",
                        job.urgency === "emergency" ? "bg-red-100" : "bg-orange-50"
                      )}>
                        {(() => {
                          const category = TRADE_CATEGORIES.find(c => c.name === job.category);
                          if (category) {
                            const Icon = iconMap[category.icon];
                            return Icon ? <Icon className={cn(
                              "w-2.5 h-2.5",
                              job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                            )} /> : <span className="text-[10px]">{category.icon}</span>;
                          }
                          return <Briefcase className={cn(
                            "w-2.5 h-2.5",
                            job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                          )} />;
                        })()}
                      </div>
                      <p className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        job.urgency === "emergency" ? "text-red-500" : "text-orange-500"
                      )}>
                        {job.category} • {job.subcategory}
                      </p>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1 cursor-pointer" onClick={() => navigate(`/job/${job.id}`)}>
                      <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      <p className="text-slate-500 font-medium line-clamp-1 text-xs leading-relaxed">
                        {job.description}
                      </p>
                    </div>

                    {/* Location & Time */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          {getOutwardPostcode(job.postcode)} • {job.city || "Area Hidden"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          {formatRelativeTime(job.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-50 my-2" />

                    {/* Footer: Urgency & Quotes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {job.urgency === "emergency" ? (
                          <div className="text-[9px]">
                            <EmergencyTimer postedDate={job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : job.createdAt} />
                          </div>
                        ) : (
                          <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {job.urgency === "specific_date" && job.jobDate ? `Date: ${new Date(job.jobDate).toLocaleDateString()}` : job.urgency || "Flexible"}
                          </span>
                        )}
                        {job.estimatedCompletionTime && (
                          <span className="bg-green-50 text-green-600 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {job.estimatedCompletionTime} {job.estimatedCompletionTimeUnit}
                          </span>
                        )}
                        {job.paymentPreference && (
                          <span className="bg-purple-50 text-purple-600 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider capitalize">
                            {job.paymentPreference.replace('_', ' ')}
                          </span>
                        )}
                        {job.quoteScope && (
                          <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider capitalize">
                            {job.quoteScope.replace('_', ' ')}
                          </span>
                        )}
                        {(job.photos?.length > 0 || job.videos?.length > 0) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedJobMedia(job);
                            }}
                            className="bg-orange-50 text-orange-600 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 hover:bg-orange-100 transition-colors"
                          >
                            {job.photos?.length > 0 ? <ImageIcon className="w-2.5 h-2.5" /> : <VideoIcon className="w-2.5 h-2.5" />}
                            { (job.photos?.length || 0) + (job.videos?.length || 0) } Media
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {job.status === "accepted" && job.acceptedTradespersonId && (
                          <Link
                            to={`/chat/${job.id}_${job.acceptedTradespersonId}`}
                            state={{ jobTitle: job.title }}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                            title="Chat with Tradesperson"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </Link>
                        )}
                        <Link
                          to={`/job/${job.id}#quote-form-section`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 group/quotes hover:opacity-80 transition-opacity"
                        >
                          <p className="text-orange-500 font-black text-xs">
                            {job.quoteCount || quoteCounts[job.id] || 0} quotes
                          </p>
                          <ChevronRight className="w-5 h-5 text-slate-800 transition-colors" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AI Home Health & Seasonal Preventive Maintenance Forecast */}
          <HomeHealthWidget 
            completedJobs={allJobs.filter(j => j.status === 'completed')} 
            userPostcode={profile?.postcode} 
          />
        </div>

        {/* Recent Quotes Section */}
        {displayQuotes.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-green-500" />
                </div>
                Recent Quotes
              </h2>
            </div>
            <div className="space-y-4">
              {displayQuotes.map((quote) => (
                <Link
                  key={quote.id}
                  to={`/job/${quote.jobId}`}
                  className="bg-white p-5 rounded-3xl border border-black shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {quote.jobTitle || "New Quote"}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          £{quote.amount} • {formatRelativeTime(quote.createdAt)}
                        </span>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          {quote.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Homeowner Perks Section */}
          <HomeownerPerks limit={2} />

          {/* Quick Actions / Tips */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              Next Steps
            </h2>
            <div className="space-y-4">
              <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 space-y-4 shadow-sm">
                <h4 className="font-bold text-blue-900 text-lg">How it works</h4>
                <ul className="space-y-4">
                  <li className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-blue-200 rounded-xl flex items-center justify-center text-xs font-bold text-blue-700">1</div>
                    <span className="text-blue-800 font-medium">Post your job details</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-blue-200 rounded-xl flex items-center justify-center text-xs font-bold text-blue-700">2</div>
                    <span className="text-blue-800 font-medium">Receive and compare quotes</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-blue-200 rounded-xl flex items-center justify-center text-xs font-bold text-blue-700">3</div>
                    <span className="text-blue-800 font-medium">Chat and hire the best pro</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Home Health & Maintenance Predictions */}
        {maintenancePredictions.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                </div>
                Home Health AI
              </h2>
              <div className="bg-indigo-100 px-3 py-1 rounded-full text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                Predictive Maintenance
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {maintenancePredictions.map((prediction, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[32px] border border-black shadow-sm space-y-4 relative overflow-hidden group">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                          prediction.Urgency === "High" ? "bg-red-100 text-red-600" :
                          prediction.Urgency === "Medium" ? "bg-amber-100 text-amber-600" :
                          "bg-blue-100 text-blue-600"
                        )}>
                          {prediction.Urgency} Priority
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {prediction.Category}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900">{prediction.Title}</h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed italic">"{prediction.Reason}"</p>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Due: {new Date(prediction.EstimatedDueDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <button 
                      onClick={() => navigate('/post-job', { state: { initialTitle: prediction.Title, initialCategory: prediction.Category } })}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                    >
                      Get Quotes
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Decorative background element */}
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-indigo-50 rounded-full blur-2xl opacity-100 md:opacity-50 md:group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
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
    </div>
  );
}
