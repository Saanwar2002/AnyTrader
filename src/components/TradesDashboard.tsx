import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { 
  collection, query, where, orderBy, onSnapshot, db, collectionGroup, handleFirestoreError, OperationType, limit, updateDoc, doc
} from "@/src/firebase";
import { getRecommendedJobs } from "@/src/services/gemini";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { motion, AnimatePresence } from "motion/react";
import { 
  Briefcase, Clock, MessageSquare, CheckCircle2, 
  ChevronRight, Star, Search, BarChart3, PoundSterling, ShieldCheck, Zap, UserPlus,
  Image as ImageIcon, Video as VideoIcon, Loader2, MapPin, Share2, Calendar
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn, getOutwardPostcode } from "@/src/lib/utils";
import { TRADE_CATEGORIES } from "@/src/constants";
import MediaGalleryModal from "./MediaGalleryModal";
import { SEO } from "./SEO";

import PartnerPerks from "./PartnerPerks";

const iconMap: Record<string, any> = {
  Briefcase, Clock, MessageSquare, CheckCircle2, ChevronRight, Star, Search, BarChart3, PoundSterling, ShieldCheck, Zap, UserPlus, ImageIcon, VideoIcon
};

export default function TradesDashboard() {
  const { user, profile } = useAuth();
  const [activeQuotes, setActiveQuotes] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [postedJobs, setPostedJobs] = useState<any[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedJobMedia, setSelectedJobMedia] = useState<any | null>(null);
  const [stats, setStats] = useState({
    activeQuotes: 0,
    activeJobs: 0,
    upcomingJobs: 0,
    postedJobs: 0,
    totalEarned: 0,
    rating: 0
  });
  const [projectTab, setProjectTab] = useState<"active" | "upcoming">("active");
  const [confirmingEmergency, setConfirmingEmergency] = useState(false);
  const [showEmergencyToast, setShowEmergencyToast] = useState(false);
  const [profitability, setProfitability] = useState<any>(null);

  useEffect(() => {
    if (user) {
        fetch("/api/analytics/profitability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: user.uid })
        })
        .then(res => res.json())
        .then(data => setProfitability(data))
        .catch(err => console.error("Profitability Fetch Error:", err));
    }
  }, [user]);

  const ProfitabilityWidget = () => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
    >
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Profitability Insights
            </h3>
        </div>
        {!profitability || profitability.error ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
                {profitability?.error ? "Unable to load analytics" : <Loader2 className="w-6 h-6 animate-spin text-blue-600" />}
            </div>
        ) : (
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Revenue</p>
                    <p className="text-xl font-black text-slate-900">£{(profitability.totalRevenue || 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Costs</p>
                    <p className="text-xl font-black text-slate-900">£{(profitability.totalSpend || 0).toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-1">Net Profit</p>
                    <p className="text-xl font-black text-blue-700">£{(profitability.netProfit || 0).toLocaleString()}</p>
                </div>
            </div>
        )}
    </motion.div>
  );

  const ReplenishmentAlert = () => profitability?.replenishmentAlert ? (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-indigo-600 p-6 rounded-3xl border border-indigo-500 text-white shadow-lg overflow-hidden relative"
    >
        <div className="relative z-10">
            <h3 className="font-bold text-white flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-indigo-300" />
                Time to Replenish!
            </h3>
            <p className="text-indigo-100 text-sm mb-4">You've hit your shop spending threshold. Check the AI Shop for exclusive Pro-member replenishment deals.</p>
            <button className="bg-white text-indigo-600 font-bold py-2 px-4 rounded-xl text-xs hover:bg-indigo-50 transition-colors">
                View Deals
            </button>
        </div>
    </motion.div>
  ) : null;

  useEffect(() => {
    if (!user || !profile) return;

    // Fetch active quotes
    const quotesQuery = query(
      collectionGroup(db, "quotes"),
      where("tradespersonId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribeQuotes = onSnapshot(quotesQuery, (snapshot) => {
      setActiveQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStats(prev => ({ ...prev, activeQuotes: snapshot.size }));
    }, (error) => {
      console.error("Error fetching active quotes:", error);
      handleFirestoreError(error, OperationType.LIST, "quotes");
    });

    // Fetch active jobs (where this tradesperson is hired)
    const hiredJobsQuery = query(
      collection(db, "jobs"),
      where("tradespersonId", "==", user.uid),
      where("status", "in", ["accepted", "in_progress"])
    );

    const unsubscribeJobs = onSnapshot(hiredJobsQuery, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setActiveJobs(jobsData);
      const activeCount = jobsData.filter(j => j.status === "in_progress").length;
      const upcomingCount = jobsData.filter(j => j.status === "accepted").length;
      setStats(prev => ({ 
        ...prev, 
        activeJobs: activeCount,
        upcomingJobs: upcomingCount
      }));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching hired jobs:", error);
      handleFirestoreError(error, OperationType.LIST, "jobs");
      setLoading(false);
    });

    // Fetch jobs posted by this tradesperson (acting as homeowner)
    const postedJobsQuery = query(
      collection(db, "jobs"),
      where("homeownerId", "==", user.uid),
      orderBy("postedDate", "desc")
    );

    const unsubscribePostedJobs = onSnapshot(postedJobsQuery, (snapshot) => {
      const postedJobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPostedJobs(postedJobsData);
      setStats(prev => ({ ...prev, postedJobs: snapshot.size }));
    }, (error) => {
      console.error("Error fetching posted jobs:", error);
      handleFirestoreError(error, OperationType.LIST, "jobs");
    });

    return () => {
      unsubscribeQuotes();
      unsubscribeJobs();
      unsubscribePostedJobs();
    };
  }, [user, profile]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user || !profile || profile.role !== "tradesperson") return;
      
      // Use profile trades, or default to null for guests/incomplete profiles
      const categoryToMatch = (profile.trades && profile.trades.length > 0) ? profile.trades[0] : null;
      
      setIsRecommending(true);
      try {
        // Fetch some recent jobs (filtered by category if available)
        let q;
        if (categoryToMatch) {
          q = query(
            collection(db, "jobs"),
            where("status", "==", "posted"),
            where("category", "==", categoryToMatch),
            orderBy("postedDate", "desc"),
            limit(10)
          );
        } else {
          q = query(
            collection(db, "jobs"),
            where("status", "==", "posted"),
            orderBy("postedDate", "desc"),
            limit(10)
          );
        }
        
        const snapshot = await new Promise<any>((resolve) => {
          const unsub = onSnapshot(q, (snap) => {
            unsub();
            resolve(snap);
          });
        });

        const jobs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        if (jobs.length > 0) {
          const recommendations = await getRecommendedJobs(
            { ...profile, category: categoryToMatch }, 
            jobs, 
            activeJobs, 
            {
              standard: profile.availability,
              overrides: profile.dateOverrides
            }
          );
          
          const enriched = recommendations
            .map(rec => {
              const job = jobs.find(j => j.id === rec.id);
              if (!job) return null;
              return { ...job, aiReason: rec.reason };
            })
            .filter(Boolean);

          setRecommendedJobs(enriched);
        }
      } catch (err) {
        console.error("Error fetching recommendations:", err);
      } finally {
        setIsRecommending(false);
      }
    };

    if (activeJobs.length >= 0) {
      fetchRecommendations();
    }
  }, [user, profile, activeJobs.length]);

  if (loading) return (
    <div className="py-12 flex justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <SEO 
        title="Tradesperson Dashboard" 
        description="Manage your quotes, active jobs, and find new work opportunities on AnyTrader."
      />
      
      <ProfitabilityWidget />
      <ReplenishmentAlert />

      {/* Availability Status Banner */}
      {profile?.isAcceptingRequests === false && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Your Availability is Paused</p>
              <p className="text-xs text-amber-700">You won't receive new quote requests or messages until you toggle this back on.</p>
            </div>
          </div>
          <Link 
            to="/availability"
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shrink-0"
          >
            Turn On
          </Link>
        </div>
      )}

      {/* Greeting Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-2xl font-bold overflow-hidden relative shadow-lg">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile?.name?.charAt(0).toUpperCase()
            )}
            <BadgeOverlay 
              badges={getTraderBadges(profile)} 
              className="absolute -bottom-1 -left-1 -right-1 justify-center z-10 scale-75" 
            />
          </div>
          <div>
            <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
              Welcome back, <span className="text-primary">{profile?.name}</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">Manage your quotes and active projects.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Emergency Toggle */}
          <div className="flex items-center gap-2 bg-white px-3 h-11 rounded-2xl border border-slate-200 shadow-sm">
            <Zap className={cn("w-4 h-4", profile?.isAvailableForEmergency ? "text-red-500" : "text-slate-400")} />
            <span className="text-xs font-bold text-slate-700">Emergency</span>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Emergency toggle button clicked");
                if (!user) {
                  console.log("No user found");
                  return;
                }
                if (!confirmingEmergency) {
                  setConfirmingEmergency(true);
                  setShowEmergencyToast(true);
                  setTimeout(() => setShowEmergencyToast(false), 3000);
                  setTimeout(() => setConfirmingEmergency(false), 3000);
                  return;
                }
                setConfirmingEmergency(false);
                setShowEmergencyToast(false);
                try {
                  await updateDoc(doc(db, "users", user.uid), {
                    isAvailableForEmergency: !profile?.isAvailableForEmergency
                  });
                  console.log("Emergency status updated successfully");
                } catch (error) {
                  console.error("Error updating emergency status:", error);
                  alert("Unable to update emergency status. Please try again later. If this persists, you may have reached your usage limit.");
                }
              }}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none touch-manipulation z-50 ${confirmingEmergency ? 'bg-amber-400' : (profile?.isAvailableForEmergency ? 'bg-red-500' : 'bg-slate-200')}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${profile?.isAvailableForEmergency ? 'translate-x-9' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Share Button */}
          <button 
            onClick={async () => {
              if (!user) return;
              const profileUrl = `${window.location.origin}/profile/${user.uid}`;
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: `${profile?.name} on AnyTrader`,
                    text: `Check out my profile on AnyTrader!`,
                    url: profileUrl,
                  });
                } else {
                  await navigator.clipboard.writeText(profileUrl);
                  alert('Profile link copied to clipboard!');
                }
              } catch (err: any) {
                if (err.name === 'AbortError') {
                  console.log('Sharing canceled by user');
                  return;
                }
                console.error('Error sharing:', err);
              }
            }}
            className="bg-white text-slate-700 border border-slate-200 px-4 h-11 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Share2 className="w-4 h-4 text-blue-600" />
            Share
          </button>

          {/* Availability Button */}
          <Link 
            to="/availability"
            className="bg-white text-slate-700 border border-slate-200 px-4 h-11 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            Set Availability
          </Link>

          <Link 
            to="/job-feed" 
            className="bg-primary text-white px-6 h-11 rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95"
          >
            <Briefcase className="w-5 h-5" />
            Find Jobs
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-2">
            <PoundSterling className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Quotes</p>
          <p className="text-2xl font-bold text-slate-900">{stats.activeQuotes}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mb-2">
            <Briefcase className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Jobs</p>
          <p className="text-2xl font-bold text-slate-900">{stats.activeJobs}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-2">
            <Calendar className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Upcoming Jobs</p>
          <p className="text-2xl font-bold text-slate-900">{stats.upcomingJobs}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 mb-2">
            <Star className="w-4 h-4 fill-current" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rating</p>
          <p className="text-2xl font-bold text-slate-900">{profile?.rating ? profile.rating.toFixed(1) : "N/A"}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-2">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
          <p className={cn(
            "text-sm font-bold",
            profile?.verificationStatus === "verified" ? "text-green-600" : "text-amber-600"
          )}>
            {profile?.verificationStatus === "verified" ? "Verified Pro" : "Unverified"}
          </p>
        </div>
      </div>

      {/* AI Recommendations */}
      {profile?.role === "tradesperson" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-slate-900">AI Recommended Jobs</h2>
            </div>
            {isRecommending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
          
          {recommendedJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendedJobs.map((job) => {
                const isCurrentlyBoosted = job.isBoosted && (job.boostExpiresAt ? new Date().getTime() < new Date(job.boostExpiresAt).getTime() : true);
                
                return (
                <Link 
                  key={job.id} 
                  to={`/job/${job.id}`}
                  className={cn(
                    "bg-white p-4 rounded-3xl border shadow-sm transition-all group relative overflow-hidden",
                    isCurrentlyBoosted ? "border-red-500 hover:shadow-red-500/20" : "border-slate-100 hover:border-orange-200"
                  )}
                >
                  {isCurrentlyBoosted && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isCurrentlyBoosted ? "bg-red-50" : "bg-orange-50"
                      )}>
                        <Briefcase className={cn("w-4 h-4", isCurrentlyBoosted ? "text-red-600" : "text-orange-600")} />
                      </div>
                      {job.jobNo && (
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                          #{job.jobNo}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isCurrentlyBoosted && (
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase shadow-sm shadow-red-600/20 animate-pulse flex items-center gap-1">
                          <Zap className="w-3 h-3 fill-current" />
                          Premium
                        </span>
                      )}
                      <div className="px-2 py-0.5 rounded-full bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border border-slate-100">
                        {job.category}
                      </div>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1 group-hover:text-orange-600 transition-colors line-clamp-1">{job.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{job.description}</p>
                  
                  {job.aiReason && (
                    <div className="mb-3 p-2 bg-orange-50/50 rounded-xl border border-orange-100/50">
                      <p className="text-[10px] text-orange-700 leading-tight italic">
                        <span className="font-bold uppercase mr-1">AI Insight:</span>
                        {job.aiReason}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {getOutwardPostcode(job.postcode)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )})}
            </div>
          ) : !isRecommending && (
            <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-200 text-center">
              <p className="text-sm text-slate-500">No specific recommendations right now. Check the main feed!</p>
            </div>
          )}
        </div>
      )}

      {/* Verification Banner */}
      {profile?.verificationStatus !== "verified" && (
        <Link 
          to="/profile#verification"
          className={cn(
            "w-full p-4 rounded-2xl flex items-center gap-4 text-left group transition-all border",
            profile?.verificationDocs?.some((d: any) => d.status === "expired") 
              ? "bg-red-50 border-red-100 hover:bg-red-100" 
              : "bg-amber-50 border-amber-100 hover:bg-amber-100"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-sm",
            profile?.verificationDocs?.some((d: any) => d.status === "expired") ? "bg-white" : "bg-white"
          )}>
            <ShieldCheck className={cn(
              "w-6 h-6",
              profile?.verificationDocs?.some((d: any) => d.status === "expired") ? "text-red-500" : "text-amber-500"
            )} />
          </div>
          <div className="flex-1">
            <h3 className={cn(
              "font-bold",
              profile?.verificationDocs?.some((d: any) => d.status === "expired") ? "text-red-900" : "text-amber-900"
            )}>
              {profile?.verificationDocs?.some((d: any) => d.status === "expired") ? "Verification Expired!" : "Get Verified"}
            </h3>
            <p className={cn(
              "text-sm",
              profile?.verificationDocs?.some((d: any) => d.status === "expired") ? "text-red-700" : "text-amber-700"
            )}>
              {profile?.verificationDocs?.some((d: any) => d.status === "expired") 
                ? "One or more documents have expired. Upload new ones to restore your badge." 
                : "Verified tradespeople win 3x more jobs. Upload your ID today."}
            </p>
          </div>
          <ChevronRight className={cn(
            "w-5 h-5 transition-transform group-hover:translate-x-1",
            profile?.verificationDocs?.some((d: any) => d.status === "expired") ? "text-red-300" : "text-amber-300"
          )} />
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Project Management Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              My Projects
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setProjectTab("active")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  projectTab === "active" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Active ({stats.activeJobs})
              </button>
              <button
                onClick={() => setProjectTab("upcoming")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  projectTab === "upcoming" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Upcoming ({stats.upcomingJobs})
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {(() => {
              const displayJobs = activeJobs.filter(j => 
                projectTab === "active" ? j.status === "in_progress" : j.status === "accepted"
              );

              if (displayJobs.length === 0) {
                return (
                  <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
                    <p className="text-slate-500 text-sm">
                      {projectTab === "active" 
                        ? "No projects currently in progress." 
                        : "No upcoming projects scheduled."}
                    </p>
                    <Link to="/job-feed" className="text-blue-600 font-bold text-sm hover:underline mt-2 inline-block">Browse Job Feed</Link>
                  </div>
                );
              }

              return displayJobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/job/${job.id}`}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex items-center gap-4 group"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    projectTab === "active" ? "bg-green-50 text-green-600" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {(() => {
                      const category = TRADE_CATEGORIES.find(c => c.name === job.category);
                      if (category) {
                        const Icon = iconMap[category.icon];
                        return Icon ? <Icon className="w-6 h-6" /> : <span className="text-2xl">{category.icon}</span>;
                      }
                      return <CheckCircle2 className="w-6 h-6" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{job.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        job.status === "in_progress" ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {job.status === "in_progress" ? "In Progress" : "Upcoming"}
                      </span>
                      {job.postedDate && (
                        <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(job.postedDate?.seconds * 1000 || job.postedDate).toLocaleDateString()}
                        </span>
                      )}
                      {job.estimatedCompletionTime && (
                        <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          Est. {job.estimatedCompletionTime} {job.estimatedCompletionTimeUnit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/chat/${job.id}_${user?.uid}`}
                      state={{ jobTitle: job.title }}
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      title="Open Chat"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </Link>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                </Link>
              ));
            })()}
          </div>
        </div>

        {/* Recent Quotes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PoundSterling className="w-5 h-5 text-green-600" />
              Pending Quotes
            </h2>
          </div>
          
          <div className="space-y-3">
            {activeQuotes.length === 0 ? (
              <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
                <p className="text-slate-500 text-sm">You have no pending quotes.</p>
              </div>
            ) : (
              activeQuotes.slice(0, 5).map((quote) => (
                <Link
                  key={quote.id}
                  to="/my-quotes"
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {quote.jobTitle || `Quote for Job #${quote.jobId.slice(-4)}`}
                    </h4>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-green-600">£{quote.amount}</p>
                      {quote.jobNo && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                          {quote.jobNo}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Partner Perks Section */}
      <div className="mt-12">
        <PartnerPerks limit={2} />
      </div>

      {/* My Hiring Projects (Jobs posted by this tradesperson) */}
      {postedJobs.length > 0 && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600" />
              My Hiring Projects
            </h2>
            <Link to="/my-jobs" className="text-sm font-bold text-blue-600 hover:underline">Manage all</Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {postedJobs.slice(0, 4).map((job) => (
              <Link
                key={job.id}
                to={`/job/${job.id}`}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{job.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      job.status === "posted" ? "bg-blue-50 text-blue-600" :
                      job.status === "in_progress" ? "bg-amber-50 text-amber-600" :
                      job.status === "completed" ? "bg-green-50 text-green-600" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {job.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{job.quotesCount || 0} quotes</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <MediaGalleryModal
        isOpen={!!selectedJobMedia}
        onClose={() => setSelectedJobMedia(null)}
        photos={selectedJobMedia?.photos}
        videos={selectedJobMedia?.videos}
        title={selectedJobMedia?.title || "Job Media"}
      />

      <AnimatePresence>
        {showEmergencyToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-[#1e293b] text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 whitespace-nowrap"
          >
            <Zap className="w-5 h-5 text-amber-400" />
            <p className="text-sm font-bold">Tap again to confirm change</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
