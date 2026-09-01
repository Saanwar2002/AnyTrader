import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Zap, ArrowLeft, Loader2, CreditCard, CheckCircle2, 
  PauseCircle, PlayCircle, Clock, Trash2, Edit3, Sparkles, 
  Eye, MousePointerClick, Star, X, Check, ChevronRight, User
} from "lucide-react";
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  doc, setDoc, updateDoc, deleteDoc, increment 
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthProvider";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export default function TradesBannerAdStudio() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [headline, setHeadline] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const DAILY_RATE = 2.00; // £2.00 per day flat rate
  const [isSaving, setIsSaving] = useState(false);
  
  // Wallet Top-up modal
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState("50");

  // Edit Modal
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [editHeadline, setEditHeadline] = useState("");

  // Live real-time wallet balance from profile or fallback
  const [liveWalletBalance, setLiveWalletBalance] = useState<number>(profile?.adWalletBalance || 0);

  // Subscribe to user doc for real-time wallet balance
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const udata = docSnap.data();
        setLiveWalletBalance(udata.adWalletBalance ?? profile?.adWalletBalance ?? 0);
      }
    });

    return () => unsubUser();
  }, [user, profile]);

  // Subscribe to advertisements created by this trader
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "advertisements"), 
      where("advertiserId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => {
        const data = d.data() as any;
        let isExpired = false;
        let daysLeft = 0;

        if (data.endDate) {
          const endMillis = data.endDate.toMillis ? data.endDate.toMillis() : (data.endDate.seconds ? data.endDate.seconds * 1000 : new Date(data.endDate).getTime());
          const diffMs = endMillis - Date.now();
          if (diffMs <= 0) {
            isExpired = true;
          } else {
            daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          }
        }

        return { 
          id: d.id, 
          ...data, 
          isExpired,
          daysLeft
        };
      }).sort((a: any, b: any) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dbTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dbTime - da;
      });

      setAdverts(items);
      setIsLoading(false);
    }, (err) => {
      console.warn("Banner ads subscription notice:", err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [user]);

  const walletBalance = liveWalletBalance;
  const isLowBalance = walletBalance > 0 && walletBalance < (DAILY_RATE * 7);
  const isOutOfFunds = walletBalance < DAILY_RATE;

  // Handle Top Up
  const handleTopup = async (amountToAdd?: number) => {
    if (!user) {
      toast.error("Please sign in to manage your ad wallet.");
      return;
    }
    
    const val = amountToAdd || Number(topupAmount);
    if (!val || isNaN(val) || val <= 0) {
      toast.error("Please enter a valid top up amount.");
      return;
    }

    setIsSaving(true);
    try {
      const newBalance = (walletBalance || 0) + val;
      await setDoc(doc(db, "users", user.uid), {
        adWalletBalance: newBalance
      }, { merge: true });

      setLiveWalletBalance(newBalance);
      toast.success(`Successfully added £${val.toFixed(2)} to your Ad Wallet!`, {
        description: `Your new balance is £${newBalance.toFixed(2)}.`
      });
      setShowTopupModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Top up failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Create Campaign
  const handleCreateCampaign = async () => {
    if (!user) {
      toast.error("Please sign in to create an ad campaign.");
      return;
    }
    
    const totalCost = durationDays * DAILY_RATE;
    if (walletBalance < totalCost) {
      const shortage = totalCost - walletBalance;
      toast.error(`Insufficient wallet funds`, {
        description: `You need £${totalCost.toFixed(2)} but have £${walletBalance.toFixed(2)}. Please top up £${shortage.toFixed(2)} to continue.`
      });
      setShowTopupModal(true);
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Deduct cost from wallet
      await setDoc(doc(db, "users", user.uid), {
        adWalletBalance: increment(-totalCost)
      }, { merge: true });

      setLiveWalletBalance(prev => Math.max(0, prev - totalCost));
      
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const businessTitle = profile?.businessName || profile?.name || "Verified Trade Specialist";
      const cleanHeadline = headline.trim() || profile?.trade || "Expert Quality Guaranteed";
      
      // 2. Add advertisement document
      const adDocRef = await addDoc(collection(db, "advertisements"), {
        type: "trader_promo",
        title: businessTitle,
        description: cleanHeadline,
        bgColor: "bg-slate-900",
        iconName: "Star",
        url: `/profile/${user.uid}`,
        targetRole: "homeowner",
        targetCategories: [profile?.trade || "all", "all"],
        
        advertiserId: user.uid,
        advertiserUid: user.uid,
        advertiserName: businessTitle,
        advertiserEmail: profile?.email || user.email || "",
        imageUrl: profile?.avatarUrl || "",
        isTraderAd: true,
        badgeLabel: "FEATURED PRO",
        perkText: profile?.isAvailableForEmergency ? "⚡ 24/7 Response Guaranteed" : "⭐ Verified Pro",
        
        dailyRate: DAILY_RATE,
        durationDays,
        totalCost,
        
        isActive: true,
        status: "active", 
        approvalStatus: "approved",
        clicks: 0,
        bannerClicks: 0,
        startDate,
        endDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Log notification for the trader
      try {
        await addDoc(collection(db, "notifications"), {
          userId: user.uid,
          title: "🚀 Promotion Boost Live!",
          body: `Your banner promotion for "${businessTitle}" is now live on homeowner dashboards for ${durationDays} days.`,
          type: "promotion",
          read: false,
          adId: adDocRef.id,
          createdAt: serverTimestamp()
        });
      } catch {
        // Non-blocking
      }

      toast.success("Ad Campaign Launched!", {
        description: `Your profile is now actively promoted on homeowner dashboards for ${durationDays} days.`
      });
      setShowModal(false);
      setHeadline("");
    } catch (err) {
      console.error("Create campaign error:", err);
      toast.error("Failed to create campaign. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Pause / Resume
  const handleToggleActive = async (ad: any) => {
    try {
      const nextActive = !ad.isActive;
      await updateDoc(doc(db, "advertisements", ad.id), {
        isActive: nextActive,
        updatedAt: serverTimestamp()
      });
      toast.success(nextActive ? "Promotion Resumed" : "Promotion Paused", {
        description: nextActive ? "Your ad is now visible to homeowners." : "Your ad is temporarily hidden."
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update campaign status.");
    }
  };

  // Delete Campaign
  const handleDeleteAd = async (adId: string) => {
    if (!confirm("Are you sure you want to remove this campaign record?")) return;
    try {
      await deleteDoc(doc(db, "advertisements", adId));
      toast.success("Campaign record removed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete campaign.");
    }
  };

  // Edit Headline
  const handleSaveEdit = async () => {
    if (!editingAd) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "advertisements", editingAd.id), {
        description: editHeadline.trim() || profile?.trade || "Expert Services",
        updatedAt: serverTimestamp()
      });
      toast.success("Campaign updated successfully!");
      setEditingAd(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update campaign.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-bold text-slate-500">Loading Banner Ad Studio...</p>
      </div>
    );
  }

  const traderName = profile?.businessName || profile?.name || "Your Business Name";
  const traderRating = (profile?.rating || 5.0).toFixed(1);
  const traderReviews = profile?.reviewCount || 24;
  const traderTrade = profile?.trade || "Professional Contractor";

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 relative">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-black transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button 
          onClick={() => navigate('/')}
          className="w-9 h-9 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 transition shadow-md cursor-pointer"
          title="Close & Return to Dashboard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 rounded-3xl border border-black shadow-lg">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Direct Homeowner Reach
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Traders Banner Ad Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Promote your trade directly at the top of local homeowner dashboards and search feeds for a flat £2.00/day.
          </p>
        </div>

        <button 
          onClick={() => {
            setHeadline("");
            setDurationDays(7);
            setShowModal(true);
          }} 
          className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 shrink-0 shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Launch New Promotion
        </button>
      </div>

      {/* Ad Wallet & Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wallet Balance Card */}
        <div className="bg-white text-slate-900 rounded-3xl p-6 relative overflow-hidden shadow-sm border border-black col-span-1 md:col-span-2 flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <CreditCard className="w-32 h-32 text-slate-900" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[11px]">
                Prepaid Ad Wallet Balance
              </p>
              {isOutOfFunds ? (
                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                  Zero Balance
                </span>
              ) : isLowBalance ? (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                  Low Funds
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                  Ready To Boost
                </span>
              )}
            </div>

            <h2 className={cn(
              "text-4xl sm:text-5xl font-black mb-2 tracking-tight", 
              isLowBalance ? "text-amber-600" : isOutOfFunds ? "text-red-600" : "text-slate-900"
            )}>
              £{walletBalance.toFixed(2)}
            </h2>

            {isOutOfFunds ? (
              <p className="text-red-600 text-xs font-bold flex items-center gap-1.5">
                <PauseCircle className="w-3.5 h-3.5"/> Top up your ad wallet to launch promotions.
              </p>
            ) : isLowBalance ? (
              <p className="text-amber-600 text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5"/> Balance is running low. Consider topping up.
              </p>
            ) : (
              <p className="text-emerald-600 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5"/> Sufficient funds ready for campaigns.
              </p>
            )}
          </div>
          
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3 relative z-10">
            <button 
              onClick={() => setShowTopupModal(true)} 
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              Top Up Ad Wallet
            </button>
            <p className="text-slate-500 text-[11px]">
              Prepaid balance is automatically deducted when you launch a campaign.
            </p>
          </div>
        </div>

        {/* Flat Rate Pricing Info Card */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-sm border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                Transparent Pricing
              </p>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                Zero Lead Fees
              </span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-amber-400 mb-1">
              £{DAILY_RATE.toFixed(2)}<span className="text-lg text-slate-400 font-bold">/day</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              No pay-per-lead charges or hidden commissions. Your profile rotates at the top of homeowner feeds with full direct contact links.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Stop / Pause Anytime
            </span>
            <span className="font-bold">100% Retained</span>
          </div>
        </div>
      </div>

      {/* Campaigns Header & List */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 fill-current" />
            Your Active & Past Campaigns ({adverts.length})
          </h2>
        </div>
        
        {adverts.length === 0 ? (
          <div className="bg-white border border-black rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto border border-amber-200">
              <Zap className="w-7 h-7 fill-current" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                No Promotional Campaigns Yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Promote your profile to thousands of local homeowners looking for qualified {profile?.trade || "trades"}.
              </p>
            </div>
            <button 
              onClick={() => {
                setHeadline("");
                setDurationDays(7);
                setShowModal(true);
              }} 
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black text-xs transition inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              Launch Your First Promotion
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adverts.map(ad => (
              <div 
                key={ad.id} 
                className={cn(
                  "bg-white rounded-3xl border p-5 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all",
                  ad.isActive && !ad.isExpired ? "border-amber-400 shadow-amber-400/10" : "border-black"
                )}
              >
                <div>
                  {/* Top Status Row */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                      <Star className="w-4 h-4 fill-current" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ad.isExpired ? (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                          Expired
                        </span>
                      ) : ad.isActive ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active ({ad.daysLeft}d left)
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                          Paused
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Title & Tagline */}
                  <h3 className="font-black text-slate-900 text-sm line-clamp-1">
                    {ad.title || "Promoted Trader"}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 min-h-[32px]">
                    {ad.description || "Expert services & quality guaranteed."}
                  </p>
                  
                  {/* Metadata Matrix */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl">
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Duration</p>
                      <p className="text-xs font-black text-slate-900">{ad.durationDays || 7} Days</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Cost</p>
                      <p className="text-xs font-black text-slate-900">£{(ad.totalCost || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Clicks</p>
                      <p className="text-xs font-black text-blue-600 flex items-center justify-center gap-0.5">
                        <MousePointerClick className="w-3 h-3" />
                        {ad.clicks || ad.bannerClicks || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingAd(ad);
                        setEditHeadline(ad.description || "");
                      }}
                      className="text-slate-600 hover:text-black flex items-center gap-1 p-1 hover:bg-slate-100 rounded-md transition cursor-pointer"
                      title="Edit Tagline"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteAd(ad.id)}
                      className="text-red-500 hover:text-red-700 flex items-center gap-1 p-1 hover:bg-red-50 rounded-md transition cursor-pointer"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!ad.isExpired && (
                    <button 
                      onClick={() => handleToggleActive(ad)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase transition cursor-pointer",
                        ad.isActive 
                          ? "bg-amber-100 text-amber-900 hover:bg-amber-200" 
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      )}
                    >
                      {ad.isActive ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" /> Resume
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE CAMPAIGN MODAL WITH LIVE BANNER PREVIEW */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] my-auto border border-black"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Boost Profile on Homeowner Dashboards
                    </h3>
                    <p className="text-[10px] text-slate-300">
                      Promote your business directly to domestic homeowners
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* Live Banner Ad Preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      Live Ad Preview (How Homeowners See It)
                    </label>
                    <span className="text-[10px] text-emerald-600 font-black uppercase">
                      ● Active Placement
                    </span>
                  </div>

                    {/* Preview Banner Container - Exactly matches live PartnerAdvertisement trader promo banner */}
                    <div className="relative overflow-hidden rounded-2xl w-full min-h-[150px] sm:min-h-[140px] bg-slate-900 border border-black shadow-md p-3.5 sm:p-4 text-white bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-between select-none">
                      {/* Golden Ribbon Badge tucked away in the top right corner (Matches exact reference design) */}
                      <div className="absolute top-0 right-3.5 sm:right-4 z-20 shrink-0 pointer-events-none drop-shadow-md">
                        <div 
                          className="w-12 sm:w-13 pt-2 pb-3.5 bg-gradient-to-b from-[#FDE68A] via-[#F59E0B] to-[#D97706] text-[#3B2500] flex flex-col items-center justify-center text-center shadow-lg font-black rounded-b-xs border-x border-b border-amber-300/40"
                          style={{
                            clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)",
                          }}
                        >
                          <span className="text-[7.5px] sm:text-[8px] font-black tracking-wider leading-none uppercase drop-shadow-[0_0.5px_0_rgba(255,255,255,0.4)]">
                            FEATURED
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-none mt-0.5 uppercase drop-shadow-[0_0.5px_0_rgba(255,255,255,0.4)]">
                            PRO
                          </span>
                        </div>
                      </div>

                      {/* Top Bar: Avatar with Verified Check + Personal/Business Name & Category + Star Rating Pill */}
                      <div className="flex items-start justify-between gap-2.5 pr-16 sm:pr-20">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {/* Trader Avatar Container */}
                          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner overflow-hidden mt-0.5">
                            {profile?.avatarUrl ? (
                              <img 
                                src={profile.avatarUrl} 
                                alt={profile?.name || "Trader Avatar"} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                            )}
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border border-black flex items-center justify-center shadow-xs">
                              <Check className="w-2 h-2 text-white stroke-[3]" />
                            </div>
                          </div>

                          {/* Title & Hierarchy: Personal Name -> Business & Category -> Rating */}
                          <div className="min-w-0 flex-1">
                            {/* 1. Personal Name */}
                            <h4 className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                              {profile?.name || profile?.businessName || "Elena Rostova"}
                            </h4>

                            {/* 2. Business Name & Category */}
                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-300 truncate mt-0.5">
                              {[profile?.businessName, profile?.trade].filter(Boolean).join(" · ") || "Heritage Luxe Painting & Decorating"}
                            </p>

                            {/* 3. Star Rating directly under Business Name */}
                            <div className="flex items-center mt-1">
                              <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0">
                                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                                {traderRating}
                                <span className="text-[9px] opacity-80">({traderReviews})</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* Middle: Full-Width Promoted Perk Highlight & Description */}
                    <div className="my-2 flex-1 flex flex-col justify-center gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-amber-300 tracking-wide">
                        <Sparkles className="w-3 h-3 fill-amber-300 shrink-0" />
                        <span className="leading-snug line-clamp-1">
                          {profile?.isAvailableForEmergency 
                            ? "⚡ 24/7 Response Guaranteed" 
                            : (profile?.accreditations?.[0]?.name ? `✨ ${profile.accreditations[0].name}` : "✨ ✨ City & Guilds Master Approved")}
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-slate-200 font-medium leading-snug line-clamp-2">
                        {headline.trim() || profile?.bio || `${traderTrade} specialist. Quality craftsmanship, upfront pricing, and guaranteed workmanship.`}
                      </p>
                    </div>

                    {/* Bottom Row: Verified Status / Area / Free Quote + View Profile CTA */}
                    <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-white/10 mt-auto">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-300 flex items-center gap-1 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
                        <span className="truncate">
                          Verified Pro · {profile?.postcode ? profile.postcode.substring(0, 4) : "SW3"} · {profile?.callOutFee ? `£${profile.callOutFee} Callout` : "Free Quote"}
                        </span>
                      </span>

                      {/* Action Button CTA */}
                      <div className="flex items-center gap-1 text-white bg-white/10 border border-white/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold shrink-0">
                        <span>View Profile</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Short Phrase / Tagline Input */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                    Promotional Tagline / Highlight
                  </label>
                  <input 
                    type="text" 
                    value={headline} 
                    onChange={e => setHeadline(e.target.value)} 
                    maxLength={70} 
                    className="w-full bg-white border border-black rounded-xl p-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400" 
                    placeholder="e.g. 24/7 Emergency Gas Safe Plumber • 30 Min Arrival" 
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Character limit: {headline.length}/70 · Keep it short, punchy, and highlight your specialty.
                  </p>
                </div>
                
                {/* Duration Picker */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1.5">
                    Select Campaign Duration
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[3, 7, 14, 30].map(days => {
                      const cost = days * DAILY_RATE;
                      const isSelected = durationDays === days;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setDurationDays(days)}
                          className={cn(
                            "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                            isSelected 
                              ? "border-amber-400 bg-amber-50 text-slate-950 ring-2 ring-amber-400" 
                              : "border-black bg-white hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <span className="text-xs font-black block">{days} Days</span>
                          <span className="text-[11px] font-bold text-slate-500 mt-1">£{cost.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Total Cost & Wallet Check */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-black space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-600">Campaign Cost ({durationDays} days @ £{DAILY_RATE.toFixed(2)}/day):</span>
                    <span className="font-black text-slate-900 text-sm">£{(durationDays * DAILY_RATE).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-600">Your Wallet Balance:</span>
                    <span className={cn("font-black text-sm", walletBalance < (durationDays * DAILY_RATE) ? "text-red-600" : "text-emerald-600")}>
                      £{walletBalance.toFixed(2)}
                    </span>
                  </div>
                  {walletBalance < (durationDays * DAILY_RATE) && (
                    <p className="text-[10px] text-red-600 font-bold pt-1 border-t border-slate-200">
                      ⚠️ Balance is £{((durationDays * DAILY_RATE) - walletBalance).toFixed(2)} short. Top up will be requested on launch.
                    </p>
                  )}
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-black cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateCampaign}
                  disabled={isSaving}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-6 py-3 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      Start £{(durationDays * DAILY_RATE).toFixed(2)} Promotion
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOP UP WALLET MODAL */}
      <AnimatePresence>
        {showTopupModal && (
          <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center shadow-2xl border border-black my-auto space-y-4"
            >
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
                <CreditCard className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">Fund Ad Wallet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add funds to your prepaid wallet to launch promotional campaigns.
                </p>
              </div>
              
              {/* Quick Select Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {["20", "50", "100", "200"].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black border transition cursor-pointer",
                      topupAmount === amt 
                        ? "bg-slate-900 text-white border-black" 
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    £{amt}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">£</span>
                <input 
                  type="number" 
                  min="1"
                  step="1"
                  value={topupAmount} 
                  onChange={e => setTopupAmount(e.target.value)} 
                  className="w-full bg-slate-50 border border-black focus:ring-2 focus:ring-blue-500 p-3 pl-9 text-2xl font-black rounded-xl outline-none text-slate-900" 
                  placeholder="50"
                />
              </div>
              
              <button 
                onClick={() => handleTopup()} 
                disabled={isSaving} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Pay with Card"}
              </button>
              
              <button 
                type="button"
                onClick={() => setShowTopupModal(false)} 
                className="w-full py-2 text-slate-500 font-bold text-xs hover:text-black transition cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT CAMPAIGN HEADLINE MODAL */}
      <AnimatePresence>
        {editingAd && (
          <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-black my-auto space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  Edit Campaign Tagline
                </h3>
                <button onClick={() => setEditingAd(null)} className="text-slate-400 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                  Tagline / Description
                </label>
                <input 
                  type="text" 
                  value={editHeadline}
                  onChange={e => setEditHeadline(e.target.value)}
                  maxLength={70}
                  className="w-full bg-white border border-black rounded-xl p-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAd(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
