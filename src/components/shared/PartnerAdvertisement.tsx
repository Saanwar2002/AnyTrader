import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronRight, ChevronLeft, Zap, Briefcase, ShieldCheck, Star, Gift, 
  ShieldAlert, Award, FileText, Copy, Check, ExternalLink, Sparkles, 
  Tag, Percent, Wrench, Flame, ShoppingBag, CreditCard, UserCheck, CheckCircle2,
  MapPin, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, query, where, onSnapshot, doc, setDoc, increment, 
  addDoc, serverTimestamp 
} from "firebase/firestore";
import { db } from "../../firebase";
import { cn } from "../../lib/utils";
import { useAuth } from "../AuthProvider";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { INITIAL_MOCK_TRADERS, Tradesperson } from "../../services/seedService";
import { IllustratedAdTicker } from "./IllustratedAdTicker";

const iconMap: Record<string, any> = {
  Zap, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, 
  FileText, Tag, Percent, Wrench, Flame, ShoppingBag, CreditCard, UserCheck
};

export interface PartnerAdItem {
  id: string;
  title: string;
  description: string;
  url: string;
  bgColor?: string;
  gradient?: string;
  iconName?: string;
  targetRole?: string;
  targetCategories?: string[];
  type?: "partner" | "trader_promo" | "voucher" | "financing" | "verified_pro" | "business";
  isTraderAd?: boolean;
  voucherCode?: string;
  badgeLabel?: string;
  perkText?: string;
  advertiserName?: string;
  advertiserId?: string;
  advertiserUid?: string;
  imageUrl?: string;
  clicks?: number;
  bannerClicks?: number;
  costPerDisplay?: number;
  billingCycle?: string;
  prepaidBalance?: number;
  autoTopUpEnabled?: boolean;
  autoTopUpThreshold?: number;
  autoTopUpAmount?: number;
  totalBudget?: number;
  placement?: string;
  isActive?: boolean;
  approvalStatus?: string;
  endDate?: any;
}

// Built-in Default Homeowner Advertisements & Deals (Curated for Domestic Homeowners)
const DEFAULT_HOMEOWNER_ADVERTS: PartnerAdItem[] = [
  {
    id: "homeowner-trader-1",
    advertiserUid: "seed-promoted-plumber",
    title: "Elite Pro Plumbing & Heating 24/7",
    description: "Gas Safe Master Plumber. 24/7 emergency burst pipe, boiler & leak repairs in 45 mins.",
    url: "/profile/seed-promoted-plumber",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-sky-950 to-slate-900",
    iconName: "Flame",
    targetRole: "homeowner",
    targetCategories: ["Plumbing", "Gas & Heating", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "⚡ 45-Min Emergency Arrival",
    advertiserName: "Marcus Vance"
  },
  {
    id: "homeowner-trader-2",
    advertiserUid: "seed-promoted-builder",
    title: "Apex Master Builders & Roofing",
    description: "Master Builder extensions, loft conversions, structural steel & roof restorations.",
    url: "/profile/seed-promoted-builder",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-blue-950 to-slate-900",
    iconName: "Briefcase",
    targetRole: "homeowner",
    targetCategories: ["Builder", "Roofing Services", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "⭐ Federation of Master Builders",
    advertiserName: "Liam Gallagher"
  },
  {
    id: "homeowner-trader-3",
    advertiserUid: "seed-promoted-electrician",
    title: "VoltMaster Electrical & EV Charging",
    description: "NICEIC Approved Contractors. EV charger installations & 18th edition consumer unit upgrades.",
    url: "/profile/seed-promoted-electrician",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-indigo-950 to-slate-900",
    iconName: "Zap",
    targetRole: "homeowner",
    targetCategories: ["Electrical", "Smart Home & Automation", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "⚡ NICEIC Approved & EV Specialist",
    advertiserName: "Sarah Jenkins"
  },
  {
    id: "homeowner-trader-4",
    advertiserUid: "seed-promoted-locksmith",
    title: "24/7 Rapid Master Locksmiths",
    description: "20-minute emergency lockout assistance, Ultion anti-snap cylinders & high security upgrades.",
    url: "/profile/seed-promoted-locksmith",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-amber-950 to-slate-900",
    iconName: "ShieldCheck",
    targetRole: "homeowner",
    targetCategories: ["Locksmith", "Security Systems", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "⚡ 20-Min Mobile Lockout Arrival",
    advertiserName: "James Miller"
  },
  {
    id: "homeowner-trader-5",
    advertiserUid: "seed-promoted-decorator",
    title: "Heritage Luxe Painting & Decorating",
    description: "City & Guilds master painters. Heritage preservation, Farrow & Ball paint and airless spray finishes.",
    url: "/profile/seed-promoted-decorator",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-rose-950 to-slate-900",
    iconName: "Paintbrush",
    targetRole: "homeowner",
    targetCategories: ["Painting & Decorating", "Wallpapering", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "✨ Farrow & Ball Approved",
    advertiserName: "Elena Rostova"
  },
  {
    id: "homeowner-trader-6",
    advertiserUid: "seed-promoted-cleaner",
    title: "Pristine Shine Eco Cleaners",
    description: "100% deposit-back guaranteed end of tenancy cleaning, eco carpet steam & commercial sanitation.",
    url: "/profile/seed-promoted-cleaner",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-emerald-950 to-slate-900",
    iconName: "Sparkles",
    targetRole: "homeowner",
    targetCategories: ["Domestic & Commercial Cleaning", "Carpet & Upholstery Cleaning", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "🛡️ Deposit-Back Guarantee",
    advertiserName: "David O'Connor"
  },
  {
    id: "homeowner-trader-7",
    advertiserUid: "seed-promoted-baker",
    title: "Artisan Sweet & Savoury Creations",
    description: "5-Star hygiene rated luxury wedding cakes, corporate event grazing tables & private chef dining.",
    url: "/profile/seed-promoted-baker",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-fuchsia-950 to-slate-900",
    iconName: "Cake",
    targetRole: "homeowner",
    targetCategories: ["Cake Maker & Baker", "Catering & Private Chef", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "🍰 5-Star FSA Hygiene Rated",
    advertiserName: "Chloe Dupont"
  },
  {
    id: "homeowner-trader-8",
    advertiserUid: "seed-promoted-tailor",
    title: "Savile & Stitch Master Tailoring & Alterations",
    description: "Savile Row trained master tailor & seamstress. Bespoke suit fitting, bridal alterations, leather repairs & steam pressing.",
    url: "/profile/seed-promoted-tailor",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-teal-950 to-slate-900",
    iconName: "Scissors",
    targetRole: "homeowner",
    targetCategories: ["Tailoring, Alterations & Laundry Services", "Bespoke Tailoring", "Garment Alterations", "all"],
    type: "trader_promo",
    badgeLabel: "FEATURED PRO",
    perkText: "🧵 Savile Row Trained Master Tailor",
    advertiserName: "Amira Hassan"
  },
  {
    id: "homeowner-bg-1",
    title: "British Gas HomeCare & Boiler Cover",
    description: "24/7 emergency heating & plumbing breakdown cover from £13/mo. Zero excess on first callout.",
    url: "https://www.britishgas.co.uk/homecare",
    bgColor: "bg-slate-900",
    gradient: "from-slate-950 via-sky-950 to-slate-900",
    iconName: "Flame",
    targetRole: "homeowner",
    targetCategories: ["Heating & Gas", "Boiler Service & Repair", "Plumbing", "Central Heating"],
    type: "partner",
    voucherCode: "HOMECARE24",
    badgeLabel: "PROMOTED AD",
    perkText: "0% Excess First Callout",
    advertiserName: "British Gas"
  },
  {
    id: "homeowner-bnq-2",
    title: "B&Q Club · Home & Garden Savings",
    description: "Get £10 off your next £75+ purchase on home decor, bathroom suites, and garden power tools.",
    url: "https://www.diy.com",
    bgColor: "bg-orange-950",
    gradient: "from-orange-950 via-amber-950 to-slate-950",
    iconName: "ShoppingBag",
    targetRole: "homeowner",
    targetCategories: ["Gardening & Landscaping", "Bathrooms", "Kitchens", "Painting & Decorating"],
    type: "voucher",
    voucherCode: "ANYHOME10",
    badgeLabel: "PARTNER OFFER",
    perkText: "£10 Off £75+ Spend",
    advertiserName: "B&Q"
  },
  {
    id: "homeowner-flexipay-4",
    title: "FlexiPay 0% Repair Financing",
    description: "Spread urgent boiler, roofing, or electrical repair costs (£1,000+) over 3-12 months at 0% APR.",
    url: "/post-job",
    bgColor: "bg-emerald-950",
    gradient: "from-emerald-950 via-teal-950 to-slate-950",
    iconName: "CreditCard",
    targetRole: "homeowner",
    targetCategories: ["Roofing", "Electrical", "Heating & Gas", "Building & Construction"],
    type: "financing",
    voucherCode: "FLEXI0APR",
    badgeLabel: "PROMOTED AD",
    perkText: "0% APR on 3-12 Mos",
    advertiserName: "FlexiPay"
  }
];

// Built-in Default Tradesperson Advertisements & Supplies (For Contractors & Trades)
const DEFAULT_TRADESPERSON_ADVERTS: PartnerAdItem[] = [
  {
    id: "trade-toolstation-1",
    title: "Toolstation Next Day Trade Delivery",
    description: "Get 10% off your first Trade Account order + free next day site delivery over £25.",
    url: "https://www.toolstation.com",
    bgColor: "bg-blue-950",
    gradient: "from-blue-950 via-slate-900 to-sky-950",
    iconName: "Briefcase",
    targetRole: "tradesperson",
    targetCategories: ["all"],
    type: "voucher",
    voucherCode: "TOOLTRADE10",
    badgeLabel: "PROMOTED AD",
    perkText: "10% Off 1st Order",
    advertiserName: "Toolstation"
  },
  {
    id: "trade-screwfix-2",
    title: "Screwfix Trade Pro Exclusive",
    description: "Unlock trade exclusive pricing, Sprint 60-min rapid courier delivery & bulk volume discounts.",
    url: "https://www.screwfix.com",
    bgColor: "bg-red-950",
    gradient: "from-red-950 via-slate-900 to-amber-950",
    iconName: "Zap",
    targetRole: "tradesperson",
    targetCategories: ["all"],
    type: "partner",
    voucherCode: "SCREWPRO",
    badgeLabel: "PROMOTED AD",
    perkText: "Sprint 60m Delivery",
    advertiserName: "Screwfix"
  },
  {
    id: "trade-selco-3",
    title: "Selco Builders Warehouse",
    description: "Huge savings on bulk plasterboard, C16/C24 timber, bricks, sand & ready-mix cement bags.",
    url: "https://www.selcobw.com",
    bgColor: "bg-emerald-950",
    gradient: "from-emerald-950 via-slate-900 to-teal-950",
    iconName: "ShieldCheck",
    targetRole: "tradesperson",
    targetCategories: ["Building & Construction", "Plastering", "Carpentry & Joinery"],
    type: "partner",
    voucherCode: "SELCOTRADE",
    badgeLabel: "PROMOTED AD",
    perkText: "Free Site Delivery > £100",
    advertiserName: "Selco"
  },
  {
    id: "trade-tradepoint-4",
    title: "TradePoint at B&Q · Pro Cards",
    description: "Exclusive member trade rates across power tools, fixings, building materials & plumbing packs.",
    url: "https://www.trade-point.co.uk",
    bgColor: "bg-orange-950",
    gradient: "from-orange-950 via-slate-900 to-amber-950",
    iconName: "Tag",
    targetRole: "tradesperson",
    targetCategories: ["all"],
    type: "partner",
    voucherCode: "TRADEPOINT",
    badgeLabel: "PROMOTED AD",
    perkText: "Pro Card Discounts",
    advertiserName: "TradePoint"
  }
];

export default function PartnerAdvertisement({ 
  role = "tradesperson", 
  category,
  activeCategories = [],
  className
}: { 
  role?: string; 
  category?: string; 
  activeCategories?: string[];
  className?: string;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [adverts, setAdverts] = useState<PartnerAdItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(7000); // 7s comfortable read time
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [tradersMap, setTradersMap] = useState<Record<string, Tradesperson>>(() => {
    const initialMap: Record<string, Tradesperson> = {};
    INITIAL_MOCK_TRADERS.forEach((t: any) => {
      if (t.uid) initialMap[t.uid] = t;
    });
    return initialMap;
  });

  // Touch Swipe Handling
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 0. Fetch live tradespeople to enrich promoted trader profiles
    const unsubTraders = onSnapshot(query(collection(db, "users"), where("role", "==", "tradesperson")), (snapshot) => {
      if (!isMounted) return;
      const map: Record<string, Tradesperson> = {};
      INITIAL_MOCK_TRADERS.forEach((t: any) => {
        if (t.uid) map[t.uid] = t;
      });
      snapshot.docs.forEach(d => {
        map[d.id] = { uid: d.id, ...d.data() } as Tradesperson;
      });
      setTradersMap(map);
    }, (error) => {
      console.warn("Tradespeople query notice:", error);
    });

    // 1. Global config (ad rotation speed)
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (docSnapshot) => {
      if (!isMounted) return;
      if (docSnapshot.exists()) {
        const config = docSnapshot.data();
        if (config.adRotationSpeedSeconds) {
          setRotationSpeed(Math.max(5, config.adRotationSpeedSeconds) * 1000);
        }
      }
    }, (error) => {
      console.warn("Platform Config Notice:", error);
    });

    // 2. Advertising master switch
    const unsubAdConfig = onSnapshot(doc(db, "platform_config", "advertising"), (docSnapshot) => {
      if (!isMounted) return;
      if (docSnapshot.exists()) {
        setIsBannerAdsEnabled(docSnapshot.data().isBannerAdsEnabled !== false);
      }
    }, (error) => {
      console.warn("Advertising Config Notice:", error);
    });

    // 3. Live advertisements query from Firestore (Traders, Trade Partners & Corporate Sponsors)
    const unsubs = onSnapshot(query(collection(db, "advertisements")), (snapshot) => {
      if (!isMounted) return;
      const activeAds: PartnerAdItem[] = snapshot.docs
        .map(d => {
          const data = d.data() as any;
          return { id: d.id, ...data } as PartnerAdItem;
        })
        // Filter out inactive ads
        .filter(ad => ad.isActive !== false)
        // Filter out rejected ads
        .filter(ad => ad.approvalStatus !== "rejected")
        // Placement check: banner_ad, both, or backward-compatible undefined
        .filter(ad => !ad.placement || ad.placement === "banner_ad" || ad.placement === "both")
        // Expiration check for day-based campaigns
        .filter(ad => {
           if (ad.type === "trader_promo" && ad.endDate) {
              const endMillis = ad.endDate.toMillis ? ad.endDate.toMillis() : (ad.endDate.seconds ? ad.endDate.seconds * 1000 : new Date(ad.endDate).getTime());
              if (Date.now() > endMillis) return false;
           }
           return true;
        })
        // Prepaid budget check: if prepaid balance is <= 0, hide
        .filter(ad => {
          if (ad.billingCycle === "prepaid" && typeof ad.prepaidBalance === "number") {
            return ad.prepaidBalance > 0;
          }
          return true;
        })
        // Target role filtering
        .filter(ad => !ad.targetRole || ad.targetRole === "all" || ad.targetRole === role)
        // Specific category filter when browsing a single trade category
        .filter(ad => {
            if (!category || !ad.targetCategories || ad.targetCategories.length === 0) return true;
            return ad.targetCategories.includes(category) || ad.targetCategories.includes("all");
        });
      
      setAdverts(activeAds);
    }, (error) => {
      console.warn("Advertisements query notice:", error);
    });

    return () => {
      isMounted = false;
      unsubTraders();
      unsubConfig();
      unsubAdConfig();
      unsubs();
    };
  }, [role, category]);

  // Combine live database ads with curated default promotions
  const defaultList = role === "homeowner" ? DEFAULT_HOMEOWNER_ADVERTS : DEFAULT_TRADESPERSON_ADVERTS;
  
  // Intelligent Job-Status & Category Targeting Engine:
  // Sorts ads so that offers matching the homeowner's active posted jobs or viewed categories appear first!
  const targetCategorySet = new Set(
    [category, ...(activeCategories || [])].filter(Boolean).map(c => (c || "").toLowerCase())
  );

  const rawCombinedList = [...adverts, ...defaultList];

  const sortedAdverts = [...rawCombinedList].sort((a, b) => {
    // 1. Prioritize live paid campaigns from traders & trade partners over defaults
    const aIsLiveDb = a.id && !String(a.id).startsWith("homeowner-") && !String(a.id).startsWith("trade-");
    const bIsLiveDb = b.id && !String(b.id).startsWith("homeowner-") && !String(b.id).startsWith("trade-");

    // 2. Check category relevance against homeowner's active posted jobs
    const aMatchesJob = (a.targetCategories || []).some(cat => 
      targetCategorySet.has(cat.toLowerCase()) || 
      Array.from(targetCategorySet).some(tc => cat.toLowerCase().includes(tc) || tc.includes(cat.toLowerCase()))
    );
    const bMatchesJob = (b.targetCategories || []).some(cat => 
      targetCategorySet.has(cat.toLowerCase()) || 
      Array.from(targetCategorySet).some(tc => cat.toLowerCase().includes(tc) || tc.includes(cat.toLowerCase()))
    );

    if (aMatchesJob && !bMatchesJob) return -1;
    if (!aMatchesJob && bMatchesJob) return 1;
    if (aIsLiveDb && !bIsLiveDb) return -1;
    if (!aIsLiveDb && bIsLiveDb) return 1;
    return 0;
  });

  // Deduplicate by ID
  const displayAdverts = Array.from(new Map(sortedAdverts.map(item => [item.id, item])).values());

  // Auto rotation timer with pause on hover/touch
  useEffect(() => {
    if (displayAdverts.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayAdverts.length);
    }, rotationSpeed);

    return () => clearInterval(timer);
  }, [displayAdverts.length, rotationSpeed, isPaused]);

  if (!isBannerAdsEnabled || displayAdverts.length === 0) return null;

  const currentAd = displayAdverts[currentIndex % displayAdverts.length];
  const linkedTraderUid = currentAd.advertiserUid || currentAd.advertiserId;
  const linkedTrader = linkedTraderUid ? (tradersMap[linkedTraderUid] || INITIAL_MOCK_TRADERS.find((t: any) => t.uid === linkedTraderUid)) : undefined;
  const isPromotedTrader = !!linkedTrader || currentAd.isTraderAd || !!currentAd.advertiserUid;

  const displayTitle = currentAd.title || linkedTrader?.businessName || linkedTrader?.name || "Verified Trade Specialist";
  const displayTagline = currentAd.description || (currentAd as any).tagline || linkedTrader?.bio || (linkedTrader as any)?.miniProfileSettings?.extraInfo || "Top-rated local verified trade professional with upfront pricing and guaranteed workmanship.";
  const displayAvatar = linkedTrader?.avatarUrl || currentAd.imageUrl;
  const displayRating = linkedTrader?.rating || (currentAd as any).rating;
  const displayReviews = linkedTrader?.totalReviews || (currentAd as any).totalReviews;
  const displayPerk = currentAd.perkText || (linkedTrader?.isAvailableForEmergency ? "⚡ 24/7 Response Guaranteed" : linkedTrader?.trades?.[0] ? `${linkedTrader.trades[0]} Specialist` : undefined);

  const mainTradeCategory = 
    linkedTrader?.trade || 
    linkedTrader?.trades?.[0] || 
    (linkedTrader as any)?.tradeCategory ||
    (currentAd.targetCategories?.find((c: string) => c && c.toLowerCase() !== "all") || (currentAd.targetCategories?.[0] !== "all" ? currentAd.targetCategories?.[0] : undefined)) ||
    (currentAd as any).tradeCategory ||
    (currentAd as any).category;

  const AdIcon = iconMap[currentAd.iconName || ""] || (isPromotedTrader ? Star : Zap);

  // Handle ad clicks (external vs internal routes with billing deductions)
  const handleAdClick = (clickedAd: PartnerAdItem, e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // Track clicks and bill prepaid balances for live database ads asynchronously in background (non-blocking)
    if (clickedAd.id && !String(clickedAd.id).startsWith("homeowner-") && !String(clickedAd.id).startsWith("trade-") && !String(clickedAd.id).startsWith("default-") && !String(clickedAd.id).startsWith("seed-")) {
      (async () => {
        try {
          const updateData: any = { clicks: increment(1), bannerClicks: increment(1) };
          const cost = clickedAd.costPerDisplay || 0;
          
          if (clickedAd.billingCycle === "prepaid" && typeof clickedAd.prepaidBalance === "number") {
            const newBalance = clickedAd.prepaidBalance - cost;
            
            if (clickedAd.autoTopUpEnabled && newBalance <= (clickedAd.autoTopUpThreshold || 10)) {
              const reloadAmount = clickedAd.autoTopUpAmount || 50;
              updateData.prepaidBalance = increment(-cost + reloadAmount);
              updateData.lastAutoTopUpAt = new Date().toISOString();
            } else {
              updateData.prepaidBalance = increment(-cost);
              if (newBalance <= 0) {
                updateData.isActive = false; // Pause campaign when balance runs out
              }
            }
            
            // Send low budget alert notification to advertiser if needed
            const advertiserUid = clickedAd.advertiserUid || clickedAd.advertiserId;
            if (advertiserUid && clickedAd.totalBudget) {
              const pct = newBalance / clickedAd.totalBudget;
              const oldPct = clickedAd.prepaidBalance / clickedAd.totalBudget;
              
              let noticeMsg = null;
              if (oldPct > 0.9 && pct <= 0.9) {
                noticeMsg = `Your ad campaign "${clickedAd.title}" has reached 90% of its budget capacity.`;
              } else if (oldPct > 0.1 && pct <= 0.1) {
                noticeMsg = `CRITICAL: Your ad campaign "${clickedAd.title}" has reached 10% of its budget capacity! Top up soon.`;
              } else if (oldPct > 0 && pct <= 0) {
                noticeMsg = `Your ad campaign "${clickedAd.title}" has run out of budget and has been paused.`;
              }
              
              if (noticeMsg) {
                await addDoc(collection(db, "notifications"), {
                  userId: advertiserUid,
                  title: "Ad Budget Alert",
                  body: noticeMsg,
                  type: "alert",
                  read: false,
                  createdAt: serverTimestamp()
                });
              }
            }
          }
          
          await setDoc(doc(db, "advertisements", clickedAd.id), updateData, { merge: true });
        } catch (err) {
          console.warn("Failed to track ad click:", err);
        }
      })();
    }

    // Instant zero-latency navigation logic: internal app routes vs external websites
    const traderUid = clickedAd.advertiserUid || (clickedAd as any).advertiserId;
    const isTraderAd = !!traderUid || clickedAd.isTraderAd || clickedAd.type === "trader_promo";
    const resolvedTrader = traderUid ? (tradersMap[traderUid] || INITIAL_MOCK_TRADERS.find((t: any) => t.uid === traderUid)) : linkedTrader;

    // 1. If it's a trader ad or has a traderUid, navigate directly to their public profile with pre-hydrated profile!
    if (isTraderAd && traderUid) {
      navigate(`/profile/${traderUid}`, { state: { initialProfile: resolvedTrader } });
      return;
    }

    let targetUrl = clickedAd.url || "";
    if (targetUrl.includes("/profile/")) {
      const profilePart = targetUrl.substring(targetUrl.indexOf("/profile/"));
      const extractedUid = profilePart.replace("/profile/", "").split("?")[0].split("#")[0];
      const extractedTrader = extractedUid ? (tradersMap[extractedUid] || INITIAL_MOCK_TRADERS.find((t: any) => t.uid === extractedUid)) : resolvedTrader;
      navigate(profilePart, { state: { initialProfile: extractedTrader } });
      return;
    }

    if (!targetUrl) {
      targetUrl = isTraderAd ? `/profile/${traderUid || 'seed-promoted-plumber'}` : "/find-trades";
    }

    if (targetUrl.startsWith("/")) {
      navigate(targetUrl, { state: { initialProfile: resolvedTrader } });
    } else if (targetUrl.startsWith("http")) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Copy promo/voucher code
  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Promo code ${code} copied!`, {
      description: "Apply this discount at checkout for instant savings."
    });
    setTimeout(() => setCopiedCode(null), 3000);
  };

  // Manual carousel navigation
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + displayAdverts.length) % displayAdverts.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % displayAdverts.length);
  };

  // Swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
      const deltaX = touchStartXRef.current - touchEndXRef.current;
      if (deltaX > 45) {
        // Swiped left -> Next
        setCurrentIndex((prev) => (prev + 1) % displayAdverts.length);
      } else if (deltaX < -45) {
        // Swiped right -> Prev
        setCurrentIndex((prev) => (prev - 1 + displayAdverts.length) % displayAdverts.length);
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
    setTimeout(() => setIsPaused(false), 2500);
  };

  return (
    <div className={cn("-mt-5 sm:-mt-4 mb-5 select-none", className)}>
      {/* Illustrated Marquee Ticker directly above advertising container - No boxes or containers */}
      <IllustratedAdTicker role={role} />

      {/* Main Banner Card Container with Natural Height & High-Contrast Black Border */}
      <div 
        className="mt-1.5 relative group/banner select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative overflow-hidden rounded-2xl w-full min-h-[150px] sm:min-h-[140px] bg-slate-900 border border-black shadow-md z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAd.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={(e) => handleAdClick(currentAd, e)}
            className={cn(
              "relative w-full h-full min-h-[150px] sm:min-h-[140px] text-white cursor-pointer overflow-hidden flex flex-col justify-between p-3.5 sm:p-4 bg-gradient-to-r",
              currentAd.gradient || "from-slate-950 via-slate-900 to-slate-950"
            )}
            style={{ 
              backgroundColor: currentAd.bgColor && !currentAd.bgColor.startsWith("bg-") ? currentAd.bgColor : undefined 
            }}
          >
            {/* Golden Ribbon Badge tucked away in the top right corner (Matches exact reference design) */}
            <div className="absolute top-0 right-3.5 sm:right-4 z-20 shrink-0 pointer-events-none drop-shadow-md">
              <div 
                className="w-12 sm:w-13 pt-2 pb-3.5 bg-gradient-to-b from-[#FDE68A] via-[#F59E0B] to-[#D97706] text-[#3B2500] flex flex-col items-center justify-center text-center shadow-lg font-black rounded-b-xs border-x border-b border-amber-300/40"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)",
                }}
              >
                {(() => {
                  const fullBadgeText = currentAd.badgeLabel || (isPromotedTrader ? "FEATURED PRO" : "PARTNER OFFER");
                  const badgeParts = fullBadgeText.trim().split(/\s+/);
                  const badgeTop = badgeParts[0] || "FEATURED";
                  const badgeBottom = badgeParts.slice(1).join(" ") || "PRO";
                  return (
                    <>
                      <span className="text-[7.5px] sm:text-[8px] font-black tracking-wider leading-none uppercase drop-shadow-[0_0.5px_0_rgba(255,255,255,0.4)]">
                        {badgeTop}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-none mt-0.5 uppercase drop-shadow-[0_0.5px_0_rgba(255,255,255,0.4)]">
                        {badgeBottom}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Top Bar: Icon/Avatar + Trader/Brand Header */}
            <div className="flex items-start justify-between gap-2.5 pr-16 sm:pr-20">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {/* Brand / Trader Avatar Container */}
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner overflow-hidden mt-0.5">
                  {displayAvatar ? (
                    <img 
                      src={displayAvatar} 
                      alt={displayTitle} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <AdIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                  )}
                  {isPromotedTrader && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border border-black flex items-center justify-center shadow-xs">
                      <Check className="w-2 h-2 text-white stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Title & Hierarchy: Personal Name -> Business Name -> Rating + Prominent Trade Category Badge */}
                <div className="min-w-0 flex-1">
                  {isPromotedTrader ? (
                    <>
                      {/* 1. Personal Name (or Business name if business-only) */}
                      <h4 className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                        {linkedTrader?.displayNamePreference === "business_only" 
                          ? (linkedTrader?.businessName || currentAd.title || "Verified Business")
                          : (linkedTrader?.name || currentAd.advertiserName || displayTitle)}
                      </h4>

                      {/* 2. Business Name */}
                      {(() => {
                        const bName = linkedTrader?.businessName || (currentAd.title !== linkedTrader?.name ? currentAd.title : "");
                        if (bName && linkedTrader?.displayNamePreference !== "business_only") {
                          return (
                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-300 truncate mt-0.5">
                              {bName}
                            </p>
                          );
                        }
                        return null;
                      })()}

                      {/* 3. Star Rating & Prominent Main Trade Category Badge */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {displayRating && (
                          <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                            {Number(displayRating).toFixed(1)}
                            {displayReviews ? <span className="text-[9px] opacity-80">({displayReviews})</span> : null}
                          </span>
                        )}

                        {/* Highlighted Main Trade Category Pill */}
                        {mainTradeCategory && mainTradeCategory.toLowerCase() !== "all" && (
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white border border-blue-400/60 px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black tracking-wide uppercase shadow-xs shrink-0 max-w-[170px] sm:max-w-[210px] truncate">
                            <Wrench className="w-2.5 h-2.5 text-sky-200 shrink-0" />
                            <span className="truncate">{mainTradeCategory}</span>
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Non-trader partner banner */}
                      <h4 className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                        {displayTitle}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {displayRating && (
                          <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                            {Number(displayRating).toFixed(1)}
                            {displayReviews ? <span className="text-[9px] opacity-80">({displayReviews})</span> : null}
                          </span>
                        )}

                        {mainTradeCategory && mainTradeCategory.toLowerCase() !== "all" && (
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white border border-blue-400/60 px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black tracking-wide uppercase shadow-xs shrink-0 max-w-[170px] sm:max-w-[210px] truncate">
                            <Tag className="w-2.5 h-2.5 text-sky-200 shrink-0" />
                            <span className="truncate">{mainTradeCategory}</span>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Middle: Full-Width Promoted Perk Highlight & Description (No text cutoff) */}
            <div className="my-2 flex-1 flex flex-col justify-center gap-1 min-w-0">
              {displayPerk && (
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-amber-300 tracking-wide">
                  <Sparkles className="w-3 h-3 fill-amber-300 shrink-0" />
                  <span className="leading-snug line-clamp-1">{displayPerk}</span>
                </div>
              )}
              <p className="text-xs sm:text-[13px] text-slate-200 font-medium leading-snug line-clamp-2">
                {displayTagline}
              </p>
            </div>

            {/* Bottom Row: Voucher Code / Perk + Action CTA (Guaranteed non-overlapping layout) */}
            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-white/10 mt-auto">
              {/* Voucher Code Chip or Verified Partner Badge */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                {currentAd.voucherCode ? (
                  <button
                    type="button"
                    onClick={(e) => handleCopyCode(currentAd.voucherCode!, e)}
                    className="inline-flex items-center gap-1.5 bg-amber-400/20 hover:bg-amber-400/30 active:scale-95 border border-amber-400/40 text-amber-200 hover:text-amber-100 text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs shrink-0"
                    title="Click to copy promo code"
                  >
                    {copiedCode === currentAd.voucherCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                        <span className="text-emerald-300 font-sans font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Tag className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>CODE: {currentAd.voucherCode}</span>
                        <Copy className="w-2.5 h-2.5 text-amber-300 opacity-70 ml-0.5 shrink-0" />
                      </>
                    )}
                  </button>
                ) : isPromotedTrader && (linkedTrader || currentAd.advertiserName) ? (
                  <span className="text-[10px] sm:text-xs font-bold text-slate-300 flex items-center gap-1 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
                    <span className="truncate">
                      Verified Pro
                      {linkedTrader?.postcode ? ` · ${linkedTrader.postcode.substring(0, 4)}` : ""}
                      {(linkedTrader as any)?.miniProfileSettings?.callOutFee ? ` · £${(linkedTrader as any).miniProfileSettings.callOutFee} Callout` : " · Free Quote"}
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs font-bold text-slate-300 flex items-center gap-1 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
                    <span className="truncate">{currentAd.advertiserName || "Verified Partner"}</span>
                  </span>
                )}
              </div>

              {/* Action Button CTA */}
              <div className="flex items-center gap-1 text-white group-hover:text-amber-300 transition-colors shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold">
                <span>
                  {isPromotedTrader ? "View Profile" : currentAd.url?.startsWith("http") ? "Claim Deal" : "Explore"}
                </span>
                {currentAd.url?.startsWith("http") ? (
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                )}
              </div>
            </div>

            {/* Background Image if uploaded by advertiser */}
            {currentAd.imageUrl && (
              <img 
                src={currentAd.imageUrl} 
                alt={currentAd.title} 
                className="absolute inset-0 w-full h-full object-cover -z-10 opacity-20 group-hover:scale-105 transition-transform duration-700 pointer-events-none" 
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Carousel Navigation Arrow Controls (Desktop/Hover only) */}
        {displayAdverts.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white hidden md:flex items-center justify-center opacity-0 group-hover/banner:opacity-100 transition-opacity z-20 cursor-pointer shadow-md"
              title="Previous promotion"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white hidden md:flex items-center justify-center opacity-0 group-hover/banner:opacity-100 transition-opacity z-20 cursor-pointer shadow-md"
              title="Next promotion"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Sleek, Micro 3px Pagination Indicators (Placed cleanly underneath container) */}
      {displayAdverts.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2 select-none">
          {displayAdverts.map((_, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setCurrentIndex(idx);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Go to slide ${idx + 1}`}
              className={cn(
                "h-[3px] rounded-full transition-all duration-300 cursor-pointer p-0 m-0 border-0 outline-none block min-w-0 min-h-0",
                idx === currentIndex % displayAdverts.length 
                  ? "w-6 bg-amber-500 shadow-xs" 
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              )}
            />
          ))}
        </div>
      )}

      {/* Advertiser Quick Link for Tradespeople & Business Accounts */}
      {(role === "tradesperson" || profile?.role === "tradesperson" || profile?.subscriptionType === "business" || profile?.role === "business") && (
        <div className="flex justify-center mt-2">
          <Link 
            to="/trader/banner-ads" 
            className="inline-flex items-center gap-1 bg-amber-300 hover:bg-amber-400 text-black border border-black px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-xs hover:shadow-none transition-all cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="w-2.5 h-2.5" />
            Promote your trade or business here
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
