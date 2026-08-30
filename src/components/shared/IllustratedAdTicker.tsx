import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Flame, 
  Zap, 
  Wrench, 
  Hammer, 
  Plug, 
  Droplets, 
  Home, 
  ShieldCheck, 
  Truck, 
  CreditCard, 
  Sparkles, 
  Key, 
  Paintbrush, 
  TreePine, 
  CheckCircle2, 
  Clock, 
  Layers, 
  BadgePercent, 
  Car, 
  FileCheck2,
  HardHat,
  Trash2,
  Building2,
  Smartphone,
  Cpu,
  Bot,
  Scale,
  Users,
  Award,
  Search,
  Calendar,
  Shovel,
  ShieldAlert,
  Shield,
  Scissors,
  Fan,
  Sun,
  Coins,
  Receipt,
  FileSpreadsheet
} from "lucide-react";
import { cn } from "@/src/lib/utils";

interface TickerItem {
  id: string;
  type: "category" | "feature" | "function";
  tag: string;
  tagClass: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  iconBgClass: string;
  term: string;
  highlight: string;
  link: string;
}

interface IllustratedAdTickerProps {
  role?: string;
}

// 1. Comprehensive Platform Trade & Service Categories Pool
const CATEGORY_POOL: TickerItem[] = [
  {
    id: "cat-kitchen",
    type: "category",
    tag: "🔥 HOT SEARCH",
    tagClass: "bg-amber-100 text-amber-950 border-amber-300",
    icon: Hammer,
    iconClass: "text-amber-700",
    iconBgClass: "bg-amber-50 border-amber-200",
    term: "Kitchen Fitting",
    highlight: "Bespoke & Pre-Built",
    link: "/find-trades?search=Kitchen Fitting",
  },
  {
    id: "cat-plumbing",
    type: "category",
    tag: "⚡ 24/7 RAPID",
    tagClass: "bg-red-100 text-red-950 border-red-300",
    icon: Wrench,
    iconClass: "text-red-600",
    iconBgClass: "bg-red-50 border-red-200",
    term: "Emergency Plumber",
    highlight: "14m Avg Dispatch",
    link: "/find-trades?search=Emergency Plumber",
  },
  {
    id: "cat-ev-charger",
    type: "category",
    tag: "⚡ OZEV GRANTS",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: Plug,
    iconClass: "text-emerald-600",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "EV Charger Installation",
    highlight: "OZEV Approved Grants",
    link: "/find-trades?search=EV Charger",
  },
  {
    id: "cat-boiler",
    type: "category",
    tag: "🔥 GAS SAFE",
    tagClass: "bg-orange-100 text-orange-950 border-orange-300",
    icon: Flame,
    iconClass: "text-orange-600",
    iconBgClass: "bg-orange-50 border-orange-200",
    term: "Boiler Service & Repair",
    highlight: "Gas Safe Verified",
    link: "/find-trades?search=Boiler",
  },
  {
    id: "cat-smart-home",
    type: "category",
    tag: "💡 NICEIC",
    tagClass: "bg-blue-100 text-blue-950 border-blue-300",
    icon: Zap,
    iconClass: "text-blue-600",
    iconBgClass: "bg-blue-50 border-blue-200",
    term: "Smart Home Wiring",
    highlight: "Automated Lighting & Audio",
    link: "/find-trades?search=Smart Home Wiring",
  },
  {
    id: "cat-general-labour",
    type: "category",
    tag: "💪 SITE HELPERS",
    tagClass: "bg-amber-100 text-amber-950 border-amber-300",
    icon: HardHat,
    iconClass: "text-amber-700",
    iconBgClass: "bg-amber-50 border-amber-200",
    term: "General Labour & Trade Mates",
    highlight: "Demolition, Offloading & Digging",
    link: "/find-trades?category=General Labour, Trade Mates & Site Helpers",
  },
  {
    id: "cat-bulky-courier",
    type: "category",
    tag: "🚚 ON-DEMAND",
    tagClass: "bg-indigo-100 text-indigo-950 border-indigo-300",
    icon: Truck,
    iconClass: "text-indigo-600",
    iconBgClass: "bg-indigo-50 border-indigo-200",
    term: "Appliance & Van Courier",
    highlight: "Bulky Item Same-Day Delivery",
    link: "/find-trades?category=On-Demand Delivery & Bulky Goods Courier",
  },
  {
    id: "cat-bin-cleaning",
    type: "category",
    tag: "✨ ECO WASH",
    tagClass: "bg-teal-100 text-teal-950 border-teal-300",
    icon: Trash2,
    iconClass: "text-teal-700",
    iconBgClass: "bg-teal-50 border-teal-200",
    term: "Mobile Wheelie Bin Cleaning",
    highlight: "Domestic & Commercial Bin Wash",
    link: "/find-trades?search=Wheelie Bin Cleaning",
  },
  {
    id: "cat-roofing",
    type: "category",
    tag: "🏠 STORM PROOF",
    tagClass: "bg-rose-100 text-rose-950 border-rose-300",
    icon: Home,
    iconClass: "text-rose-600",
    iconBgClass: "bg-rose-50 border-rose-200",
    term: "Roof Tile & Leak Repair",
    highlight: "Storm Damage & Chimneys",
    link: "/find-trades?search=Roofing",
  },
  {
    id: "cat-leak-detection",
    type: "category",
    tag: "💧 ACOUSTIC",
    tagClass: "bg-cyan-100 text-cyan-950 border-cyan-300",
    icon: Droplets,
    iconClass: "text-cyan-600",
    iconBgClass: "bg-cyan-50 border-cyan-200",
    term: "Leak Detection & Repair",
    highlight: "Non-Invasive Acoustic Scan",
    link: "/find-trades?search=Leak Detection",
  },
  {
    id: "cat-decorating",
    type: "category",
    tag: "🎨 PRO FINISH",
    tagClass: "bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300",
    icon: Paintbrush,
    iconClass: "text-fuchsia-600",
    iconBgClass: "bg-fuchsia-50 border-fuchsia-200",
    term: "Painting & Decorating",
    highlight: "Interior & Exterior Finish",
    link: "/find-trades?search=Painting",
  },
  {
    id: "cat-tree-surgery",
    type: "category",
    tag: "🌳 NPTC SURGEON",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: TreePine,
    iconClass: "text-emerald-700",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "Tree Surgery & Pruning",
    highlight: "NPTC Qualified Surgeons",
    link: "/find-trades?search=Tree Surgery",
  },
  {
    id: "cat-locksmith",
    type: "category",
    tag: "🔒 24/7 LOCKOUT",
    tagClass: "bg-amber-100 text-amber-950 border-amber-300",
    icon: Key,
    iconClass: "text-amber-700",
    iconBgClass: "bg-amber-50 border-amber-200",
    term: "Locksmith & Security",
    highlight: "Emergency Lockout & Ultion Locks",
    link: "/find-trades?search=Locksmith",
  },
  {
    id: "cat-heat-pumps",
    type: "category",
    tag: "🌿 ECO HEATING",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: Fan,
    iconClass: "text-emerald-700",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "Heat Pumps & Air Conditioning",
    highlight: "MCS Certified Installations",
    link: "/find-trades?search=Air Conditioning",
  },
  {
    id: "cat-solar",
    type: "category",
    tag: "☀️ SOLAR PV",
    tagClass: "bg-yellow-100 text-yellow-950 border-yellow-300",
    icon: Sun,
    iconClass: "text-yellow-700",
    iconBgClass: "bg-yellow-50 border-yellow-200",
    term: "Solar Panels & Battery Storage",
    highlight: "Cut Bills & Store Green Energy",
    link: "/find-trades?search=Solar",
  },
  {
    id: "cat-tailoring",
    type: "category",
    tag: "✂️ BESPOKE",
    tagClass: "bg-purple-100 text-purple-950 border-purple-300",
    icon: Scissors,
    iconClass: "text-purple-700",
    iconBgClass: "bg-purple-50 border-purple-200",
    term: "Tailoring & Alterations",
    highlight: "Suit Fitting & Bridal Care",
    link: "/find-trades?category=Tailoring, Alterations & Laundry Services",
  },
  {
    id: "cat-landscaping",
    type: "category",
    tag: "🌿 GARDEN DESIGN",
    tagClass: "bg-lime-100 text-lime-950 border-lime-300",
    icon: Shovel,
    iconClass: "text-lime-700",
    iconBgClass: "bg-lime-50 border-lime-200",
    term: "Landscaping & Patios",
    highlight: "Porcelain Paving & Turf",
    link: "/find-trades?search=Landscaping",
  }
];

// 2. Platform Core Features & Tools Pool
const FEATURE_POOL: TickerItem[] = [
  {
    id: "feat-passport",
    type: "feature",
    tag: "📱 DIGITAL TWIN",
    tagClass: "bg-purple-100 text-purple-950 border-purple-300",
    icon: FileCheck2,
    iconClass: "text-purple-600",
    iconBgClass: "bg-purple-50 border-purple-200",
    term: "Property Passport",
    highlight: "Instant Digital Specs & CP12 Expiry",
    link: "/property-passports",
  },
  {
    id: "feat-flexipay",
    type: "feature",
    tag: "💳 0% APR FINANCING",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: CreditCard,
    iconClass: "text-emerald-700",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "FlexiPay Repair BNPL",
    highlight: "Spread Costs 3–12 Mo (0% APR)",
    link: "/payment-protection",
  },
  {
    id: "feat-ai-quote",
    type: "feature",
    tag: "🤖 PRICE GUIDE",
    tagClass: "bg-blue-100 text-blue-950 border-blue-300",
    icon: Bot,
    iconClass: "text-blue-600",
    iconBgClass: "bg-blue-50 border-blue-200",
    term: "AI Pre-Quote Transparency",
    highlight: "Real-Time UK Benchmark Pricing",
    link: "/post-job",
  },
  {
    id: "feat-matching",
    type: "feature",
    tag: "🎯 40+ SIGNALS",
    tagClass: "bg-violet-100 text-violet-950 border-violet-300",
    icon: Cpu,
    iconClass: "text-violet-700",
    iconBgClass: "bg-violet-50 border-violet-200",
    term: "Intelligent Trader Match",
    highlight: "Reputation, Proximity & Skills Match",
    link: "/find-trades",
  },
  {
    id: "feat-video-badge",
    type: "feature",
    tag: "🎥 VIDEO VERIFIED",
    tagClass: "bg-amber-100 text-amber-950 border-amber-300",
    icon: Sparkles,
    iconClass: "text-amber-600",
    iconBgClass: "bg-amber-50 border-amber-200",
    term: "Trader Video Credentials",
    highlight: "15s Intro Videos (+35 Match Points)",
    link: "/find-trades",
  },
  {
    id: "feat-privacy-bridge",
    type: "feature",
    tag: "🔒 PRIVACY BRIDGE",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: ShieldCheck,
    iconClass: "text-emerald-700",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "WhatsApp Privacy Share",
    highlight: "Share Quotes & Specs Without Phone Numbers",
    link: "/dashboard",
  },
  {
    id: "feat-tenant-bridge",
    type: "feature",
    tag: "🏢 TENANT PORTAL",
    tagClass: "bg-sky-100 text-sky-950 border-sky-300",
    icon: Smartphone,
    iconClass: "text-sky-600",
    iconBgClass: "bg-sky-50 border-sky-200",
    term: "Tenant Repair Reporting",
    highlight: "Direct Passport Logging & Fast Fixes",
    link: "/tenant-report",
  },
  {
    id: "feat-gotham",
    type: "feature",
    tag: "🏛️ SOCIAL HOUSING",
    tagClass: "bg-indigo-100 text-indigo-950 border-indigo-300",
    icon: Building2,
    iconClass: "text-indigo-600",
    iconBgClass: "bg-indigo-50 border-indigo-200",
    term: "Gotham B2B Housing Layer",
    highlight: "2h SLA Dispatch & Portfolio SaaS",
    link: "/corporate",
  },
  {
    id: "feat-materials-ai",
    type: "feature",
    tag: "📦 AI SOURCING",
    tagClass: "bg-amber-100 text-amber-950 border-amber-300",
    icon: Layers,
    iconClass: "text-amber-700",
    iconBgClass: "bg-amber-50 border-amber-200",
    term: "Materials AI Procurement",
    highlight: "Automated Lists & Trade Pricing",
    link: "/dashboard",
  },
  {
    id: "feat-rides",
    type: "feature",
    tag: "🚖 ANYROLLER",
    tagClass: "bg-amber-200 text-black border-black/40",
    icon: Car,
    iconClass: "text-black",
    iconBgClass: "bg-amber-100 border-amber-300",
    term: "AnyRoller Rides & Taxis",
    highlight: "12% Flat Commission • Zero Shift Fees",
    link: "/rides",
  }
];

// 3. Platform Functions & Safety Guarantees Pool
const FUNCTION_POOL: TickerItem[] = [
  {
    id: "func-zero-lead",
    type: "function",
    tag: "⭐ ZERO LEAD FEES",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: BadgePercent,
    iconClass: "text-emerald-700",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "TradeOS Zero Lead Fees",
    highlight: "Traders Only Pay on Completed Work",
    link: "/pricing",
  },
  {
    id: "func-tax-reserve",
    type: "function",
    tag: "💼 TRADEOS TAX",
    tagClass: "bg-amber-100 text-amber-950 border-amber-300",
    icon: Receipt,
    iconClass: "text-amber-700",
    iconBgClass: "bg-amber-50 border-amber-200",
    term: "Auto Tax & NI Reserves",
    highlight: "UK Sole Trader Self-Assessment Ready",
    link: "/dashboard",
  },
  {
    id: "func-shield",
    type: "function",
    tag: "🛡️ 14-DAY COOLING",
    tagClass: "bg-rose-100 text-rose-950 border-rose-300",
    icon: ShieldAlert,
    iconClass: "text-rose-700",
    iconBgClass: "bg-rose-50 border-rose-200",
    term: "Anti-Serial Complainer Shield",
    highlight: "Fair Review Dispute Protection",
    link: "/dashboard",
  },
  {
    id: "func-escrow",
    type: "function",
    tag: "🔒 100% PROTECTED",
    tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
    icon: Shield,
    iconClass: "text-emerald-700",
    iconBgClass: "bg-emerald-50 border-emerald-200",
    term: "Milestone Escrow Protection",
    highlight: "Funds Held Securely Until Job Approval",
    link: "/payment-protection",
  },
  {
    id: "func-compliance",
    type: "function",
    tag: "🛡️ COMPLIANCE",
    tagClass: "bg-yellow-100 text-yellow-950 border-yellow-300",
    icon: ShieldCheck,
    iconClass: "text-yellow-700",
    iconBgClass: "bg-yellow-50 border-yellow-200",
    term: "EICR & CP12 Safety Checks",
    highlight: "1-Click Landlord Compliance Auto-Booking",
    link: "/property-passports",
  },
  {
    id: "func-driver-ratings",
    type: "function",
    tag: "⭐ MUTUAL FAIRNESS",
    tagClass: "bg-sky-100 text-sky-950 border-sky-300",
    icon: Award,
    iconClass: "text-sky-600",
    iconBgClass: "bg-sky-50 border-sky-200",
    term: "Post-Ride Mutual Reviews",
    highlight: "5-Star Driver & Passenger Fairness Engine",
    link: "/rides",
  }
];

// Helper to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function IllustratedAdTicker({ role = "homeowner" }: IllustratedAdTickerProps) {
  const navigate = useNavigate();

  const isTrader = role === "tradesperson";

  // Dynamically assemble and randomize categories, features, and functions
  const tickerItems: TickerItem[] = useMemo(() => {
    const shuffledCategories = shuffleArray(CATEGORY_POOL);
    const shuffledFeatures = shuffleArray(FEATURE_POOL);
    const shuffledFunctions = shuffleArray(FUNCTION_POOL);

    // Trader-specific priority items if in tradesperson mode
    const traderCallouts: TickerItem[] = isTrader
      ? [
          {
            id: "trader-priority-zero-lead",
            type: "function",
            tag: "⭐ 0 LEAD FEES",
            tagClass: "bg-emerald-100 text-emerald-950 border-emerald-300",
            icon: BadgePercent,
            iconClass: "text-emerald-700",
            iconBgClass: "bg-emerald-50 border-emerald-200",
            term: "TradeOS Zero Lead Fees",
            highlight: "Only Pay On Completed Jobs",
            link: "/pricing",
          },
          {
            id: "trader-priority-video",
            type: "feature",
            tag: "🎥 +35 MATCH PTS",
            tagClass: "bg-blue-100 text-blue-950 border-blue-300",
            icon: Sparkles,
            iconClass: "text-blue-600",
            iconBgClass: "bg-blue-50 border-blue-200",
            term: "Video Credential Badge",
            highlight: "Boost Homeowner Inquiries & Trust",
            link: "/profile",
          }
        ]
      : [];

    // Interleave randomized items for a balanced showcase: Category -> Feature -> Function
    const combinedList: TickerItem[] = [...traderCallouts];
    const maxLength = Math.max(shuffledCategories.length, shuffledFeatures.length, shuffledFunctions.length);

    for (let i = 0; i < maxLength; i++) {
      if (shuffledCategories[i]) combinedList.push(shuffledCategories[i]);
      if (shuffledFeatures[i]) combinedList.push(shuffledFeatures[i]);
      if (shuffledFunctions[i]) combinedList.push(shuffledFunctions[i]);
    }

    return combinedList;
  }, [isTrader]);

  const handleItemClick = (item: TickerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <div 
      className="w-full overflow-hidden select-none py-1 mb-0 relative pointer-events-auto group/ticker"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
      }}
      title="Platform categories, smart features & tools — click any item to explore"
    >
      <div className="animate-ticker-slow flex items-center will-change-transform">
        {/* First copy of items */}
        <div className="flex items-center shrink-0">
          {tickerItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={`item-1-${item.id}-${idx}`}
                onClick={(e) => handleItemClick(item, e)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full hover:bg-slate-100/80 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {/* Illustrated Icon Badge */}
                <span className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 shadow-2xs", item.iconBgClass)}>
                  <Icon className={cn("w-3 h-3", item.iconClass)} />
                </span>

                {/* Illustrated Micro Tag */}
                <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border leading-none shrink-0 tracking-tight", item.tagClass)}>
                  {item.tag}
                </span>

                {/* Term & Highlight */}
                <span className="text-[11px] sm:text-xs font-black text-black tracking-tight leading-none whitespace-nowrap">
                  {item.term}
                </span>
                <span className="text-[11px] sm:text-xs font-black text-blue-700 underline decoration-blue-300 decoration-1 underline-offset-2 tracking-tight leading-none whitespace-nowrap">
                  {item.highlight}
                </span>

                {/* Illustrated Separator */}
                <Sparkles className="w-2.5 h-2.5 text-amber-400/90 fill-amber-300/40 shrink-0 ml-3 mr-1" />
              </div>
            );
          })}
        </div>

        {/* Second copy of items for seamless infinite marquee loop */}
        <div className="flex items-center shrink-0" aria-hidden="true">
          {tickerItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={`item-2-${item.id}-${idx}`}
                onClick={(e) => handleItemClick(item, e)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full hover:bg-slate-100/80 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {/* Illustrated Icon Badge */}
                <span className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 shadow-2xs", item.iconBgClass)}>
                  <Icon className={cn("w-3 h-3", item.iconClass)} />
                </span>

                {/* Illustrated Micro Tag */}
                <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border leading-none shrink-0 tracking-tight", item.tagClass)}>
                  {item.tag}
                </span>

                {/* Term & Highlight */}
                <span className="text-[11px] sm:text-xs font-black text-black tracking-tight leading-none whitespace-nowrap">
                  {item.term}
                </span>
                <span className="text-[11px] sm:text-xs font-black text-blue-700 underline decoration-blue-300 decoration-1 underline-offset-2 tracking-tight leading-none whitespace-nowrap">
                  {item.highlight}
                </span>

                {/* Illustrated Separator */}
                <Sparkles className="w-2.5 h-2.5 text-amber-400/90 fill-amber-300/40 shrink-0 ml-3 mr-1" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
