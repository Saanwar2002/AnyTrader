import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, X, User, FileText, Wrench, Shield, CreditCard, 
  Home, Zap, ShoppingBag, Video, Phone, Bell, HelpCircle, 
  Calendar, CheckCircle2, ChevronRight, Sparkles, MessageSquare, 
  Lock, ArrowRight, Truck, DollarSign, Calculator, Layers, AlertTriangle, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "./AuthProvider";
import BnplFinancingModal from "./BnplFinancingModal";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Account & Profile" | "Jobs & Quotes" | "Tools & Portals" | "Services & Trades" | "Help & Safety";
  icon: any;
  iconBg: string;
  iconColor: string;
  path?: string;
  action?: () => void;
  keywords: string[];
  roleFilter?: "homeowner" | "tradesperson" | "tenant" | "all";
}

export function HeaderAccountSearch() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showBnplModal, setShowBnplModal] = useState(false);
  const [showEmergencyGuide, setShowEmergencyGuide] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Comprehensive searchable platform and account index
  const searchIndex: SearchItem[] = useMemo(() => [
    // 1. Account & Profile
    {
      id: "acc-profile",
      title: "My Profile & Personal Details",
      subtitle: "Update name, email, phone number, address and preferences",
      category: "Account & Profile",
      icon: User,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/profile",
      keywords: ["profile", "account", "settings", "name", "email", "phone", "address", "details", "photo", "avatar"]
    },
    {
      id: "acc-verify",
      title: "ID & Video Verification",
      subtitle: "Upload trade credentials, gas safe, NICEIC, or 15s intro video",
      category: "Account & Profile",
      icon: Shield,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/profile#verification",
      keywords: ["verify", "verification", "id", "passport", "driving licence", "credentials", "video pro", "gas safe", "niceic", "cscs"]
    },
    {
      id: "acc-payouts",
      title: "Bank & Payouts (Stripe Connect)",
      subtitle: "Manage bank accounts, debit cards, and payout schedules",
      category: "Account & Profile",
      icon: CreditCard,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-700",
      path: "/profile#payouts",
      keywords: ["bank", "payout", "payouts", "stripe", "account number", "sort code", "card", "billing", "earnings", "withdraw"]
    },
    {
      id: "acc-tax",
      title: "Auto Tax & NI Reserve Calculator",
      subtitle: "UK Sole Trader Self-Assessment tax and national insurance allocation",
      category: "Account & Profile",
      icon: Calculator,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-800",
      path: "/trade-dashboard",
      keywords: ["tax", "ni", "national insurance", "hmrc", "self-assessment", "sole trader", "reserves", "accounting", "expenses"]
    },
    {
      id: "acc-messages",
      title: "Messages & Direct Chats",
      subtitle: "Chat with tradespeople, clients, and review job specifications",
      category: "Account & Profile",
      icon: MessageSquare,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-700",
      path: "/messages",
      keywords: ["messages", "chat", "inbox", "conversations", "quotes chat", "direct message", "dm", "communication"]
    },
    {
      id: "acc-notifications",
      title: "Alerts & Notifications",
      subtitle: "Review incoming job invites, quote acceptances, and booking alerts",
      category: "Account & Profile",
      icon: Bell,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-700",
      path: "/notifications",
      keywords: ["alerts", "notifications", "bell", "updates", "reminders", "activity", "unread"]
    },

    // 2. Jobs, Quotes & Financials
    {
      id: "jobs-posted",
      title: "My Posted Jobs & Active Projects",
      subtitle: "View job status, incoming quotes, applicant profiles and schedules",
      category: "Jobs & Quotes",
      icon: FileText,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/dashboard",
      keywords: ["jobs", "posted jobs", "my jobs", "active jobs", "projects", "hiring", "applications", "contracts", "repairs"]
    },
    {
      id: "jobs-post-new",
      title: "Post a New Job (Get Free Quotes)",
      subtitle: "Describe your job, upload photos, set budgets and get matched",
      category: "Jobs & Quotes",
      icon: Sparkles,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/post-job",
      keywords: ["post job", "create job", "new job", "need trade", "hire", "quote", "get quotes", "request quote"]
    },
    {
      id: "jobs-emergency",
      title: "24/7 Rapid Emergency Dispatch",
      subtitle: "14m average arrival for burst pipes, gas leaks, power cuts & lockouts",
      category: "Jobs & Quotes",
      icon: Zap,
      iconBg: "bg-red-100",
      iconColor: "text-red-700",
      path: "/post-emergency-job",
      keywords: ["emergency", "sos", "urgent", "24/7", "burst pipe", "leak", "power cut", "lockout", "boiler breakdown", "fast fix"]
    },
    {
      id: "jobs-invoices",
      title: "TradeOS Invoices & Receipts",
      subtitle: "Create, view, download PDF invoices and track paid balances",
      category: "Jobs & Quotes",
      icon: DollarSign,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/trade-dashboard",
      keywords: ["invoices", "invoice", "receipts", "bill", "billing", "paid", "create invoice", "pdf", "vat", "tradeos"]
    },
    {
      id: "jobs-quotes",
      title: "Pending Quotes & Estimates",
      subtitle: "Compare trader quotes with breakdown of materials vs labor",
      category: "Jobs & Quotes",
      icon: Calculator,
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-700",
      path: "/dashboard",
      keywords: ["quotes", "quote", "estimates", "prices", "bids", "proposals", "compare quotes", "pricing"]
    },

    // 3. Tools & Portals
    {
      id: "tool-passport",
      title: "Property Passport & Digital Specs",
      subtitle: "Digital twin tracking EPC rating, boiler specs, CP12 & stopcock location",
      category: "Tools & Portals",
      icon: Home,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/portfolio",
      keywords: ["passport", "property passport", "portfolio", "digital twin", "epc", "boiler", "cp12", "eicr", "specs", "property"]
    },
    {
      id: "tool-tenant",
      title: "Tenant Repair & Issue Reporting",
      subtitle: "Direct repair logging with photo uploads & WhatsApp landlord bridge",
      category: "Tools & Portals",
      icon: Wrench,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/tenant-report",
      keywords: ["tenant", "tenant report", "report repair", "landlord", "broken", "leak", "mould", "damp", "rent", "property issue"]
    },
    {
      id: "tool-bnpl",
      title: "FlexiPay 0% APR Repair Financing",
      subtitle: "Spread unexpected repairs (£1,000+) over 3 to 12 months with 0% APR",
      category: "Tools & Portals",
      icon: CreditCard,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-700",
      action: () => setShowBnplModal(true),
      keywords: ["flexipay", "bnpl", "financing", "finance", "spread cost", "monthly payments", "0% apr", "loan", "installments"]
    },
    {
      id: "tool-deals",
      title: "Quiet Period Off-Peak Flash Deals",
      subtitle: "Create or browse weekday discounted booking slots (up to 30% off)",
      category: "Tools & Portals",
      icon: Sparkles,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/trade-dashboard",
      keywords: ["flash deals", "deals", "discounts", "off-peak", "quiet period", "offers", "promotions", "cheap", "save"]
    },
    {
      id: "tool-gotham",
      title: "Gotham B2B Housing & Council Portal",
      subtitle: "Enterprise command layer for social housing, SLAs and portfolio maintenance",
      category: "Tools & Portals",
      icon: Layers,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-800",
      path: "/corporate",
      keywords: ["gotham", "b2b", "housing association", "council", "portfolio", "social housing", "enterprise", "sla", "awaab"]
    },
    {
      id: "tool-driver",
      title: "AnyRoller Rides & Driver Terminal",
      subtitle: "On-demand taxi booking, live GPS tracking, and driver navigation",
      category: "Tools & Portals",
      icon: Truck,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/driver-terminal",
      keywords: ["taxi", "ride", "rides", "anyroller", "driver", "cab", "transport", "terminal", "book taxi"]
    },

    // 4. Services & Trades
    {
      id: "trade-courier",
      title: "On-Demand Delivery & Bulky Appliance Courier",
      subtitle: "Washing machines, fridges, store pickups, furniture & same-day van dispatch",
      category: "Services & Trades",
      icon: Truck,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/find-trades?category=On-Demand Delivery & Bulky Goods Courier",
      keywords: ["courier", "van", "delivery", "bulky", "appliance", "washing machine", "fridge", "sofa", "ikea", "transport"]
    },
    {
      id: "trade-labour",
      title: "General Labour, Trade Mates & Site Helpers",
      subtitle: "Manual assistance, trenching, material offloading, demolition & skip loading",
      category: "Services & Trades",
      icon: Wrench,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/find-trades?category=General Labour, Trade Mates & Site Helpers",
      keywords: ["labour", "general labour", "trade mate", "site helper", "helper", "digging", "offloading", "demolition", "skip"]
    },
    {
      id: "trade-bin",
      title: "Wheelie Bin Cleaning Services",
      subtitle: "Domestic and commercial mobile wheelie bin washing & disinfection",
      category: "Services & Trades",
      icon: Wrench,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/find-trades?search=Wheelie Bin Cleaning",
      keywords: ["bin", "wheelie bin", "bin cleaning", "washing", "disinfect", "rubbish", "refuse"]
    },
    {
      id: "trade-plumbing",
      title: "Plumbing & Heating Engineers",
      subtitle: "Leak repairs, boiler servicing, bathroom fitting & radiator replacements",
      category: "Services & Trades",
      icon: Wrench,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/find-trades?category=Plumbing & Heating",
      keywords: ["plumber", "plumbing", "boiler", "gas safe", "leak", "radiator", "tap", "heating", "pipes"]
    },
    {
      id: "trade-electrical",
      title: "Electricians & EV Charger Installation",
      subtitle: "Fuse boxes, rewiring, NICEIC certifications, smart lighting & OZEV chargers",
      category: "Services & Trades",
      icon: Zap,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/find-trades?category=Electrical & Smart Home",
      keywords: ["electrician", "electrical", "ev charger", "fuse box", "rewire", "lights", "niceic", "smart home", "socket"]
    },

    // 5. Help & Safety
    {
      id: "help-shutoff",
      title: "Emergency Water & Gas Shutoff Guide",
      subtitle: "Interactive steps to isolate stopcocks, gas valves, and fusebox RCDs",
      category: "Help & Safety",
      icon: ShieldAlert,
      iconBg: "bg-red-100",
      iconColor: "text-red-700",
      action: () => setShowEmergencyGuide(true),
      keywords: ["shutoff", "water shutoff", "gas valve", "stopcock", "fusebox", "rcd", "breaker", "safety", "emergency guide"]
    },
    {
      id: "help-escrow",
      title: "Milestone Escrow & Payment Protection",
      subtitle: "Learn how funds are held securely until work is inspected and approved",
      category: "Help & Safety",
      icon: Shield,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/payment-protection",
      keywords: ["escrow", "protection", "payment protection", "milestone", "refund", "dispute", "safety", "guarantee"]
    }
  ], []);

  // Filtered results based on query
  const filteredResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Return top priority quick links when input is empty but opened
      return searchIndex.slice(0, 6);
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);

    return searchIndex.filter(item => {
      const matchTitle = tokens.every(token => item.title.toLowerCase().includes(token));
      const matchSubtitle = tokens.every(token => item.subtitle.toLowerCase().includes(token));
      const matchKeywords = tokens.some(token => 
        item.keywords.some(k => k.toLowerCase().includes(token))
      );
      const matchCategory = tokens.some(token => item.category.toLowerCase().includes(token));

      return matchTitle || matchSubtitle || matchKeywords || matchCategory;
    });
  }, [query, searchIndex]);

  // Group filtered results by category
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: SearchItem[] } = {};
    filteredResults.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredResults]);

  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className={`relative flex items-center justify-center min-w-0 ${isOpen ? "z-[75]" : ""}`} ref={containerRef}>
      {/* Header Search Box Bar */}
      <div 
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`h-9 sm:h-11 px-2.5 sm:px-3.5 rounded-[14px] bg-white border border-black shadow-sm flex items-center gap-2 cursor-pointer transition-all duration-200 hover:border-black hover:bg-slate-50 w-36 xs:w-44 sm:w-64 md:w-80 lg:w-96 relative z-[75] ${
          isOpen ? "ring-2 ring-blue-500/40 bg-white" : ""
        }`}
      >
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search account, jobs, tools..."
          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-500 focus:outline-hidden truncate"
        />
        {query ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 text-[10px] shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-300 rounded-[6px] shrink-0">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Search Dropdown / Results Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop: starts below header so the search bar and header are NEVER dimmed or grayed out */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed top-16 inset-x-0 bottom-0 z-[60] bg-black/40 sm:bg-black/20"
            />

            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed top-[68px] sm:top-[72px] left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[500px] max-w-[calc(100vw-24px)] bg-white rounded-3xl border border-black shadow-2xl z-[75] overflow-hidden flex flex-col max-h-[75vh]"
            >
              {/* Dropdown Header */}
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-black shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Search className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="text-xs font-black text-white truncate">
                    {query.trim() ? `Results for "${query}"` : "Account & Dashboard Quick Search"}
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search Results List */}
              <div className="p-2 space-y-3 overflow-y-auto flex-1 divide-y divide-slate-100">
                {filteredResults.length === 0 ? (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center">
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">No exact matches found</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Try searching for keywords like "profile", "passport", "invoices", "quotes", or a trade category.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/find-trades?search=${encodeURIComponent(query)}`);
                        }}
                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border border-black"
                      >
                        <Search className="w-3.5 h-3.5" /> Search Trade Directory for "{query}"
                      </button>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate("/dashboard");
                        }}
                        className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold flex items-center justify-center border border-black"
                      >
                        Return to Main Dashboard
                      </button>
                    </div>
                  </div>
                ) : (
                  Object.entries(groupedResults).map(([category, items]) => (
                    <div key={category} className="pt-2 first:pt-0 space-y-1">
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {category}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {items.length} {items.length === 1 ? "match" : "matches"}
                        </span>
                      </div>

                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="p-2.5 rounded-2xl hover:bg-slate-100 cursor-pointer flex items-center justify-between transition-colors group active:scale-[0.99] border border-transparent hover:border-slate-200"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 border border-black/10`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 group-hover:text-blue-700 truncate">
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate font-medium">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 shrink-0 ml-2" />
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer Shortcuts */}
              <div className="p-2.5 bg-slate-50 border-t border-black flex items-center justify-between text-[11px] text-slate-600 font-bold shrink-0">
                <span className="text-slate-500">Search anything on TradeOS</span>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/post-job");
                  }}
                  className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-extrabold hover:bg-black flex items-center gap-1 border border-black"
                >
                  Post Job <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BNPL Financing Modal */}
      {showBnplModal && (
        <BnplFinancingModal
          isOpen={showBnplModal}
          onClose={() => setShowBnplModal(false)}
          initialAmount={2000}
          jobTitle="Emergency Home Repair Financing"
        />
      )}

      {/* Emergency Shutoff Guide Modal */}
      <AnimatePresence>
        {showEmergencyGuide && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black p-6 max-w-lg w-full shadow-2xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-300 text-red-700 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Emergency Shutoff Checklist</h3>
                    <p className="text-[11px] text-slate-500">Quick steps to protect your home</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmergencyGuide(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 space-y-1">
                  <div className="flex items-center gap-2 font-black text-blue-900">
                    <span>1. Mains Water Stopcock (Burst Pipe / Leak)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Usually located under the kitchen sink, in the ground floor hallway, or near the front door. Turn it clockwise until fully closed to stop incoming water.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                  <div className="flex items-center gap-2 font-black text-amber-900">
                    <span>2. Gas Meter Emergency Valve (Smell Gas)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Located beside the gas meter. Turn the brass lever so it is at a 90° right angle to the pipe (horizontal). Open windows and do NOT touch electrical switches. Call National Gas Emergency: <strong>0800 111 999</strong>.
                  </p>
                </div>

                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-1">
                  <div className="flex items-center gap-2 font-black text-purple-900">
                    <span>3. Fuse Box / Consumer Unit (Sparks / Power Trip)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Located in hallway cupboard or under stairs. Switch off the big red master switch or toggle individual RCD circuit switches if water has contacted electrics.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowEmergencyGuide(false);
                    navigate("/post-emergency-job");
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl border border-black shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" /> Dispatch Emergency Engineer
                </button>
                <button
                  onClick={() => setShowEmergencyGuide(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-black"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
