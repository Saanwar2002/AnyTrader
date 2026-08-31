import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { 
  collection, query, where, orderBy, onSnapshot, db, collectionGroup, handleFirestoreError, OperationType, limit, updateDoc, doc, getDoc, getDocs, setDoc
} from "@/src/firebase";
import { getRecommendedJobs } from "@/src/services/gemini";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { TraderUpcomingAppointments } from './shared/TraderUpcomingAppointments';
import { motion, AnimatePresence } from "motion/react";
import { 
  Briefcase, Clock, MessageSquare, CheckCircle2, 
  ChevronRight, Star, Search, BarChart3, PoundSterling, ShieldCheck, Zap, UserPlus,
  Image as ImageIcon, Video as VideoIcon, Loader2, MapPin, Share2, Calendar, X, Info, Award, ArrowRight,
  ChevronDown, ChevronUp, Activity, XCircle, AlertCircle, RotateCw
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn, getOutwardPostcode, formatJobLocation } from "@/src/lib/utils";
import { TRADE_CATEGORIES } from "@/src/constants";
import MediaGalleryModal from "./MediaGalleryModal";
import { SEO } from "./SEO";

import PartnerPerks from "./PartnerPerks";
import PartnerAdvertisement from "./shared/PartnerAdvertisement";
import { getRegionalDemandData, RegionalDemand } from "@/src/services/demandHeatmapService";
import { InstantMatchTraderAlert } from "./InstantMatchTraderAlert";
import { FinancialDashboardWidget } from "./FinancialDashboardWidget";
import { TraderMonetizationBanners } from "./TraderMonetizationBanners";
import { INITIAL_MOCK_FLASH_DEALS } from "@/src/services/seedService";
import { 
  isDealSoldOut, 
  isDealPaused, 
  getRemainingSlots, 
  getDealCapacityInfo, 
  FLASH_DEAL_SCHEDULE_OPTIONS, 
  formatDealBadgeText, 
  formatDealScheduleText 
} from "@/src/lib/flashDeals";

const iconMap: Record<string, any> = {
  Briefcase, Clock, MessageSquare, CheckCircle2, ChevronRight, Star, Search, BarChart3, PoundSterling, ShieldCheck, Zap, UserPlus, ImageIcon, VideoIcon
};

export default function TradesDashboard({ isSubView }: { isSubView?: boolean }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showTestAlert, setShowTestAlert] = useState(false);
  const [activeQuotes, setActiveQuotes] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [postedJobs, setPostedJobs] = useState<any[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [pendingPaymentJobs, setPendingPaymentJobs] = useState<any[]>([]);
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
  const [showSavingsInfo, setShowSavingsInfo] = useState(false);

  // Auto-dismiss the savings info section after 5 seconds of being open
  useEffect(() => {
    if (showSavingsInfo) {
      const timer = setTimeout(() => {
        setShowSavingsInfo(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSavingsInfo]);

  // Auto-close savings info on scroll
  useEffect(() => {
    let lastY = 0;
    const handleScroll = () => {
      if (window.scrollY > 20) {
        if (showSavingsInfo) setShowSavingsInfo(false);
      }
    };

    const handleTouch = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      if (lastY > 0 && Math.abs(currentY - lastY) > 10) {
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
  }, [showSavingsInfo]);

  // Exclusive Job Offers State
  const [showExclusiveModal, setShowExclusiveModal] = useState(false);
  const [isProcessingExclusive, setIsProcessingExclusive] = useState(false);
  const [exclusiveCheckoutError, setExclusiveCheckoutError] = useState<string | null>(null);

  // Off-Peak Quiet Period Flash Deals State
  const [myDeals, setMyDeals] = useState<any[]>([]);
  const [directRequests, setDirectRequests] = useState<any[]>([]);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [dealService, setDealService] = useState("");
  const [dealDiscount, setDealDiscount] = useState(20);
  const [dealDay, setDealDay] = useState("Tuesday");
  const [dealDesc, setDealDesc] = useState("");
  const [dealOrigPrice, setDealOrigPrice] = useState("");
  const [dealLimitType, setDealLimitType] = useState<"preset" | "custom" | "unlimited">("preset");
  const [dealMaxClaims, setDealMaxClaims] = useState<number | null>(5);
  const [customLimitInput, setCustomLimitInput] = useState("5");
  const [editingDealLimitId, setEditingDealLimitId] = useState<string | null>(null);
  const [editLimitNumber, setEditLimitNumber] = useState<number | string>(5);
  const [isSavingDeal, setIsSavingDeal] = useState(false);

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "instant_match_attempts");
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
      where("acceptedTradespersonId", "==", user.uid),
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

    // Fetch pending payment jobs
    const pendingPaymentJobsQuery = query(
      collection(db, "jobs"),
      where("acceptedTradespersonId", "==", user.uid),
      where("status", "==", "completed")
    );

    const unsubscribePendingPaymentJobs = onSnapshot(pendingPaymentJobsQuery, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Filter those that are not explicitly paid
      const unpaid = jobsData.filter(j => j.paymentStatus === "pending" || j.paymentStatus === "unpaid" || (!j.paymentStatus && !j.isPaid));
      setPendingPaymentJobs(unpaid);
    }, (error) => {
      console.error("Error fetching pending payment jobs:", error);
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

    // Fetch my flash_deals
    const dealsQuery = query(
      collection(db, "flash_deals"),
      where("traderId", "==", user.uid)
    );

    const unsubscribeDeals = onSnapshot(dealsQuery, (snapshot) => {
      const dbDeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const mockMatches = INITIAL_MOCK_FLASH_DEALS.filter(m => m.traderId === user.uid);
      const existingIds = new Set(dbDeals.map(d => d.id));
      const merged = [...dbDeals, ...mockMatches.filter(m => !existingIds.has(m.id))];
      setMyDeals(merged);
    }, (error) => {
      console.error("Error fetching my flash deals:", error);
      setMyDeals(INITIAL_MOCK_FLASH_DEALS.filter(m => m.traderId === user.uid));
    });

    // Fetch incoming direct quote requests and claimed flash deals
    const directRequestsQuery = query(
      collection(db, "jobs"),
      where("targetTradespersonId", "==", user.uid),
      where("status", "in", ["posted", "open"])
    );

    const unsubscribeDirectRequests = onSnapshot(directRequestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDirectRequests(requests);
    }, (error) => {
      console.error("Error fetching direct requests for tradesperson:", error);
    });

    return () => {
      unsubscribeQuotes();
      unsubscribeJobs();
      unsubscribePendingPaymentJobs();
      unsubscribePostedJobs();
      unsubscribeDeals();
      unsubscribeDirectRequests();
    };
  }, [user, profile]);

  const fetchRecommendations = async (bypassCache = false) => {
    if (!user || !profile || profile.role !== "tradesperson") return;
    
    setIsRecommending(true);
    try {
      const cacheRef = doc(db, "users", user.uid, "recommendations", "current");
      
      if (!bypassCache) {
        // 1. Attempt to load from 24h Firestore cache
        const cacheSnap = await getDoc(cacheRef);
        if (cacheSnap.exists()) {
          const cacheData = cacheSnap.data();
          const createdAt = cacheData.createdAt;
          const cacheTime = createdAt ? new Date(createdAt).getTime() : 0;
          if (Date.now() - cacheTime < 24 * 60 * 60 * 1000) {
            setRecommendedJobs(cacheData.jobs || []);
            setIsRecommending(false);
            return;
          }
        }
      }

      // Use profile trades, or default to null for guests/incomplete profiles
      const categoryToMatch = (profile.trades && profile.trades.length > 0) ? profile.trades[0] : null;
      
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
      
      const snapshot = await getDocs(q);

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

        // Save to 24h Firestore cache
        await setDoc(cacheRef, {
          jobs: enriched,
          createdAt: new Date().toISOString()
        });
      } else {
        setRecommendedJobs([]);
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setIsRecommending(false);
    }
  };

  useEffect(() => {
    if (activeJobs.length >= 0) {
      fetchRecommendations(false);
    }
  }, [user, profile, activeJobs.length]);

  return (
    <div className={cn("space-y-6", !isSubView && "pb-12")}>
      {!isSubView && (
        <SEO 
          title="Tradesperson Dashboard" 
          description="Manage your quotes, active jobs, and find new work opportunities on AnyTrader."
        />
      )}
      
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
                  
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-black/10 flex items-center gap-4 shrink-0">
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

      <div className="w-full bg-white/90 backdrop-blur-xs p-2 sm:p-2.5 rounded-2xl border border-black/10 shadow-xs mb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 w-full min-w-0 scrollbar-none">
          {/* Emergency Toggle */}
          <div
            role="button"
            tabIndex={0}
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
            className={cn(
              "flex items-center justify-between gap-2.5 bg-white border border-black rounded-[10px] px-3 py-2 shadow-xs cursor-pointer select-none transition-all active:scale-[0.99] shrink-0",
              profile?.isAvailableForEmergency ? "bg-red-50/70" : "hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
              <Zap className={cn("w-4 h-4 shrink-0 transition-colors", profile?.isAvailableForEmergency ? "text-red-600 fill-red-600" : "text-slate-700")} />
              <span className="text-[13px] tracking-tight font-extrabold text-slate-900">Emergency</span>
            </div>
            {/* Compact Slider Switch */}
            <div className={cn(
              "w-[34px] h-[18px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black",
              confirmingEmergency ? "bg-amber-400" : (profile?.isAvailableForEmergency ? "bg-red-600" : "bg-slate-200")
            )}>
              <div className={cn(
                "w-[12px] h-[12px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0",
                profile?.isAvailableForEmergency ? "translate-x-[16px]" : "translate-x-0"
              )} />
            </div>
          </div>

          {/* Instant Match Toggle */}
          <div
            role="button"
            tabIndex={0}
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
            className={cn(
              "flex items-center justify-between gap-2.5 bg-white border border-black rounded-[10px] px-3 py-2 shadow-xs cursor-pointer select-none transition-all active:scale-[0.99] shrink-0",
              profile?.isAvailableForInstantMatch ? "bg-blue-50/70" : "hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
              <Zap className={cn("w-4 h-4 shrink-0 transition-colors", profile?.isAvailableForInstantMatch ? "text-[#2563EB] fill-[#2563EB]" : "text-slate-700")} />
              <span className="text-[13px] tracking-tight font-extrabold text-slate-900">Instant Match</span>
            </div>
            {/* Compact Slider Switch */}
            <div className={cn(
              "w-[34px] h-[18px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black",
              confirmingIM ? "bg-amber-400" : (profile?.isAvailableForInstantMatch ? "bg-[#2563EB]" : "bg-slate-200")
            )}>
              <div className={cn(
                "w-[12px] h-[12px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0",
                profile?.isAvailableForInstantMatch ? "translate-x-[16px]" : "translate-x-0"
              )} />
            </div>
          </div>

          {/* Exclusive Job Offers Toggle */}
          {sysConfig?.paywallEnabled !== false && (
            <div
              role="button"
              tabIndex={0}
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
              className={cn(
                "flex items-center justify-between gap-2.5 bg-white border border-black rounded-[10px] px-3 py-2 shadow-xs cursor-pointer select-none transition-all active:scale-[0.99] shrink-0",
                (profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? "bg-blue-50/70" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
                <Zap className={cn("w-4 h-4 shrink-0 transition-colors", (profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? "text-[#2563EB] fill-[#2563EB]" : "text-slate-700")} />
                <span className="text-[13px] tracking-tight font-extrabold text-slate-900">Priority Offers</span>
              </div>
              {/* Compact Slider Switch */}
              <div className={cn(
                "w-[34px] h-[18px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black",
                (profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? "bg-[#2563EB]" : "bg-slate-200"
              )}>
                <div className={cn(
                  "w-[12px] h-[12px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0",
                  (profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false) ? "translate-x-[16px]" : "translate-x-0"
                )} />
              </div>
            </div>
          )}

          {/* Test Alert Button (Integrated into row with no overlap) */}
          <button
            type="button"
            onClick={() => setShowTestAlert(true)}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 rounded-[10px] shadow-xs transition-all shrink-0 active:scale-95 border border-black"
            title="Test Instant Match Alert notification"
          >
            <Zap className="w-4 h-4 text-red-500 fill-red-500 animate-pulse shrink-0" />
            <span className="text-[13px] font-extrabold whitespace-nowrap">Test IM Alert</span>
          </button>
        </div>
      </div>

      {/* Main Dashboard Action Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
            className="bg-white text-slate-700 border border-black h-10 sm:h-11 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex flex-1 sm:flex-none items-center justify-center sm:justify-start px-3.5 gap-2 shadow-xs shrink-0"
          >
            <Share2 className="w-4 h-4 text-blue-600" />
            Share
          </button>

          {/* Availability Button */}
          <Link 
            to="/availability"
            className="bg-white text-slate-700 border border-black h-10 sm:h-11 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex flex-1 sm:flex-none items-center justify-center sm:justify-start px-3.5 gap-2 shadow-xs shrink-0"
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            Set Availability
          </Link>
        </div>

        <Link 
          to="/job-feed" 
          className="bg-primary text-white h-10 sm:h-11 px-5 rounded-2xl font-bold border border-primary hover:bg-primary-hover transition-all shadow-md shadow-primary/20 flex w-full sm:w-auto items-center justify-center gap-2 active:scale-95 shrink-0"
        >
          <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
          Find Jobs
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-2.5">
        <div className="bg-white p-2.5 rounded-xl border border-black shadow-sm flex flex-col justify-between min-w-0 h-20">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 bg-blue-50 rounded-md flex items-center justify-center text-blue-600 shrink-0">
              <PoundSterling className="w-3 h-3" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">Quotes</p>
          </div>
          <p className="text-lg sm:text-lg font-black text-slate-900 truncate leading-none">{stats.activeQuotes}</p>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-black shadow-sm flex flex-col justify-between min-w-0 h-20">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 bg-green-50 rounded-md flex items-center justify-center text-green-600 shrink-0">
              <Briefcase className="w-3 h-3" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">Active Jobs</p>
          </div>
          <p className="text-lg sm:text-lg font-black text-slate-900 truncate leading-none">{stats.activeJobs}</p>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-black shadow-sm flex flex-col justify-between min-w-0 h-20">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 bg-indigo-50 rounded-md flex items-center justify-center text-indigo-600 shrink-0">
              <Calendar className="w-3 h-3" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">Upcoming</p>
          </div>
          <p className="text-lg sm:text-lg font-black text-slate-900 truncate leading-none">{stats.upcomingJobs}</p>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-black shadow-sm flex flex-col justify-between min-w-0 h-20">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 bg-amber-50 rounded-md flex items-center justify-center text-amber-600 shrink-0">
              <Star className="w-3 h-3 fill-current" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">Rating</p>
          </div>
          <p className="text-lg sm:text-lg font-black text-slate-900 truncate leading-none">{profile?.rating ? profile.rating.toFixed(1) : "N/A"}</p>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-black shadow-sm flex flex-col justify-between min-w-0 h-20">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 bg-purple-50 rounded-md flex items-center justify-center text-purple-600 shrink-0">
              <ShieldCheck className="w-3 h-3" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">Status</p>
          </div>
          <p className={cn(
            "text-xs sm:text-xs font-black truncate leading-none",
            profile?.verificationStatus === "verified" ? "text-green-600" : "text-amber-600"
          )}>
            {profile?.verificationStatus === "verified" ? "Verified" : "Unverified"}
          </p>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-black shadow-sm flex flex-col justify-between min-w-0 h-20">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 bg-red-50 rounded-md flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle className="w-3 h-3" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">Unpaid Invcs</p>
          </div>
          <p className="text-lg sm:text-lg font-black text-slate-900 truncate leading-none">{pendingPaymentJobs.length}</p>
        </div>
      </div>
      
      {/* Auto-scrolling Advertisement Banner */}
      <PartnerAdvertisement />

      {/* TradeOS Financials & Cash Flow Engine */}
      <FinancialDashboardWidget />

      {/* Incoming Direct Requests & Claimed Flash Deals */}
      {directRequests.length > 0 && (
        <div className="space-y-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 sm:p-5 rounded-3xl border border-emerald-300 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                ⚡
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  Incoming Direct Requests & Claimed Deals
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium">
                  Homeowners who booked your Flash Deals or invited you directly to quote.
                </p>
              </div>
            </div>
            <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-2xs">
              {directRequests.length} Pending
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {directRequests.map(job => (
              <div
                key={job.id}
                className="bg-white p-4 rounded-2xl border border-black shadow-xs flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group"
              >
                {job.claimedDeal ? (
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white font-black text-[9px] px-3 py-1 uppercase rounded-bl-xl flex items-center gap-1 shadow-2xs">
                    <span>⚡ {job.claimedDeal.discountPercentage || 0}% OFF FLASH DEAL</span>
                  </div>
                ) : (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white font-black text-[9px] px-3 py-1 uppercase rounded-bl-xl flex items-center gap-1 shadow-2xs">
                    <span>📝 1-ON-1 DIRECT INVITE</span>
                  </div>
                )}

                <div className="space-y-1.5 pr-24">
                  <div className="flex items-center gap-2 max-w-full overflow-hidden flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded truncate whitespace-nowrap max-w-full">
                      {job.category} {job.subcategory ? `• ${job.subcategory}` : ''}
                    </span>
                    {(() => {
                      const qCount = job.quoteCount || 0;
                      const isFull = qCount >= 5;
                      return (
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full transition-all",
                          isFull
                            ? "border-2 border-red-500 text-red-700 bg-red-50"
                            : "border-2 border-emerald-500 text-emerald-800 bg-emerald-50 pulse-green-border"
                        )}>
                          {isFull ? 'Max Quotes Reached' : 'Seeking Quotes'}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1 group-hover:text-emerald-700 transition-colors">
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-snug">
                    {job.description}
                  </p>

                  {job.claimedDeal && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-[10.5px] font-bold text-emerald-800">
                        Pre-Agreed Flash Rate:
                      </span>
                      <span className="font-black text-emerald-700">
                        £{job.claimedDeal.discountedPrice || job.claimedDeal.targetRate || job.claimedDeal.price}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <MapPin className="w-3 h-3" />
                    <span>{formatJobLocation(job)}</span>
                  </div>

                  <Link
                    to={`/job/${job.id}`}
                    className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white text-xs font-black rounded-xl shadow-2xs flex items-center gap-1 transition-all"
                  >
                    <span>Review & Quote</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {profile?.role === "tradesperson" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-slate-900">AI Recommended Jobs</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRecommendations(true)}
                disabled={isRecommending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
              >
                <RotateCw className={cn("w-3.5 h-3.5", isRecommending && "animate-spin")} />
                <span>Refresh Matches</span>
              </button>
              {isRecommending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
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
                    isCurrentlyBoosted ? "border-red-500 hover:shadow-red-500/20" : "border-black hover:border-orange-200"
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
                      <div className="px-2 py-0.5 rounded-full bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border border-black">
                        {job.category}
                      </div>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-950 mb-1 group-hover:text-orange-600 transition-colors line-clamp-1">{job.title}</h3>
                  <p className="text-xs text-slate-900 font-semibold line-clamp-2 mb-3 leading-relaxed">{job.description}</p>
                  
                  {job.aiReason && (
                    <div className="mb-3 p-2 bg-orange-50/50 rounded-xl border border-orange-100/50">
                      <p className="text-[10px] text-orange-950 font-medium leading-tight italic">
                        <span className="font-black uppercase mr-1">AI Insight:</span>
                        {job.aiReason}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-black text-slate-900 uppercase">
                    <div className="flex items-center gap-1 text-slate-900 font-black">
                      <MapPin className="w-3 h-3 text-slate-800" />
                      <span className="text-slate-900 font-black">{formatJobLocation(job)}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )})}
            </div>
          ) : !isRecommending && (
            <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-black text-center">
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
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl hidden sm:flex">
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
              <Link to="/trade-jobs" className="text-sm font-bold text-blue-600 hover:underline shrink-0">Manage all</Link>
            </div>
          </div>
          
          <div className="space-y-3">
            {(() => {
              const displayJobs = activeJobs.filter(j => 
                projectTab === "active" ? j.status === "in_progress" : j.status === "accepted"
              );

              if (displayJobs.length === 0) {
                return (
                  <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-black text-center">
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
                  className="bg-white p-4 rounded-2xl border border-black shadow-sm hover:border-blue-200 transition-all flex items-center gap-4 group"
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
              <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-black text-center">
                <p className="text-slate-500 text-sm">You have no pending quotes.</p>
              </div>
            ) : (
              activeQuotes.slice(0, 5).map((quote) => (
                <Link
                  key={quote.id}
                  to="/my-quotes"
                  className="bg-white p-4 rounded-2xl border border-black shadow-sm flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all group"
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

      <TraderUpcomingAppointments />

      {/* Payment Pending Section */}
      {pendingPaymentJobs.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 border-l-4 border-amber-500 pl-3">Payment Pending</h3>
          </div>
          <div className="space-y-3">
            {pendingPaymentJobs.map((job) => (
              <Link
                key={job.id}
                to={`/job/${job.id}`}
                className="bg-white p-4 rounded-2xl border border-black shadow-sm flex items-center gap-4 hover:border-amber-200 hover:shadow-md transition-all group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-2xl"></div>
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0 group-hover:bg-amber-100 transition-colors">
                  <PoundSterling className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 truncate group-hover:text-amber-600 transition-colors">
                    {job.title || "Untitled Job"}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">{new Date(job.completedAt?.toDate?.() || job.completedAt).toLocaleDateString()}</p>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Awaiting Payment
                    </span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quiet Period Off-Peak Deals Section */}
      <div className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-black text-slate-900 flex items-center gap-2">
              <span className="text-2xl">🍂</span> Quiet Period Off-Peak Deals
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Increase your weekly bookings by offering off-peak weekday discounts. Showcased directly on the homeowner discovery feed!
            </p>
          </div>
          <button
            onClick={() => {
              setIsCreatingDeal(!isCreatingDeal);
              setDealService(profile?.trades?.[0] || "");
              setDealDiscount(20);
              setDealDay("All Week");
              setDealOrigPrice("");
              setDealDesc("");
            }}
            className="flex items-center justify-center gap-1.5 px-4 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all text-xs active:scale-95 border border-black cursor-pointer shadow-sm shrink-0"
          >
            {isCreatingDeal ? "Cancel Builder" : "⚡ Create Flash Deal"}
          </button>
        </div>

        {isCreatingDeal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 p-5 rounded-2xl border border-black space-y-4"
          >
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Flash Deal Builder</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service / Trade Title</label>
                <input
                  type="text"
                  value={dealService}
                  onChange={e => setDealService(e.target.value)}
                  placeholder="e.g. Boiler Servicing, Painting"
                  className="w-full h-11 bg-white border border-black rounded-xl px-3 font-semibold text-xs text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Discount %</label>
                <select
                  value={dealDiscount}
                  onChange={e => setDealDiscount(Number(e.target.value))}
                  className="w-full h-11 bg-white border border-black rounded-xl px-3 font-semibold text-xs text-slate-900 focus:outline-none"
                >
                  <option value={10}>10% Off</option>
                  <option value={15}>15% Off</option>
                  <option value={20}>20% Off</option>
                  <option value={25}>25% Off</option>
                  <option value={30}>30% Off</option>
                  <option value={40}>40% Off</option>
                  <option value={50}>50% Off</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deal Schedule / Active Days</label>
                <select
                  value={dealDay}
                  onChange={e => setDealDay(e.target.value)}
                  className="w-full h-11 bg-white border border-black rounded-xl px-3 font-bold text-xs text-slate-900 focus:outline-none"
                >
                  {FLASH_DEAL_SCHEDULE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Typical Price (£ - Optional)</label>
                <input
                  type="number"
                  value={dealOrigPrice}
                  onChange={e => setDealOrigPrice(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full h-11 bg-white border border-black rounded-xl px-3 font-semibold text-xs text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Deal Booking Limit / Daily Quantity */}
            <div className="bg-white p-4 rounded-xl border border-black/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Deal Booking Limit / Quantity for the Day 🛡️
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Control how many times this deal can be booked on the day so you never get overwhelmed. Once reached, the deal automatically shows as <strong>Sold Out</strong>.
                  </p>
                </div>
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                  {dealLimitType === "unlimited" ? "Unlimited Bookings" : `${dealLimitType === "custom" ? customLimitInput : dealMaxClaims} Bookings Max`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: "1 Booking (Exclusive)", value: 1, type: "preset" },
                  { label: "3 Bookings", value: 3, type: "preset" },
                  { label: "5 Bookings (Popular)", value: 5, type: "preset" },
                  { label: "10 Bookings", value: 10, type: "preset" },
                  { label: "Custom Number", value: "custom", type: "custom" },
                  { label: "Unlimited", value: "unlimited", type: "unlimited" },
                ].map((opt) => {
                  const isSelected =
                    opt.type === "preset"
                      ? dealLimitType === "preset" && dealMaxClaims === opt.value
                      : dealLimitType === opt.type;

                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        if (opt.type === "preset") {
                          setDealLimitType("preset");
                          setDealMaxClaims(opt.value as number);
                        } else if (opt.type === "custom") {
                          setDealLimitType("custom");
                        } else {
                          setDealLimitType("unlimited");
                          setDealMaxClaims(null);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                        isSelected
                          ? "bg-black text-white border-black shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {dealLimitType === "custom" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-slate-600">Set Max Bookings:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={customLimitInput}
                    onChange={(e) => setCustomLimitInput(e.target.value)}
                    className="w-24 h-9 bg-slate-50 border border-black rounded-lg px-2.5 font-bold text-xs text-slate-900 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500">deals max per day</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Promo Message / Short Notes</label>
              <textarea
                value={dealDesc}
                onChange={e => setDealDesc(e.target.value)}
                placeholder="e.g. Free filter cleaning included. Valid for any residential boiler booked for this Tuesday."
                rows={2}
                className="w-full bg-white border border-black rounded-xl p-3 font-semibold text-xs text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-bold italic">
                Preview: {dealDiscount}% off {dealService || 'Service'} · {formatDealScheduleText(dealDay)} ({dealLimitType === 'unlimited' ? 'Unlimited' : `Cap: ${dealLimitType === 'custom' ? customLimitInput : dealMaxClaims} claims`})
              </span>
              <button
                type="button"
                disabled={isSavingDeal || !dealService}
                onClick={async () => {
                  if (!user) return;
                  setIsSavingDeal(true);
                  try {
                    const finalMaxClaims =
                      dealLimitType === "unlimited"
                        ? null
                        : dealLimitType === "custom"
                        ? Number(customLimitInput) || 5
                        : Number(dealMaxClaims) || 5;

                    const dealId = `deal-${Date.now()}`;
                    const dealObj = {
                      id: dealId,
                      traderId: user.uid,
                      traderName: profile?.name || "Verified Trader",
                      traderBusinessName: profile?.businessName || profile?.name || "Verified Specialist",
                      traderAvatarUrl: profile?.avatarUrl || "",
                      service: dealService,
                      category: profile?.primaryCategory || profile?.trade || (profile?.trades && profile?.trades[0]) || "General",
                      discountPercentage: Number(dealDiscount),
                      originalPrice: dealOrigPrice ? Number(dealOrigPrice) : null,
                      discountedPrice: dealOrigPrice ? Number(dealOrigPrice) * (1 - Number(dealDiscount) / 100) : null,
                      dayOfWeek: dealDay,
                      description: dealDesc || `Special weekday discount for off-peak bookings.`,
                      status: "active",
                      maxClaims: finalMaxClaims,
                      claimedCount: 0,
                      createdAt: new Date().toISOString(),
                      city: profile?.city || "",
                      postcode: profile?.postcode || "",
                      rating: profile?.rating || 5.0,
                      totalReviews: profile?.totalReviews || 0
                    };
                    await setDoc(doc(db, "flash_deals", dealId), dealObj);
                    setIsCreatingDeal(false);
                    toast.success("Quiet Period Flash Deal published live with booking limit!");
                  } catch (e) {
                    console.error("Error creating flash deal:", e);
                    toast.error("Failed to publish flash deal.");
                  } finally {
                    setIsSavingDeal(false);
                  }
                }}
                className="px-5 h-11 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingDeal ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish Live Deal"}
              </button>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              My Active Flash Deals & Capacity Limits
            </h3>
            {myDeals.length > 0 && (
              <span className="text-[11px] font-bold text-slate-500">
                {myDeals.length} Deal{myDeals.length === 1 ? "" : "s"} Configured
              </span>
            )}
          </div>

          {myDeals.length === 0 ? (
            <div className="border border-dashed border-black/30 bg-slate-50 p-6 rounded-2xl text-center">
              <p className="text-slate-500 text-xs font-medium">You don't have any active off-peak deals currently.</p>
              <p className="text-[10px] text-slate-400 mt-1">Create one above to show up in the Deals Feed with automated booking limit protection!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myDeals.map(deal => {
                const soldOut = isDealSoldOut(deal);
                const paused = isDealPaused(deal);
                const isUnlimited = deal.maxClaims === null || deal.maxClaims === undefined || deal.maxClaims <= 0;
                const claims = Number(deal.claimedCount) || 0;
                const max = Number(deal.maxClaims) || 0;
                const remaining = isUnlimited ? null : Math.max(0, max - claims);
                const progressPct = isUnlimited ? 0 : Math.min(100, Math.round((claims / (max || 1)) * 100));

                return (
                  <div
                    key={deal.id}
                    className={cn(
                      "border rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all shadow-xs",
                      soldOut
                        ? "border-amber-400 bg-amber-50/40"
                        : paused
                        ? "border-slate-300 bg-slate-50/60"
                        : "border-black bg-white"
                    )}
                  >
                    {/* Top Status & Discount Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[9.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-black uppercase">
                          {formatDealBadgeText(deal.dayOfWeek)}
                        </span>
                        <span className="bg-emerald-600 text-white font-black text-[9px] px-2.5 py-0.5 uppercase rounded-full shadow-2xs">
                          🍁 {deal.discountPercentage}% OFF
                        </span>
                      </div>

                      {paused ? (
                        <span className="bg-slate-700 text-white font-black text-[9px] px-2.5 py-0.5 uppercase rounded-full shadow-2xs">
                          ⏸️ Paused
                        </span>
                      ) : soldOut ? (
                        <span className="bg-amber-600 text-white font-black text-[9px] px-2.5 py-0.5 uppercase rounded-full shadow-2xs animate-pulse">
                          🔴 Sold Out (Limit Reached)
                        </span>
                      ) : (
                        <span className="bg-emerald-600 text-white font-black text-[9px] px-2.5 py-0.5 uppercase rounded-full shadow-2xs">
                          ⚡ Active
                        </span>
                      )}
                    </div>

                    {/* Deal Info */}
                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-slate-900 text-sm">{deal.service}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-snug">{deal.description}</p>
                      
                      {deal.originalPrice && (
                        <p className="text-xs font-extrabold text-slate-600">
                          Price: <span className="line-through text-slate-400 mr-1.5">£{deal.originalPrice}</span> 
                          <span className="text-emerald-600">£{deal.discountedPrice?.toFixed(0)}</span>
                        </p>
                      )}
                    </div>

                    {/* Capacity & Claim Progress Tracker */}
                    <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-2.5 mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span className="text-slate-700 flex items-center gap-1">
                          <span>📊 Booking Capacity:</span>
                        </span>
                        {isUnlimited ? (
                          <span className="text-emerald-700 font-black">
                            Unlimited ({claims} booked)
                          </span>
                        ) : (
                          <span className={cn("font-black", soldOut ? "text-amber-700" : "text-slate-800")}>
                            {claims} of {max} Claimed ({progressPct}%)
                          </span>
                        )}
                      </div>

                      {!isUnlimited && (
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-300 rounded-full",
                              soldOut ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] pt-0.5 font-bold">
                        {soldOut ? (
                          <span className="text-amber-800 font-extrabold flex items-center gap-1">
                            ⚠️ Deal is grayed out for homeowners. Add slots below to reactivate.
                          </span>
                        ) : isUnlimited ? (
                          <span className="text-slate-500">
                            Homeowners can claim without booking caps.
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-black">
                            🔥 {remaining} spot{remaining === 1 ? "" : "s"} remaining before auto-close.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Reactivation & Slot Adjustment Controls */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                          Manage Deal Slots:
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            if (editingDealLimitId === deal.id) {
                              setEditingDealLimitId(null);
                            } else {
                              setEditingDealLimitId(deal.id);
                              setEditLimitNumber(deal.maxClaims || 5);
                            }
                          }}
                          className="text-[10.5px] font-extrabold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {editingDealLimitId === deal.id ? "Close" : "⚙️ Edit Limit / Mode"}
                        </button>
                      </div>

                      {/* Quick Reactivation Buttons when sold out or limited */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const newMax = (deal.maxClaims || 0) + 3;
                              await updateDoc(doc(db, "flash_deals", deal.id), {
                                maxClaims: newMax,
                                status: "active",
                                updatedAt: new Date().toISOString()
                              });
                              toast.success("Added +3 slots & reactivated deal!");
                            } catch (e) {
                              toast.error("Failed to update slots.");
                            }
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-2xs cursor-pointer transition-all active:scale-95 flex items-center gap-0.5"
                        >
                          <span>⚡ +3 Slots</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const newMax = (deal.maxClaims || 0) + 5;
                              await updateDoc(doc(db, "flash_deals", deal.id), {
                                maxClaims: newMax,
                                status: "active",
                                updatedAt: new Date().toISOString()
                              });
                              toast.success("Added +5 slots & reactivated deal!");
                            } catch (e) {
                              toast.error("Failed to update slots.");
                            }
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-2xs cursor-pointer transition-all active:scale-95 flex items-center gap-0.5"
                        >
                          <span>⚡ +5 Slots</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, "flash_deals", deal.id), {
                                claimedCount: 0,
                                status: "active",
                                updatedAt: new Date().toISOString()
                              });
                              toast.success("Reset claims to 0 & reactivated deal!");
                            } catch (e) {
                              toast.error("Failed to reset claims.");
                            }
                          }}
                          title="Resets claims counter to 0 for a fresh batch of bookings"
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[10px] font-bold shadow-2xs cursor-pointer transition-all active:scale-95"
                        >
                          <span>🔄 Reset Count</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const nextStatus = paused ? "active" : "paused";
                              await updateDoc(doc(db, "flash_deals", deal.id), {
                                status: nextStatus,
                                updatedAt: new Date().toISOString()
                              });
                              toast.success(paused ? "Deal resumed & active!" : "Deal paused.");
                            } catch (e) {
                              toast.error("Failed to update status.");
                            }
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-black text-white rounded-lg text-[10px] font-bold shadow-2xs cursor-pointer transition-all active:scale-95 ml-auto"
                        >
                          {paused ? "▶️ Resume" : "⏸️ Pause"}
                        </button>
                      </div>

                      {/* Expanded Inline Limit Editor */}
                      {editingDealLimitId === deal.id && (
                        <div className="bg-white p-3 rounded-lg border border-slate-300 space-y-2 mt-2">
                          <p className="text-[11px] font-bold text-slate-800">Adjust Deal Capacity:</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="200"
                              value={editLimitNumber}
                              onChange={(e) => setEditLimitNumber(e.target.value)}
                              className="w-20 h-8 bg-slate-50 border border-black rounded-md px-2 font-bold text-xs text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const newL = Number(editLimitNumber) || 5;
                                  const isNowSoldOut = (deal.claimedCount || 0) >= newL;
                                  await updateDoc(doc(db, "flash_deals", deal.id), {
                                    maxClaims: newL,
                                    status: isNowSoldOut ? "sold_out" : "active",
                                    updatedAt: new Date().toISOString()
                                  });
                                  setEditingDealLimitId(null);
                                  toast.success(`Capacity updated to ${newL} bookings!`);
                                } catch (e) {
                                  toast.error("Failed to update capacity.");
                                }
                              }}
                              className="px-2.5 py-1 bg-black text-white text-[10px] font-black rounded-md hover:bg-zinc-800"
                            >
                              Save Limit
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "flash_deals", deal.id), {
                                    maxClaims: null,
                                    status: "active",
                                    updatedAt: new Date().toISOString()
                                  });
                                  setEditingDealLimitId(null);
                                  toast.success("Set deal to unlimited capacity!");
                                } catch (e) {
                                  toast.error("Failed to update capacity.");
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold rounded-md hover:bg-emerald-100"
                            >
                              Set Unlimited
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Date & Remove Action */}
                    <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-2.5">
                      <span className="text-[10px] text-slate-400 font-bold">
                        Published {new Date(deal.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Are you sure you want to delete this deal?")) return;
                          try {
                            const { deleteDoc, doc } = await import("firebase/firestore");
                            await deleteDoc(doc(db, "flash_deals", deal.id));
                            toast.success("Deal deleted successfully.");
                          } catch (e) {
                            console.error("Error deleting deal:", e);
                            toast.error("Failed to delete deal.");
                          }
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                      >
                        Remove Deal
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trader Monetization & Advertising Banners (Placed at bottom below Flash Deal Creator) */}
      <TraderMonetizationBanners onOpenVideoVerification={() => navigate('/profile#verification')} />

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
                className="bg-white p-4 rounded-2xl border border-black shadow-sm hover:border-blue-200 transition-all flex items-center gap-4 group"
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

                <div className="bg-slate-50 border border-black rounded-2xl p-3 text-center">
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
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-[#1e293b] text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 whitespace-nowrap"
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
              <div className="p-6 border-b border-black flex items-center justify-between">
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
                      className="w-full h-12 bg-slate-50 border border-black rounded-2xl px-4 font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
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
                      className="w-full h-12 bg-slate-50 border border-black rounded-2xl px-4 font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    />
                    <p className="text-xs text-slate-500 mt-1.5 px-1">Charge per hour for subsequent emergency repair work.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Terms &amp; Conditions</label>
                    <textarea 
                      value={imSetupData.terms}
                      onChange={e => setImSetupData({ ...imSetupData, terms: e.target.value })}
                      placeholder="e.g. Rate excludes materials. Client must be present to provide access."
                      className="w-full min-h-[100px] bg-slate-50 border border-black rounded-2xl p-4 font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors resize-y"
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

              <div className="p-6 border-t border-black">
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
