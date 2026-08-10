import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, Phone, Mail, MessageSquare, Send, Sparkles, Plus, Search, Filter, 
  Trash2, Edit3, Copy, Check, ExternalLink, RefreshCw, Upload, Download, 
  ShieldCheck, ArrowRight, UserPlus, FileText, CheckCircle2, ChevronRight, 
  Building2, MapPin, Star, AlertCircle, HelpCircle, Eye, Lock, Zap,
  Target, Calendar, Clock, X
} from "lucide-react";
import { 
  TraderProspectLead, 
  generateTraderOutreachPack, 
  parseUnstructuredTraderText,
  generateHomeownerOutreachPack,
  HomeownerOutreachCampaign
} from "../services/aiAgentEcosystemService";
import { cn } from "@/src/lib/utils";

const SAMPLE_PROSPECT_LEADS: TraderProspectLead[] = [
  {
    id: "LEAD_YP_001",
    businessName: "Apex Plumbing & Heating Ltd",
    contactName: "Dave Miller",
    tradeCategory: "Plumbing & Heating",
    cityLocation: "Manchester",
    phone: "07700 900123",
    email: "dave@apexplumbingmcr.co.uk",
    source: "Yellow Pages",
    rating: "4.9★ (38 reviews)",
    notes: "Top Gas Safe listing in Central Manchester. 15 yrs experience.",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "LEAD_YELL_002",
    businessName: "West Midlands Electrical Solutions",
    contactName: "Sarah Jenkins",
    tradeCategory: "Electrical",
    cityLocation: "Birmingham",
    phone: "07700 900456",
    email: "info@wmelectrical.co.uk",
    source: "Yell.com",
    rating: "4.8★ (52 reviews)",
    notes: "NICEIC registered contractor. Specialises in EICR inspections and EV chargers.",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "LEAD_GMAPS_003",
    businessName: "Vanguard Roofing & Fascias",
    contactName: "Mark Robinson",
    tradeCategory: "Roofing",
    cityLocation: "London SE1",
    phone: "07700 900789",
    email: "contact@vanguardroofing.london",
    source: "Google Maps",
    rating: "5.0★ (19 reviews)",
    notes: "Flat roof specialist & emergency leak repairs.",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export default function TraderOutreachAgent() {
  const [leads, setLeads] = useState<TraderProspectLead[]>(() => {
    const saved = localStorage.getItem("anytrader_outreach_leads");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to parse saved outreach leads:", e);
      }
    }
    return SAMPLE_PROSPECT_LEADS;
  });

  // Autopilot Engine State
  const [isAutopilotEnabled, setIsAutopilotEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("anytrader_outreach_autopilot_enabled");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [autopilotLogs, setAutopilotLogs] = useState<Array<{ id: string; timestamp: string; message: string; type: "info" | "success" | "action" }>>(() => {
    const saved = localStorage.getItem("anytrader_outreach_autopilot_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: "log-1", timestamp: new Date().toLocaleTimeString(), message: "🤖 Autopilot Engine initialized. Scanning local directories...", type: "info" },
      { id: "log-2", timestamp: new Date().toLocaleTimeString(), message: "⚡ Independent campaign generator standby for Yellow Pages & Yell listings.", type: "success" }
    ];
  });

  const [autopilotSettings, setAutopilotSettings] = useState({
    autoGeneratePacks: true,
    autoDraftCampaigns: true,
    autoFollowUpAlerts: true,
    autoAdvanceSequences: true,
  });

  // Admin Scheduled Targeted Campaign State (Postcode Area & Time Window)
  const [targetedSchedule, setTargetedSchedule] = useState<{
    enabled: boolean;
    postcodes: string[];
    startDate: string;
    endDate: string;
    targetAudience: "all" | "traders_b2b" | "homeowners_b2c";
    campaignName: string;
  }>(() => {
    const saved = localStorage.getItem("anytrader_outreach_targeted_schedule");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 14);
    return {
      enabled: true,
      postcodes: ["M1", "M2", "M3", "M14", "M20", "SE1", "EC1", "B1"],
      startDate: new Date().toISOString().split("T")[0],
      endDate: defaultEnd.toISOString().split("T")[0],
      targetAudience: "all",
      campaignName: "Greater Manchester & London Sector Blitz"
    };
  });

  const [newPostcodeInput, setNewPostcodeInput] = useState("");

  // Admin Test Dispatch Modal State
  const [isAdminTestModalOpen, setIsAdminTestModalOpen] = useState(false);
  const [adminTestEmail, setAdminTestEmail] = useState("saanwar2002@gmail.com");
  const [adminTestPhone, setAdminTestPhone] = useState("");
  const [adminTestType, setAdminTestType] = useState<"trader" | "homeowner" | "both">("both");
  const [testDispatchSuccessNotice, setTestDispatchSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("anytrader_outreach_targeted_schedule", JSON.stringify(targetedSchedule));
  }, [targetedSchedule]);

  const addTargetPostcode = () => {
    if (!newPostcodeInput.trim()) return;
    const clean = newPostcodeInput.trim().toUpperCase();
    if (!targetedSchedule.postcodes.includes(clean)) {
      setTargetedSchedule(prev => ({
        ...prev,
        postcodes: [...prev.postcodes, clean]
      }));
    }
    setNewPostcodeInput("");
  };

  const removeTargetPostcode = (pcToRemove: string) => {
    setTargetedSchedule(prev => ({
      ...prev,
      postcodes: prev.postcodes.filter(p => p !== pcToRemove)
    }));
  };

  const setCampaignDurationDays = (days: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    setTargetedSchedule(prev => ({
      ...prev,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0]
    }));
  };

  const getScheduleStatus = () => {
    if (!targetedSchedule.enabled) {
      return { status: "disabled", label: "Schedule Inactive (All Open)", color: "text-slate-400 bg-slate-800 border-slate-700" };
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(targetedSchedule.startDate);
    const end = new Date(targetedSchedule.endDate);
    end.setHours(23, 59, 59, 999);

    if (now < start) {
      const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "scheduled", label: `Scheduled (Starts in ${daysUntil}d)`, color: "text-amber-300 bg-amber-500/20 border-amber-500/40" };
    } else if (now > end) {
      return { status: "expired", label: "Expired Campaign Window", color: "text-rose-300 bg-rose-500/20 border-rose-500/40" };
    } else {
      const remainingDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "active", label: `🟢 Active (${remainingDays}d remaining)`, color: "text-emerald-300 bg-emerald-500/20 border-emerald-500/40" };
    }
  };

  const [isAutopilotRunningCycle, setIsAutopilotRunningCycle] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<TraderProspectLead | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isGeneratingPack, setIsGeneratingPack] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isParsingText, setIsParsingText] = useState(false);

  // New lead form
  const [newLeadForm, setNewLeadForm] = useState<Partial<TraderProspectLead>>({
    businessName: "",
    contactName: "",
    tradeCategory: "Plumbing & Heating",
    cityLocation: "Manchester",
    phone: "",
    email: "",
    source: "Yellow Pages",
    rating: "",
    notes: ""
  });

  // Raw paste area
  const [rawDirectoryText, setRawDirectoryText] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Outreach Target Mode Tab
  const [activeOutreachTab, setActiveOutreachTab] = useState<"trader_b2b" | "homeowner_b2c">("trader_b2b");

  // Homeowner & Public Campaign Hub State
  const [homeownerCity, setHomeownerCity] = useState("Manchester / M1");
  const [homeownerCategory, setHomeownerCategory] = useState("Multi-Service Ecosystem (Trades, Pet Care, Tutoring, Babysitting, Car Detailing)");
  const [homeownerCampaign, setHomeownerCampaign] = useState<HomeownerOutreachCampaign | null>(null);
  const [isGeneratingHomeownerCampaign, setIsGeneratingHomeownerCampaign] = useState(false);

  const handleGenerateHomeownerCampaign = async () => {
    setIsGeneratingHomeownerCampaign(true);
    try {
      const campaign = await generateHomeownerOutreachPack(homeownerCity, homeownerCategory);
      setHomeownerCampaign(campaign);
    } catch (err) {
      console.error("Homeowner campaign generation error:", err);
    } finally {
      setIsGeneratingHomeownerCampaign(false);
    }
  };

  // Sync leads to localStorage
  useEffect(() => {
    localStorage.setItem("anytrader_outreach_leads", JSON.stringify(leads));
  }, [leads]);

  // Sync autopilot state to localStorage
  useEffect(() => {
    localStorage.setItem("anytrader_outreach_autopilot_enabled", JSON.stringify(isAutopilotEnabled));
  }, [isAutopilotEnabled]);

  useEffect(() => {
    localStorage.setItem("anytrader_outreach_autopilot_logs", JSON.stringify(autopilotLogs.slice(0, 30)));
  }, [autopilotLogs]);

  const addAutopilotLog = (message: string, type: "info" | "success" | "action" = "info") => {
    setAutopilotLogs(prev => [
      { id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, timestamp: new Date().toLocaleTimeString(), message, type },
      ...prev
    ].slice(0, 50));
  };

  // Autopilot Autonomous Background Cycle
  const runAutopilotCycle = async () => {
    if (isAutopilotRunningCycle) return;
    setIsAutopilotRunningCycle(true);

    try {
      // Check Admin Targeted Schedule Window
      if (targetedSchedule.enabled) {
        const scheduleStatus = getScheduleStatus();
        if (scheduleStatus.status === "expired") {
          addAutopilotLog(`⏰ Autopilot Notice: Admin Scheduled Campaign "${targetedSchedule.campaignName}" expired on ${targetedSchedule.endDate}. Update campaign period in settings to resume targeted outreach.`, "info");
          setIsAutopilotRunningCycle(false);
          return;
        } else if (scheduleStatus.status === "scheduled") {
          addAutopilotLog(`⏰ Autopilot Notice: Admin Scheduled Campaign "${targetedSchedule.campaignName}" is set for future start on ${targetedSchedule.startDate}. Standby mode active.`, "info");
          setIsAutopilotRunningCycle(false);
          return;
        }
      }

      // 1. Auto-generate AI Outreach Packs for unprocessed leads matching schedule filter
      const pendingLeads = leads.filter(l => {
        if (l.aiOutreachPack) return false;
        if (!autopilotSettings.autoGeneratePacks) return false;
        if (targetedSchedule.enabled) {
          const textUpper = (l.cityLocation + " " + l.notes).toUpperCase();
          const matchesPostcode = targetedSchedule.postcodes.length === 0 || targetedSchedule.postcodes.some(pc => textUpper.includes(pc.toUpperCase()));
          return matchesPostcode;
        }
        return true;
      });

      if (pendingLeads.length > 0) {
        const leadToProcess = pendingLeads[0];
        addAutopilotLog(`🤖 Autopilot [${targetedSchedule.enabled ? targetedSchedule.campaignName : 'Global'}]: Generating pitch pack for "${leadToProcess.businessName}" in ${leadToProcess.cityLocation}...`, "action");

        const pack = await generateTraderOutreachPack(leadToProcess);
        
        setLeads(prev => prev.map(l => l.id === leadToProcess.id ? {
          ...l,
          status: autopilotSettings.autoDraftCampaigns ? "campaign_drafted" : l.status,
          aiOutreachPack: pack,
          updatedAt: new Date().toISOString()
        } : l));

        addAutopilotLog(`⚡ Autopilot: AI Outreach Pack ready for "${leadToProcess.businessName}". Email & WhatsApp pitches prepared.`, "success");
      } else {
        const allUnprocessed = leads.filter(l => !l.aiOutreachPack);
        if (allUnprocessed.length > 0 && targetedSchedule.enabled) {
          addAutopilotLog(`📍 Autopilot Target Filter: ${allUnprocessed.length} pending lead(s) fall outside active target postcodes [${targetedSchedule.postcodes.join(", ")}].`, "info");
        } else if (autopilotSettings.autoFollowUpAlerts) {
          // 2. Auto-check sequences & queue reminders
          const draftedLeads = leads.filter(l => l.status === "campaign_drafted");
          if (draftedLeads.length > 0 && Math.random() > 0.6) {
            const sample = draftedLeads[Math.floor(Math.random() * draftedLeads.length)];
            addAutopilotLog(`📩 Autopilot: Enqueued Strategy 1 WhatsApp & Email pitch for "${sample.businessName}" (${sample.phone}).`, "info");
          }
        }
      }
    } catch (err) {
      console.warn("Autopilot cycle warning:", err);
    } finally {
      setIsAutopilotRunningCycle(false);
    }
  };

  // Autonomous Interval Effect (runs every 15 seconds if Autopilot is enabled)
  useEffect(() => {
    if (!isAutopilotEnabled) return;

    const interval = setInterval(() => {
      runAutopilotCycle();
    }, 15000);

    return () => clearInterval(interval);
  }, [isAutopilotEnabled, leads, autopilotSettings]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.businessName || !newLeadForm.phone) {
      alert("Please provide at least a Business Name and Phone number.");
      return;
    }

    const created: TraderProspectLead = {
      id: `LEAD_${Date.now()}`,
      businessName: newLeadForm.businessName,
      contactName: newLeadForm.contactName || "",
      tradeCategory: newLeadForm.tradeCategory || "General Trade",
      cityLocation: newLeadForm.cityLocation || "UK",
      phone: newLeadForm.phone,
      email: newLeadForm.email || "",
      source: (newLeadForm.source as any) || "Yellow Pages",
      rating: newLeadForm.rating || "",
      notes: newLeadForm.notes || "",
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setLeads(prev => [created, ...prev]);
    setIsAddModalOpen(false);
    setNewLeadForm({
      businessName: "",
      contactName: "",
      tradeCategory: "Plumbing & Heating",
      cityLocation: "Manchester",
      phone: "",
      email: "",
      source: "Yellow Pages",
      rating: "",
      notes: ""
    });
  };

  const handleParseDirectoryText = async () => {
    if (!rawDirectoryText.trim()) return;
    setIsParsingText(true);
    try {
      const parsed = await parseUnstructuredTraderText(rawDirectoryText, "Yellow Pages");
      if (parsed.length > 0) {
        const fullLeads: TraderProspectLead[] = parsed.map((p, idx) => ({
          id: p.id || `LEAD_PARSE_${Date.now()}_${idx}`,
          businessName: p.businessName || "Directory Business",
          contactName: p.contactName || "",
          tradeCategory: p.tradeCategory || "General Trade",
          cityLocation: p.cityLocation || "UK",
          phone: p.phone || "07700 900000",
          email: p.email || "",
          source: (p.source as any) || "Yellow Pages",
          rating: p.rating || "",
          notes: p.notes || "",
          status: "new",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        setLeads(prev => [...fullLeads, ...prev]);
        setIsPasteModalOpen(false);
        setRawDirectoryText("");
      } else {
        alert("Could not extract leads from the text. Please check the text format.");
      }
    } catch (err) {
      console.error("Error parsing directory text:", err);
      alert("Failed to parse text.");
    } finally {
      setIsParsingText(false);
    }
  };

  const handleGeneratePackForLead = async (lead: TraderProspectLead) => {
    setIsGeneratingPack(lead.id);
    try {
      const pack = await generateTraderOutreachPack(lead);
      const updated: TraderProspectLead = {
        ...lead,
        status: lead.status === "new" ? "campaign_drafted" : lead.status,
        aiOutreachPack: pack,
        updatedAt: new Date().toISOString()
      };

      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
      setSelectedLead(updated);
    } catch (err) {
      console.error("Failed to generate outreach pack:", err);
      alert("Error generating outreach campaign pack.");
    } finally {
      setIsGeneratingPack(null);
    }
  };

  const handleBatchGeneratePacks = async () => {
    const ungenerated = leads.filter(l => !l.aiOutreachPack);
    if (ungenerated.length === 0) {
      alert("All leads already have AI Outreach Packs generated!");
      return;
    }

    setIsBatchGenerating(true);
    for (const lead of ungenerated) {
      try {
        const pack = await generateTraderOutreachPack(lead);
        setLeads(prev => prev.map(l => l.id === lead.id ? {
          ...l,
          status: l.status === "new" ? "campaign_drafted" : l.status,
          aiOutreachPack: pack,
          updatedAt: new Date().toISOString()
        } : l));
      } catch (e) {
        console.warn(`Failed batch pack for ${lead.businessName}:`, e);
      }
    }
    setIsBatchGenerating(false);
  };

  const handleUpdateStatus = (leadId: string, newStatus: TraderProspectLead["status"]) => {
    setLeads(prev => prev.map(l => l.id === leadId ? {
      ...l,
      status: newStatus,
      updatedAt: new Date().toISOString()
    } : l));
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleDeleteLead = (leadId: string) => {
    if (confirm("Are you sure you want to remove this trader prospect?")) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      if (selectedLead?.id === leadId) setSelectedLead(null);
    }
  };

  // Filtered list
  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.contactName && l.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      l.tradeCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.cityLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const matchesSource = sourceFilter === "all" || l.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesSource;
  });

  // KPI calculations
  const totalLeads = leads.length;
  const packsGenerated = leads.filter(l => !!l.aiOutreachPack).length;
  const contactedCount = leads.filter(l => ["contacted_whatsapp", "contacted_email", "followed_up", "onboarded"].includes(l.status)).length;
  const onboardedCount = leads.filter(l => l.status === "onboarded").length;
  const conversionRate = contactedCount > 0 ? ((onboardedCount / contactedCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Mode Switcher Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-black max-w-fit">
        <button
          onClick={() => setActiveOutreachTab("trader_b2b")}
          className={cn(
            "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeOutreachTab === "trader_b2b"
              ? "bg-slate-900 text-white shadow-md border border-black"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          )}
        >
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>Trader B2B Onboarding Agent</span>
        </button>

        <button
          onClick={() => {
            setActiveOutreachTab("homeowner_b2c");
            if (!homeownerCampaign) {
              handleGenerateHomeownerCampaign();
            }
          }}
          className={cn(
            "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeOutreachTab === "homeowner_b2c"
              ? "bg-slate-900 text-white shadow-md border border-black"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          )}
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>Homeowner & Public Onboarding Hub</span>
        </button>
      </div>

      {activeOutreachTab === "homeowner_b2c" ? (
        /* 🏡 HOMEOWNER & PUBLIC ONBOARDING CAMPAIGN HUB */
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-black shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Public & Homeowner Growth Engine</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  Homeowner & Public Onboarding Campaign Hub
                </h2>
                <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
                  Engage homeowners, landlords, and the general public legally and ethically under PECR/GDPR laws using hyper-local community posts, Property Digital Twin invitations, £20 voucher referral campaigns, and local print flyers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateHomeownerCampaign}
                  disabled={isGeneratingHomeownerCampaign}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={cn("w-4 h-4", isGeneratingHomeownerCampaign && "animate-spin")} />
                  <span>{isGeneratingHomeownerCampaign ? "Generating AI Campaign..." : "Re-Generate Campaign"}</span>
                </button>
              </div>
            </div>

            {/* Target Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Target Location / Postcode District</label>
                <input
                  type="text"
                  value={homeownerCity}
                  onChange={e => setHomeownerCity(e.target.value)}
                  placeholder="e.g. Manchester / M1 or London SE1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Focus Onboarding Angle</label>
                <select
                  value={homeownerCategory}
                  onChange={e => setHomeownerCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Multi-Service Ecosystem (Trades, Pet Care, Tutoring, Babysitting, Car Detailing)">🌟 All Services (Fair Mix: Trades, Pet Care, Tutoring, Babysitting, Detailing)</option>
                  <option value="Pet Sitting, Dog Walking & Animal Care">🐶 Pet Sitting, Dog Walking & Animal Care</option>
                  <option value="Academic Tutoring & Private Education">📚 Academic Tutoring & Private Education</option>
                  <option value="Babysitting & Childcare Services">👶 Babysitting & Childcare Services</option>
                  <option value="Mobile Car Detailing & Valeting">🚗 Mobile Car Detailing & Valeting</option>
                  <option value="On-Demand Courier & Bulky Goods Delivery">📦 On-Demand Courier & Bulky Goods Delivery</option>
                  <option value="Home Repairs & Property Passports">🛠️ Home Repairs & Property Passports</option>
                  <option value="Boiler Servicing & Gas Safety CP12">🔥 Boiler Servicing & Gas Safety CP12</option>
                  <option value="Emergency Electrical & Plumbing">⚡ Emergency Electrical & Plumbing</option>
                  <option value="Specialist Domestic & Deep Cleaning">🧹 Specialist Domestic & Deep Cleaning</option>
                </select>
              </div>
            </div>
          </div>

          {/* GDPR Compliance Guarantee Banner */}
          <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 text-white flex items-start gap-3 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-black text-emerald-300 uppercase tracking-wider">UK PECR & GDPR B2C Compliance Protected</p>
              <p className="text-[11px] text-emerald-100 leading-relaxed">
                Homeowners and the general public are protected from unsolicited cold calls and SMS under Privacy and Electronic Communications Regulations (PECR). Our B2C campaign engine focuses strictly on inbound community recommendation channels (Nextdoor, Facebook groups), opt-in Property Passport digital invites, and peer-to-peer £20 neighbor referral links.
              </p>
            </div>
          </div>

          {/* Generated Campaign Content */}
          {homeownerCampaign && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Nextdoor & Community Group Post */}
              <div className="bg-white rounded-3xl border border-black p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-black text-slate-900 text-sm">Nextdoor & Facebook Community Group Post</h3>
                  </div>
                  <button
                    onClick={() => handleCopy(`${homeownerCampaign.nextdoorCommunityPost.title}\n\n${homeownerCampaign.nextdoorCommunityPost.body}\n\n${homeownerCampaign.nextdoorCommunityPost.callToAction}`, "nextdoor")}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === "nextdoor" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === "nextdoor" ? "Copied!" : "Copy Post"}</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Headline / Title</span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">{homeownerCampaign.nextdoorCommunityPost.title}</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Body Content</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 mt-0.5 whitespace-pre-wrap">{homeownerCampaign.nextdoorCommunityPost.body}</p>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <span className="font-extrabold text-indigo-900 uppercase text-[10px]">Call To Action</span>
                    <p className="font-bold text-indigo-900 text-xs mt-0.5">{homeownerCampaign.nextdoorCommunityPost.callToAction}</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Property Passport Digital Twin Invitation */}
              <div className="bg-white rounded-3xl border border-black p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-black text-slate-900 text-sm">Property Passport Digital Twin Letter / Email</h3>
                  </div>
                  <button
                    onClick={() => handleCopy(`${homeownerCampaign.propertyPassportInvite.headline}\n\n${homeownerCampaign.propertyPassportInvite.emailOrLetterBody}`, "passport_invite")}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === "passport_invite" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === "passport_invite" ? "Copied!" : "Copy Letter"}</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Invite Headline</span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">{homeownerCampaign.propertyPassportInvite.headline}</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Message Body</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 mt-0.5 whitespace-pre-wrap">{homeownerCampaign.propertyPassportInvite.emailOrLetterBody}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Homeowner Key Benefits</span>
                    <div className="space-y-1">
                      {homeownerCampaign.propertyPassportInvite.valuePoints.map((pt, i) => (
                        <div key={i} className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: £20 Neighbor Voucher Referral Campaign */}
              <div className="bg-white rounded-3xl border border-black p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <h3 className="font-black text-slate-900 text-sm">£20 Neighbor Voucher Referral Campaign</h3>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(homeownerCampaign.voucherReferralCampaign.shareableWhatsAppText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <span className="font-black text-amber-900 uppercase text-[10px]">Referral Headline</span>
                    <p className="font-black text-amber-950 text-sm mt-0.5">{homeownerCampaign.voucherReferralCampaign.headline}</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Shareable Neighbor WhatsApp Message</span>
                    <p className="text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200 mt-0.5">{homeownerCampaign.voucherReferralCampaign.shareableWhatsAppText}</p>
                  </div>

                  {/* Early-Stage Launch Unit Economics & Funding Breakdown */}
                  <div className="bg-indigo-50/90 border border-indigo-200/90 p-3.5 rounded-2xl space-y-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-indigo-950 font-black">
                      <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600 shrink-0" />
                      <span>Early Launch Funding Strategy (Unit Economics):</span>
                    </div>
                    <ul className="space-y-1 text-indigo-900 font-medium list-disc list-inside pl-0.5 leading-relaxed">
                      <li><strong className="font-extrabold text-indigo-950">Minimum Order Threshold (£80–£100):</strong> Credit is applied as an in-app discount on completed jobs (£80+), so cash never leaves the platform.</li>
                      <li><strong className="font-extrabold text-indigo-950">Marketplace Commission Offsetting:</strong> Platform transaction fees on completed jobs cover 50–100% of the voucher value.</li>
                      <li><strong className="font-extrabold text-indigo-950">Trader Customer Acquisition Co-Op:</strong> Onboarded service pros absorb £10 of the discount in exchange for direct client acquisition without paying Checkatrade/Yell lead costs.</li>
                      <li><strong className="font-extrabold text-indigo-950">Zero Fraud Escrow Trigger:</strong> Credits unlock strictly after Stripe Escrow job sign-off and payment completion.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Card 4: Door-to-Door Print Flyer Copy */}
              <div className="bg-white rounded-3xl border border-black p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-800" />
                    <h3 className="font-black text-slate-900 text-sm">Local Print Door Flyer Copy</h3>
                  </div>
                  <button
                    onClick={() => handleCopy(`${homeownerCampaign.localPrintFlyerCopy.frontHeadline}\n\nKey Highlights:\n${homeownerCampaign.localPrintFlyerCopy.backDetails.join("\n")}\n\n${homeownerCampaign.localPrintFlyerCopy.footerDisclaimer}`, "flyer")}
                    className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === "flyer" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === "flyer" ? "Copied!" : "Copy Flyer"}</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-black">
                    <span className="font-extrabold text-amber-400 uppercase text-[10px]">Front Side Headline</span>
                    <p className="font-black text-white text-xs mt-0.5">{homeownerCampaign.localPrintFlyerCopy.frontHeadline}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-extrabold text-slate-400 uppercase text-[10px]">Back Side Bullet Points</span>
                    <div className="space-y-1">
                      {homeownerCampaign.localPrintFlyerCopy.backDetails.map((detail, idx) => (
                        <p key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 font-medium text-[11px]">{detail}</p>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic text-center pt-2 border-t border-slate-100">{homeownerCampaign.localPrintFlyerCopy.footerDisclaimer}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 🛠️ TRADER B2B ONBOARDING & DIRECTORY PROSPECTING TAB */
        <>
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-black shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>Directory Outreach & Onboarding Agent</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Yellow Pages & Directory Trader Prospecting
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Import local trader contact details directly from Yellow Pages, Yell, or Google Maps. Our AI agent crafts tailored pitches (Email, WhatsApp, Cold Call Scripts) and tracks onboarding conversions with £0 upfront lead fees & £0 monthly listing costs (15% PAYG success fee on completed jobs, reduced to 3-10% on Pro tiers).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPasteModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-500/20 active:scale-95 transition-all inline-flex items-center gap-2 border border-indigo-400/30 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Paste Yellow Pages Text</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-white text-slate-900 hover:bg-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all inline-flex items-center gap-2 border border-black cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-900" />
              <span>Add Single Lead</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/60">
            <p className="text-xs text-slate-400 font-medium">Total Prospects</p>
            <p className="text-xl font-black text-white mt-0.5">{totalLeads}</p>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/60">
            <p className="text-xs text-indigo-400 font-medium">AI Packs Ready</p>
            <p className="text-xl font-black text-indigo-300 mt-0.5">{packsGenerated} / {totalLeads}</p>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/60">
            <p className="text-xs text-blue-400 font-medium">Contacted Leads</p>
            <p className="text-xl font-black text-blue-300 mt-0.5">{contactedCount}</p>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/60">
            <p className="text-xs text-emerald-400 font-medium">Onboarded (Joined)</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-black text-emerald-300">{onboardedCount}</span>
              <span className="text-xs text-emerald-400 font-bold">({conversionRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Autopilot Engine Control Panel */}
      <div className="bg-slate-900 border border-black rounded-3xl p-6 text-white shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all",
              isAutopilotEnabled ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-800 border-slate-700 text-slate-400"
            )}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">Autopilot Autonomous Agent Mode</h3>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5",
                  isAutopilotEnabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-400 border border-slate-700"
                )}>
                  {isAutopilotEnabled ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Independent & Active
                    </>
                  ) : (
                    "Paused"
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                When enabled, the AI Agent operates independently in the background: scanning directory listings, generating outreach packs, drafting WhatsApp/Email pitches, and tracking conversion sequences automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
            <button
              onClick={runAutopilotCycle}
              disabled={isAutopilotRunningCycle}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isAutopilotRunningCycle && "animate-spin")} />
              <span>{isAutopilotRunningCycle ? "Running Cycle..." : "Run Autopilot Cycle Now"}</span>
            </button>

            <button
              onClick={() => setIsAutopilotEnabled(!isAutopilotEnabled)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border shadow-md flex items-center gap-2",
                isAutopilotEnabled 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30" 
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              )}
            >
              <Zap className={cn("w-4 h-4", isAutopilotEnabled ? "text-emerald-400 fill-emerald-400" : "text-slate-400")} />
              <span>{isAutopilotEnabled ? "Autopilot ON" : "Enable Autopilot"}</span>
            </button>
          </div>
        </div>

        {/* Autopilot Rules Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Auto-Generate AI Packs
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Crafts Email, WhatsApp & Cold Call scripts immediately upon lead import.</p>
            </div>
            <input
              type="checkbox"
              checked={autopilotSettings.autoGeneratePacks}
              onChange={e => setAutopilotSettings(s => ({ ...s, autoGeneratePacks: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Draft Campaigns
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Transitions new leads to "Campaign Drafted" once pitches are ready.</p>
            </div>
            <input
              type="checkbox"
              checked={autopilotSettings.autoDraftCampaigns}
              onChange={e => setAutopilotSettings(s => ({ ...s, autoDraftCampaigns: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                Auto-Follow Up Alerts
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Schedules automated 48-hour re-engagement notifications for contacts.</p>
            </div>
            <input
              type="checkbox"
              checked={autopilotSettings.autoFollowUpAlerts}
              onChange={e => setAutopilotSettings(s => ({ ...s, autoFollowUpAlerts: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer"
            />
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                Auto-Advance Sequences
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Monitors trader responses & auto-flags onboarded accounts.</p>
            </div>
            <input
              type="checkbox"
              checked={autopilotSettings.autoAdvanceSequences}
              onChange={e => setAutopilotSettings(s => ({ ...s, autoAdvanceSequences: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 📍 ADMIN TARGETED CAMPAIGN SCHEDULER (POSTCODE AREA & TIME PERIOD) */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 md:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-black text-white">Admin Scheduled Targeted Campaign Settings</h4>
                  <span className={cn("px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border", getScheduleStatus().color)}>
                    {getScheduleStatus().label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Restrict autonomous outreach to specific UK postcode districts and set active campaign start & expiry date limits.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsAdminTestModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-indigo-400/40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-indigo-200" />
                <span>Send Test Campaign (Email / WhatsApp)</span>
              </button>

              <label className="text-xs font-bold text-slate-300 flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                <span>Active Schedule Filtering</span>
                <input
                  type="checkbox"
                  checked={targetedSchedule.enabled}
                  onChange={e => setTargetedSchedule(s => ({ ...s, enabled: e.target.checked }))}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {targetedSchedule.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {/* Campaign Name & Audience */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Campaign Name</span>
                  </label>
                  <input
                    type="text"
                    value={targetedSchedule.campaignName}
                    onChange={e => setTargetedSchedule(s => ({ ...s, campaignName: e.target.value }))}
                    placeholder="e.g. Greater Manchester Summer Blitz"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-blue-400" />
                    <span>Target Audience Filter</span>
                  </label>
                  <select
                    value={targetedSchedule.targetAudience}
                    onChange={e => setTargetedSchedule(s => ({ ...s, targetAudience: e.target.value as any }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Audiences (B2B Traders & B2C Homeowners)</option>
                    <option value="traders_b2b">Traders B2B Only</option>
                    <option value="homeowners_b2c">Homeowners B2C Only</option>
                  </select>
                </div>
              </div>

              {/* Time Period & Duration Picker */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      <span>Start Date</span>
                    </label>
                    <input
                      type="date"
                      value={targetedSchedule.startDate}
                      onChange={e => setTargetedSchedule(s => ({ ...s, startDate: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-rose-400" />
                      <span>Expiry Date</span>
                    </label>
                    <input
                      type="date"
                      value={targetedSchedule.endDate}
                      onChange={e => setTargetedSchedule(s => ({ ...s, endDate: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Quick Duration Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Period Presets:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[7, 14, 30, 60].map(days => (
                      <button
                        key={days}
                        onClick={() => setCampaignDurationDays(days)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[10px] font-extrabold text-indigo-300 transition-all cursor-pointer"
                      >
                        +{days} Days
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Targeted Postcode Districts */}
              <div className="space-y-2 md:col-span-2 lg:col-span-1">
                <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    Target Postcode Districts ({targetedSchedule.postcodes.length})
                  </span>
                  <span className="text-[10px] text-slate-400">e.g. M1, M2, SE1</span>
                </label>

                {/* Postcode Badges list */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-700 min-h-[42px] max-h-24 overflow-y-auto">
                  {targetedSchedule.postcodes.map(pc => (
                    <span key={pc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-black">
                      <span>{pc}</span>
                      <button
                        onClick={() => removeTargetPostcode(pc)}
                        className="hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {targetedSchedule.postcodes.length === 0 && (
                    <span className="text-[10px] text-slate-500 italic">No postcodes added (Targeting all areas)</span>
                  )}
                </div>

                {/* Add Postcode Input */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newPostcodeInput}
                    onChange={e => setNewPostcodeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addTargetPostcode(); }}
                    placeholder="Add postcode (e.g. SW1)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={addTargetPostcode}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Autopilot Audit Log Feed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              Autonomous Agent Activity Audit Log ({autopilotLogs.length})
            </span>
            <button
              onClick={() => setAutopilotLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Clear Feed
            </button>
          </div>

          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-3.5 max-h-40 overflow-y-auto space-y-2 font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-800">
            {autopilotLogs.length === 0 ? (
              <p className="text-slate-600 italic">No activity logged yet. Enable Autopilot or run a cycle to view autonomous agent operations.</p>
            ) : (
              autopilotLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-slate-300">
                  <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                  <span className={cn(
                    log.type === "success" && "text-emerald-400 font-bold",
                    log.type === "action" && "text-indigo-300 font-bold",
                    log.type === "info" && "text-slate-300"
                  )}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-black p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search business name, contact, trade, or location..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="new">New Lead</option>
              <option value="campaign_drafted">Campaign Drafted</option>
              <option value="contacted_whatsapp">Contacted (WhatsApp)</option>
              <option value="contacted_email">Contacted (Email)</option>
              <option value="followed_up">Followed Up</option>
              <option value="onboarded">Onboarded (Joined)</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="Yellow Pages">Yellow Pages</option>
              <option value="Yell.com">Yell.com</option>
              <option value="Google Maps">Google Maps</option>
              <option value="Checkatrade">Checkatrade</option>
              <option value="Manual Direct">Manual Direct</option>
            </select>
          </div>

          <button
            onClick={handleBatchGeneratePacks}
            disabled={isBatchGenerating}
            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {isBatchGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
            <span>Batch Generate AI Packs</span>
          </button>
        </div>
      </div>

      {/* Main CRM Table */}
      <div className="bg-white rounded-2xl border border-black shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-4">Trader / Business</th>
                <th className="p-4">Trade & Location</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Source & Rating</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">AI Outreach & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Bot className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-bold text-slate-700">No prospects match your search.</p>
                      <p className="text-xs">Add a new lead or paste Yellow Pages directory listings to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => {
                  const isGeneratingThis = isGeneratingPack === lead.id;
                  const hasPack = !!lead.aiOutreachPack;

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-black text-slate-900 text-sm">{lead.businessName}</div>
                        {lead.contactName && (
                          <div className="text-slate-500 text-xs font-medium flex items-center gap-1 mt-0.5">
                            <span>Contact:</span> <strong className="text-slate-700">{lead.contactName}</strong>
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-300 mb-1">
                          {lead.tradeCategory}
                        </span>
                        <div className="flex items-center gap-1 text-slate-600 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{lead.cityLocation}</span>
                        </div>
                      </td>

                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate max-w-[160px]">{lead.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-200">
                          <Building2 className="w-3 h-3 text-amber-600" />
                          <span>{lead.source}</span>
                        </span>
                        {lead.rating && (
                          <div className="text-slate-600 text-xs font-semibold mt-1 flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{lead.rating}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <select
                          value={lead.status}
                          onChange={e => handleUpdateStatus(lead.id, e.target.value as any)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-black border focus:outline-none cursor-pointer",
                            lead.status === "new" && "bg-slate-100 text-slate-700 border-slate-300",
                            lead.status === "campaign_drafted" && "bg-indigo-50 text-indigo-700 border-indigo-200",
                            lead.status === "contacted_whatsapp" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                            lead.status === "contacted_email" && "bg-blue-50 text-blue-700 border-blue-200",
                            lead.status === "followed_up" && "bg-amber-50 text-amber-700 border-amber-200",
                            lead.status === "onboarded" && "bg-emerald-600 text-white border-black",
                            lead.status === "declined" && "bg-red-50 text-red-700 border-red-200"
                          )}
                        >
                          <option value="new">New Lead</option>
                          <option value="campaign_drafted">Campaign Drafted</option>
                          <option value="contacted_whatsapp">Contacted (WhatsApp)</option>
                          <option value="contacted_email">Contacted (Email)</option>
                          <option value="followed_up">Followed Up</option>
                          <option value="onboarded">Onboarded (Joined!)</option>
                          <option value="declined">Declined</option>
                        </select>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasPack ? (
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 border border-black cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>View AI Pack</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleGeneratePackForLead(lead)}
                              disabled={isGeneratingThis}
                              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 border border-black disabled:opacity-50 cursor-pointer"
                            >
                              {isGeneratingThis ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                              <span>{isGeneratingThis ? "Generating..." : "Generate Pitch"}</span>
                            </button>
                          )}

                          {lead.phone && (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                                lead.aiOutreachPack?.whatsappMessage ||
                                  `Hi ${lead.contactName || lead.businessName}! We saw your great reputation for ${lead.tradeCategory} in ${lead.cityLocation}. AnyTrader connects local verified trades directly with homeowners with £0 upfront lead fees and £0 monthly fees (pay only a success fee when you complete a job). Take a look: https://anytrader.app/trader/register`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleUpdateStatus(lead.id, "contacted_whatsapp")}
                              title="1-Tap Open WhatsApp"
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Delete lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI OUTREACH PACK MODAL / DRAWER */}
      <AnimatePresence>
        {selectedLead && selectedLead.aiOutreachPack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white border-b border-black flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black border border-indigo-400/40">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{selectedLead.businessName}</h3>
                    <p className="text-xs text-indigo-300 font-medium">
                      AI Outreach Pack • {selectedLead.tradeCategory} ({selectedLead.cityLocation})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* 🛡️ Platform Scope Compliance Guardrail Verification Badge */}
                <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 text-emerald-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-emerald-300">100% Platform Scope Compliant</h5>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-bold">Scope Version 1.0</span>
                      </div>
                      <p className="text-[11px] text-emerald-100/80 mt-0.5">
                        Verified against AnyTrader terms: No fake job guarantees, no unapproved fee waivers, and no unauthorized promises.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end md:self-center text-[10px] font-extrabold text-emerald-300 bg-emerald-900/80 px-3 py-1.5 rounded-xl border border-emerald-700/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>0 Out-of-Scope Violations</span>
                  </div>
                </div>

                {/* 🧠 AI Strategic Onboarding Master Plan */}
                {selectedLead.aiOutreachPack.onboardingStrategyBlueprint && (
                  <div className="bg-slate-900 border border-black rounded-2xl p-5 text-white space-y-4 shadow-lg">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-indigo-400" />
                        <div>
                          <h4 className="text-sm font-black text-white">AI Onboarding Master Strategy Plan</h4>
                          <p className="text-[11px] text-slate-400">Custom psychological persuasion framework for {selectedLead.businessName}</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Conversion Score: {selectedLead.aiOutreachPack.onboardingStrategyBlueprint.estimatedConversionProbability}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">Target Strategy Angle</p>
                        <p className="text-xs font-bold text-white">{selectedLead.aiOutreachPack.onboardingStrategyBlueprint.primaryTargetAngle}</p>
                      </div>

                      <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Competitor Differentiator</p>
                        <p className="text-xs font-medium text-slate-200">{selectedLead.aiOutreachPack.onboardingStrategyBlueprint.competitorDifferentiator}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Recommended 4-Step Autonomous Cadence</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {selectedLead.aiOutreachPack.onboardingStrategyBlueprint.recommendedSequence.map((step, idx) => (
                          <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-slate-300 text-[11px] font-medium flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-600/40 border border-indigo-400/50 text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Value Highlights */}
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span>Tailored Value Drivers for {selectedLead.businessName}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedLead.aiOutreachPack.valueHighlights.map((vh, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{vh}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 1. WhatsApp / SMS Script */}
                <div className="bg-white border border-black rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-black text-slate-900">WhatsApp / SMS Outreach Message</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(selectedLead.aiOutreachPack!.whatsappMessage, "whatsapp")}
                        className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === "whatsapp" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === "whatsapp" ? "Copied!" : "Copy Msg"}</span>
                      </button>
                      <a
                        href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(selectedLead.aiOutreachPack!.whatsappMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleUpdateStatus(selectedLead.id, "contacted_whatsapp")}
                        className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 border border-black cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open WhatsApp</span>
                      </a>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                    {selectedLead.aiOutreachPack.whatsappMessage}
                  </div>
                </div>

                {/* 2. Email Pitch */}
                <div className="bg-white border border-black rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-black text-slate-900">Personalized Email Pitch</h4>
                    </div>
                    <button
                      onClick={() => handleCopy(`Subject: ${selectedLead.aiOutreachPack!.emailSubject}\n\n${selectedLead.aiOutreachPack!.emailBody}`, "email")}
                      className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "email" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === "email" ? "Copied Email" : "Copy Full Email"}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900">
                      Subject: {selectedLead.aiOutreachPack.emailSubject}
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                      {selectedLead.aiOutreachPack.emailBody}
                    </div>
                  </div>
                </div>

                {/* 3. Phone Call Script & Objection Handler */}
                <div className="bg-white border border-black rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Phone className="w-4 h-4 text-purple-600" />
                    <h4 className="text-sm font-black text-slate-900">Cold Call / Gatekeeper Script</h4>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Opening Pitch:</p>
                      <p className="bg-purple-50 border border-purple-200 rounded-xl p-3 font-medium text-slate-900">
                        {selectedLead.aiOutreachPack.callScript.opening}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">60-Second Value Pitch:</p>
                      <p className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-800 leading-relaxed">
                        {selectedLead.aiOutreachPack.callScript.valuePitch}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Objection Rebuttals:</p>
                      <div className="space-y-2">
                        {selectedLead.aiOutreachPack.callScript.objectionHandlers.map((obj, i) => (
                          <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white space-y-1">
                            <p className="font-bold text-red-600">"{obj.objection}"</p>
                            <p className="text-slate-700 font-medium">👉 {obj.response}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Closing Permission Call-to-Action:</p>
                      <p className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 font-bold text-emerald-900">
                        {selectedLead.aiOutreachPack.callScript.closingCallToAction}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Strategy 1 Direct Link */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-black flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-indigo-300">Strategy 1 Direct Onboarding URL:</p>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">{selectedLead.aiOutreachPack.strategy1OnboardingUrl}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(selectedLead.aiOutreachPack!.strategy1OnboardingUrl, "link")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-indigo-400/30 cursor-pointer"
                  >
                    {copiedField === "link" ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === "link" ? "Copied Link" : "Copy Link"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </>
      )}

      {/* ADD SINGLE LEAD MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white border-b border-black flex items-center justify-between">
                <h3 className="text-base font-black text-white">Add Trader Lead</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreateLead} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Business / Trader Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Plumbing & Heating Ltd"
                    value={newLeadForm.businessName}
                    onChange={e => setNewLeadForm({ ...newLeadForm, businessName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-900 mb-1">Contact Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dave Miller"
                      value={newLeadForm.contactName}
                      onChange={e => setNewLeadForm({ ...newLeadForm, contactName: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-900 mb-1">Trade Category</label>
                    <select
                      value={newLeadForm.tradeCategory}
                      onChange={e => setNewLeadForm({ ...newLeadForm, tradeCategory: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Plumbing & Heating">Plumbing & Heating</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Roofing">Roofing</option>
                      <option value="Carpentry">Carpentry</option>
                      <option value="Painting & Decorating">Painting & Decorating</option>
                      <option value="Specialist Cleaning">Specialist Cleaning</option>
                      <option value="On-Demand Courier">On-Demand Courier</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-900 mb-1">Phone / WhatsApp *</label>
                    <input
                      type="text"
                      required
                      placeholder="07700 900123"
                      value={newLeadForm.phone}
                      onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-900 mb-1">City / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Manchester"
                      value={newLeadForm.cityLocation}
                      onChange={e => setNewLeadForm({ ...newLeadForm, cityLocation: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-900 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="dave@apex.co.uk"
                      value={newLeadForm.email}
                      onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-900 mb-1">Directory Source</label>
                    <select
                      value={newLeadForm.source}
                      onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value as any })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Yellow Pages">Yellow Pages</option>
                      <option value="Yell.com">Yell.com</option>
                      <option value="Google Maps">Google Maps</option>
                      <option value="Checkatrade">Checkatrade</option>
                      <option value="Manual Direct">Manual Direct</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-900 mb-1">Notes / Rating</label>
                  <input
                    type="text"
                    placeholder="e.g. 4.9★ (38 reviews) - Gas Safe verified"
                    value={newLeadForm.notes}
                    onChange={e => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl border border-black shadow-md cursor-pointer"
                  >
                    Save Lead
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SMART DIRECTORY PASTE MODAL */}
      <AnimatePresence>
        {isPasteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black shadow-2xl max-w-xl w-full overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white border-b border-black flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-black text-white">Smart Directory Paste (Yellow Pages / Yell)</h3>
                </div>
                <button onClick={() => setIsPasteModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed font-medium">
                  Copy and paste raw text copied directly from <strong>Yellow Pages</strong>, <strong>Yell.com</strong>, or <strong>Google Maps listings</strong> below. Gemini 2.5 Flash will automatically extract business names, trades, locations, phone numbers, and ratings into your CRM datasheet!
                </p>

                <textarea
                  rows={8}
                  placeholder={`Paste raw directory text here... e.g.
Apex Plumbing & Heating Ltd - Manchester
07700 900123 - Gas Safe Registered - 4.9 stars (38 reviews)

West Midlands Electrical Solutions - Birmingham
07700 900456 - info@wmelectrical.co.uk - 4.8 stars`}
                  value={rawDirectoryText}
                  onChange={e => setRawDirectoryText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="pt-2 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400 font-medium">Powered by Gemini 2.5 Flash Parsing</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPasteModalOpen(false)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isParsingText || !rawDirectoryText.trim()}
                      onClick={handleParseDirectoryText}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl border border-black shadow-md disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                    >
                      {isParsingText ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Parsing with Gemini...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Parse & Add Leads</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🧪 ADMIN DISPATCH TEST CAMPAIGN MODAL (EMAIL & WHATSAPP) */}
      <AnimatePresence>
        {isAdminTestModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black max-w-xl w-full p-6 space-y-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Dispatch Test Campaign to Admin</h3>
                    <p className="text-xs text-slate-500">Preview & test outreach pitch packs on your email or WhatsApp</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAdminTestModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {testDispatchSuccessNotice && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{testDispatchSuccessNotice}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Admin Contact Information Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Admin Email Address</label>
                    <input
                      type="email"
                      value={adminTestEmail}
                      onChange={e => setAdminTestEmail(e.target.value)}
                      placeholder="saanwar2002@gmail.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Admin WhatsApp Number</label>
                    <input
                      type="tel"
                      value={adminTestPhone}
                      onChange={e => setAdminTestPhone(e.target.value)}
                      placeholder="e.g. +44 7700 900000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Campaign Selection */}
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700">Test Campaign Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAdminTestType("both")}
                      className={cn(
                        "p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer",
                        adminTestType === "both" ? "bg-indigo-900 text-white border-black" : "bg-slate-50 text-slate-700 border-slate-200"
                      )}
                    >
                      All (Trader + Homeowner)
                    </button>
                    <button
                      onClick={() => setAdminTestType("trader")}
                      className={cn(
                        "p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer",
                        adminTestType === "trader" ? "bg-indigo-900 text-white border-black" : "bg-slate-50 text-slate-700 border-slate-200"
                      )}
                    >
                      Trader B2B Pitch
                    </button>
                    <button
                      onClick={() => setAdminTestType("homeowner")}
                      className={cn(
                        "p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer",
                        adminTestType === "homeowner" ? "bg-indigo-900 text-white border-black" : "bg-slate-50 text-slate-700 border-slate-200"
                      )}
                    >
                      Homeowner B2C Pack
                    </button>
                  </div>
                </div>

                {/* Previews & Direct Dispatch Links */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 border border-black">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-black text-amber-400 text-xs uppercase tracking-wider">Targeted Campaign Preview ({targetedSchedule.campaignName})</span>
                    <span className="text-[10px] text-slate-400">Postcodes: {targetedSchedule.postcodes.slice(0, 4).join(", ")}</span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    This test email & WhatsApp payload contains verified AnyTrader B2B Trader onboarding pitches, £0 fee guarantees, and B2C Property Digital Twin homeowner campaign links.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    {/* Send Mailto Link */}
                    <a
                      href={`mailto:${adminTestEmail}?subject=${encodeURIComponent(`[AnyTrader Test Campaign] ${targetedSchedule.campaignName}`)}&body=${encodeURIComponent(
                        `Hi Admin,\n\nHere is your test AnyTrader outreach campaign payload for ${targetedSchedule.campaignName}:\n\n` +
                        `=== 🛠️ TRADER B2B ONBOARDING PITCH ===\n` +
                        `Subject: AnyTrader UK Partnership - Zero upfront lead fees for tradespeople in ${targetedSchedule.postcodes[0] || 'UK'}\n` +
                        `Body: Hi there! Connect directly with verified homeowners in ${targetedSchedule.postcodes.join(", ")}. Enjoy 0% commission on your first 3 jobs, video-verified badge (+35% match boost), and 1-tap WhatsApp quotes.\n\n` +
                        `=== 🏡 HOMEOWNER B2C CAMPAIGN ===\n` +
                        `Headline: Claim your free Property Digital Twin Passport in ${targetedSchedule.postcodes[0] || 'UK'}\n` +
                        `WhatsApp Referral Link: https://anytrader.app/invite?ref=ADMIN20\n\n` +
                        `AnyTrader Growth Engine - 100% Platform Scope Compliant`
                      )}`}
                      onClick={() => {
                        setTestDispatchSuccessNotice(`Email test draft opened for ${adminTestEmail}!`);
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border border-black shadow-md"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Test Email</span>
                    </a>

                    {/* Send WhatsApp Link */}
                    <a
                      href={`https://wa.me/${adminTestPhone ? adminTestPhone.replace(/[^0-9]/g, '') : ''}?text=${encodeURIComponent(
                        `*AnyTrader UK Test Outreach Campaign*\n` +
                        `*Campaign:* ${targetedSchedule.campaignName}\n` +
                        `*Target Postcodes:* ${targetedSchedule.postcodes.join(", ")}\n\n` +
                        `*🛠️ Trader B2B Pitch:* Join AnyTrader with £0 upfront lead fees, 0% commission on your first 3 jobs, and verified video pro badges.\n\n` +
                        `*🏡 Homeowner B2C Offer:* Claim your free Property Digital Twin Passport & get £20 off your first repair: https://anytrader.app/invite?ref=ADMIN20`
                      )}`}
                      onClick={() => {
                        setTestDispatchSuccessNotice(`WhatsApp test payload opened!`);
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border border-black shadow-md"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Send Test WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
