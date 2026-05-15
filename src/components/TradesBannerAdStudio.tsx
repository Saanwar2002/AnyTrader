import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Zap, ArrowLeft, Loader2, CreditCard, ChevronRight, CheckCircle2, PauseCircle, Calendar, MousePointerClick, FileText, LayoutGrid, Clock, X } from "lucide-react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, orderBy, increment } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthProvider";
import { useCategories } from "../lib/CategoryProvider";
import { cn } from "../lib/utils";

const iconMap: Record<string, any> = {
  Zap, Calendar, LayoutGrid
};

export default function TradesBannerAdStudio() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { categories } = useCategories();
  
  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [headline, setHeadline] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const DAILY_RATE = 2.00; // £2 per day
  const [isSaving, setIsSaving] = useState(false);
  
  // Wallet Top-up modal
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState("50");

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "advertisements"), 
      where("advertiserId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setAdverts(snapshot.docs.map(d => {
        const data = d.data() as any;
        // Check if expired for display purposes
        let isExpired = false;
        if (data.type === "trader_promo" && data.endDate) {
           const endMillis = data.endDate.toMillis ? data.endDate.toMillis() : data.endDate.seconds * 1000;
           if (Date.now() > endMillis) isExpired = true;
        }
        return { id: d.id, ...data, isExpired };
      }).sort((a: any, b: any) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dbTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dbTime - da;
      }));
      setIsLoading(false);
    });
    return unsub;
  }, [user]);

  const walletBalance = profile?.adWalletBalance || 0;
  const isLowBalance = walletBalance > 0 && walletBalance < (DAILY_RATE * 7);
  const isOutOfFunds = walletBalance < DAILY_RATE;

  const handleCreateCampaign = async () => {
    if (!user) return;
    
    const totalCost = durationDays * DAILY_RATE;
    if (walletBalance < totalCost) {
      alert(`Insufficient funds. Your wallet balance is £${walletBalance.toFixed(2)}, but this campaign costs £${totalCost.toFixed(2)}.`);
      return;
    }
    
    setIsSaving(true);
    try {
      // Deduct from wallet
      await updateDoc(doc(db, "users", user.uid), {
        adWalletBalance: increment(-totalCost)
      });
      
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      await addDoc(collection(db, "advertisements"), {
        type: "trader_promo",
        title: `⭐ PROMOTED: ${profile?.businessName || profile?.name || "Trader"}`,
        description: `★${profile?.rating?.toFixed(1) || "5.0"} · ${headline || profile?.trade || "Expert Services"}`,
        bgColor: "bg-slate-900",
        iconName: "Star",
        url: `${window.location.origin}/profile/${user.uid}`,
        targetRole: "homeowner",
        
        advertiserId: user.uid,
        advertiserName: profile?.businessName || profile?.name || "Trader",
        advertiserEmail: profile?.email || "",
        isTraderAd: true,
        
        dailyRate: DAILY_RATE,
        durationDays,
        totalCost,
        
        isActive: true, // Auto active
        status: "active", 
        clicks: 0,
        startDate,
        endDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create campaign");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTopup = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const newBalance = walletBalance + Number(topupAmount);
      await updateDoc(doc(db, "users", user.uid), {
        adWalletBalance: newBalance
      });
      alert(`Successfully added £${topupAmount} to your Ad Wallet.`);
      setShowTopupModal(false);
    } catch (err) {
      console.error(err);
      alert("Top up failed.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 relative">
      <button 
        onClick={() => navigate('/')}
        className="absolute top-4 right-4 md:top-8 md:right-4 w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg z-10"
        title="Close & Return to Dashboard"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-12">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Traders Banner Ad Studio</h1>
          <p className="text-slate-500 mt-1">Promote your business directly to homeowners and other trades.</p>
        </div>
        <button 
          onClick={() => {
            setHeadline("");
            setDurationDays(7);
            setShowModal(true);
          }} 
          className="bg-amber-500 text-slate-900 px-5 h-12 rounded-xl font-bold hover:bg-amber-400 transition flex items-center gap-2 shrink-0 shadow-sm"
        >
          <Plus className="w-5 h-5" /> Boost Profile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white text-slate-900 rounded-3xl p-6 relative overflow-hidden shadow-sm border border-black col-span-1 md:col-span-2 flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <CreditCard className="w-24 h-24 text-slate-900" />
          </div>
          <div>
            <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">Prepaid Ad Wallet Balance</p>
            <h2 className={cn("text-5xl font-black mb-2", isLowBalance ? "text-amber-500" : isOutOfFunds ? "text-red-500" : "text-slate-900")}>
              £{walletBalance.toFixed(2)}
            </h2>
            {isOutOfFunds ? (
              <p className="text-red-500 text-sm font-bold flex items-center gap-1.5"><PauseCircle className="w-4 h-4"/> Top up to run ads.</p>
            ) : isLowBalance ? (
              <p className="text-amber-500 text-sm font-bold flex items-center gap-1.5"><Loader2 className="w-4 h-4"/> Low balance! Top up soon.</p>
            ) : (
              <p className="text-emerald-500 text-sm font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> Sufficient funds for campaigns.</p>
            )}
          </div>
          
          <div className="mt-8 flex items-center gap-3 relative z-10">
            <button onClick={() => setShowTopupModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-sm border-none">
              Top Up Wallet
            </button>
            <p className="text-slate-500 text-xs">Funds are kept in your wallet until you launch a promotion.</p>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">Daily Boost Rate</p>
            <h3 className="text-4xl font-black text-amber-400 mb-1">£{DAILY_RATE.toFixed(2)}<span className="text-xl text-slate-400">/day</span></h3>
            <p className="text-sm font-bold text-slate-800 bg-amber-400 px-3 py-1 rounded-lg inline-flex items-center gap-2 mt-2 shadow-sm">
               Flat Rate
            </p>
          </div>
          <p className="text-xs text-slate-300 mt-4 leading-relaxed">
            Pay a flat daily rate to get your profile promoted on homeowner dashboards. Stop anytime.
          </p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900 pt-4">Your Advertising Campaigns</h2>
      
      {adverts.length === 0 ? (
        <div className="bg-white border border-black rounded-3xl p-12 text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">No campaigns yet</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">Create your first banner ad campaign.</p>
          <button 
            onClick={() => setShowModal(true)} 
            className="bg-slate-100 text-slate-900 px-6 h-12 rounded-xl font-bold hover:bg-slate-200 transition inline-flex items-center gap-2"
          >
            Create Your First Ad
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adverts.map(ad => (
            <div key={ad.id} className="bg-white rounded-3xl border border-black p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0", ad.bgColor)}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  {ad.status === "pending_approval" ? (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">Pending</span>
                  ) : ad.status === "rejected" ? (
                    <span className="bg-red-100 text-red-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">Rejected</span>
                  ) : ad.isActive ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">Active</span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">Paused</span>
                  )}
                </div>
              </div>
              
              <h3 className="font-bold text-slate-900 line-clamp-1">{ad.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mt-1 min-h-[40px]">{ad.description}</p>
              
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</p>
                  <p className="text-lg font-black text-slate-900">{ad.durationDays} Days</p>
                </div>
                 <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cost</p>
                  <p className="text-lg font-black text-slate-900">£{ad.totalCost?.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5 object-contain"><MousePointerClick className="w-3.5 h-3.5"/> Flat Rate</span>
                {!ad.isExpired && (
                  <button 
                    onClick={async () => {
                      await updateDoc(doc(db, "advertisements", ad.id), { isActive: !ad.isActive });
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {ad.isActive ? "Pause Ad" : "Resume Ad"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Boost Profile on Banner Ads</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-2"><ArrowLeft className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="bg-slate-900 text-white rounded-2xl p-5 mb-4 shadow-sm border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-slate-900">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg">⭐ PROMOTED</h4>
                    <p className="text-slate-300 text-xs">Your profile will be shown to homeowners in your area.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Short Phrase / Tagline</label>
                <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} maxLength={40} className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none focus:ring-2 focus:ring-blue-600/20" placeholder={profile?.trade || "e.g. Expert Plumbing Services"} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (Days)</label>
                <div className="flex flex-col gap-3">
                   {[7, 14, 30].map(days => (
                     <button
                       key={days}
                       onClick={() => setDurationDays(days)}
                       className={cn("flex items-center justify-between p-4 rounded-xl border-2 transition-all", durationDays === days ? "border-amber-400 bg-amber-50" : "border-black bg-white hover:border-black")}
                     >
                       <span className="font-black text-slate-900">{days} Days</span>
                       <span className="font-bold text-slate-500">£{(days * DAILY_RATE).toFixed(2)} total</span>
                     </button>
                   ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-black flex justify-between items-center text-sm">
                <span className="font-bold text-slate-500">Total Cost:</span>
                <span className="font-black text-slate-900 text-lg">£{(durationDays * DAILY_RATE).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={handleCreateCampaign}
                disabled={isSaving}
                className="bg-amber-500 text-slate-900 px-8 h-12 rounded-xl font-black hover:bg-amber-400 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start Promotion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTopupModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Fund Ad Wallet</h3>
            <p className="text-sm text-slate-500 mb-6">Instantly add funds to launch your promotional campaigns.</p>
            
            <div className="relative mb-6">
              <span className="absolute left-6 top-4 text-slate-400 font-bold text-xl">£</span>
              <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="w-full bg-slate-50 border-2 border-black focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-4 pl-12 text-2xl font-black rounded-2xl outline-none transition-all" />
            </div>
            
            <button onClick={handleTopup} disabled={isSaving} className="w-full bg-slate-900 text-white h-14 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-sm disabled:opacity-50">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pay with Card"}
            </button>
            <button onClick={() => setShowTopupModal(false)} className="w-full mt-3 h-12 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
