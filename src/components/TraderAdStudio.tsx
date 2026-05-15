import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthProvider";
import { Zap, Plus, ArrowLeft, Loader2, CreditCard, LayoutGrid, AlertCircle, CheckCircle2 } from "lucide-react";

export default function TraderAdStudio() {
  const { user, profile } = useAuth();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Determine click cost based on tier
  const tierCost = profile?.subscriptionType === "premium" ? 0.50 : profile?.subscriptionType === "pro" ? 0.70 : 1.00;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "advertisements"), where("advertiserUid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAdverts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return unsub;
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const handleRequestAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const budget = Number(formData.get("budget"));
    
    try {
      await setDoc(doc(collection(db, "advertisements")), {
        advertiserUid: user.uid,
        advertiserName: profile?.name || "Trader",
        advertiserEmail: profile?.email || user.email,
        title: formData.get("title"),
        description: formData.get("description"),
        url: `${window.location.origin}/profile/${user.uid}`,
        bgColor: "bg-blue-600",
        iconName: "Zap",
        targetRole: formData.get("targetRole"),
        targetCategories: [],
        costPerDisplay: tierCost,
        dailyDisplayLimit: 100,
        durationDays: 30,
        isActive: false,
        approvalStatus: "pending",
        billingCycle: "prepaid",
        totalBudget: budget,
        prepaidBalance: budget,
        clicks: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowRequestModal(false);
    } catch (e) {
      console.error(e);
      alert("Error requesting ad");
    }
  };

  const handleTopup = async (adId: string, currentBalance: number, amount: number) => {
    if (confirm(`Charge £${amount} to your default payment method to top up ad balance?`)) {
      try {
        await updateDoc(doc(db, "advertisements", adId), {
          prepaidBalance: (currentBalance || 0) + amount,
          totalBudget: amount // Note: simple logic as total top-ups just adds it
        });
        alert(`Successfully topped up £${amount}`);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/profile" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Traders Banner Ad Studio</h1>
          <p className="text-slate-500">Promote your profile across AnyTrader</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Your Campaigns</h2>
            <button onClick={() => setShowRequestModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          </div>

          {adverts.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-black rounded-3xl p-12 text-center">
              <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No active campaigns</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Get more leads by promoting your profile natively in the project feed and dashboard.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adverts.map((ad) => {
                const balancePct = ad.prepaidBalance && ad.totalBudget ? Math.max(0, Math.min(100, (ad.prepaidBalance / ad.totalBudget) * 100)) : 0;
                
                return (
                <div key={ad.id} className="bg-white border border-black rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">{ad.title}</h3>
                      <p className="text-sm text-slate-500">{ad.description}</p>
                    </div>
                    {ad.approvalStatus === "pending" ? (
                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Pending Review
                      </span>
                    ) : ad.isActive ? (
                      <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        Paused
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-1">Clicks</p>
                      <p className="text-lg font-black text-slate-900">{ad.clicks || 0}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-1">Cost / Click</p>
                      <p className="text-lg font-black text-slate-900">£{(ad.costPerDisplay || tierCost).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 md:col-span-2">
                      <div className="flex justify-between items-end mb-1">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none">Wallet Balance</p>
                        <p className="text-lg font-black text-blue-600 leading-none">£{(ad.prepaidBalance || 0).toFixed(2)}</p>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden w-full">
                        <div className={`h-full rounded-full ${balancePct > 20 ? 'bg-blue-600' : 'bg-red-500'}`} style={{ width: `${balancePct}%` }}></div>
                      </div>
                      {balancePct <= 10 && ad.approvalStatus !== "pending" && (
                        <p className="text-[10px] text-red-600 font-bold mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Balance critically low. Top up to continue promotion.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 gap-2">
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => handleTopup(ad.id, ad.prepaidBalance, 50)} className="flex-1 md:flex-none border border-black bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition">
                        <CreditCard className="w-4 h-4" /> Top up £50
                        </button>
                        <button onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/ad-report/${ad.id}`);
                            alert("Report link copied!");
                        }} className="border border-black bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                        <LayoutGrid className="w-4 h-4" /> Report
                        </button>
                    </div>
                    {ad.approvalStatus !== "pending" && (
                        <button 
                         onClick={async () => {
                             await updateDoc(doc(db, "advertisements", ad.id), { isActive: !ad.isActive });
                         }}
                         className={`px-4 py-2 rounded-xl text-sm font-bold ${ad.isActive ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                        >
                            {ad.isActive ? "Pause Campaign" : "Resume"}
                        </button>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        <div className="col-span-1">
          <div className="bg-gradient-to-b from-blue-50 to-white rounded-3xl p-6 border border-blue-100">
            <h3 className="font-bold text-lg text-slate-900 mb-2">Pricing Structure</h3>
            <p className="text-sm text-slate-600 mb-6">Your cost-per-click is discounted based on your current AnyTrader subscription tier.</p>
            
            <div className="space-y-3 mb-6">
              <div className={`p-4 rounded-xl border ${profile?.subscriptionType === "premium" ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 my-4" : "bg-white border-black text-slate-600"}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-black uppercase tracking-widest ${profile?.subscriptionType === "premium" ? "text-blue-200" : "text-slate-400"}`}>Premium Tier</span>
                  {profile?.subscriptionType === "premium" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black ${profile?.subscriptionType === "premium" ? "text-white" : "text-slate-900"}`}>50p</span>
                  <span className={`text-sm ${profile?.subscriptionType === "premium" ? "text-blue-100" : "text-slate-500"}`}>/ click</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${profile?.subscriptionType === "pro" ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 my-4" : "bg-white border-black text-slate-600"}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-black uppercase tracking-widest ${profile?.subscriptionType === "pro" ? "text-blue-200" : "text-slate-400"}`}>Pro Tier</span>
                  {profile?.subscriptionType === "pro" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black ${profile?.subscriptionType === "pro" ? "text-white" : "text-slate-900"}`}>70p</span>
                  <span className={`text-sm ${profile?.subscriptionType === "pro" ? "text-blue-100" : "text-slate-500"}`}>/ click</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${profile?.subscriptionType === "free" || !profile?.subscriptionType ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 my-4" : "bg-white border-black text-slate-600"}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-black uppercase tracking-widest ${profile?.subscriptionType === "free" || !profile?.subscriptionType ? "text-blue-200" : "text-slate-400"}`}>Free Tier</span>
                  {(profile?.subscriptionType === "free" || !profile?.subscriptionType) && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black ${profile?.subscriptionType === "free" || !profile?.subscriptionType ? "text-white" : "text-slate-900"}`}>£1.00</span>
                  <span className={`text-sm ${profile?.subscriptionType === "free" || !profile?.subscriptionType ? "text-blue-100" : "text-slate-500"}`}>/ click</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 italic text-center">Charges are deducted from your prepaid wallet balance automatically.</p>
          </div>
        </div>
      </div>

      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRequestAd} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Request Campaign</h3>
                <p className="text-sm text-slate-500">Your ad will go live after admin approval.</p>
              </div>
              <button type="button" onClick={() => setShowRequestModal(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 shadow-sm border border-black hover:text-slate-900 shrink-0">X</button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Title *</label>
                <input name="title" required type="text" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="E.g. Verified Electrician in London" defaultValue={`${profile?.name} - Professional Services`} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Short Description *</label>
                <input name="description" required type="text" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Available for 24/7 emergency callouts." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Show To</label>
                    <select name="targetRole" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
                        <option value="all">Everyone</option>
                        <option value="homeowner">Homeowners Only</option>
                        <option value="tradesperson">Tradespeople Only</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Initial Prepaid Budget (£)</label>
                    <select name="budget" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold text-slate-900">
                        <option value="50">£50</option>
                        <option value="100">£100</option>
                        <option value="250">£250</option>
                        <option value="500">£500</option>
                    </select>
                 </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p><strong>Your CPC:</strong> £{tierCost.toFixed(2)}/click (Based on {profile?.subscriptionType || 'Free'} Tier)</p>
                <p className="mt-2 text-xs opacity-80">This budget will be charged to your default payment method upon admin approval.</p>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setShowRequestModal(false)} className="px-6 py-3 font-bold text-slate-600 hover:text-slate-900">Cancel</button>
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">Submit Request</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
