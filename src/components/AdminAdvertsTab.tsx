import React, { useState, useEffect } from "react";
import { Plus, Loader2, Save, Trash2, Zap, LayoutGrid, Calendar, Eye, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, FileText } from "lucide-react";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { cn } from "../lib/utils";
import { useCategories } from "../lib/CategoryProvider";

const iconMap: Record<string, any> = {
  Zap, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, FileText
};

export default function AdminAdvertsTab() {
  const [adverts, setAdverts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bgColor, setBgColor] = useState("bg-blue-600");
  const [iconName, setIconName] = useState("Zap");
  const { categories } = useCategories();
  const [targetRole, setTargetRole] = useState("all");
  const [targetCategories, setTargetCategories] = useState<string[]>([]);
  const [costPerDisplay, setCostPerDisplay] = useState("0");
  const [dailyDisplayLimit, setDailyDisplayLimit] = useState(100);
  const [durationDays, setDurationDays] = useState(7);
  const [isActive, setIsActive] = useState(true);
  
  // CRM / Advertiser info
  const [advertiserName, setAdvertiserName] = useState("");
  const [advertiserEmail, setAdvertiserEmail] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly"); // fixed, monthly, annual
  const [recurringPrice, setRecurringPrice] = useState("0");

  const [isSaving, setIsSaving] = useState(false);

  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, inactive
  const [targetFilter, setTargetFilter] = useState("all"); // all, tradesperson, homeowner

  // Master Control
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(true);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "advertising"), (doc) => {
      if (doc.exists()) {
        setIsBannerAdsEnabled(doc.data().isBannerAdsEnabled !== false);
      }
    });

    const q = query(collection(db, "advertisements"), orderBy("createdAt", "desc"));
    const unsubAds = onSnapshot(q, (snapshot) => {
      setAdverts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => {
      unsubConfig();
      unsubAds();
    };
  }, []);

  const toggleMasterAdSwitch = async (enabled: boolean) => {
    try {
      await setDoc(doc(db, "platform_config", "advertising"), { isBannerAdsEnabled: enabled }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const openNewModal = () => {
    setTitle("");
    setDescription("");
    setUrl("");
    setImageUrl("");
    setBgColor("bg-blue-600");
    setIconName("Zap");
    setTargetRole("all");
    setTargetCategories([]);
    setCostPerDisplay("0.5");
    setDailyDisplayLimit(100);
    setDurationDays(7);
    setIsActive(true);
    setAdvertiserName("");
    setAdvertiserEmail("");
    setBillingCycle("monthly");
    setRecurringPrice("500");
    setEditingAd(null);
    setShowModal(true);
  };

  const openEditModal = (ad: any) => {
    setTitle(ad.title || "");
    setDescription(ad.description || "");
    setUrl(ad.url || "");
    setImageUrl(ad.imageUrl || "");
    setBgColor(ad.bgColor || "bg-blue-600");
    setIconName(ad.iconName || "Zap");
    setTargetRole(ad.targetRole || "all");
    setTargetCategories(ad.targetCategories || []);
    setCostPerDisplay(ad.costPerDisplay || "0");
    setDailyDisplayLimit(ad.dailyDisplayLimit || 100);
    setDurationDays(ad.durationDays || 7);
    setIsActive(ad.isActive !== false);
    setAdvertiserName(ad.advertiserName || "");
    setAdvertiserEmail(ad.advertiserEmail || "");
    setBillingCycle(ad.billingCycle || "monthly");
    setRecurringPrice(ad.recurringPrice || "500");
    setEditingAd(ad);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title || !url) return;
    setIsSaving(true);
    try {
      const adRef = editingAd ? doc(db, "advertisements", editingAd.id) : doc(collection(db, "advertisements"));
      await setDoc(adRef, {
        title,
        description,
        url,
        imageUrl,
        bgColor,
        iconName,
        targetRole,
        targetCategories: targetRole === "tradesperson" ? targetCategories : [],
        costPerDisplay: Number(costPerDisplay),
        dailyDisplayLimit: Number(dailyDisplayLimit),
        durationDays: Number(durationDays),
        isActive,
        advertiserName,
        advertiserEmail,
        billingCycle,
        recurringPrice: Number(recurringPrice),
        createdAt: editingAd ? editingAd.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("Error saving advert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this advertisement?")) {
      await deleteDoc(doc(db, "advertisements", id));
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  const filteredAdverts = adverts.filter((ad) => {
    const matchesSearch = 
      (ad.advertiserName || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      (ad.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ad.billingCycle || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" 
      ? true 
      : statusFilter === "active" 
        ? ad.isActive 
        : statusFilter === "pending" 
          ? ad.approvalStatus === "pending" 
          : !ad.isActive && ad.approvalStatus !== "pending";
    const matchesTarget = targetFilter === "all" ? true : ad.targetRole === targetFilter;

    return matchesSearch && matchesStatus && matchesTarget;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Traders Banner Ad Studio</h2>
          <p className="text-sm text-slate-500">Manage banner ads submitted by traders or create internal partner campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isBannerAdsEnabled} 
                onChange={(e) => toggleMasterAdSwitch(e.target.checked)} 
              />
              <div className={cn("w-10 h-6   rounded-full transition", isBannerAdsEnabled ? "bg-amber-500" : "bg-slate-300")}></div>
              <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 left-1 transition-transform", isBannerAdsEnabled ? "translate-x-4" : "")}></div>
            </div>
            <span className="text-sm font-bold text-slate-700">Master Banner Toggle</span>
          </label>
          <button onClick={openNewModal} className="bg-blue-600 text-white px-4 h-10 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Advert
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Search by advertiser name, title, or tier..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-10 outline-none text-sm placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-4">
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)} 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-10 outline-none text-sm font-bold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="pending">Pending Approval</option>
            <option value="inactive">Paused / Inactive</option>
          </select>
          <select 
            value={targetFilter} 
            onChange={e => setTargetFilter(e.target.value)} 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-10 outline-none text-sm font-bold text-slate-700"
          >
            <option value="all">All Targets</option>
            <option value="tradesperson">Tradespeople</option>
            <option value="homeowner">Homeowners</option>
          </select>
        </div>
      </div>

      {filteredAdverts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">No campaigns found matching criteria.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAdverts.map((ad) => {
          const AdIcon = iconMap[ad.iconName] || Zap;
          return (
          <div key={ad.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative group overflow-hidden">
             {/* Preview block */}
             {ad.imageUrl ? (
               <div className="w-full h-16 rounded-xl mb-4 relative overflow-hidden bg-slate-100 flex items-center justify-center">
                 <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
               </div>
             ) : (
               <div className={cn("w-full h-16 rounded-xl mb-4 relative overflow-hidden flex items-center p-3 text-white", ad.bgColor)} style={{ background: ad.bgColor.includes("bg-") ? undefined : ad.bgColor }}>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 mr-3">
                    <AdIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-black truncate">{ad.title}</p>
                    <p className="text-[10px] text-white/90 truncate mt-0.5">{ad.description}</p>
                  </div>
               </div>
             )}
             
             <div className="flex justify-between items-end">
               <div>
                  <p className="text-xs text-slate-500 mb-1">Target: <span className="font-bold text-slate-900 uppercase">{ad.targetRole} {ad.targetCategories?.length ? `(${ad.targetCategories.length} cats)` : ""}</span></p>
                  <p className="text-xs text-slate-500 mb-1">
                    Advertiser: 
                    {ad.isTraderAd && ad.advertiserId ? (
                      <Link to={`/profile/${ad.advertiserId}`} target="_blank" className="font-bold text-blue-600 hover:text-blue-800 ml-1">
                        {ad.advertiserName || "Trader Profile"}
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-900 ml-1">{ad.advertiserName || "N/A"}</span>
                    )}
                    <span className="ml-1">({ad.type === "trader_promo" ? "Flat Rate" : ad.billingCycle || "N/A"})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Clicks: <span className="font-bold text-blue-600">{ad.clicks || 0}</span> • 
                    {ad.type === "trader_promo" ? (
                       <span>Duration: <span className="font-bold text-slate-900">{ad.durationDays} days</span> (Total: £{ad.totalCost?.toFixed(2)})</span>
                    ) : (
                       <span>Limit: <span className="font-bold text-slate-900">{ad.dailyDisplayLimit}/day</span></span>
                    )}
                  </p>
               </div>
               <div className="flex gap-2">
                 {ad.approvalStatus === "pending" && (
                   <>
                     <button onClick={async () => {
                       await updateDoc(doc(db, "advertisements", ad.id), { approvalStatus: "approved", isActive: true });
                     }} className="px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-lg text-xs" title="Approve">
                       Approve
                     </button>
                     <button onClick={async () => {
                       await updateDoc(doc(db, "advertisements", ad.id), { approvalStatus: "rejected" });
                     }} className="px-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-xs" title="Reject">
                       Reject
                     </button>
                   </>
                 )}
                 <button onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/ad-report/${ad.id}`);
                   alert("Tracking link copied to clipboard");
                 }} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg" title="Copy Tracking Link">
                   <LayoutGrid className="w-4 h-4" />
                 </button>
                 <button onClick={() => openEditModal(ad)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg" title="Edit">
                   Edit
                 </button>
                 <button onClick={() => handleDelete(ad.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg" title="Delete">
                   <Trash2 className="w-4 h-4" />
                 </button>
               </div>
             </div>
             
             {ad.approvalStatus === "pending" ? (
               <div className="absolute top-2 right-2 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">PENDING</div>
             ) : ad.approvalStatus === "rejected" ? (
               <div className="absolute top-2 right-2 bg-red-900 text-white text-[10px] font-bold px-2 py-1 rounded">REJECTED</div>
             ) : !ad.isActive ? (
               <div className="absolute top-2 right-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded">INACTIVE</div>
             ) : (
               <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded">ACTIVE</div>
             )}
          </div>
          );
        })}
      </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold">{editingAd ? "Edit Advertisement" : "New Advertisement"}</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">X</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Advert Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none font-medium" placeholder="Screwfix Trade Exclusive" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none" placeholder="Apply now for exclusive trade prices" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target URL *</label>
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none text-blue-600" placeholder="https://..." />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Image URL (Optional Custom Banner)</label>
                <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none" placeholder="https://example.com/banner.png" />
                <p className="text-[10px] text-slate-500 mt-1">If provided, this image will be displayed instead of the color-block design. Standard ad banner sizes (e.g. 320x50, 320x100) are recommended.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Background Color</label>
                  <select value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none">
                    <option value="bg-blue-600">Blue</option>
                    <option value="bg-red-600">Red</option>
                    <option value="bg-emerald-600">Green</option>
                    <option value="bg-amber-500">Amber</option>
                    <option value="bg-purple-600">Purple</option>
                    <option value="bg-slate-900">Black/Dark</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Icon Name</label>
                  <select value={iconName} onChange={e => setIconName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none">
                    <option value="Zap">Zap (Lightning)</option>
                    <option value="Briefcase">Briefcase</option>
                    <option value="ShieldCheck">Shield</option>
                    <option value="Star">Star</option>
                    <option value="Gift">Gift</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Audience</label>
                  <select value={targetRole} onChange={e => setTargetRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none">
                    <option value="all">Everyone</option>
                    <option value="tradesperson">Tradespeople Only</option>
                    <option value="homeowner">Homeowners Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                  <select value={isActive ? "active" : "inactive"} onChange={e => setIsActive(e.target.value === "active")} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 outline-none">
                    <option value="active">Active</option>
                    <option value="inactive">Paused / Inactive</option>
                  </select>
                </div>
              </div>
              
              {targetRole === "tradesperson" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Trade Categories</label>
                  <select 
                    multiple
                    value={targetCategories.length === 0 ? ["all"] : targetCategories} 
                    onChange={e => {
                        const selected = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                        if (selected.includes("all") && !targetCategories.includes("all")) {
                            setTargetCategories([]);
                        } else {
                            setTargetCategories(selected.filter(x => x !== "all"));
                        }
                    }} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-h-[140px] outline-none scrollbar-thin scrollbar-thumb-slate-300"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c: any) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Hold CMD (Mac) or CTRL (Windows) to select multiple. Leave as "All Categories" to show to all trades.</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 mb-4">CRM & Billing Details</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Advertiser Name</label>
                    <input type="text" value={advertiserName} onChange={e => setAdvertiserName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 outline-none" placeholder="Company Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Advertiser Email</label>
                    <input type="email" value={advertiserEmail} onChange={e => setAdvertiserEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 outline-none" placeholder="contact@company.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Billing Cycle</label>
                    <select value={billingCycle} onChange={e => setBillingCycle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-11 outline-none">
                      <option value="fixed">Fixed Duration / Prepaid</option>
                      <option value="monthly">Recurring Monthly</option>
                      <option value="quarterly">Recurring Quarterly</option>
                      <option value="annual">Recurring Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recurring Price / Budget (£)</label>
                    <input type="number" step="0.01" value={recurringPrice} onChange={e => setRecurringPrice(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-11 outline-none" min="0" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Budget & Delivery Settings</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cost/Click (£)</label>
                    <input type="number" step="0.01" value={costPerDisplay} onChange={e => setCostPerDisplay(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-11 outline-none" min="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Clicks/Day</label>
                    <input type="number" value={dailyDisplayLimit} onChange={e => setDailyDisplayLimit(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-11 outline-none" min="1" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (Days)</label>
                    <input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-11 outline-none" min="1" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button disabled={isSaving} onClick={() => setShowModal(false)} className="px-6 h-12 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancel</button>
              <button disabled={isSaving || !title || !url} onClick={handleSave} className="px-6 h-12 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Advert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
