import React, { useState, useEffect } from "react";
import { 
  collection, query, where, onSnapshot, db, 
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  orderBy, limit
} from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, 
  Shield, 
  PoundSterling, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  AlertCircle,
  BarChart3,
  Users,
  ExternalLink,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  Info,
  ArrowRight
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { getMonetizationOpportunities, MonetizationOpportunity } from "@/src/services/gemini";

type Tab = "partners" | "campaigns" | "watchdog" | "insights" | "leads";

export default function EcosystemAdmin() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("watchdog");
  const [partners, setPartners] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [expiringTraders, setExpiringTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalType, setModalType] = useState<"partner" | "campaign">("partner");
  const [aiInsights, setAiInsights] = useState<MonetizationOpportunity[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!user || (profile?.role !== "admin" && profile?.role !== "ecosystem_manager")) return;

    const unsubPartners = onSnapshot(collection(db, "partners"), (snap) => {
      setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCampaigns = onSnapshot(collection(db, "campaigns"), (snap) => {
      setCampaigns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLeads = onSnapshot(query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
      setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Watchdog: Fetch traders with expiring docs
    const unsubUsers = onSnapshot(query(collection(db, "users"), where("role", "==", "tradesperson")), (snap) => {
      const traders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const expiring = traders.filter((t: any) => {
        if (!t.verificationDocs) return false;
        return t.verificationDocs.some((doc: any) => {
          if (!doc.expiryDate) return false;
          const expiry = new Date(doc.expiryDate);
          return expiry <= thirtyDaysFromNow;
        });
      });
      setExpiringTraders(expiring);
      setLoading(false);
    });

    return () => {
      unsubPartners();
      unsubCampaigns();
      unsubLeads();
      unsubUsers();
    };
  }, [user, profile]);

  const handleSavePartner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const benefitsStr = formData.get("benefits")?.toString() || "";
    
    const data = {
      name: formData.get("name"),
      category: formData.get("category"),
      description: formData.get("description"),
      trackingUrl: formData.get("trackingUrl"),
      commissionRate: Number(formData.get("commissionRate")),
      status: formData.get("status"),
      rating: Number(formData.get("rating") || 0),
      totalDrivers: Number(formData.get("totalDrivers") || 0),
      startingPrice: formData.get("startingPrice") || "",
      benefits: benefitsStr.split(',').map(s => s.trim()).filter(s => s.length > 0),
      highlight: formData.get("highlight") || "",
      tier: formData.get("tier") || "basic",
      updatedAt: serverTimestamp()
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, "partners", editingItem.id), data);
        toast.success("Partner updated");
      } else {
        await addDoc(collection(db, "partners"), { ...data, createdAt: serverTimestamp() });
        toast.success("Partner added");
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error("Error saving partner");
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title"),
      partnerId: formData.get("partnerId"),
      content: formData.get("content"),
      targetRole: formData.get("targetRole"),
      triggerType: formData.get("triggerType"),
      status: formData.get("status"),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, "campaigns", editingItem.id), data);
        toast.success("Campaign updated");
      } else {
        await addDoc(collection(db, "campaigns"), { ...data, createdAt: serverTimestamp(), clicks: 0, leads: 0 });
        toast.success("Campaign added");
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error("Error saving campaign");
    }
  };

  const generateAIInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      // Gather platform stats for Gemini
      const stats = {
        totalUsers: 1250, // Mock stats for now, could be fetched
        totalJobs: 450,
        topCategories: ["Plumbing", "Electrical", "Carpentry"],
        expiringDocsCount: expiringTraders.length,
        currentMonth: new Date().toLocaleString('default', { month: 'long' }),
        activeCampaigns: campaigns.length
      };

      const insights = await getMonetizationOpportunities(stats);
      setAiInsights(insights);
      toast.success("AI Insights refreshed");
    } catch (error) {
      toast.error("Failed to generate AI insights");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  if (loading) return <div className="p-12 text-center">Loading Ecosystem Center...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-primary shrink-0 transition-transform group-hover:scale-110" />
            Ecosystem
          </h1>
          <p className="text-slate-500 font-medium mt-1">Monetization & Partners center.</p>
        </div>
        <div className="flex flex-col sm:items-end gap-4">
          <button 
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 text-primary font-bold text-sm hover:underline transition-all pr-1"
          >
            <HelpCircle className="w-4 h-4" />
            How to use
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => {
                setModalType("partner");
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-none justify-center bg-white border-2 border-slate-200 px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Partner
            </button>
            <button 
              onClick={() => {
                setModalType("campaign");
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-none justify-center bg-primary text-white px-4 sm:px-6 py-2 rounded-2xl text-xs sm:text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-max sm:w-fit min-w-full sm:min-w-0">
          {[
            { id: "watchdog", label: "Watchdog", icon: Clock },
            { id: "partners", label: "Partners", icon: Shield },
            { id: "campaigns", label: "Campaigns", icon: Zap },
            { id: "leads", label: "Leads", icon: Users },
            { id: "insights", label: "AI Insights", icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0",
                activeTab === tab.id 
                  ? "bg-white text-primary shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "watchdog" && expiringTraders.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 shrink-0">
                  {expiringTraders.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "watchdog" && (
          <motion.div
            key="watchdog"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-amber-50 border border-amber-200 p-4 sm:p-6 rounded-[32px] flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-amber-100 shrink-0">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-black text-amber-900">Document Expiry Watchdog</h3>
                <p className="text-sm text-amber-700">Traders with documents expiring soon. High conversion opportunity.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expiringTraders.map((trader) => (
                <div key={trader.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden">
                      {trader.photoURL ? (
                        <img src={trader.photoURL} alt={trader.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                          {trader.name[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{trader.name}</h4>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">{trader.trades?.[0] || "Trader"}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {trader.verificationDocs?.map((doc: any, idx: number) => {
                      const expiry = new Date(doc.expiryDate);
                      const now = new Date();
                      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      if (daysLeft > 30) return null;

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{doc.type}</p>
                            <p className={cn(
                              "text-xs font-bold",
                              daysLeft < 0 ? "text-red-600" : "text-amber-600"
                            )}>
                              {daysLeft < 0 ? "Expired" : `Expires in ${daysLeft} days`}
                            </p>
                          </div>
                          <button 
                            onClick={() => toast.info(`Campaign triggered for ${trader.name}`)}
                            className="bg-primary text-white px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-primary-hover transition-all"
                          >
                            Send Offer
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {expiringTraders.length === 0 && (
                <div className="col-span-full p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                  <p className="text-slate-500">No traders with expiring documents found.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "partners" && (
          <motion.div
            key="partners"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {partners.map((partner) => (
              <div key={partner.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-primary">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setModalType("partner");
                          setEditingItem(partner);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm("Delete this partner?")) {
                            await deleteDoc(doc(db, "partners", partner.id));
                            toast.success("Partner deleted");
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{partner.name}</h3>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">{partner.category}</p>
                  <p className="text-sm text-slate-500 mt-3 line-clamp-2">{partner.description}</p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Commission</span>
                    <span className="text-green-600 font-black">{partner.commissionRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Status</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                      partner.status === "active" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600"
                    )}>
                      {partner.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "campaigns" && (
          <motion.div
            key="campaigns"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setModalType("campaign");
                          setEditingItem(campaign);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm("Delete this campaign?")) {
                            await deleteDoc(doc(db, "campaigns", campaign.id));
                            toast.success("Campaign deleted");
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{campaign.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {campaign.triggerType}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                      {campaign.targetRole}
                    </span>
                  </div>
                  
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <p className="text-lg font-black text-slate-900">{campaign.clicks || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Clicks</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <p className="text-lg font-black text-slate-900">{campaign.leads || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Leads</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      campaign.status === "active" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {campaign.status}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Partner: {partners.find(p => p.id === campaign.partnerId)?.name || "Unknown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "leads" && (
          <motion.div
            key="leads"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaign</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {lead.userId.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{lead.userId.slice(0, 8)}...</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{lead.userRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">
                          {partners.find(p => p.id === lead.partnerId)?.name || "Unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">
                          {campaigns.find(c => c.id === lead.campaignId)?.title || "Direct"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={lead.status}
                          onChange={async (e) => {
                            await updateDoc(doc(db, "leads", lead.id), { status: e.target.value });
                            toast.success("Lead status updated");
                          }}
                          className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none border-none",
                            lead.status === "new" ? "bg-blue-100 text-blue-600" :
                            lead.status === "converted" ? "bg-green-100 text-green-600" :
                            lead.status === "contacted" ? "bg-amber-100 text-amber-600" :
                            "bg-slate-100 text-slate-600"
                          )}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Converted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : "Just now"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <div className="p-12 text-center text-slate-500">No leads generated yet.</div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "insights" && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-[32px] relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">AI Strategist</h2>
                  </div>
                  <button 
                    onClick={generateAIInsights}
                    disabled={isGeneratingInsights}
                    className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingInsights ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Refresh Insights
                  </button>
                </div>
                <p className="text-slate-400 max-w-2xl">Gemini is analyzing platform behavior to suggest high-conversion monetization opportunities. Suggestions refresh every 24 hours.</p>
              </div>
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aiInsights.length > 0 ? aiInsights.map((insight, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 group">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest">{insight.type}</span>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest",
                          insight.impact === "High" ? "text-red-600" : insight.impact === "Medium" ? "text-amber-600" : "text-green-600"
                        )}>{insight.impact} Impact</span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900">{insight.title}</h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{insight.description}</p>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Audience</p>
                      <p className="text-xs font-bold text-slate-700 capitalize">{insight.targetRole}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setModalType("campaign");
                      setEditingItem({
                        title: insight.title,
                        content: insight.description,
                        targetRole: insight.targetRole,
                        triggerType: insight.type.toLowerCase(),
                        status: "draft"
                      });
                      setIsModalOpen(true);
                    }}
                    className="w-full bg-slate-50 text-slate-900 py-3 rounded-2xl font-bold text-sm hover:bg-primary hover:text-white transition-all"
                  >
                    {insight.action}
                  </button>
                </div>
              )) : (
                <div className="col-span-full p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                  <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Click "Refresh Insights" to let Gemini analyze your platform data.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal for Partner/Campaign */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">
                {editingItem ? "Edit" : "Add"} {modalType === "partner" ? "Partner" : "Campaign"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={modalType === "partner" ? handleSavePartner : handleSaveCampaign} className="space-y-4">
              {modalType === "partner" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Partner Name</label>
                    <input name="name" defaultValue={editingItem?.name} required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <select name="category" defaultValue={editingItem?.category} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                      {["Insurance", "Finance", "Vehicle", "Health", "Supplies", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea name="description" defaultValue={editingItem?.description} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all h-24" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tracking URL</label>
                    <input name="trackingUrl" defaultValue={editingItem?.trackingUrl} required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                  </div>
                  
                  {/* Rating, Total Drivers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rating</label>
                      <input name="rating" type="number" step="0.1" defaultValue={editingItem?.rating} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Drivers</label>
                      <input name="totalDrivers" type="number" defaultValue={editingItem?.totalDrivers} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                    </div>
                  </div>

                  {/* Starting Price, Highlight */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Starting Price (Text)</label>
                      <input name="startingPrice" defaultValue={editingItem?.startingPrice} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Highlight (e.g. Exclusive)</label>
                      <input name="highlight" defaultValue={editingItem?.highlight} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Benefits (Comma Separated)</label>
                    <input name="benefits" defaultValue={editingItem?.benefits?.join(", ")} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Commission (%)</label>
                      <input name="commissionRate" type="number" defaultValue={editingItem?.commissionRate} required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tier</label>
                      <select name="tier" defaultValue={editingItem?.tier || "basic"} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                        <option value="basic">Basic</option>
                        <option value="featured">Featured</option>
                        <option value="exclusive">Exclusive</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                      <select name="status" defaultValue={editingItem?.status} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Title</label>
                    <input name="title" defaultValue={editingItem?.title} required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Partner</label>
                    <select name="partnerId" defaultValue={editingItem?.partnerId} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                      {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                    <textarea name="content" defaultValue={editingItem?.content} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all h-24" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Role</label>
                      <select name="targetRole" defaultValue={editingItem?.targetRole} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                        <option value="homeowner">Homeowner</option>
                        <option value="tradesperson">Tradesperson</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trigger</label>
                      <select name="triggerType" defaultValue={editingItem?.triggerType} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                        <option value="manual">Manual</option>
                        <option value="expiry">Expiry</option>
                        <option value="behavior">Behavior</option>
                        <option value="seasonal">Seasonal</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                    <select name="status" defaultValue={editingItem?.status} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all">
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </>
              )}
              <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all mt-4">
                {editingItem ? "Update" : "Save"} {modalType === "partner" ? "Partner" : "Campaign"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Instructional Manual Modal */}
      <AnimatePresence>
        {showManual && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] p-0 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Ecosystem Manual</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Mastering platform monetization</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowManual(false)}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                {/* Watchdog Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h3 className="font-black text-slate-900">1. Document Expiry Watchdog</h3>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    This is your proactive revenue engine. It scans all tradespeople for documents (like Public Liability Insurance) that expire within the next 30 days.
                  </p>
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 font-medium">
                      <strong>How to use:</strong> When a trader appears here, use the "Send Offer" button to immediately trigger a relevant campaign (e.g., insurance renewal discount from a partner).
                    </p>
                  </div>
                </div>

                {/* Partners Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <h3 className="font-black text-slate-900">2. Partner Management</h3>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Manage relationships with external companies (Insurance, Finance, Tool Suppliers) who want access to your audience.
                  </p>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-start gap-3">
                    <Info className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-700 font-medium">
                      <strong>Best Practice:</strong> Ensure "Tracking URLs" are accurate to correctly attribute leads. Use the commission rate field to calculate expected revenue.
                    </p>
                  </div>
                </div>

                {/* Campaigns Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <h3 className="font-black text-slate-900">3. Targeted Campaigns</h3>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Orchestrate how and when offers are displayed. You can target specific user roles (Homeowners or Traders).
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { t: "Manual", d: "Pushed from Watchdog" },
                      { t: "Expiry", d: "Auto-trigger on doc dates" },
                      { t: "Behavior", d: "Action-based triggers" },
                      { t: "Seasonal", d: "Date-range promotions" }
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <ArrowRight className="w-3 h-3 text-primary" />
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase">{item.t}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{item.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Leads & AI Insights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <h3 className="font-black text-slate-900">4. Leads Tracking</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Real-time audit log of every campaign click. Manage lead status (New → Converted) to keep track of conversion health.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <h3 className="font-black text-slate-900">5. AI Strategist</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Uses Gemini to analyze your platform's top trade categories and expiry patterns to suggest and draft new high-impact campaigns.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-bold">Version 1.2 • Monetization Center</p>
                <button 
                  onClick={() => setShowManual(false)}
                  className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
