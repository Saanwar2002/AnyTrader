import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Zap, ArrowLeft, Loader2, CreditCard, ChevronRight, CheckCircle2, PauseCircle, Calendar, MousePointerClick, FileText, LayoutGrid, Clock, X } from "lucide-react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, orderBy } from "firebase/firestore";
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
  
  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bgColor, setBgColor] = useState("bg-blue-600");
  const [targetRole, setTargetRole] = useState("all");
  const [targetCategories, setTargetCategories] = useState<string[]>([]);
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
      setAdverts(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dbTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dbTime - da;
      }));
      setIsLoading(false);
    });
    return unsub;
  }, [user]);

  const currentTier = profile?.tierId || "Free Explorer";
  
  const getCpc = () => {
    const t = currentTier.toLowerCase();
    if (t.includes("expert") || t.includes("gold") || t.includes("enterprise")) return 0.50;
    if (t.includes("pro") || t.includes("silver") || t.includes("plus")) return 0.70;
    return 1.00;
  };

  const cpc = getCpc();
  const walletBalance = profile?.adWalletBalance || 0;
  const isLowBalance = walletBalance > 0 && walletBalance < 10;
  const isOutOfFunds = walletBalance <= 0;

  const handleCreateCampaign = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, "advertisements"), {
        title,
        description,
        bgColor,
        iconName: "Zap",
        url: `${window.location.origin}/profile/${user.uid}`,
        targetRole,
        targetCategories: targetRole === "tradesperson" ? targetCategories : [],
        
        // CRM / Tracking info
        advertiserId: user.uid,
        advertiserName: profile?.businessName || profile?.name || "Trader",
        advertiserEmail: profile?.email || "",
        isTraderAd: true,
        costPerDisplay: cpc,
        billingCycle: "prepaid_wallet",
        
        isActive: false, // Requires admin approval
        status: "pending_approval", 
        clicks: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to request campaign");
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
            setTitle("");
            setDescription("");
            setBgColor("bg-blue-600");
            setTargetRole("all");
            setTargetCategories([]);
            setShowModal(true);
          }} 
          className="bg-blue-600 text-white px-5 h-12 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shrink-0 shadow-sm"
        >
          <Plus className="w-5 h-5" /> New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden shadow-lg col-span-1 md:col-span-2 flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <CreditCard className="w-24 h-24" />
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">Prepaid Ad Wallet Balance</p>
            <h2 className={cn("text-5xl font-black mb-2", isLowBalance ? "text-amber-400" : isOutOfFunds ? "text-red-400" : "text-white")}>
              £{walletBalance.toFixed(2)}
            </h2>
            {isOutOfFunds ? (
              <p className="text-red-400 text-sm font-bold flex items-center gap-1.5"><PauseCircle className="w-4 h-4"/> Ads paused due to insufficient funds.</p>
            ) : isLowBalance ? (
              <p className="text-amber-400 text-sm font-bold flex items-center gap-1.5"><Loader2 className="w-4 h-4"/> Low balance! Top up soon.</p>
            ) : (
              <p className="text-emerald-400 text-sm font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> Ads running smoothly.</p>
            )}
          </div>
          
          <div className="mt-8 flex items-center gap-3">
            <button onClick={() => setShowTopupModal(true)} className="bg-white text-slate-900 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition shadow-sm border-none">
              Top Up Wallet
            </button>
            <p className="text-slate-400 text-xs">Funds are automatically deducted per click.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-3">Your Cost Per Click (CPC)</p>
            <h3 className="text-4xl font-black text-blue-600 mb-1">£{cpc.toFixed(2)}</h3>
            <p className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg inline-flex items-center gap-2 mt-2">
              <Zap className="w-3.5 h-3.5 text-blue-600" /> {currentTier} Rate
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-4 leading-relaxed">
            Your CPC is calculated based on your subscription tier. Upgrade to lower your CPC.
          </p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900 pt-4">Your Advertising Campaigns</h2>
      
      {adverts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
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
            <div key={ad.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clicks</p>
                  <p className="text-lg font-black text-slate-900">{ad.clicks || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spent</p>
                  <p className="text-lg font-black text-slate-900">£{((ad.clicks || 0) * (ad.costPerDisplay || cpc)).toFixed(2)}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><MousePointerClick className="w-3.5 h-3.5"/> £{ad.costPerDisplay || cpc}/click</span>
                <button 
                  onClick={async () => {
                    if (ad.status !== "active" && ad.status !== "pending_approval" && ad.status !== "rejected") {
                       await updateDoc(doc(db, "advertisements", ad.id), { isActive: !ad.isActive });
                    }
                  }}
                  disabled={ad.status === "pending_approval" || ad.status === "rejected"}
                  className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {ad.isActive ? "Pause Ad" : "Resume Ad"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Create Banner Campaign</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-2"><ArrowLeft className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Punchy Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={40} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none focus:ring-2 focus:ring-blue-600/20" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Short Description</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={80} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none focus:ring-2 focus:ring-blue-600/20" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Background Color</label>
                <div className="flex flex-wrap gap-3">
                  {["bg-blue-600", "bg-emerald-600", "bg-rose-600", "bg-indigo-600", "bg-amber-600", "bg-slate-900"].map(color => (
                    <button
                      key={color}
                      onClick={() => setBgColor(color)}
                      className={cn("w-10 h-10 rounded-full border-2 transition-all", color, bgColor === color ? "border-blue-400 ring-4 ring-blue-500/20" : "border-transparent")}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Audience</label>
                <select value={targetRole} onChange={e => setTargetRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none">
                  <option value="all">Everyone on AnyTrader</option>
                  <option value="tradesperson">Other Tradespeople (B2B)</option>
                  <option value="homeowner">Homeowners Only (B2C)</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={handleCreateCampaign}
                disabled={isSaving || !title.trim() || !description.trim()}
                className="bg-blue-600 text-white px-8 h-12 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTopupModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Top Up Wallet</h3>
            <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="w-full border p-4 text-2xl text-center rounded-xl font-black mb-4" />
            <button onClick={handleTopup} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold">Top Up {topupAmount}</button>
            <button onClick={() => setShowTopupModal(false)} className="w-full mt-2 p-4 text-slate-500 font-bold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
