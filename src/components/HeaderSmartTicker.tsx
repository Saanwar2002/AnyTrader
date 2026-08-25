import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "./AuthProvider";
import { usePortal } from "@/src/lib/PortalContext";
import { cn } from "@/src/lib/utils";

interface TextSticker {
  id: string;
  cardBg: string;
  titleColor: string;
  tagColor: string;
  tag: string;
  title: string;
  subtext?: string;
}

// Master pool of popular UK trade and home maintenance hot search queries
const MASTER_HOT_SEARCHES = [
  { term: "Emergency Plumber", highlight: "24/7 Rapid Callout", category: "Plumbing" },
  { term: "Boiler Service & Repair", highlight: "Gas Safe Verified", category: "Heating" },
  { term: "Kitchen Fitting", highlight: "Bespoke & Pre-Built", category: "Carpentry" },
  { term: "Smart Home Wiring", highlight: "Automated Lighting & Audio", category: "Electrical" },
  { term: "Full House Rewiring", highlight: "NICEIC Certified", category: "Electrical" },
  { term: "Leak Detection & Repair", highlight: "Non-Invasive Acoustic", category: "Plumbing" },
  { term: "EV Charger Installation", highlight: "OZEV Approved Grants", category: "Electrical" },
  { term: "Bathroom Renovation", highlight: "Tiling, Suites & Wetrooms", category: "Bathrooms" },
  { term: "Roof Tile & Leak Repair", highlight: "Storm Damage & Chimneys", category: "Roofing" },
  { term: "Gutter Cleaning & Clearance", highlight: "Vacuum & Downpipes", category: "Roofing" },
  { term: "Plastering & Skimming", highlight: "Smooth Finish & Drywall", category: "Plastering" },
  { term: "Garden Fencing & Gates", highlight: "Storm Proof Timber & Composite", category: "Landscaping" },
  { term: "Drain Jetting & Unblocking", highlight: "CCTV Camera Surveys", category: "Drainage" },
  { term: "EICR Safety Inspection", highlight: "Landlord Compliance", category: "Electrical" },
  { term: "Gas Safety Certificate CP12", highlight: "Annual Boiler Check", category: "Gas" },
  { term: "Appliance & Van Courier", highlight: "Bulky Item Transport", category: "Couriers" },
  { term: "General Labour & Mate", highlight: "Site Helpers & Strip-Out", category: "Labour" },
  { term: "Shop Signs & Graphics", highlight: "Fascias & Display Boards", category: "Signage" },
  { term: "Tree Surgery & Pruning", highlight: "NPTC Qualified Surgeons", category: "Tree Care" },
  { term: "Mobile Wheelie Bin Wash", highlight: "Eco Disinfection & Deodorise", category: "Cleaning" },
  { term: "Double Glazing & Windows", highlight: "A-Rated Energy Efficient", category: "Glazing" },
  { term: "Locksmith & Security", highlight: "Emergency Lockout & Ultion", category: "Security" },
  { term: "Damp & Mould Treatment", highlight: "Awaab's Law Compliant", category: "Damp" },
  { term: "Air Conditioning & HVAC", highlight: "Heat Pump & Climate Control", category: "HVAC" },
  { term: "Carpet & Upholstery Clean", highlight: "Deep Steam Extraction", category: "Cleaning" },
  { term: "Painting & Decorating", highlight: "Interior & Exterior Finish", category: "Decorating" },
  { term: "Bricklaying & Repointing", highlight: "Lime Mortar & Walls", category: "Masonry" },
  { term: "Tile & Stone Laying", highlight: "Porcelain, Marble & Wetrooms", category: "Tiling" },
  { term: "Pest Control", highlight: "Wasps, Rodents & Birds", category: "Pest Control" },
  { term: "Scaffolding Erection", highlight: "CITB Certified Access", category: "Scaffolding" },
  { term: "Driveway Jet Washing", highlight: "Block Paving & Resanding", category: "Cleaning" }
];

/**
 * Selects 10 deterministic hot searches per day using a date-based pseudo-random hash
 */
function getDailyHotSearches(pool: typeof MASTER_HOT_SEARCHES, count = 10): typeof MASTER_HOT_SEARCHES {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  let seed = 0;
  for (let i = 0; i < todayStr.length; i++) {
    seed = (seed * 31 + todayStr.charCodeAt(i)) & 0xffffffff;
  }

  const items = [...pool];
  for (let i = items.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items.slice(0, count);
}

export function HeaderSmartTicker() {
  const { profile } = useAuth();
  const { activePortal } = usePortal();

  const [currentIndex, setCurrentIndex] = useState(0);

  const isDriver = profile?.role === "driver" || profile?.role === "fleet_driver";
  const isTrader = profile?.role === "tradesperson";
  const isBusiness = profile?.role === "business" || profile?.subscriptionType === "business";
  const isRidesPortal = activePortal === "anyroller" || isDriver;

  // Compute 10 daily hot searches
  const dailyHotSearches = useMemo(() => getDailyHotSearches(MASTER_HOT_SEARCHES, 10), []);

  const getStickers = (): TextSticker[] => {
    // Generate 10 Hot Search Stickers for today
    const hotStickers: TextSticker[] = dailyHotSearches.map((item, idx) => ({
      id: `daily-hot-${idx}`,
      cardBg: idx % 3 === 0 ? "bg-orange-50" : idx % 3 === 1 ? "bg-amber-50" : "bg-red-50",
      tagColor: idx % 3 === 0 ? "text-orange-950 bg-orange-200/90" : idx % 3 === 1 ? "text-amber-950 bg-amber-200/90" : "text-red-950 bg-red-200/90",
      titleColor: "text-black",
      tag: "🔥 HOT SEARCH",
      title: `${item.term} • ${item.highlight}`,
      subtext: `Trending in ${item.category} today`,
    }));

    if (isRidesPortal) {
      const ridesCore: TextSticker[] = [
        {
          id: "rides-comm",
          cardBg: "bg-amber-50",
          tagColor: "text-amber-900 bg-amber-200/90",
          titleColor: "text-black",
          tag: "12% FLAT",
          title: "Zero Weekly Shift Fees",
        },
        {
          id: "rides-safe",
          cardBg: "bg-blue-50",
          tagColor: "text-blue-900 bg-blue-200/90",
          titleColor: "text-black",
          tag: "SAFE UK",
          title: "24/7 Live GPS Journey Share",
        },
        {
          id: "rides-van",
          cardBg: "bg-purple-50",
          tagColor: "text-purple-900 bg-purple-200/90",
          titleColor: "text-black",
          tag: "COURIER",
          title: "Bulky Item & Van Transport",
        },
      ];
      // Interleave rides value props with hot searches
      return [...ridesCore, ...hotStickers];
    }

    if (isTrader) {
      const traderCore: TextSticker[] = [
        {
          id: "trader-pay-on-win",
          cardBg: "bg-emerald-50",
          tagColor: "text-emerald-900 bg-emerald-200/90",
          titleColor: "text-black",
          tag: "0 LEAD FEES",
          title: "Only Pay On Completed Jobs",
        },
        {
          id: "trader-video",
          cardBg: "bg-blue-50",
          tagColor: "text-blue-900 bg-blue-200/90",
          titleColor: "text-black",
          tag: "+35 PTS",
          title: "15s Video Selfie Badge",
        },
        {
          id: "trader-tax",
          cardBg: "bg-amber-50",
          tagColor: "text-amber-950 bg-amber-200/90",
          titleColor: "text-black",
          tag: "TRADEOS",
          title: "Auto Tax & NI Reserves",
        },
        {
          id: "trader-sched",
          cardBg: "bg-indigo-50",
          tagColor: "text-indigo-900 bg-indigo-200/90",
          titleColor: "text-black",
          tag: "AUTO-SYNC",
          title: "Live Calendar Scheduling",
        },
        {
          id: "trader-shield",
          cardBg: "bg-rose-50",
          tagColor: "text-rose-900 bg-rose-200/90",
          titleColor: "text-black",
          tag: "PROTECTED",
          title: "Anti-Serial Complainer Shield",
        },
      ];
      return [...traderCore, ...hotStickers];
    }

    if (isBusiness) {
      const bizCore: TextSticker[] = [
        {
          id: "biz-comp",
          cardBg: "bg-emerald-50",
          tagColor: "text-emerald-900 bg-emerald-200/90",
          titleColor: "text-black",
          tag: "100% VALID",
          title: "CP12 & EICR Compliance Vault",
        },
        {
          id: "biz-gotham",
          cardBg: "bg-purple-50",
          tagColor: "text-purple-900 bg-purple-200/90",
          titleColor: "text-black",
          tag: "GOTHAM SLA",
          title: "Awaab's Law 2h SLA Engine",
        },
        {
          id: "biz-tenant",
          cardBg: "bg-sky-50",
          tagColor: "text-sky-900 bg-sky-200/90",
          titleColor: "text-black",
          tag: "TENANT HUB",
          title: "Direct WhatsApp Repair Bridge",
        },
      ];
      return [...bizCore, ...hotStickers];
    }

    // Default Homeowner / Guest Core Showcase
    const homeCore: TextSticker[] = [
      {
        id: "home-emergency",
        cardBg: "bg-red-50",
        tagColor: "text-red-900 bg-red-200/90",
        titleColor: "text-black",
        tag: "⚡ 14M AVG",
        title: "Fast Emergency Dispatch",
      },
      {
        id: "home-flexipay",
        cardBg: "bg-emerald-50",
        tagColor: "text-emerald-900 bg-emerald-200/90",
        titleColor: "text-black",
        tag: "0% APR",
        title: "FlexiPay 3–12 Mo Financing",
      },
      {
        id: "home-passport",
        cardBg: "bg-purple-50",
        tagColor: "text-purple-900 bg-purple-200/90",
        titleColor: "text-black",
        tag: "FREE SPECS",
        title: "Property Passport Digital Twin",
      },
      {
        id: "home-vetted",
        cardBg: "bg-amber-50",
        tagColor: "text-amber-950 bg-amber-200/90",
        titleColor: "text-black",
        tag: "FREE QUOTES",
        title: "100% Free For Homeowners",
      },
      {
        id: "home-ai",
        cardBg: "bg-blue-50",
        tagColor: "text-blue-900 bg-blue-200/90",
        titleColor: "text-black",
        tag: "AI GUIDE",
        title: "Real-Time UK Price Estimator",
      },
      {
        id: "home-rides",
        cardBg: "bg-slate-100",
        tagColor: "text-black bg-amber-300",
        titleColor: "text-black",
        tag: "RIDES & VAN",
        title: "AnyRoller Rides & Couriers",
      },
    ];

    // Interleave home value props with the 10 hot search stickers
    return [...homeCore, ...hotStickers];
  };

  const stickers = getStickers();

  // Smooth continuous cycling between cards every 6.8 seconds
  useEffect(() => {
    if (stickers.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stickers.length);
    }, 6800);
    return () => clearInterval(timer);
  }, [stickers.length]);

  const activeSticker = stickers[currentIndex] || stickers[0];

  return (
    <div 
      className="flex-1 mx-1 min-w-0 max-w-full select-none pointer-events-none"
      aria-label="Platform Feature Spotlight"
    >
      <div 
        className={cn(
          "w-full h-10 sm:h-11 px-1.5 rounded-[14px] border border-black shadow-xs flex items-center transition-colors duration-500 overflow-hidden relative",
          activeSticker.cardBg
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeSticker.id}-${currentIndex}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full h-full flex items-center overflow-hidden"
          >
            {/* Single Line: Centered Tag + Title Scrolling Right to Left */}
            <div className="w-full overflow-hidden flex items-center">
              <motion.div
                key={`line1-${activeSticker.id}-${currentIndex}`}
                initial={{ x: "0%" }}
                animate={{ x: "-50%" }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: 10.5,
                }}
                className="flex items-center whitespace-nowrap shrink-0 will-change-transform"
              >
                {/* Loop Segment 1 */}
                <div className="flex items-center gap-2 pr-10 shrink-0">
                  <span 
                    className={cn(
                      "text-[8.5px] sm:text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded-[5px] border border-black/40 leading-none shrink-0",
                      activeSticker.tagColor
                    )}
                  >
                    {activeSticker.tag}
                  </span>
                  <span className={cn("text-[11.5px] sm:text-[13px] font-black tracking-tight leading-none", activeSticker.titleColor)}>
                    {activeSticker.title}
                  </span>
                </div>

                {/* Loop Segment 2 (Seamless loop duplicate) */}
                <div className="flex items-center gap-2 pr-10 shrink-0">
                  <span 
                    className={cn(
                      "text-[8.5px] sm:text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded-[5px] border border-black/40 leading-none shrink-0",
                      activeSticker.tagColor
                    )}
                  >
                    {activeSticker.tag}
                  </span>
                  <span className={cn("text-[11.5px] sm:text-[13px] font-black tracking-tight leading-none", activeSticker.titleColor)}>
                    {activeSticker.title}
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
