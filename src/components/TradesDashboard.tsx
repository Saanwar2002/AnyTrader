import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { 
  collection, query, where, orderBy, onSnapshot, db, collectionGroup, handleFirestoreError, OperationType, limit, updateDoc, doc, getDoc
} from "@/src/firebase";
import { getRecommendedJobs } from "@/src/services/gemini";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { motion, AnimatePresence } from "motion/react";
import { 
  Briefcase, Clock, MessageSquare, CheckCircle2, 
  ChevronRight, Star, Search, BarChart3, PoundSterling, ShieldCheck, Zap, UserPlus,
  Image as ImageIcon, Video as VideoIcon, Loader2, MapPin, Share2, Calendar, X, Info, Award, ArrowRight,
  ChevronDown, ChevronUp, Activity, XCircle, AlertCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn, getOutwardPostcode } from "@/src/lib/utils";
import { TRADE_CATEGORIES } from "@/src/constants";
import MediaGalleryModal from "./MediaGalleryModal";
import { SEO } from "./SEO";

import PartnerPerks from "./PartnerPerks";
import PartnerAdvertisement from "./shared/PartnerAdvertisement";
import { getRegionalDemandData, RegionalDemand } from "@/src/services/demandHeatmapService";
import { InstantMatchTraderAlert } from "./InstantMatchTraderAlert";

const iconMap: Record<string, any> = {
  Briefcase, Clock, MessageSquare, CheckCircle2, ChevronRight, Star, Search, BarChart3, PoundSterling, ShieldCheck, Zap, UserPlus, ImageIcon, VideoIcon
};

export default function TradesDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showTestAlert, setShowTestAlert] = useState(false);
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
  
  const [showInstantMatchSetup, setShowInstantMatchSetup] = useState(false);
  const [imSetupData, setImSetupData] = useState({ callOutFee: "", hourlyRate: "", terms: "" });
  const [confirmingIM, setConfirmingIM] = useState(false);
  const [showIMToast, setShowIMToast] = useState(false);
  const [isSavingIM, setIsSavingIM] = useState(false);
  const [profitability, setProfitability] = useState<any>(null);
  const [showProfitabilityInfo, setShowProfitabilityInfo] = useState(false);
  const [showSavingsInfo, setShowSavingsInfo] = useState(true);
  const [userInteractedWithSavings, setUserInteractedWithSavings] = useState(false);
  const [activeInsightTab, setActiveInsightTab] = useState<"profitability" | "pulse" | "map">("profitability");
  const [showInsights, setShowInsights] = useState(true);
  const [userInteractedWithInsights, setUserInteractedWithInsights] = useState(false);
  const [regionalDemand, setRegionalDemand] = useState<RegionalDemand[]>([]);
  const [loadingDemand, setLoadingDemand] = useState(false);

  // Auto-dismiss the savings info section after 3 seconds, starting only after loading completes
  useEffect(() => {
    if (loading || userInteractedWithSavings) return;
    
    const timer = setTimeout(() => {
      setShowSavingsInfo(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading, userInteractedWithSavings]);

  // Auto-dismiss the business insights section after 8 seconds
  useEffect(() => {
    if (loading || userInteractedWithInsights) return;
    
    const timer = setTimeout(() => {
      setShowInsights(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading, userInteractedWithInsights]);

  // Auto-close business insights on scroll
  useEffect(() => {
    let lastY = 0;
    const handleScroll = () => {
      if (window.scrollY > 20) {
        if (showInsights) setShowInsights(false);
        if (showSavingsInfo) setShowSavingsInfo(false);
      }
    };

    const handleTouch = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      if (lastY > 0 && Math.abs(currentY - lastY) > 10) {
        if (showInsights) setShowInsights(false);
        if (showSavingsInfo) setShowSavingsInfo(false);
      }
      lastY = currentY;
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("touchmove", handleTouch);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchmove", handleTouch);
    };
  }, [showInsights, showSavingsInfo]);

  // Exclusive Job Offers State
  const [showExclusiveModal, setShowExclusiveModal] = useState(false);
  const [isProcessingExclusive, setIsProcessingExclusive] = useState(false);
  const [exclusiveCheckoutError, setExclusiveCheckoutError] = useState<string | null>(null);

  const [sysConfig, setSysConfig] = useState<any>(null);

  // Instant Match Alert State
  const [activeIMAttempt, setActiveIMAttempt] = useState<any | null>(null);
  const [activeIMJob, setActiveIMJob] = useState<any | null>(null);
  const [showIMAlert, setShowIMAlert] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(
      collection(db, "instant_match_attempts"),
      where("traderId", "==", user.uid),
      where("status", "in", ["pending", "notified"])
    ), async (snap) => {
      if (!snap.empty) {
        const attemptArray = snap.docs.map(d => ({id: d.id, ...d.data()} as any));
        // Sort by attempt number descending just in case, though there should only be one active
        attemptArray.sort((a: any, b: any) => b.attemptNumber - a.attemptNumber);
        const attempt = attemptArray[0];
        
        // Fetch Job Details
        try {
          const matchDoc = await getDoc(doc(db, "instant_matches", attempt.instantMatchId));
          if (matchDoc.exists() && matchDoc.data().jobId) {
             const jobDoc = await getDoc(doc(db, "jobs", matchDoc.data().jobId));
             if (jobDoc.exists()) {
                setActiveIMJob({id: jobDoc.id, ...jobDoc.data()});
                setActiveIMAttempt(attempt);
                setShowIMAlert(true);
             }
          }
        } catch (e) {
          console.error("Failed to load instant match job details:", e);
        }
      } else {
        setShowIMAlert(false);
        setActiveIMAttempt(null);
        setActiveIMJob(null);
      }
    });
    return () => unsub();
  }, [user]);

  const handleAcceptIM = async () => {
    if (!activeIMAttempt || !activeIMJob) return;
    try {
      setShowIMAlert(false);
      
      // Update Attempt
      await updateDoc(doc(db, "instant_match_attempts", activeIMAttempt.id), {
        status: "accepted",
        respondedAt: new Date().toISOString()
      });

      // Update Match Match
      await updateDoc(doc(db, "instant_matches", activeIMAttempt.instantMatchId), {
        status: "matched",
        matchedTraderId: user?.uid,
        matchedAt: new Date().toISOString()
      });

      // Update the Job itself to bypass quote process
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      await updateDoc(doc(db, "jobs", activeIMJob.id), {
        status: "accepted",
        acceptedTradespersonId: user?.uid,
        isInstantMatchAccepted: true, // Custom flag if we want it
        isConfirmedByTradesperson: true,
        scheduledDate: new Date().toISOString().split('T')[0],
        verificationPin: pin
      });
      
      toast.success("Instant Match accepted! Please contact the customer immediately.");
      navigate(`/job/${activeIMJob.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to accept. It may have expired.");
    }
  };

  const handleDeclineIM = async () => {
    if (!activeIMAttempt) return;
    setShowIMAlert(false);
    try {
      await updateDoc(doc(db, "instant_match_attempts", activeIMAttempt.id), {
        status: "declined",
        respondedAt: new Date().toISOString()
      });
      setActiveIMAttempt(null);
      setActiveIMJob(null);
    } catch (e) {
      console.error(e);
    }
  };

  const getExclusivePrice = () => {
    const tier = profile?.tierId || "Basic";
    if (tier === "Basic") return 25;
    if (tier.includes("Enterprise") || tier.includes("Highest")) return 10;
    return 15; // Standard/Pro
  };

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSysConfig(docSnapshot.data());
      } else {
        setSysConfig({ paywallEnabled: true });
      }
    }, (error) => {
      console.error("Firestore Paywall Config Error:", error);
      setSysConfig({ paywallEnabled: true });
    });
    return () => unsubConfig();
  }, []);

  const handleExclusiveCheckout = async () => {
    if (!user || !profile) return;
    setIsProcessingExclusive(true);
    setExclusiveCheckoutError(null);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          tierName: "Exclusive Leads Add-on",
          priceId: "price_mock_exclusive_addon", // Replace with real price in prod
          successUrl: `${window.location.origin}/dashboard?exclusive_success=true`,
          cancelUrl: `${window.location.origin}/dashboard`,
          metadata: { isExclusiveAddon: "true" }
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to initiate checkout");
      }
    } catch (err: any) {
      console.error(err);
      setExclusiveCheckoutError(err.message);
      setIsProcessingExclusive(false);
    }
  };

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

  useEffect(() => {
    const fetchDemand = async () => {
      setLoadingDemand(true);
      const data = await getRegionalDemandData(profile?.category);
      setRegionalDemand(data);
      setLoadingDemand(false);
    };
    if (user && profile) {
      fetchDemand();
    }
  }, [user, profile]);

  const BusinessInsightsWidget = () => {
    if (!profitability) return null;

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden"
      >
        <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                setActiveInsightTab("profitability");
                setUserInteractedWithInsights(true);
              }}
              className={cn(
                "text-xs font-black uppercase tracking-widest pb-1 transition-all",
                activeInsightTab === "profitability" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-900"
              )}
            >
              Profitability
            </button>
            <button 
              onClick={() => {
                setActiveInsightTab("pulse");
                setUserInteractedWithInsights(true);
              }}
              className={cn(
                "text-xs font-black uppercase tracking-widest pb-1 transition-all flex items-center gap-1",
                activeInsightTab === "pulse" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-900"
              )}
            >
              Shop Pulse
              {profitability.replenishmentAlert && <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />}
            </button>
            <button 
              onClick={() => {
                setActiveInsightTab("map");
                setUserInteractedWithInsights(true);
              }}
              className={cn(
                "text-xs font-black uppercase tracking-widest pb-1 transition-all flex items-center gap-1",
                activeInsightTab === "map" ? "text-rose-600 border-b-2 border-rose-600" : "text-slate-400 hover:text-slate-900"
              )}
            >
              Demand Map
              <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            </button>
          </div>
          <button 
            onClick={() => {
              setShowInsights(!showInsights);
              setUserInteractedWithInsights(true);
            }}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            {showInsights ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {showInsights && (
            <motion.div
              key={activeInsightTab}
              initial={{ opacity: 0, x: activeInsightTab === "profitability" ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeInsightTab === "profitability" ? 10 : -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {activeInsightTab === "profitability" ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Profitability Insights
                    </h3>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Net Profit</p>
                      <p className="text-xl font-black text-blue-600 leading-none">£{(profitability.netProfit || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Revenue</p>
                      <p className="text-lg font-black text-slate-900 leading-none">£{(profitability.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Material Spend</p>
                      <p className="text-lg font-black text-slate-900 leading-none">£{(profitability.totalSpend || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 italic font-medium font-display">Daily average calculated from last 30 days of accepted quotes vs. shop orders.</p>
                </div>
              ) : activeInsightTab === "pulse" ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm shadow-indigo-100">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-none">Shop Vitality</h3>
                        <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1">{profitability.pulse?.status || "Active"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-900 leading-none">{profitability.pulse?.score || 0}%</span>
                    </div>
                  </div>
                  
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-6">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${profitability.pulse?.score || 0}%` }}
                      className="h-full bg-indigo-600 rounded-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="border border-slate-100 p-3 rounded-2xl bg-slate-50/50">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Total Orders</p>
                      <p className="text-lg font-black text-slate-900 mt-1">{profitability.orderCount || 0}</p>
                    </div>
                    <div className="border border-slate-100 p-3 rounded-2xl bg-indigo-50/30">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">Trade Savings</p>
                      <p className="text-lg font-black text-indigo-700 mt-1">£{(profitability.shopSavings || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {profitability.replenishmentAlert && (
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 mb-4">
                      <Zap className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-900 leading-tight">Low Stock Alert: You've hit your shop spending threshold. Restock for exclusive Pro deals.</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-bold text-indigo-600 border border-indigo-100 bg-indigo-50/5 px-4 py-2 rounded-xl">
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {profitability.pulse?.nextPerk || "Keep shopping to unlock perks"}
                    </span>
                    <button className="uppercase tracking-widest font-black text-indigo-700 hover:text-indigo-800 transition-colors">Shop Now</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-sm shadow-rose-100">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-none">Regional Demand</h3>
                        <p className="text-[10px] text-rose-600 font-black uppercase tracking-widest mt-1">Real-time Hotspots</p>
                      </div>
                    </div>
                    {loadingDemand && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>

                  <div className="space-y-3">
                    {regionalDemand.length === 0 && !loadingDemand ? (
                      <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        <p className="text-xs font-medium text-slate-400">No active job clusters found in your area yet.</p>
                      </div>
                    ) : (
                      regionalDemand.map((region, i) => (
                        <div key={region.area} className="group relative bg-white border border-slate-100 rounded-2xl p-3 hover:border-rose-200 hover:shadow-md hover:shadow-rose-500/5 transition-all">
                          <div className="absolute inset-y-0 left-0 w-1 bg-rose-500 rounded-l-full overflow-hidden">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${region.intensity * 100}%` }}
                              className="w-full bg-rose-600"
                            />
                          </div>
                          <div className="pl-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900">{region.area}</span>
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded",
                                  region.intensity > 0.7 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
                                )}>
                                  {region.intensity > 0.7 ? "High Heat" : "Steady"}
                                </span>
                              </div>
                              <p className="text-[10px] font-medium text-slate-500 mt-1">
                                <span className="text-rose-600 font-bold">{region.jobCount} jobs</span> in {region.topCategory}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Potential Value</p>
                              <p className="text-sm font-black text-slate-900 mt-1">£{region.totalEstimate.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-[8px] text-slate-400 mt-4 text-center font-bold uppercase tracking-widest">
                    Clusters updated every 15 minutes based on active postings
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {!showInsights && (
          <div className="px-6 py-2 flex items-center justify-between bg-slate-50 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <BarChart3 className="w-3 h-3 text-blue-600" />
                £{(profitability.netProfit || 0).toLocaleString()} Profit
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <Activity className="w-3 h-3 text-indigo-600" />
                {profitability.pulse?.score || 0}% Vitality
              </div>
            </div>
            <button 
              onClick={() => {
                setShowInsights(true);
                setUserInteractedWithInsights(true);
              }}
              className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors"
            >
              Expand Analytics
            </button>
          </div>
        )}
      </motion.div>
    );
  };

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
      
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <BusinessInsightsWidget />
      </motion.div>
      
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] py-3 px-4 rounded-3xl text-white shadow-xl relative overflow-hidden group"
      >
        {/* Decorative Elements */}
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
        <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm shadow-orange-500/20">
                  {profile?.joinedDuringBeta ? "Free Beta Member" : "Active Member"}
                </span>
                {profile?.isFoundingMember && (
                  <div className="flex items-center gap-1 text-blue-200 text-[8px] font-bold uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded">
                    <Award className="w-2 h-2 text-orange-400" />
                    Founding Member
                  </div>
                )}
                <div className="flex items-center gap-1 text-blue-200 text-[8px] font-bold uppercase tracking-widest">
                  <CheckCircle2 className="w-2 h-2" />
                  {profile?.verificationStatus === "auditioned" ? "Auditioned Pro" : 
                   profile?.verificationStatus === "vetted" ? "Vetted Pro" : 
                   profile?.verificationStatus === "verified" ? "Verified Status" : "Onboarding"}
                </div>
              </div>
              
              <h3 className="text-base md:text-lg font-display font-black tracking-tight leading-snug">
                You've saved <span className="text-orange-400">£{(profile?.phantomFeesSaved || 0).toFixed(2)}</span> in platform fees!
              </h3>
            </div>

            <button 
              onClick={() => {
                setShowSavingsInfo(!showSavingsInfo);
                setUserInteractedWithSavings(true);
              }}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all shrink-0"
            >
              {showSavingsInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence>
            {showSavingsInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <p className="text-blue-100/70 text-sm font-medium max-w-md">
                    As a beta member, we've waived the standard 15% success fee on your completed jobs. Enjoy 100% of your earnings.
                  </p>
                  
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10 flex items-center gap-4 shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Member ID</p>
                      <p className="text-2xl font-black text-white leading-none mt-1 tracking-widest">{profile?.memberId || "---"}</p>
                      <Link 
                        to="/billing"
                        className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-white bg-white/10 hover:bg-white/20 transition-all px-3 py-1.5 rounded-full uppercase tracking-wider"
                      >
                        Manage Billing 
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

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
        <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
          {/* Test Alert Toggle */}
          <button
            type="button"
            onClick={() => setShowTestAlert(true)}
            className="self-end flex items-center gap-1.5 bg-zinc-900 text-white px-2.5 h-7 rounded-2xl shadow-sm hover:bg-zinc-800 transition-colors shrink-0"
          >
            <Zap className="w-3 h-3 text-red-500 fill-red-500" />
            <span className="text-[10px] font-bold truncate">Test IM Alert</span>
          </button>

          {/* Toggles Container */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-hide">
            {/* Emergency Toggle */}
            <div className={cn("flex items-center gap-1.5 px-2 h-8 rounded-2xl border border-black shadow-sm shrink-0 transition-colors", profile?.isAvailableForEmergency ? "bg-red-50" : "bg-white")}>
              <Zap className={cn("w-3 h-3", profile?.isAvailableForEmergency ? "text-red-500" : "text-slate-400")} />
              <span className="text-[10px] font-bold text-slate-700 truncate">Emergency</span>
              <button 
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!user) return;
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
                  } catch (error) {
                    console.error("Error updating emergency status:", error);
                    alert("Unable to update emergency status.");
                  }
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none touch-manipulation z-50 ${confirmingEmergency ? 'bg-amber-400' : (profile?.isAvailableForEmergency ? 'bg-red-500' : 'bg-slate-300')}`}
              >
                <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${profile?.isAvailableForEmergency ? 'translate-x-4' : 'translate-x-[2px]'}`} />
              </button>
            </div>

            {/* Instant Match Toggle */}
            <div className={cn("flex items-center gap-1.5 px-2 h-8 rounded-2xl border border-black shadow-sm shrink-0 transition-colors", profile?.isAvailableForInstantMatch ? "bg-amber-50" : "bg-white")}>
              <Zap className={cn("w-3 h-3", profile?.isAvailableForInstantMatch ? "text-amber-500" : "text-slate-400")} />
              <span className="text-[10px] font-bold text-slate-700 truncate">Instant Match</span>
              <button 
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!user) return;
                  
                  // If turning on and no pricing set, show setup
                  if (!profile?.isAvailableForInstantMatch && (!profile?.instantMatchPricing || !profile?.instantMatchPricing.callOutFee)) {
                    setImSetupData(profile?.instantMatchPricing || { callOutFee: "", hourlyRate: "", terms: "" });
                    setShowInstantMatchSetup(true);
                    return;
                  }

                  if (!confirmingIM) {
                    setConfirmingIM(true);
                    setShowIMToast(true);
                    setTimeout(() => setShowIMToast(false), 3000);
                    setTimeout(() => setConfirmingIM(false), 3000);
                    return;
                  }
                  setConfirmingIM(false);
                  setShowIMToast(false);
                  try {
                    await updateDoc(doc(db, "users", user.uid), {
                      isAvailableForInstantMatch: !profile?.isAvailableForInstantMatch
                    });
                  } catch (error) {
                    console.error("Error updating Instant Match status:", error);
                    alert("Unable to update Instant Match status.");
                  }
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none touch-manipulation z-50 ${confirmingIM ? 'bg-amber-400' : (profile?.isAvailableForInstantMatch ? 'bg-amber-500' : 'bg-slate-300')}`}
              >
                <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${profile?.isAvailableForInstantMatch ? 'translate-x-4' : 'translate-x-[2px]'}`} />
              </button>
            </div>

            {/* Exclusive Job Offers Toggle */}
            {sysConfig?.paywallEnabled !== false && (
              <div className={cn("flex items-center gap-1.5 px-2 h-8 rounded-2xl border border-black shadow-sm shrink-0 transition-colors overflow-hidden", (profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? "bg-yellow-50" : "bg-white")}>
                <Zap className="w-3 h-3 text-yellow-500 fill-current" />
                <span className="text-[10px] font-black uppercase text-yellow-900 tracking-tight">Priority Offers</span>
                <button 
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!profile?.hasExclusiveAddon) {
                      setShowExclusiveModal(true);
                    } else {
                      try {
                        const newState = profile?.isExclusiveActive === false ? true : false;
                        await updateDoc(doc(db, "users", user!.uid), {
                          isExclusiveActive: newState
                        });
                        
                        // Brief toast explanation
                        if (newState) {
                           alert("Priority Offer Activated: You will now receive early-access notifications for new jobs matching your profile.");
                        }
                      } catch (error) {
                        console.error("Error toggling exclusive status", error);
                      }
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none z-10 ${(profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? 'bg-yellow-500' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${(profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? 'translate-x-4' : 'translate-x-[2px]'}`} />
                </button>
              </div>
            )}
          </div>

          {/* Actions Container */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
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
              className="bg-white text-slate-700 border border-black h-11 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex flex-1 sm:flex-none items-center justify-center sm:justify-start px-4 gap-2 shadow-sm shrink-0"
            >
              <Share2 className="w-4 h-4 text-blue-600" />
              Share
            </button>

            {/* Availability Button */}
            <Link 
              to="/availability"
              className="bg-white text-slate-700 border border-black h-11 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex flex-1 sm:flex-none items-center justify-center sm:justify-start px-4 gap-2 shadow-sm shrink-0"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              Set Availability
            </Link>
          </div>

          <Link 
            to="/job-feed" 
            className="bg-primary text-white h-11 px-6 rounded-2xl font-bold border border-primary hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex w-full sm:w-auto items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            <Briefcase className="w-5 h-5" />
            Find Jobs
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-black shadow-sm space-y-1 content-center">
          <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-1">
            <PoundSterling className="w-3 h-3" />
          </div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Quotes</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.activeQuotes}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-black shadow-sm space-y-1 content-center">
          <div className="w-6 h-6 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mb-1">
            <Briefcase className="w-3 h-3" />
          </div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Active Jobs</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.activeJobs}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-black shadow-sm space-y-1 content-center">
          <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-1">
            <Calendar className="w-3 h-3" />
          </div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Upcoming</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.upcomingJobs}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-black shadow-sm space-y-1 content-center">
          <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 mb-1">
            <Star className="w-3 h-3 fill-current" />
          </div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Rating</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{profile?.rating ? profile.rating.toFixed(1) : "N/A"}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-black shadow-sm space-y-1 content-center">
          <div className="w-6 h-6 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-1">
            <ShieldCheck className="w-3 h-3" />
          </div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Status</p>
          <p className={cn(
            "text-xs sm:text-sm font-bold truncate",
            profile?.verificationStatus === "verified" ? "text-green-600" : "text-amber-600"
          )}>
            {profile?.verificationStatus === "verified" ? "Verified" : "Unverified"}
          </p>
        </div>
      </div>
      
      {/* Auto-scrolling Advertisement Banner */}
      <PartnerAdvertisement />

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

        {showExclusiveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowExclusiveModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl relative z-10 border border-amber-200 max-h-[70vh] flex flex-col"
            >
              <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-6 text-center relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <button onClick={() => setShowExclusiveModal(false)} className="bg-black/20 hover:bg-black/30 text-white rounded-full p-2 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2 backdrop-blur-md">
                  <Zap className="w-6 h-6 text-amber-50 fill-current" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Unlock Priority Offers</h2>
                <p className="text-amber-100 font-medium mt-1 text-sm max-w-sm mx-auto">Beat the competition by getting notified before jobs hit the public feed.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Time-Gated Leads</h4>
                      <p className="text-xs text-slate-500">Access emergency jobs early and normal jobs 15 mins early.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-amber-600 fill-current" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Top 5 Quote Guarantee</h4>
                      <p className="text-xs text-slate-500">Submit your quote while others are locked out. Get matched to 3 Exclusive Offer per day.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Add-on Price</p>
                  <p className="text-3xl font-black text-slate-900">£{getExclusivePrice()}<span className="text-sm text-slate-500 font-medium">/mo</span></p>
                </div>

                {exclusiveCheckoutError && (
                  <div className="bg-red-50 text-red-600 p-2 rounded-xl text-xs font-bold text-center">
                    {exclusiveCheckoutError}
                  </div>
                )}

                <button 
                  onClick={handleExclusiveCheckout}
                  disabled={isProcessingExclusive}
                  className="w-full h-12 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-2xl font-black text-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessingExclusive ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </>
                  ) : (
                    <>
                      Unlock Priority Offers
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-400 font-medium">Cancel anytime. Applied to your existing subscription.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Instant Match Trader Alert Demo */}
      <AnimatePresence>
        {showTestAlert && (
          <InstantMatchTraderAlert 
            job={{ id: '1', title: 'Burst Pipe', location: { address: 'Peckham, SE15' }, assetName: 'Main House' }}
            expiresAt={new Date(Date.now() + 60000).toISOString()}
            onAccept={() => {
              alert('Job Accepted!');
              setShowTestAlert(false);
            }}
            onDecline={() => setShowTestAlert(false)}
          />
        )}
      </AnimatePresence>

      {/* Actual Instant Match Worker Notification */}
      <AnimatePresence>
        {showIMAlert && activeIMJob && activeIMAttempt && (
          <InstantMatchTraderAlert 
            job={activeIMJob}
            expiresAt={activeIMAttempt.expiresAt}
            onAccept={handleAcceptIM}
            onDecline={handleDeclineIM}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIMToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-[#1e293b] text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 whitespace-nowrap"
          >
            <Zap className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-bold">Tap again to confirm Instant Match</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instant Match Setup Modal */}
      <AnimatePresence>
        {showInstantMatchSetup && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowInstantMatchSetup(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Instant Match Setup
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Set your emergency response rates</p>
                </div>
                <button
                  onClick={() => setShowInstantMatchSetup(false)}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Call-Out Fee (£)</label>
                    <input 
                      type="number"
                      value={imSetupData.callOutFee}
                      onChange={e => setImSetupData({ ...imSetupData, callOutFee: e.target.value })}
                      placeholder="e.g. 50"
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    />
                    <p className="text-xs text-slate-500 mt-1.5 px-1">Fixed fee just to arrive on site in an emergency.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Hourly Rate (£/hr)</label>
                    <input 
                      type="number"
                      value={imSetupData.hourlyRate}
                      onChange={e => setImSetupData({ ...imSetupData, hourlyRate: e.target.value })}
                      placeholder="e.g. 80"
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    />
                    <p className="text-xs text-slate-500 mt-1.5 px-1">Charge per hour for subsequent emergency repair work.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Terms &amp; Conditions</label>
                    <textarea 
                      value={imSetupData.terms}
                      onChange={e => setImSetupData({ ...imSetupData, terms: e.target.value })}
                      placeholder="e.g. Rate excludes materials. Client must be present to provide access."
                      className="w-full min-h-[100px] bg-slate-50 border border-slate-200 rounded-2xl p-4 font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors resize-y"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-4">
                  <h4 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    How Instant Matches Work
                  </h4>
                  <ul className="space-y-1.5 text-xs text-amber-800/80 font-medium list-disc pl-4">
                    <li>This pricing is shown to homeowners when they request an emergency instant match.</li>
                    <li>Because they accept these rates upfront, there is no negotiation phase.</li>
                    <li>You must be ready to deploy immediately if you accept a match.</li>
                    <li>Repeated cancellations after accepting will disable this feature.</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100">
                <button
                  disabled={isSavingIM || !imSetupData.callOutFee || !imSetupData.hourlyRate}
                  onClick={async () => {
                    setIsSavingIM(true);
                    try {
                      await updateDoc(doc(db, "users", user!.uid), {
                        instantMatchPricing: {
                           callOutFee: Number(imSetupData.callOutFee),
                           hourlyRate: Number(imSetupData.hourlyRate),
                           terms: imSetupData.terms || ""
                        },
                        isAvailableForInstantMatch: true
                      });
                      setShowInstantMatchSetup(false);
                    } catch (error) {
                      console.error("Failed to save instant match settings", error);
                      alert("Error saving settings.");
                    } finally {
                      setIsSavingIM(false);
                    }
                  }}
                  className="w-full h-12 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-2xl font-black transition-colors flex items-center justify-center gap-2"
                >
                  {isSavingIM ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Enable Instant Match"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
