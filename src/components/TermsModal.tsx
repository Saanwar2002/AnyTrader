import React, { useState } from "react";
import { 
  ShieldCheck, 
  X, 
  Search, 
  FileText, 
  CheckCircle2, 
  Lock, 
  Building2, 
  Car, 
  Utensils, 
  HeartHandshake, 
  Dog, 
  Truck, 
  DollarSign, 
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  CURRENT_TERMS_VERSION, 
  TERMS_LAST_UPDATED, 
  TERMS_AND_PRIVACY_SECTIONS, 
  PRIVACY_SUMMARY_POINTS,
  TermsSection
} from "../constants/termsAndPrivacy";
import { cn } from "@/src/lib/utils";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "all" | "general" | "privacy" | "trades" | "rides" | "food" | "pets" | "delivery" | "pricing";
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  initialTab = "all"
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    { id: "all", label: "All Terms", icon: FileText },
    { id: "general", label: "Core Platform & Intermediary", icon: ShieldCheck },
    { id: "pricing", label: "Fees & Pricing Tiers", icon: DollarSign },
    { id: "privacy", label: "Privacy & UK GDPR", icon: Lock },
    { id: "trades", label: "Trades & Gotham B2B", icon: Building2 },
    { id: "rides", label: "AnyRoller Rides", icon: Car },
    { id: "food", label: "Food Safety & Prep", icon: Utensils },
    { id: "pets", label: "Pet Care & Boarding", icon: Dog },
    { id: "delivery", label: "Courier & Delivery", icon: Truck },
  ];

  const filteredSections = TERMS_AND_PRIVACY_SECTIONS.filter((sec) => {
    const matchesCategory = selectedCategory === "all" || sec.category === selectedCategory;
    const matchesQuery = searchQuery === "" || 
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.content.some(line => line.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-hidden">
      <div className="bg-white w-full max-w-4xl h-[92vh] sm:h-[88vh] rounded-[24px] sm:rounded-[32px] border border-black shadow-2xl overflow-hidden flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-3.5 sm:p-5 bg-slate-900 text-white border-b border-black flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h2 className="text-sm sm:text-lg font-black text-white truncate">Master Platform Agreement & Terms</h2>
                <span className="bg-emerald-500 text-slate-950 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  v{CURRENT_TERMS_VERSION}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
                Updated: {TERMS_LAST_UPDATED} | Enforcing Multi-Portal Protections
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-black space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search legal clauses, liability terms, privacy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-black text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border border-black shrink-0",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-slate-500")} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Content - min-h-0 and flex-1 required for proper container scrolling */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 min-h-0 text-slate-800 text-xs sm:text-sm leading-relaxed">
          {/* Executive Summary Box */}
          <div className="bg-emerald-50/80 p-3.5 sm:p-5 rounded-2xl border border-emerald-300 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
              <h4 className="font-black text-emerald-950 text-xs sm:text-sm">Key Legal & Liability Takeaways</h4>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-emerald-950 font-medium text-[11px] sm:text-xs">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Pure technology venue: Direct contracts between Users & Independent Service Providers.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Unilateral right to adjust pricing tiers, subscriptions & commissions without prior notice.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>UK GDPR Compliant: Granular controls over marketing & partner data sharing in settings.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Coverage across all verticals: Trades, AnyRoller Taxi, Food, Pets, Delivery & Care.</span>
              </li>
            </ul>
          </div>

          {/* Sections list */}
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">No legal clauses match your query.</p>
              <p className="text-slate-400 text-xs">Try clearing your search term or selecting 'All Terms'.</p>
            </div>
          ) : (
            filteredSections.map((section) => {
              const isExpanded = expandedSectionId === section.id || searchQuery !== "" || selectedCategory !== "all";
              return (
                <div key={section.id} className="bg-white rounded-2xl border border-black overflow-hidden shadow-sm">
                  <button
                    onClick={() => setExpandedSectionId(isExpanded && expandedSectionId === section.id ? null : section.id)}
                    className="w-full p-3.5 sm:p-4 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors border-b border-black gap-2"
                  >
                    <span className="font-black text-slate-900 text-xs sm:text-sm leading-snug">{section.title}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-3.5 sm:p-5 space-y-2.5 bg-white border-t border-slate-100">
                      {section.content.map((paragraph, idx) => (
                        <p key={idx} className="text-slate-700 leading-relaxed font-medium text-xs sm:text-sm">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white border-t border-black flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium text-center sm:text-left">
            Official Binding Terms & Conditions of AnyTrader Platform Ecosystem.
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all border border-black shadow-md shrink-0"
          >
            Close & Return
          </button>
        </div>
      </div>
    </div>
  );
};
