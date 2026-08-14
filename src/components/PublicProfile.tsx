import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { 
  db, doc, getDoc, collection, query, where, orderBy, onSnapshot, 
  handleFirestoreError, OperationType, addDoc, updateDoc, serverTimestamp, sendNotification, getDocs 
} from "@/src/firebase";
import { arrayUnion } from "firebase/firestore";
import { useAuth } from "./AuthProvider";
import { 
  Star, MapPin, Calendar, Shield, Check, Briefcase, Clock, Zap, MessageSquare, ChevronLeft, Loader2, Image as ImageIcon, Users, ChevronDown,
  ShieldCheck, CheckCircle, Heart, FileText, AlertTriangle, X, Send, ChevronRight, Award, Share2, UserPlus, HelpCircle, Medal, CalendarClock, Pencil
} from "lucide-react";
import { cn, getOutwardPostcode, getDealPricing } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { PROFESSIONAL_BADGES } from "@/src/constants";
import { getTraderBadges } from "@/src/lib/badges";
import { getTraderUnifiedTrustBadges } from "@/src/lib/trustBadges";
import { TraderDocumentViewerModal } from "./TraderDocumentViewerModal";
import { SlowTrustBadgesCarousel } from "./SlowTrustBadgesCarousel";
import { format } from "date-fns";
import { SEO } from "./SEO";
import { Logo } from "./Logo";
import { TraderVideoVerificationCard } from "./TraderVideoVerificationCard";
import { INITIAL_MOCK_FLASH_DEALS } from "@/src/services/seedService";
import { DealCountdownBadge, shareDeal } from "./FindTrades";
import { isDealSoldOut, getRemainingSlots, getDealCapacityInfo } from "@/src/lib/flashDeals";

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isB2B, linkedPropertyId, linkedPropertyName } = location.state || {};
  const { profile: currentUserProfile, user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(false);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([]);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [docViewerBadgeId, setDocViewerBadgeId] = useState<string>("liability_insurance");
  const [activeDeals, setActiveDeals] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "flash_deals"),
      where("traderId", "==", id),
      where("status", "==", "active")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbDeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const mockMatches = INITIAL_MOCK_FLASH_DEALS.filter(m => m.traderId === id);
      const existingIds = new Set(dbDeals.map(d => d.id));
      const merged = [...dbDeals, ...mockMatches.filter(m => !existingIds.has(m.id))];
      setActiveDeals(merged);
    }, (error) => {
      console.error("Error fetching trader flash deals:", error);
      setActiveDeals(INITIAL_MOCK_FLASH_DEALS.filter(m => m.traderId === id));
    });
    return () => unsubscribe();
  }, [id]);

  const toggleFaq = (faqId: string) => {
    setOpenFaqIds(prev => 
      prev.includes(faqId) ? prev.filter(id => id !== faqId) : [...prev, faqId]
    );
  };

  const isOwnProfile = currentUser && profile && (currentUser.uid === profile.uid || currentUser.uid === profile.id);

  // Quote Request State
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedDealForQuote, setSelectedDealForQuote] = useState<any>(location.state?.activeDeal || null);
  const [userJobs, setUserJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.activeDeal) {
      setSelectedDealForQuote(location.state.activeDeal);
    }
    if (location.state?.autoOpenQuoteModal && location.state?.activeDeal) {
      openQuoteModal(location.state.activeDeal);
    }
  }, [location.state]);

  // Smooth scroll to Active Deals when navigated from search deal pill
  useEffect(() => {
    if (location.hash === "#active-deals" || location.state?.scrollToDeals) {
      const timer = setTimeout(() => {
        const dealsElement = document.getElementById("active-deals");
        if (dealsElement) {
          dealsElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash, location.state, activeDeals]);

  // Booking Appointments
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  const isBusyToday = () => {
    if (!profile?.dateOverrides) return false;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const status = profile.dateOverrides[todayStr];
    return status === "busy" || status === "booked";
  };

  const handleSubmitBooking = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setIsProcessing(true);
    try {
      await addDoc(collection(db, "appointments"), {
        customerId: currentUser.uid,
        traderId: id,
        serviceId: selectedService?.id || "general",
        serviceName: selectedService?.name || "General Consultation",
        price: selectedService?.price || 0,
        durationMinutes: selectedService?.durationMinutes || 60,
        date: bookingDate,
        startTime: bookingTime,
        notes: bookingNotes,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send notification to trader
      await sendNotification(
        id!,
        "New Appointment Request",
        `You have a new appointment request from ${currentUserProfile?.name || 'a customer'} for ${bookingDate} at ${bookingTime}.`,
        "system",
        "#appointments"
      );

      setIsBookingModalOpen(false);
      setBookingDate("");
      setBookingTime("");
      setBookingNotes("");
      setSelectedService(null);
      alert("Appointment request sent successfully! You will be notified when it is confirmed.");
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, "appointments");
      alert("Failed to send appointment request.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    });

    const fetchProfile = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "users", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profileData = { uid: docSnap.id, ...docSnap.data() };
          setProfile(profileData);

          // Update Recently Viewed
          try {
            const stored = localStorage.getItem("recentlyViewedTraders");
            let ids: string[] = [];
            try {
              ids = stored && stored !== "undefined" ? JSON.parse(stored) : [];
            } catch (e) {
              console.warn("Invalid JSON in localStorage for recentlyViewedTraders");
            }
            // Remove if already exists to move to front
            ids = ids.filter(item => item !== id);
            // Add to front
            ids.unshift(id);
            // Keep only last 10
            ids = ids.slice(0, 10);
            localStorage.setItem("recentlyViewedTraders", JSON.stringify(ids));
          } catch (e) {
            console.error("Error updating recently viewed:", e);
          }
        } else {
          console.error("No such profile!");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        handleFirestoreError(error, OperationType.GET, `users/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    return () => unsubConfig();
  }, [id]);

  useEffect(() => {
    if (!loading && profile) {
      if (location.state?.openQuote) {
        openQuoteModal();
        // Clear state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      } else if (location.state?.openChat) {
        handleMessage();
        // Clear state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [loading, profile, location.state]);

  useEffect(() => {
    if (!id) return;
    setLoadingReviews(true);
    const q = query(
      collection(db, "reviews"),
      where("revieweeId", "==", id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(fetchedReviews.filter((r: any) => r.status !== "cooling_off"));
      setLoadingReviews(false);
    }, (error) => {
      console.error("Error fetching reviews:", error);
      handleFirestoreError(error, OperationType.LIST, "reviews");
      setLoadingReviews(false);
    });

    const portfolioQ = query(
      collection(db, "portfolioItems"),
      where("consultantId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsubPortfolio = onSnapshot(portfolioQ, (snapshot) => {
      setPortfolioItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching portfolio items:", error);
    });

    return () => {
      unsubscribe();
      unsubPortfolio();
    };
  }, [id]);

  const handleMessage = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (!id || !profile) return;

    setIsProcessing(true);
    try {
      // Check if conversation already exists
      const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const existingConv = snapshot.docs.find(doc => 
        doc.data().participants.includes(id) && doc.data().jobId === "general"
      );

      if (existingConv) {
        navigate(`/chat/${existingConv.id}`, { 
          state: { recipientName: profile.name, jobTitle: "General Discussion" } 
        });
      } else {
        // Create new conversation
        const convRef = await addDoc(collection(db, "conversations"), {
          participants: [currentUser.uid, id],
          jobId: "general",
          jobTitle: "General Discussion",
          lastMessage: "Conversation started",
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        navigate(`/chat/${convRef.id}`, { 
          state: { recipientName: profile.name, jobTitle: "General Discussion" } 
        });
      }
    } catch (error) {
      console.error("Error starting chat:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const openQuoteModal = async (dealToClaim?: any) => {
    if (!currentUser) {
      navigate("/login", { state: { redirectTo: `/profile/${id}`, activeDeal: dealToClaim || selectedDealForQuote, autoOpenQuoteModal: true } });
      return;
    }
    if (dealToClaim) {
      setSelectedDealForQuote(dealToClaim);
    }
    setIsQuoteModalOpen(true);
    setLoadingJobs(true);
    try {
      const q = query(
        collection(db, "jobs"),
        where("homeownerId", "==", currentUser.uid),
        where("status", "in", ["posted", "quoting"])
      );
      const snapshot = await getDocs(q);
      const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Filter out emergency jobs as they cannot be directly requested
      setUserJobs(jobs.filter(job => job.urgency !== "emergency"));
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleInviteToJob = async (job: any) => {
    if (!currentUser || !id || !profile) return;

    // Check emergency availability (fallback, though emergency jobs are filtered out)
    if (job.urgency === "emergency") {
      setError("Emergency jobs cannot be directly requested. They must be broadcasted to all available tradespeople.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // 1. Check for existing conversation for this job
      const q = query(
        collection(db, "conversations"),
        where("jobId", "==", job.id),
        where("participants", "array-contains", currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const existingConv = snapshot.docs.find(doc => doc.data().participants.includes(id));

      const dealNote = selectedDealForQuote
        ? `\n\n⚡ CLAIMED FLASH DEAL (${selectedDealForQuote.discountPercentage}% OFF):\n• Service: ${selectedDealForQuote.service}\n• Off-Peak Rate: £${selectedDealForQuote.discountedPrice || selectedDealForQuote.price}`
        : "";

      let convId;
      if (existingConv) {
        convId = existingConv.id;
        await addDoc(collection(db, "conversations", convId, "messages"), {
          senderId: currentUser.uid,
          text: `Hi ${profile.name}, I'd like to invite you to quote for my job: "${job.title}".${dealNote} Please review and confirm the quote with the Flash Deal discount!`,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "conversations", convId), {
          lastMessage: `Invitation to quote for: ${job.title}${selectedDealForQuote ? ` (${selectedDealForQuote.discountPercentage}% OFF Deal)` : ''}`,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new conversation
        const convRef = await addDoc(collection(db, "conversations"), {
          participants: [currentUser.uid, id],
          jobId: job.id,
          jobTitle: job.title,
          lastMessage: `Invitation to quote for: ${job.title}${selectedDealForQuote ? ` (${selectedDealForQuote.discountPercentage}% OFF Deal)` : ''}`,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        convId = convRef.id;

        // Add initial invitation message
        await addDoc(collection(db, "conversations", convId, "messages"), {
          senderId: currentUser.uid,
          text: `Hi ${profile.name}, I'd like to invite you to quote for my job: "${job.title}".${dealNote} Please review and confirm the quote with the Flash Deal discount!`,
          createdAt: serverTimestamp()
        });
      }

      // Update job document with invited trader ID
      try {
        await updateDoc(doc(db, "jobs", job.id), {
          invitedTraderIds: arrayUnion(id),
          targetTradespersonId: job.targetTradespersonId || id,
          targetTradespersonName: job.targetTradespersonName || profile.name,
          updatedAt: serverTimestamp()
        });
      } catch (jobErr) {
        console.warn("Could not update job invitedTraderIds:", jobErr);
      }

      // 2. Send notification
      await sendNotification(
        id,
        "New Quote Request! 📝",
        `${currentUserProfile?.name || 'A homeowner'} invited you to quote for "${job.title}"${selectedDealForQuote ? ` (${selectedDealForQuote.discountPercentage}% OFF Flash Deal)` : ''}`,
        "quote",
        `/job/${job.id}`
      );

      setIsQuoteModalOpen(false);
      navigate(`/chat/${convId}`, { 
        state: { recipientName: profile.name, jobTitle: job.title } 
      });
    } catch (error) {
      console.error("Error inviting to job:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // Check if profile exists, and if disabled, only show if current user is admin
  if (!profile || (profile.isDisabled && currentUserProfile?.role !== "admin")) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Profile Not Found</h2>
        <p className="text-slate-500 mb-6">The tradesperson you are looking for does not exist or is currently unavailable.</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 font-bold hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className={cn("max-w-2xl mx-auto pb-40 px-3 sm:px-4", !currentUser && "pt-16")}>
      <SEO 
        title={`${profile.name} | Verified Trader`} 
        description={profile.bio || `View ${profile.name}'s profile on AnyTrader. See reviews, portfolio, and hire for your next project.`}
        ogType="profile"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": profile.name,
          "description": profile.bio,
          "image": profile.photoURL,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": profile.rating || 5,
            "reviewCount": profile.totalReviews || 0
          }
        }}
      />
      {!currentUser && (
        <header className="fixed top-0 left-0 right-0 glass z-50 h-16 flex items-center px-4">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-500">
                <Logo size={28} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-display font-black text-slate-900 tracking-tight">AnyTrader</span>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-1">Every Skill</p>
              </div>
            </Link>
            <Link 
              to="/login" 
              className="text-xs font-black uppercase tracking-widest text-white bg-primary px-6 py-2.5 rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95"
            >
              Sign In
            </Link>
          </div>
        </header>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 relative z-50 min-w-0">
          <button onClick={() => { console.log("Back button clicked"); navigate(-1); }} className="p-2 sm:p-2.5 bg-white border border-black rounded-xl shadow-sm hover:bg-slate-50 hover:shadow-md transition-all group shrink-0">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Tradesperson Profile</h1>
        </div>
        <button 
          onClick={async () => {
            try {
              if (navigator.share) {
                await navigator.share({
                  title: `${profile.name} on AnyTrader`,
                  text: `Check out ${profile.name}'s profile on AnyTrader!`,
                  url: window.location.href,
                });
              } else {
                await navigator.clipboard.writeText(window.location.href);
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
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-1.5 sm:gap-2 text-slate-600 border border-black shrink-0 text-xs sm:text-sm font-bold"
        >
          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
          <span>Share Profile</span>
        </button>
      </div>

      {/* Admin Suspension Banner */}
      {profile.isDisabled && currentUserProfile?.role === "admin" && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-6 flex items-center gap-3 text-red-800">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-bold">This profile is currently suspended.</p>
            <p className="text-xs opacity-80">Only administrators can view this profile. Homeowners and other tradespeople cannot see this.</p>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-3xl border border-black shadow-sm p-4 sm:p-8 mb-8 relative w-full overflow-hidden">
        <div className="flex flex-col items-center w-full">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold overflow-hidden border-4 border-white/20 shadow-lg mb-4 shrink-0">
            {profile.photoURL || profile.avatarUrl ? (
              <img src={profile.photoURL || profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile.name?.charAt(0).toUpperCase() || "U"
            )}
          </div>
          
          <div className="text-center w-full">
            {profile.memberId && (
              <span className="text-[10px] font-black tracking-[0.2em] text-[#1e3a5f] bg-[#1e3a5f]/5 px-2 py-1 rounded-lg border border-[#1e3a5f]/10 mb-3 inline-block">
                {profile.memberId}
              </span>
            )}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2 w-full">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{profile.name}</h2>
              {profile.isAcceptingRequests === false && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-red-700 flex items-center gap-1 shadow-sm shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  Currently Unavailable
                </span>
              )}
              {isBusyToday() && profile.isAcceptingRequests !== false && (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-orange-200 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    Busy Today
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/50 rounded-lg border border-blue-100/50">
                    <HelpCircle className="w-3 h-3 text-blue-600 shrink-0" />
                    <p className="text-[9px] text-blue-700 font-bold leading-none uppercase tracking-tighter">
                      Available for Messages & Quotes
                    </p>
                  </div>
                </div>
              )}
              {profile.isDisabled && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-red-200 shrink-0">
                  Suspended
                </span>
              )}
              {(profile.recommendedCategories?.length > 0 || platformConfig?.feeTiers?.find((t: any) => t.name === (profile.tierId || "Basic"))?.includesRecommendation) && (
                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-orange-200 flex items-center gap-1 shrink-0">
                  <Award className="w-3 h-3 fill-orange-500" />
                  Recommended
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-3 mb-6 w-full">
              <div className="flex items-stretch gap-2 sm:gap-3 bg-white p-1.5 sm:p-2 rounded-[1.25rem] sm:rounded-[1.5rem] border border-black shadow-lg shadow-slate-200/50 w-full max-w-sm mx-auto">
                <div className="flex-1 flex items-center justify-center gap-2 px-2.5 sm:px-3 py-2.5 sm:py-3 bg-slate-900 rounded-xl sm:rounded-2xl shadow-md">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400 shrink-0" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-black text-white text-base sm:text-lg leading-none">{profile.rating?.toFixed(1) || "5.0"}</span>
                    <span className="text-slate-400 text-[8px] sm:text-[9px] font-black uppercase tracking-tighter mt-0.5 truncate">{profile.totalReviews || 0} reviews</span>
                  </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 sm:py-3 bg-green-100/50 rounded-xl sm:rounded-2xl border border-green-200/50">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-green-500 flex items-center justify-center shadow-md shadow-green-500/20 shrink-0">
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-[7.5px] sm:text-[8px] font-black text-green-900 uppercase tracking-widest leading-none mb-0.5 truncate">Recmd By</span>
                    <span className="text-base sm:text-lg font-black text-green-900 leading-none">{profile.totalRecommendations || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 my-4 max-w-full">
              <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-black/10 text-xs font-semibold text-slate-700 shadow-2xs">
                <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-none">{profile.trades?.[0] || "Professional Tradesperson"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-black/10 text-xs font-semibold text-slate-700 shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span>{profile.postcode || profile.location || "Location not set"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-black/10 text-xs font-semibold text-slate-700 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Member since {new Date(profile.createdAt?.seconds * 1000 || Date.now()).getFullYear()}</span>
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-5 max-w-2xl mx-auto">
              {profile.isAvailableForEmergency && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 text-xs font-bold text-red-700 shadow-sm transition-all hover:shadow-md">
                  <Zap className="w-4 h-4 text-red-500" />
                  Accepting Emergency Jobs
                </div>
              )}
            </div>

            {/* 5-Point Verified Compliance Slow Carousel */}
            <div className="w-full max-w-2xl mx-auto mb-6 p-2.5 sm:p-3 bg-slate-50 rounded-2xl border-2 border-black overflow-hidden">
              <SlowTrustBadgesCarousel
                trader={profile}
                bgClass="bg-slate-50"
                onSelectBadge={(badgeId) => {
                  setDocViewerBadgeId(badgeId);
                  setIsDocViewerOpen(true);
                }}
                onOpenAllDocs={() => {
                  setDocViewerBadgeId("liability_insurance");
                  setIsDocViewerOpen(true);
                }}
              />
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6 max-w-2xl mx-auto w-full">
              {getTraderBadges(profile).map((badge: any) => (
                <div 
                  key={badge.id} 
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold shadow-sm transition-all hover:shadow-md",
                    badge.bgColor,
                    badge.color,
                    "border-current/10"
                  )}
                  title={badge.description}
                >
                  {badge.icon}
                  {badge.label}
                </div>
              ))}
              {profile.badges && profile.badges.length > 0 && profile.badges.map((badgeId: string) => {
                  const badge = PROFESSIONAL_BADGES.find(b => b.id === badgeId);
                  if (!badge) return null;
                  const Icon = { ShieldCheck, Clock, FileText, Shield, CheckCircle, MapPin, Heart, Star }[badge.icon] as any;
                  
                  const iconColorClasses: Record<string, string> = {
                    blue: "text-blue-500",
                    red: "text-red-500",
                    green: "text-green-500",
                    indigo: "text-indigo-500",
                    amber: "text-amber-500",
                    slate: "text-slate-500",
                    rose: "text-rose-500"
                  };

                  return (
                    <div 
                      key={badgeId} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-black text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-black hover:shadow-md"
                    >
                      <Icon className={cn("w-4 h-4", iconColorClasses[badge.color] || "text-slate-500")} />
                      {badge.name}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 border-t border-black pt-6 sm:pt-8 w-full">
          <div className="text-center min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-1.5">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </div>
            <p className="text-base sm:text-xl font-bold text-slate-900 leading-tight">{profile.totalJobsDone || 0}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Jobs</p>
          </div>
          <div className="text-center min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-1.5">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </div>
            <p className="text-base sm:text-xl font-bold text-slate-900 leading-tight">{profile.acceptanceRate || 100}%</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Response</p>
          </div>
          <div className="text-center min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-1.5">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </div>
            <p className="text-base sm:text-xl font-bold text-slate-900 leading-tight">{profile.trustScore || 95}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Trust</p>
          </div>
        </div>
      </div>

      {/* Active Off-Peak Weekdays Flash Deals */}
      {activeDeals.length > 0 && (
        <div id="active-deals" className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-3xl border border-black shadow-sm space-y-4 mb-8 scroll-mt-24">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍂</span>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">Active Quiet Period Off-Peak Deals</h3>
              <p className="text-xs text-slate-500 font-medium">Book one of these services for the off-peak weekday to claim the discount on your quote!</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeDeals.map(deal => {
              const { origPrice, discPrice, discountPct, savings } = getDealPricing(deal);
              const cap = getDealCapacityInfo(deal);
              const soldOut = cap.isSoldOut;
              const isHighlighted = location.state?.highlightDealId === deal.id || location.state?.activeDeal?.id === deal.id;

              return (
                <div
                  key={deal.id}
                  id={`deal-${deal.id}`}
                  className={cn(
                    "border rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-xs transition-all",
                    soldOut ? "bg-slate-100/90 border-slate-300 opacity-80" : "bg-white border-black",
                    isHighlighted && "ring-3 ring-emerald-500 shadow-md animate-[pulse_2s_ease-in-out_3]"
                  )}
                >
                  {/* Compact Share Button in Top Right Corner */}
                  <button
                    type="button"
                    onClick={(e) => shareDeal(e, { ...deal, traderName: profile?.name || deal.traderName })}
                    title="Share offer via WhatsApp or Social Apps"
                    className="absolute top-2 right-2 z-20 w-4 h-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90 shrink-0"
                  >
                    <Share2 className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                  </button>

                  <div className="space-y-2 pr-6">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {soldOut ? (
                        <span className="bg-slate-700 text-white font-black text-[10px] px-2.5 py-0.5 uppercase rounded-full shadow-2xs">
                          🔴 Sold Out
                        </span>
                      ) : (
                        <span className="bg-emerald-600 text-white font-black text-xs px-2.5 py-0.5 uppercase rounded-full shadow-2xs">
                          {discountPct || deal.discountPercentage}% OFF
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[9.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-black uppercase">
                        ⚡ Off-Peak {deal.dayOfWeek}
                      </span>
                      {/* Prominent Booking Limit Pill in Header */}
                      {cap.isSoldOut ? (
                        <span className="text-[9.5px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                          🔴 0 of {cap.max} Left
                        </span>
                      ) : cap.isUnlimited ? (
                        <span className="text-[9.5px] font-black text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                          ⚡ Unlimited Slots
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                          🔥 {cap.remaining} of {cap.max} Left
                        </span>
                      )}
                      <DealCountdownBadge deal={deal} className="text-[9.5px] px-2.5 py-0.5 rounded-full" />
                    </div>
                    <h4 className={cn("font-extrabold text-sm sm:text-base", soldOut ? "text-slate-700" : "text-slate-900")}>
                      {deal.service}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-snug">{deal.description}</p>

                    {/* Prominent Daily Booking Limit & Capacity Bar */}
                    <div className="bg-slate-50 border border-black/20 rounded-xl p-2 mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-800 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Daily Booking Limit:</span>
                        </span>
                        {cap.isUnlimited ? (
                          <span className="text-emerald-700 font-black">Unlimited Deals</span>
                        ) : cap.isSoldOut ? (
                          <span className="text-amber-800 font-black bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                            🔴 Sold Out ({cap.max}/{cap.max} Booked)
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-black bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                            🔥 {cap.remaining} of {cap.max} Left Today
                          </span>
                        )}
                      </div>
                      {!cap.isUnlimited && (
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              cap.isSoldOut ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${cap.progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clear Unambiguous Price Breakdown Box */}
                  <div className={cn(
                    "border rounded-xl p-2.5 mt-3 flex items-center justify-between gap-2",
                    soldOut ? "bg-slate-200/70 border-slate-300" : "bg-emerald-50/80 border-emerald-200/90"
                  )}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {origPrice && origPrice > discPrice && (
                        <span className="text-xs font-extrabold text-slate-400 line-through">
                          Was £{origPrice}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-base font-black", soldOut ? "text-slate-700" : "text-emerald-700")}>
                          £{discPrice}
                        </span>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded",
                          soldOut ? "bg-slate-300 text-slate-700" : "bg-emerald-200/60 text-emerald-800"
                        )}>
                          Deal Rate
                        </span>
                      </div>
                    </div>
                    {savings > 0 && !soldOut && (
                      <span className="text-xs font-black text-emerald-700 bg-white border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                        Save £{savings}
                      </span>
                    )}
                    {soldOut && (
                      <span className="text-xs font-black text-slate-600 bg-white border border-slate-300 px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                        Capacity Filled
                      </span>
                    )}
                  </div>

                  {soldOut ? (
                    <button
                      type="button"
                      onClick={() => openQuoteModal(null)}
                      className="w-full mt-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs sm:text-sm py-2.5 px-3 rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                    >
                      <span>Deal Sold Out • Request Standard Quote</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openQuoteModal(deal)}
                      className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm py-2.5 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-white shrink-0" />
                      <span>Claim Deal & Request Quote ({discountPct || deal.discountPercentage}% OFF)</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Video Credential Verification Showcase */}
      {profile?.videoVerificationUrl && (
        <TraderVideoVerificationCard profile={profile} isReadOnly={true} />
      )}

      {/* Achievements */}
      <div className="bg-white rounded-3xl border border-black shadow-sm p-4 sm:p-6 mb-8 overflow-hidden">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
        >
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">Achievements</h3>
          <div className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 flex items-center justify-center transition-transform shrink-0",
            isAchievementsExpanded && "rotate-180"
          )}>
            <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
          </div>
        </div>
        
        {isAchievementsExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-6">
            <div className="bg-blue-50 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 border border-blue-100">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-base sm:text-lg leading-tight">{profile.trustScore || 95} Trust Score</p>
                <p className="text-xs text-slate-600 truncate">Highly reliable professional</p>
              </div>
            </div>
            <div className="bg-orange-50 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 border border-orange-100">
              <Star className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500 fill-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-base sm:text-lg leading-tight">Top Rated</p>
                <p className="text-xs text-slate-600 truncate">{profile.rating?.toFixed(1) || "5.0"} average rating</p>
              </div>
            </div>
            <div className="bg-green-50 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 border border-green-100">
              {profile.verificationStatus === "auditioned" ? <Medal className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 fill-amber-500/20 shrink-0" /> :
               profile.verificationStatus === "vetted" ? <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 fill-emerald-500/20 shrink-0" /> :
               <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 shrink-0" />}
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
                  {profile.verificationStatus === "auditioned" ? "Auditioned Pro" :
                   profile.verificationStatus === "vetted" ? "Vetted Pro" : 
                   profile.verificationStatus === "verified" ? "Verified Pro" : "Unverified"}
                </p>
                <p className="text-xs text-slate-600 truncate">
                  {profile.verificationStatus === "auditioned" ? "Physical work inspection passed" :
                   profile.verificationStatus === "vetted" ? "References & work reviewed" :
                   profile.verificationStatus === "verified" ? "Identity & Insurance checked" : "Onboarding in progress"}
                </p>
              </div>
            </div>
            <div className="bg-amber-50 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 border border-amber-100">
              <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-base sm:text-lg leading-tight">Responsive</p>
                <p className="text-xs text-slate-600 truncate">100% response rate</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Products and Services */}
      {profile.services && profile.services.length > 0 && (
        <div className="bg-white rounded-3xl border border-black shadow-sm p-4 sm:p-8 mb-8 overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">Products and Services</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(isServicesExpanded ? profile.services : profile.services.slice(0, 4)).map((service: string, index: number) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-black hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="text-sm font-bold text-slate-700 leading-relaxed">{service}</span>
              </div>
            ))}
          </div>
          
          {profile.services.length > 4 && (
            <button 
              onClick={() => setIsServicesExpanded(!isServicesExpanded)}
              className="mt-6 w-full py-3 flex items-center justify-center gap-2 text-blue-600 font-bold text-sm bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            >
              {isServicesExpanded ? "Show less" : `Show all ${profile.services.length} services`}
              <ChevronDown className={cn("w-4 h-4 transition-transform", isServicesExpanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      {/* About & Specializations */}
      <div className="bg-white rounded-3xl border border-black shadow-sm p-8 mb-8">
        <h3 className="text-xl font-bold text-slate-900 mb-4">About</h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">{profile.bio || "No bio provided."}</p>
        
        <h4 className="text-sm font-bold text-slate-900 mb-3">Skills/Services</h4>
        <div className="flex flex-wrap gap-2">
          {profile.trades?.map((trade: string) => (
            <span key={trade} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
              {trade}
            </span>
          ))}
          {profile.tags?.map((tag: string) => (
            <span key={tag} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {tag}
            </span>
          ))}
        </div>

        {profile.postcode && (
          <div className="mt-8 pt-8 border-t border-black">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              Trader Location
            </h4>
            <div className="aspect-video bg-slate-100 rounded-2xl relative flex items-center justify-center overflow-hidden border border-black pointer-events-none">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(getOutwardPostcode(profile.postcode) + ', ' + (profile.city || 'UK'))}&t=&z=10&ie=UTF8&iwloc=&output=embed`}
              ></iframe>

              {/* Dotted Area Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-dashed border-red-500/40 rounded-full bg-red-500/5" />
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    {getOutwardPostcode(profile.postcode)} {profile.city ? `• ${profile.city}` : ''}
                  </span>
                  <span className="bg-orange-50 text-orange-600 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Approx. area</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Portfolio Section */}
      {((profile.portfolio && profile.portfolio.length > 0) || portfolioItems.length > 0) && (
        <div className="bg-white rounded-3xl border border-black shadow-sm p-8 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Work Portfolio</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {profile.portfolio?.map((url: string, index: number) => (
              <div key={`basic-${index}`} className="aspect-square rounded-2xl overflow-hidden border border-black bg-slate-100">
                <img src={url} alt={`Portfolio ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
            {portfolioItems.map((item) => (
               <div key={`complex-${item.id}`} className="aspect-square rounded-2xl overflow-hidden border border-black bg-slate-100 relative group">
                 {item.imageUrls?.[0] ? (
                  <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                 ) : (
                  <div className="flex items-center justify-center h-full w-full bg-slate-100">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                    <h4 className="text-white font-bold text-sm leading-tight mb-1">{item.title}</h4>
                    {item.description && (
                      <p className="text-white/80 text-[10px] line-clamp-2">{item.description}</p>
                    )}
                 </div>
               </div>
            ))}
          </div>
        </div>
      )}

      {/* Frequently Asked Questions */}
      {((profile.faqs && profile.faqs.length > 0) || isOwnProfile) && (
        <div id="faqs" className="bg-white rounded-3xl border border-black shadow-sm p-6 sm:p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Quick answers provided directly by {profile.name || "this trader"}</p>
              </div>
            </div>
            {isOwnProfile && (
              <Link
                to="/profile#faqs"
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-colors flex items-center gap-1 shrink-0"
              >
                <Pencil className="w-3 h-3" />
                Edit FAQs
              </Link>
            )}
          </div>

          {profile.faqs && profile.faqs.length > 0 ? (
            <div className="space-y-3">
              {profile.faqs.map((faq: any, idx: number) => {
                const faqId = faq.id || `faq_${idx}`;
                const isOpen = openFaqIds.includes(faqId) || profile.faqs.length <= 3;
                return (
                  <div 
                    key={faqId} 
                    className="border border-black rounded-2xl overflow-hidden bg-slate-50/60 transition-all hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(faqId)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 font-bold text-sm text-slate-900 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                        <span>{faq.question}</span>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 border-t border-black/10 text-xs text-slate-700 leading-relaxed font-medium bg-white/80">
                            <div className="pl-3 border-l-2 border-indigo-500/60 py-1">
                              {faq.answer}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-black/30 p-4">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No frequently asked questions added yet.</p>
              {isOwnProfile && (
                <Link
                  to="/profile#faqs"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  + Add FAQs in Business Dashboard
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-6 mb-24">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Client Reviews</h3>
          <div className="flex items-center gap-1 text-orange-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="font-bold">{profile.rating?.toFixed(1) || "5.0"}</span>
            <span className="text-slate-400 text-sm font-medium">({profile.totalReviews || 0})</span>
          </div>
        </div>

        {loadingReviews ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={cn(
                          "w-3.5 h-3.5",
                          i < review.rating ? "text-orange-500 fill-current" : "text-slate-200"
                        )} 
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(review.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed italic">"{review.comment}"</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-black text-center">
            <p className="text-slate-500 text-sm">No reviews yet.</p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-4 sm:bottom-0 left-4 right-4 sm:left-0 sm:right-0 bg-white/95 backdrop-blur-xl border border-black sm:border-t p-4 z-[90] rounded-3xl sm:rounded-none shadow-2xl sm:shadow-none pb-safe sm:pb-4">
        {!currentUser ? (
          <div className="max-w-2xl mx-auto">
            <button 
              onClick={() => navigate("/login")}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Sign In to Contact {profile.name}
            </button>
          </div>
        ) : profile.isAcceptingRequests === false ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">{profile.name} is currently not accepting new requests</p>
                <p className="text-xs text-amber-700">This tradesperson has paused new work. Please check back later or try another tradesperson.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {selectedDealForQuote && (
              <div className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl flex items-center justify-between text-xs font-bold shadow-sm">
                <div className="flex items-center gap-1.5 truncate">
                  <Zap className="w-3.5 h-3.5 fill-white shrink-0" />
                  <span className="truncate">Claiming <strong>{selectedDealForQuote.discountPercentage}% OFF</strong> for {selectedDealForQuote.service}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedDealForQuote(null)} 
                  className="text-[11px] underline text-emerald-100 hover:text-white shrink-0 ml-2"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <button 
                onClick={handleMessage}
                disabled={isProcessing}
                className="flex-1 bg-white border-2 border-blue-600 text-blue-600 py-3.5 rounded-2xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                Message
              </button>
              <button 
                onClick={() => openQuoteModal(selectedDealForQuote)}
                disabled={isProcessing}
                className={cn(
                  "flex-1 py-3.5 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50",
                  selectedDealForQuote
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                )}
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : (selectedDealForQuote ? <Zap className="w-5 h-5 fill-white shrink-0" /> : <FileText className="w-5 h-5" />)}
                <span>{selectedDealForQuote ? `Request Quote (${selectedDealForQuote.discountPercentage}% OFF)` : 'Request Quote'}</span>
              </button>
            </div>
            {profile.appointmentSettings?.enabled && (
              <button 
                onClick={() => setIsBookingModalOpen(true)}
                disabled={isProcessing}
                className="w-full bg-slate-900 border-2 border-white/20 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CalendarClock className="w-5 h-5" />
                Book an Appointment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Booking Appointment Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-black flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Book Appointment</h2>
                    <p className="text-xs text-slate-500">Pick a service and date</p>
                  </div>
                </div>
                <button onClick={() => setIsBookingModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Service Selection */}
                  <div>
                     <h3 className="text-sm font-bold text-slate-900 mb-3">1. Select a Service</h3>
                     {(!profile.appointmentSettings?.services || profile.appointmentSettings.services.length === 0) ? (
                        <div className="p-4 bg-slate-50 border border-black rounded-xl text-center">
                          <p className="text-sm text-slate-500 font-medium">No specific services listed.</p>
                          <p className="text-xs text-slate-400 mt-1">You will request a general consultation.</p>
                        </div>
                     ) : (
                        <div className="space-y-2">
                           {profile.appointmentSettings.services.map((svc: any) => (
                             <button
                               key={svc.id}
                               onClick={() => setSelectedService(svc)}
                               className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${selectedService?.id === svc.id ? 'border-blue-600 bg-blue-50' : 'border-black hover:border-black bg-white'}`}
                             >
                               <div>
                                  <p className="font-bold text-slate-900">{svc.name}</p>
                                  <p className="text-xs text-slate-500">{svc.durationMinutes} minutes</p>
                               </div>
                               <p className="font-black text-slate-900">£{svc.price}</p>
                             </button>
                           ))}
                        </div>
                     )}
                  </div>

                  {/* Date & Time Selection */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3">2. Choose Date & Time</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                        <input 
                          type="date" 
                          min={new Date().toISOString().split("T")[0]}
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full bg-slate-50 border border-black px-4 py-3 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Start Time</label>
                        <input 
                          type="time" 
                          value={bookingTime}
                          onChange={(e) => setBookingTime(e.target.value)}
                          className="w-full bg-slate-50 border border-black px-4 py-3 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                     <h3 className="text-sm font-bold text-slate-900 mb-3">3. Notes (Optional)</h3>
                     <textarea
                       value={bookingNotes}
                       onChange={(e) => setBookingNotes(e.target.value)}
                       placeholder="Briefly describe what you need help with..."
                       className="w-full bg-slate-50 border border-black px-4 py-3 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-colors resize-none h-24 text-sm placeholder:text-slate-400"
                     />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-black bg-slate-50 shrink-0">
                <button
                  onClick={handleSubmitBooking}
                  disabled={isProcessing || !bookingDate || !bookingTime}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarClock className="w-5 h-5" />}
                  Confirm Appointment Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quote Request Modal */}
      <AnimatePresence>
        {isQuoteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQuoteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
            >
              {/* Pinned Top Header with Close Button */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <h2 className="text-xl font-extrabold text-slate-900">Request a Quote</h2>
                <button 
                  onClick={() => setIsQuoteModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  aria-label="Close"
                  title="Close modal"
                >
                  <X className="w-6 h-6 text-slate-400 hover:text-slate-600 transition-colors" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 no-scrollbar space-y-5">
                <div className="bg-slate-50 border border-black rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-black text-blue-700 text-sm shrink-0">
                      {profile.name ? profile.name.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Target Tradesperson</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight truncate">{profile.name}</h4>
                        {(profile.primaryCategory || profile.trade || (Array.isArray(profile.trades) && profile.trades.length > 0)) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-blue-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                            <Briefcase className="w-3 h-3 text-white shrink-0" />
                            <span>{profile.primaryCategory || profile.trade || (Array.isArray(profile.trades) ? profile.trades.slice(0, 2).join(" • ") : profile.trades)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-slate-500 text-xs sm:text-sm font-medium">
                  Select an existing job below to invite <strong className="text-slate-900">{profile.name}</strong>, or post a new job targeted directly to them.
                </p>

                {selectedDealForQuote && (() => {
                  const { origPrice, discPrice, discountPct, savings } = getDealPricing(selectedDealForQuote);
                  return (
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-sm shrink-0">
                          ⚡
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                              {discountPct}% OFF
                            </span>
                            <span className="text-xs font-extrabold text-emerald-100">
                              {selectedDealForQuote.dayOfWeek ? `Off-Peak ${selectedDealForQuote.dayOfWeek}` : 'Flash Deal'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white truncate mt-0.5">
                            {selectedDealForQuote.service} • Deal Rate: £{discPrice} {origPrice && origPrice > discPrice ? `(Was £${origPrice})` : ''} {savings > 0 ? `• Save £${savings}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDealForQuote(null)}
                        className="text-xs font-extrabold text-white/80 hover:text-white underline shrink-0 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  );
                })()}

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {loadingJobs ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : userJobs.length > 0 ? (
                    userJobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => handleInviteToJob(job)}
                        className="w-full p-5 rounded-2xl border border-black hover:border-blue-600 hover:bg-blue-50 transition-all text-left flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{job.title}</h4>
                          <p className="text-xs text-slate-500 mt-1">{job.category} • {getOutwardPostcode(job.postcode)}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all" />
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-black">
                      <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium mb-6">You don't have any active jobs yet.</p>
                      <Link 
                        to="/post-job"
                        state={{ 
                          targetTradespersonId: id, 
                          targetTradespersonName: profile.name, 
                          targetTrades: profile.primaryCategory || profile.trade || profile.trades, 
                          isB2B, 
                          linkedPropertyId, 
                          linkedPropertyName,
                          claimedDeal: selectedDealForQuote,
                          title: selectedDealForQuote ? selectedDealForQuote.service : undefined,
                          description: selectedDealForQuote ? selectedDealForQuote.description : undefined,
                          budget: selectedDealForQuote ? (selectedDealForQuote.discountedPrice || selectedDealForQuote.price) : undefined,
                          category: selectedDealForQuote ? selectedDealForQuote.category : undefined
                        }}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                      >
                        <Zap className="w-4 h-4 fill-white" />
                        <span>{selectedDealForQuote ? `Post Job with ${selectedDealForQuote.discountPercentage}% OFF` : 'Post a Job Now'}</span>
                      </Link>
                    </div>
                  )}
                </div>

                {userJobs.length > 0 && (
                  <div className="pt-4 border-t border-black">
                    <p className="text-center text-xs text-slate-400 mb-4">Need to post a new job?</p>
                    <Link 
                      to="/post-job"
                      state={{ 
                        targetTradespersonId: id, 
                        targetTradespersonName: profile.name, 
                        targetTrades: profile.primaryCategory || profile.trade || profile.trades, 
                        isB2B, 
                        linkedPropertyId, 
                        linkedPropertyName,
                        claimedDeal: selectedDealForQuote,
                        title: selectedDealForQuote ? selectedDealForQuote.service : undefined,
                        description: selectedDealForQuote ? selectedDealForQuote.description : undefined,
                        budget: selectedDealForQuote ? (selectedDealForQuote.discountedPrice || selectedDealForQuote.price) : undefined,
                        category: selectedDealForQuote ? selectedDealForQuote.category : undefined
                      }}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer",
                        selectedDealForQuote
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-black text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Zap className={cn("w-4 h-4", selectedDealForQuote ? "fill-white" : "text-amber-500")} />
                      <span>{selectedDealForQuote ? `Post New Job with ${selectedDealForQuote.discountPercentage}% OFF` : 'Post New Job'}</span>
                    </Link>
                  </div>
                )}
              </div>
              <div className="h-4 bg-white shrink-0 sm:hidden" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trader Document & Compliance Proof Viewer Modal */}
      <TraderDocumentViewerModal
        isOpen={isDocViewerOpen}
        onClose={() => setIsDocViewerOpen(false)}
        trader={profile}
        initialBadgeId={docViewerBadgeId}
      />
    </div>
  );
}
