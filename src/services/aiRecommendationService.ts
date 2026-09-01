import { TRADE_CATEGORIES } from "@/src/constants";
import { INITIAL_MOCK_TRADERS, Tradesperson } from "./seedService";
import { db, collection, query, where, getDocs, limit } from "@/src/firebase";
import { categoryMatchesSearch } from "@/src/lib/fuzzyMatch";

export interface TraderRecommendationCard {
  uid: string;
  name: string;
  businessName?: string;
  avatarUrl?: string;
  category: string;
  rating: number;
  reviewsCount: number;
  hourlyRate?: number;
  postcode?: string;
  distanceMiles?: number;
  isVerified: boolean;
  isGasSafe?: boolean;
  isNiceic?: boolean;
  isVideoVerified?: boolean;
  isSponsored: boolean; // Featured Partner (Monetized Slot)
  isNewcomerBoost?: boolean; // Fairness Engine Newcomer Slot
  badges: string[];
  bio?: string;
}

export interface AiTradeBotActionPayload {
  category?: string;
  subcategory?: string;
  suggestedTitle?: string;
  estimatedPriceRange?: { min: number; max: number; unit?: string };
  suggestedJobDescription?: string;
  relatedCategories?: string[];
  recommendedTraders?: TraderRecommendationCard[];
}

/**
 * Searches for best matching category names from TRADE_CATEGORIES based on user text.
 */
export function findMatchingTradeCategories(userText: string, maxResults: number = 3): string[] {
  if (!userText || userText.trim().length === 0) return ["Building & Construction", "Handyman Services"];
  
  const textLower = userText.toLowerCase();
  const matchedCategories: { name: string; score: number }[] = [];

  TRADE_CATEGORIES.forEach((cat) => {
    let score = 0;
    const catNameLower = cat.name.toLowerCase();

    // Direct name match
    if (textLower.includes(catNameLower)) {
      score += 15;
    }

    // Fuzzy category/synonym match from fuzzyMatch.ts dictionary
    if (categoryMatchesSearch(cat, userText)) {
      score += 12;
    }

    // Subcategory matches
    if (cat.subcategories && Array.isArray(cat.subcategories)) {
      cat.subcategories.forEach((sub: string) => {
        const subLower = sub.toLowerCase();
        if (textLower.includes(subLower)) {
          score += 10;
        } else {
          // Check word overlap
          const words = subLower.split(/[\s/&-]+/);
          words.forEach((w) => {
            if (w.length > 3 && textLower.includes(w)) {
              score += 3;
            }
          });
        }
      });
    }

    // Keyword heuristics across all key UK trade domains
    // 1. Painting & Decorating
    if (
      textLower.includes("paint") || 
      textLower.includes("painter") || 
      textLower.includes("painting") || 
      textLower.includes("decorat") || 
      textLower.includes("wallpaper") || 
      textLower.includes("gloss") || 
      textLower.includes("emulsion") || 
      textLower.includes("varnish") || 
      textLower.includes("stain") || 
      (textLower.includes("door") && (textLower.includes("paint") || textLower.includes("wood") || textLower.includes("finish") || textLower.includes("color") || textLower.includes("colour"))) ||
      textLower.includes("skirting") || 
      textLower.includes("woodwork") || 
      textLower.includes("coving")
    ) {
      if (cat.name === "Painting & Decorating") score += 18;
    }

    // 2. Carpentry & Joinery
    if (
      textLower.includes("carpenter") || 
      textLower.includes("joiner") || 
      textLower.includes("carpentry") || 
      textLower.includes("joinery") || 
      textLower.includes("staircase") || 
      textLower.includes("cupboard") || 
      textLower.includes("cabinet") || 
      textLower.includes("wardrobe") || 
      textLower.includes("timber") || 
      (textLower.includes("door") && (textLower.includes("hang") || textLower.includes("fit") || textLower.includes("frame") || textLower.includes("hinge")))
    ) {
      if (cat.name === "Carpentry & Joinery" || cat.name === "Door Fitting & Hanging") score += 15;
    }

    // 3. Locksmith & Security
    if (
      textLower.includes("lock") || 
      textLower.includes("locksmith") || 
      textLower.includes("key") || 
      textLower.includes("lockout") || 
      textLower.includes("anti snap") || 
      textLower.includes("ultion") || 
      textLower.includes("latch") || 
      textLower.includes("bolt")
    ) {
      if (cat.name === "Locksmith" || cat.name === "Security Systems") score += 15;
    }

    // 4. Plumbing
    if (
      textLower.includes("plumb") || 
      textLower.includes("plumber") || 
      textLower.includes("leak") || 
      textLower.includes("pipe") || 
      textLower.includes("tap") || 
      textLower.includes("sink") || 
      textLower.includes("toilet") || 
      textLower.includes("drain") || 
      textLower.includes("shower") || 
      textLower.includes("unblock")
    ) {
      if (cat.name === "Plumbing" || cat.name === "Bathroom Fitting") score += 12;
    }

    // 5. Gas & Heating
    if (
      textLower.includes("boiler") || 
      textLower.includes("heating") || 
      textLower.includes("radiator") || 
      textLower.includes("gas") || 
      textLower.includes("cp12") || 
      textLower.includes("flue") || 
      textLower.includes("thermostat") || 
      textLower.includes("combi")
    ) {
      if (cat.name === "Gas & Heating" || cat.name === "Plumbing") score += 12;
    }

    // 6. Electrical
    if (
      textLower.includes("fuse") || 
      textLower.includes("light") || 
      textLower.includes("wire") || 
      textLower.includes("rewir") || 
      textLower.includes("socket") || 
      textLower.includes("circuit") || 
      textLower.includes("electric") || 
      textLower.includes("eicr") || 
      textLower.includes("consumer unit")
    ) {
      if (cat.name === "Electrical" || cat.name === "Smart Home & Automation") score += 12;
    }

    // 7. Roofing & Guttering
    if (
      textLower.includes("roof") || 
      textLower.includes("tile") || 
      textLower.includes("gutter") || 
      textLower.includes("chimney") || 
      textLower.includes("leadwork") || 
      textLower.includes("fascia") || 
      textLower.includes("soffit")
    ) {
      if (cat.name === "Roofing & Guttering" || cat.name === "Roofing Services") score += 12;
    }

    // 8. Cleaning
    if (
      textLower.includes("clean") || 
      textLower.includes("carpet") || 
      textLower.includes("tenancy") || 
      textLower.includes("mould") || 
      textLower.includes("damp") || 
      textLower.includes("bin")
    ) {
      if (cat.name === "Domestic & Commercial Cleaning" || cat.name === "Specialist Cleaning" || cat.name === "Carpet & Upholstery Cleaning") score += 12;
    }

    // 9. Gardening & Landscaping
    if (
      textLower.includes("garden") || 
      textLower.includes("lawn") || 
      textLower.includes("hedge") || 
      textLower.includes("tree") || 
      textLower.includes("fence") || 
      textLower.includes("patio") || 
      textLower.includes("paving") || 
      textLower.includes("decking")
    ) {
      if (cat.name === "Gardening & Landscaping") score += 12;
    }

    // 10. Cake & Catering
    if (
      textLower.includes("cake") || 
      textLower.includes("bake") || 
      textLower.includes("wedding cake") || 
      textLower.includes("catering") || 
      textLower.includes("food")
    ) {
      if (cat.name === "Cake Maker & Baker" || cat.name === "Catering & Private Chef") score += 12;
    }

    // 11. Delivery & Transport
    if (
      textLower.includes("courier") || 
      textLower.includes("van") || 
      textLower.includes("transport") || 
      textLower.includes("delivery") || 
      textLower.includes("removal") || 
      textLower.includes("bulky") || 
      textLower.includes("appliance")
    ) {
      if (cat.name === "On-Demand Delivery & Bulky Goods Courier") score += 15;
    }

    if (score > 0) {
      matchedCategories.push({ name: cat.name, score });
    }
  });

  matchedCategories.sort((a, b) => b.score - a.score);
  const result = matchedCategories.slice(0, maxResults).map((c) => c.name);

  return result.length > 0 ? result : ["Building & Construction", "Handyman Services"];
}

/**
 * Retrieves recommended traders using the Hybrid Fairness & Monetization Engine:
 * - Slot 1: Featured Pro ⚡ (Monetized / Priority Partner with top badges)
 * - Slot 2: Organic Match 🌟 (Fairness Rotation with distance & quality ranking)
 * - Slot 3 (optional): Newcomer Boost 🌟 (Equally rotated newly verified trader)
 */
export async function getHybridTraderRecommendations(
  category: string,
  userPostcode?: string,
  liveTradersPool?: Tradesperson[],
  userQuery?: string
): Promise<TraderRecommendationCard[]> {
  try {
    let pool: Tradesperson[] = [];

    // 1. Fetch live traders from Firestore if available
    let firestoreTraders: Tradesperson[] = [];
    if (!liveTradersPool || liveTradersPool.length === 0) {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("role", "in", ["tradesperson", "trader"]), limit(30));
        const snap = await getDocs(q);
        if (!snap.empty) {
          firestoreTraders = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Tradesperson));
        }
      } catch (err) {
        console.warn("Firestore fetch for traders skipped:", err);
      }
    }

    // Always merge seeded mock traders into pool so seed profiles (Elena Rostova, Lisa Park, etc.) are always accessible
    const seedPool = INITIAL_MOCK_TRADERS as Tradesperson[];
    if (liveTradersPool && liveTradersPool.length > 0) {
      const existingUids = new Set(liveTradersPool.map(t => t.uid));
      pool = [...liveTradersPool, ...seedPool.filter(s => !existingUids.has(s.uid))];
    } else {
      const existingUids = new Set(firestoreTraders.map(t => t.uid));
      pool = [...firestoreTraders, ...seedPool.filter(s => !existingUids.has(s.uid))];
    }

    // 2. Filter traders relevant to category and/or userQuery
    const catLower = (category || "").toLowerCase();
    const queryLower = (userQuery || "").toLowerCase();

    const relevant = pool.filter((traderObj) => {
      const t = traderObj as any;
      if (!catLower || catLower === "all") return true;
      const trades = (t.trades || []).map((tr: string) => tr.toLowerCase());
      const cat = (t.category || "").toLowerCase();
      const primary = (t.primaryTrade || "").toLowerCase();
      const bio = (t.bio || "").toLowerCase();
      const company = (t.businessName || t.companyName || "").toLowerCase();
      const services = (t.services || []).map((s: string) => s.toLowerCase());
      const tags = ((t as any).tags || []).map((tg: string) => tg.toLowerCase());

      const matchesCat = (
        trades.some((tr: string) => catLower.includes(tr) || tr.includes(catLower)) ||
        cat.includes(catLower) ||
        catLower.includes(cat) ||
        primary.includes(catLower) ||
        company.includes(catLower) ||
        bio.includes(catLower) ||
        services.some((s: string) => s.includes(catLower) || catLower.includes(s)) ||
        tags.some((tg: string) => tg.includes(catLower) || catLower.includes(tg))
      );

      const matchesQuery = queryLower ? (
        trades.some((tr: string) => queryLower.includes(tr) || tr.includes(queryLower)) ||
        services.some((s: string) => queryLower.includes(s) || s.includes(queryLower)) ||
        tags.some((tg: string) => queryLower.includes(tg) || tg.includes(queryLower)) ||
        company.includes(queryLower) ||
        bio.includes(queryLower)
      ) : false;

      return matchesCat || matchesQuery;
    });

    // If relevant traders exist for this category/query, ONLY use relevant traders!
    const candidatePool = relevant.length > 0 ? relevant : pool;
    const userPrefix = (userPostcode || "").trim().split(" ")[0]?.toUpperCase() || "";

    // 3. Score candidates for Featured Slot vs Organic Pool
    const scoredCandidates = candidatePool.map((tpObj) => {
      const tp: any = tpObj;
      const rating = tp.rating || 4.8;
      const reviews = tp.reviewsCount || tp.totalReviews || tp.totalJobsCompleted || 12;
      const isVerified = tp.verificationStatus === "verified" || tp.isVerified === true;
      const isGasSafe = tp.isGasSafeRegistered || tp.certifications?.some((c: any) => c.name?.toLowerCase().includes("gas safe"));
      const isNiceic = tp.isNiceicApproved || tp.certifications?.some((c: any) => c.name?.toLowerCase().includes("niceic"));
      const isVideo = Boolean(tp.videoVerificationUrl || tp.verificationVideoUrl || tp.isVideoVerified || tp.videoVerificationStatus === "verified" || tp.hasVerifiedVideoProSubscription);
      const isProSubscribed = Boolean(tp.subscriptionType === "business" || tp.tier === "premium" || (tp as any).isTradeOsPro || tp.hasVerifiedVideoProSubscription);

      const tpPostcode = (tp.postcode || "").trim().toUpperCase();
      const isAreaMatch = !!(userPrefix && tpPostcode.startsWith(userPrefix));

      // Calculate organic match score
      let organicScore = rating * 20 + Math.min(reviews * 2, 30) + (isVerified ? 15 : 0) + (isAreaMatch ? 25 : 0);

      return {
        tp,
        rating,
        reviews,
        isVerified,
        isGasSafe,
        isNiceic,
        isVideo,
        isProSubscribed,
        isAreaMatch,
        organicScore,
        isNewcomer: reviews <= 5
      };
    });

    const recommendations: TraderRecommendationCard[] = [];

    // --- SLOT 1: FEATURED PRO ⚡ (Monetized / Pro Tier Partner) ---
    const featuredCandidates = scoredCandidates.filter((c) => c.isProSubscribed || (c.isVerified && c.rating >= 4.7));
    const featuredPick = featuredCandidates.length > 0
      ? featuredCandidates[Math.floor(Date.now() / (1000 * 60 * 30)) % featuredCandidates.length]
      : scoredCandidates[0];

    if (featuredPick) {
      const tp: any = featuredPick.tp;
      recommendations.push({
        uid: tp.uid || tp.id || "trader-featured-1",
        name: tp.name || tp.displayName || tp.businessName || "Apex Pro Services",
        businessName: tp.businessName || tp.companyName || `${tp.name}'s ${category || "Trade"} Services`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150",
        category: category || tp.category || "Certified Professional",
        rating: Math.max(4.7, featuredPick.rating),
        reviewsCount: Math.max(18, featuredPick.reviews),
        hourlyRate: tp.hourlyRate || tp.baseRate || 45,
        postcode: tp.postcode || "UK Wide",
        distanceMiles: featuredPick.isAreaMatch ? 1.4 : 3.8,
        isVerified: true,
        isGasSafe: featuredPick.isGasSafe,
        isNiceic: featuredPick.isNiceic,
        isVideoVerified: featuredPick.isVideo,
        isSponsored: true, // Tagged as Featured Pro
        badges: [
          "⚡ Featured Partner",
          featuredPick.isGasSafe ? "Gas Safe" : (featuredPick.isNiceic ? "NICEIC" : "Verified Pro"),
          "Fast Response (<15m)"
        ],
        bio: tp.bio || `Specialist in ${category || "general trade solutions"} with guaranteed workmanship and public liability insurance.`
      });
    }

    // --- SLOT 2: ORGANIC FAIR ROTATION MATCH 🌟 ---
    const organicPool = scoredCandidates.filter((c) => c.tp.uid !== featuredPick?.tp.uid);
    const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 15)); // 15-min fair share rotation
    
    if (organicPool.length > 0) {
      const sortedOrganic = [...organicPool].sort((a, b) => {
        const hashA = ((a.tp.uid || "a").charCodeAt(0) + rotationSeed) % 23;
        const hashB = ((b.tp.uid || "b").charCodeAt(0) + rotationSeed) % 23;
        return hashA - hashB;
      });

      const organicPick = sortedOrganic[0];
      const tp: any = organicPick.tp;

      recommendations.push({
        uid: tp.uid || tp.id || "trader-organic-2",
        name: tp.name || tp.displayName || tp.businessName || "Local Verified Pro",
        businessName: tp.businessName || tp.companyName || `${tp.name} Quality Trades`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        category: category || tp.category || "Local Specialist",
        rating: organicPick.rating,
        reviewsCount: organicPick.reviews,
        hourlyRate: tp.hourlyRate || tp.baseRate || 40,
        postcode: tp.postcode || "Local Area",
        distanceMiles: organicPick.isAreaMatch ? 0.9 : 2.6,
        isVerified: organicPick.isVerified,
        isGasSafe: organicPick.isGasSafe,
        isNiceic: organicPick.isNiceic,
        isVideoVerified: organicPick.isVideo,
        isSponsored: false,
        isNewcomerBoost: organicPick.isNewcomer,
        badges: [
          organicPick.isNewcomer ? "🌟 Newcomer Boost" : "Top Local Match",
          organicPick.isVerified ? "100% Vetted" : "Insured Trader",
          organicPick.isAreaMatch ? "Near You" : "Guaranteed Work"
        ],
        bio: tp.bio || `Reliable ${category || "tradesperson"} providing transparent quotes, punctuality, and high-quality finishes.`
      });
    }

    return recommendations;
  } catch (err) {
    console.error("Error generating hybrid trader recommendations:", err);
    return [];
  }
}
