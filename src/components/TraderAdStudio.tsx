import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthProvider";
import { Zap, Plus, ArrowLeft, Loader2, CreditCard, LayoutGrid, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Target, Flame, HelpCircle } from "lucide-react";

export default function TraderAdStudio() {
  const { user, profile } = useAuth();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [openModalInfo, setOpenModalInfo] = useState<string | null>("autotopup");

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
    const placement = formData.get("placement") || "both";
    const selectedCat = formData.get("targetCategory") || "all";
    const promotionRadius = formData.get("promotionRadius") || "20";
    
    try {
      await setDoc(doc(collection(db, "advertisements")), {
        advertiserUid: user.uid,
        advertiserId: user.uid,
        advertiserName: profile?.name || "Trader",
        advertiserEmail: profile?.email || user.email,
        title: formData.get("title"),
        description: formData.get("description"),
        url: `${window.location.origin}/profile/${user.uid}`,
        bgColor: "bg-blue-600",
        iconName: "Zap",
        placement: placement, // "search_feed", "banner_ad", or "both"
        promotionRadius: promotionRadius, // "5", "10", "15", "20", "50", or "nationwide"
        autoTopUpEnabled: formData.get("autoTopUpEnabled") === "on",
        autoTopUpThreshold: 10,
        autoTopUpAmount: 50,
        lowBalanceAlertsEnabled: formData.get("lowBalanceAlertsEnabled") === "on",
        targetRole: formData.get("targetRole"),
        targetCategories: selectedCat === "all" ? [] : [selectedCat],
        costPerDisplay: tierCost,
        dailyDisplayLimit: 100,
        durationDays: 30,
        isActive: false,
        approvalStatus: "pending",
        billingCycle: "prepaid",
        totalBudget: budget,
        prepaidBalance: budget,
        clicks: 0,
        searchFeedClicks: 0,
        bannerClicks: 0,
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

      {/* Interactive Collapsible Feature Benefits & ROI Guide */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-black shadow-xl space-y-4">
        <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setShowGuide(!showGuide)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex flex-wrap items-center gap-2">
                Promoted Profiles & Search Monetisation Guide
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Maximise ROI</span>
              </h3>
              <p className="text-xs text-slate-300">Understand how Auto-Reload, Radius Targeting, & Peak Bidding bring you direct customer leads.</p>
            </div>
          </div>
          <button type="button" className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/20 transition shrink-0">
            {showGuide ? "Hide Benefits" : "View Benefits"}
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Zap className="w-4 h-4 shrink-0" />
                <span>Smart Auto Top-Up</span>
              </div>
              <p className="text-xs text-slate-200 font-semibold">Zero Campaign Downtime</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Automatically reloads £50.00 into your wallet when balance hits £10.00. Ensures your profile never drops out of top 3 search slots during peak homeowner search surges.
              </p>
              <div className="bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-lg p-2 text-[10px] font-bold">
                📈 Up to 3.5x higher inquiry conversion rate
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <Target className="w-4 h-4 shrink-0" />
                <span>Geo-Radius Lead Matching</span>
              </div>
              <p className="text-xs text-slate-200 font-semibold">Zero Wasted CPC Budget</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Target homeowners strictly within 5 to 50 miles of your registered postcode. Your budget is spent 100% on nearby customers you can actually travel to and service.
              </p>
              <div className="bg-blue-400/10 border border-blue-400/20 text-blue-300 rounded-lg p-2 text-[10px] font-bold">
                🎯 100% local lead qualification
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Flame className="w-4 h-4 shrink-0" />
                <span>Seasonal & Category Boost</span>
              </div>
              <p className="text-xs text-slate-200 font-semibold">Capture Emergency Surges</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Homeowners search for emergency fixes (heating in winter, roofing in storms) with high urgency. Priority category bidding places you at the top of high-intent searches.
              </p>
              <div className="bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 rounded-lg p-2 text-[10px] font-bold">
                💰 Premium callout rates & instant job hires
              </div>
            </div>
          </div>
        )}
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {ad.placement === "search_feed" ? "🔍 Search Feed" : ad.placement === "banner_ad" ? "🖼️ Banner Ad" : "⚡ Dual Boost"}
                        </span>
                        {ad.targetCategories?.length > 0 && (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {ad.targetCategories[0]}
                          </span>
                        )}
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {ad.promotionRadius === "nationwide" ? "🌍 Nationwide" : `📍 ${ad.promotionRadius || 20} Miles`}
                        </span>
                      </div>
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
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-black">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-1">Search Clicks</p>
                      <p className="text-lg font-black text-slate-900">{ad.searchFeedClicks || 0}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-black">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-1">Banner Clicks</p>
                      <p className="text-lg font-black text-slate-900">{ad.bannerClicks || 0}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-black">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-1">CPC Rate</p>
                      <p className="text-lg font-black text-slate-900">£{(ad.costPerDisplay || tierCost).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-black">
                      <div className="flex justify-between items-end mb-1">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none">Prepaid Balance</p>
                        <p className="text-lg font-black text-blue-600 leading-none">£{(ad.prepaidBalance || 0).toFixed(2)}</p>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden w-full mt-2">
                        <div className={`h-full rounded-full ${balancePct > 20 ? 'bg-blue-600' : 'bg-red-500'}`} style={{ width: `${balancePct}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Low Balance & Auto Top-Up Status Banner */}
                  <div className={`p-3 rounded-xl border mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-medium ${
                    (ad.prepaidBalance || 0) <= 10 
                      ? 'bg-amber-50 border-amber-300 text-amber-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      {(ad.prepaidBalance || 0) <= 10 ? (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                      ) : (
                        <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                      <div>
                        {(ad.prepaidBalance || 0) <= 10 ? (
                          <span className="font-bold text-amber-800">⚠️ Low Balance Warning: £{(ad.prepaidBalance || 0).toFixed(2)} remaining. </span>
                        ) : null}
                        <span>
                          {ad.autoTopUpEnabled 
                            ? "⚡ Auto Top-Up Active: Automatically reloads £50.00 if balance drops below £10.00." 
                            : "Auto Top-Up Disabled: Campaign will pause when balance reaches £0.00."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                        <input 
                          type="checkbox" 
                          checked={ad.autoTopUpEnabled || false} 
                          onChange={async (e) => {
                            await updateDoc(doc(db, "advertisements", ad.id), {
                              autoTopUpEnabled: e.target.checked
                            });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        Auto-Reload
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-black gap-2">
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
            <div className="p-6 border-b border-black flex justify-between items-center bg-slate-50">
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
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Placement *</label>
                <select name="placement" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none font-bold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
                  <option value="search_feed">🔍 Search Feed Promoted Profile (Top 3 Category Slots)</option>
                  <option value="banner_ad">🖼️ Dashboard Banner Ad</option>
                  <option value="both">⚡ Dual Promotion (Search Feed + Dashboard Banner)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Select where your profile or business campaign will be showcased.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Trade Category</label>
                <select name="targetCategory" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800">
                  <option value="all">All Trade Categories</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Roofing">Roofing</option>
                  <option value="Joinery & Carpentry">Joinery & Carpentry</option>
                  <option value="Building & Construction">Building & Construction</option>
                  <option value="Painting & Decorating">Painting & Decorating</option>
                  <option value="Heating & Gas">Heating & Gas</option>
                  <option value="Landscaping & Gardening">Landscaping & Gardening</option>
                  <option value="Tiling">Tiling</option>
                  <option value="Handyman">Handyman</option>
                </select>
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenModalInfo(openModalInfo === 'category' ? null : 'category')}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>How Category & Seasonal Surge Bidding works?</span>
                    {openModalInfo === 'category' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {openModalInfo === 'category' && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 space-y-1">
                      <p className="font-bold">🔥 Category & Seasonal Demand Spikes:</p>
                      <p className="opacity-90 leading-relaxed">
                        During seasonal demand spikes (e.g. Heating & Gas in winter, Landscaping in spring, Roofing after storms), homeowner searches surge by over 300%. Target your specific category to capture high-intent customers who need immediate quotes.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Targeting Radius (Miles around registered location)</label>
                <select name="promotionRadius" defaultValue="20" className="w-full bg-slate-50 border border-black rounded-xl px-4 h-12 outline-none font-bold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
                  <option value="5">📍 Within 5 Miles</option>
                  <option value="10">📍 Within 10 Miles</option>
                  <option value="15">📍 Within 15 Miles</option>
                  <option value="20">📍 Within 20 Miles</option>
                  <option value="50">📍 Within 50 Miles</option>
                  <option value="nationwide">🌍 Nationwide (No Radius Limit)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Your promoted profile will be showcased to homeowners searching within this radius of your registered address ({profile?.postcode || 'registered postcode'}).</p>
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenModalInfo(openModalInfo === 'radius' ? null : 'radius')}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Why set a local radius limit?</span>
                    {openModalInfo === 'radius' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {openModalInfo === 'radius' && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 space-y-1">
                      <p className="font-bold">🎯 100% Qualified Local Leads:</p>
                      <p className="opacity-90 leading-relaxed">
                        Restricting your radius ensures every single paid click comes from a homeowner located within your travel range. Zero wasted ad spend on leads outside your service territory.
                      </p>
                    </div>
                  )}
                </div>
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

              <div className="bg-slate-50 border border-black rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="autoTopUpEnabled" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">⚡ Enable Smart Auto Top-Up</span>
                    <span className="text-[11px] text-slate-500 block">Automatically reloads £50.00 when balance falls below £10.00 to keep campaign active during peak search hours.</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-slate-200">
                  <input type="checkbox" name="lowBalanceAlertsEnabled" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">🔔 Enable Low Balance Notifications</span>
                    <span className="text-[11px] text-slate-500 block">Receive instant in-app/push alerts when wallet balance drops below £10.00.</span>
                  </div>
                </label>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOpenModalInfo(openModalInfo === 'autotopup' ? null : 'autotopup')}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 transition"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Why keep Smart Auto Top-Up enabled?</span>
                    {openModalInfo === 'autotopup' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {openModalInfo === 'autotopup' && (
                    <div className="mt-2 bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 space-y-1">
                      <p className="font-bold">⚡ Never Lose Top Search Slots:</p>
                      <p className="opacity-90 leading-relaxed">
                        Homeowners search for emergency trades most heavily between 7–9 AM & 5–8 PM. If your balance hits zero, your promoted profile pauses and drops off the top 3 spots. Smart Auto Top-Up reloads £50 only when needed, guaranteeing unbroken visibility.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p><strong>Your CPC:</strong> £{tierCost.toFixed(2)}/click (Based on {profile?.subscriptionType || 'Free'} Tier)</p>
                <p className="mt-2 text-xs opacity-80">This budget will be charged to your default payment method upon admin approval.</p>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-black flex justify-end gap-3">
              <button type="button" onClick={() => setShowRequestModal(false)} className="px-6 py-3 font-bold text-slate-600 hover:text-slate-900">Cancel</button>
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">Submit Request</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
