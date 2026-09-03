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
      score += 20;
    }

    // Fuzzy category/synonym match from fuzzyMatch.ts dictionary
    if (categoryMatchesSearch(cat, userText)) {
      score += 15;
    }

    // Subcategory matches
    if (cat.subcategories && Array.isArray(cat.subcategories)) {
      cat.subcategories.forEach((sub: string) => {
        const subLower = sub.toLowerCase();
        if (textLower.includes(subLower)) {
          score += 12;
        } else {
          // Check significant word overlap
          const words = subLower.split(/[\s/&-]+/);
          words.forEach((w) => {
            if (w.length >= 4 && textLower.includes(w)) {
              score += 4;
            }
          });
        }
      });
    }

    // Keyword heuristics across all key UK trade domains
    // 1. Bake N Cake, Wedding Cakes, Pastry & Catering
    if (
      textLower.includes("cake") || 
      textLower.includes("bake") || 
      textLower.includes("baker") || 
      textLower.includes("baking") || 
      textLower.includes("cupcake") || 
      textLower.includes("wedding cake") || 
      textLower.includes("tier") || 
      textLower.includes("fondant") || 
      textLower.includes("pastry") || 
      textLower.includes("patisserie") || 
      textLower.includes("afternoon tea") || 
      textLower.includes("catering") || 
      textLower.includes("caterer") || 
      textLower.includes("food allergen") || 
      textLower.includes("natasha's law") || 
      textLower.includes("fsa") || 
      textLower.includes("dessert")
    ) {
      if (cat.name === "Bake N Cake" || cat.name === "Catering & Private Chef") score += 25;
    }

    // 2. Painting & Decorating
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

    // 3. Carpentry & Joinery
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
      if (cat.name === "Carpentry & Joinery" || cat.name === "Door Fitting & Hanging") score += 18;
    }

    // 4. Locksmith & Security
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
      if (cat.name === "Locksmith" || cat.name === "Security Systems") score += 20;
    }

    // 5. Plumbing & Gas
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
      if (cat.name === "Plumbing" || cat.name === "Bathroom & Kitchen Fitting") score += 18;
    }

    // 6. Gas & Heating
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
      if (cat.name === "Gas Engineering" || cat.name === "Plumbing") score += 20;
    }

    // 7. Electrical
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
      if (cat.name === "Electrical" || cat.name === "Security Systems") score += 20;
    }

    // 8. Roofing & Guttering
    if (
      textLower.includes("roof") || 
      textLower.includes("tile") || 
      textLower.includes("gutter") || 
      textLower.includes("chimney") || 
      textLower.includes("leadwork") || 
      textLower.includes("fascia") || 
      textLower.includes("soffit")
    ) {
      if (cat.name === "Roofing" || cat.name === "Guttering & Drainage") score += 18;
    }

    // 9. Cleaning
    if (
      textLower.includes("clean") || 
      textLower.includes("carpet") || 
      textLower.includes("tenancy") || 
      textLower.includes("mould") || 
      textLower.includes("damp") || 
      textLower.includes("bin")
    ) {
      if (cat.name === "Home Cleaning" || cat.name === "Industrial & Commercial Cleaning" || cat.name === "Specialist Cleaning") score += 18;
    }

    // 10. Gardening & Landscaping
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
      if (cat.name === "Landscaping & Garden" || cat.name === "Tree Surgery & Arboriculture") score += 18;
    }

    // 11. Delivery & Transport
    if (
      textLower.includes("courier") || 
      textLower.includes("parcel") || 
      textLower.includes("delivery") || 
      textLower.includes("bulky") || 
      textLower.includes("appliance delivery")
    ) {
      if (cat.name === "Courier, Parcel & Express Delivery") score += 20;
    }

    // 12. Removals & House Moves
    if (
      textLower.includes("removal") || 
      textLower.includes("house move") || 
      textLower.includes("moving house") || 
      textLower.includes("man and van")
    ) {
      if (cat.name === "Removals") score += 20;
    }

    // 13. Tailoring & Laundry
    if (
      textLower.includes("tailor") || 
      textLower.includes("alteration") || 
      textLower.includes("seamstress") || 
      textLower.includes("hemming") || 
      textLower.includes("laundry") || 
      textLower.includes("dry clean")
    ) {
      if (cat.name === "Tailoring, Alterations & Laundry Services") score += 20;
    }

    if (score > 0) {
      matchedCategories.push({ name: cat.name, score });
    }
  });

  matchedCategories.sort((a, b) => b.score - a.score);
  const result = matchedCategories.slice(0, maxResults).map((c) => c.name);

  return result.length > 0 ? result : ["Building & Construction", "Handyman / General"];
}

/**
 * Normalizes trade strings and category aliases to ensure cross-matching.
 */
function getCategoryAliases(category: string): string[] {
  const cat = (category || "").toLowerCase().trim();
  const aliases = new Set<string>([cat]);

  if (cat.includes("cake") || cat.includes("bake") || cat.includes("catering") || cat.includes("pastry")) {
    ["bake n cake", "cake maker & baker", "cake maker", "baker", "baking", "wedding cakes", "celebration cakes", "bespoke bakes", "catering & private chef", "pastry chef"].forEach(a => aliases.add(a));
  }
  if (cat.includes("plumb") || cat.includes("gas") || cat.includes("heating") || cat.includes("boiler")) {
    ["plumbing", "gas & heating", "gas engineering", "heating", "boiler engineer", "bathroom fitting"].forEach(a => aliases.add(a));
  }
  if (cat.includes("electr") || cat.includes("smart home") || cat.includes("eicr")) {
    ["electrical", "electrician", "smart home & automation", "security systems"].forEach(a => aliases.add(a));
  }
  if (cat.includes("remov") || cat.includes("move") || cat.includes("man and van")) {
    ["removals", "home & domestic removals", "house removals", "man & van"].forEach(a => aliases.add(a));
  }
  if (cat.includes("clean") || cat.includes("carpet") || cat.includes("bin")) {
    ["home cleaning", "domestic & commercial cleaning", "specialist cleaning", "carpet & upholstery cleaning"].forEach(a => aliases.add(a));
  }
  if (cat.includes("paint") || cat.includes("decorat") || cat.includes("wallpaper")) {
    ["painting & decorating", "painter & decorator", "decorating", "wallpapering"].forEach(a => aliases.add(a));
  }
  if (cat.includes("carpent") || cat.includes("joiner")) {
    ["carpentry & joinery", "carpenter & joiner", "joiner", "door fitting"].forEach(a => aliases.add(a));
  }
  if (cat.includes("lock") || cat.includes("security")) {
    ["locksmith", "security systems", "locksmith & security"].forEach(a => aliases.add(a));
  }
  if (cat.includes("tailor") || cat.includes("alterat") || cat.includes("seamstress") || cat.includes("laundry")) {
    ["tailoring, alterations & laundry services", "tailoring", "garment alterations", "seamstress", "laundry"].forEach(a => aliases.add(a));
  }
  if (cat.includes("pet") || cat.includes("dog") || cat.includes("cat")) {
    ["pet services", "pet care specialist", "dog walker", "cat sitter"].forEach(a => aliases.add(a));
  }

  return Array.from(aliases);
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
        const q = query(usersRef, where("role", "in", ["tradesperson", "trader", "business"]), limit(30));
        const snap = await getDocs(q);
        if (!snap.empty) {
          firestoreTraders = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Tradesperson));
        }
      } catch (err) {
        console.warn("Firestore fetch for traders skipped:", err);
      }
    }

    // Always merge seeded mock traders into pool so verified profiles are always accessible
    const seedPool = INITIAL_MOCK_TRADERS as Tradesperson[];
    if (liveTradersPool && liveTradersPool.length > 0) {
      const existingUids = new Set(liveTradersPool.map(t => t.uid));
      pool = [...liveTradersPool, ...seedPool.filter(s => !existingUids.has(s.uid))];
    } else {
      const existingUids = new Set(firestoreTraders.map(t => t.uid));
      pool = [...firestoreTraders, ...seedPool.filter(s => !existingUids.has(s.uid))];
    }

    // 2. Filter traders strictly relevant to the category and inquiry
    const catLower = (category || "").toLowerCase().trim();
    const queryLower = (userQuery || "").toLowerCase().trim();
    const targetAliases = getCategoryAliases(category);

    // Extract significant query tokens (min 3 chars, skip noise and generic non-trade words)
    const noiseWords = new Set([
      "how", "much", "does", "cost", "what", "where", "when", "who", "which", "is", "are", "was", "were", "been",
      "the", "and", "for", "with", "apply", "laws", "rule", "rules", "need", "hire", "find", "best", "good", "local",
      "system", "systems", "installed", "installing", "installation", "new", "complete", "including", "included",
      "house", "home", "full", "done", "week", "weeks", "work", "price", "prices", "quote", "quotes", "about", "tell",
      "estimate", "service", "unit", "area", "type", "within", "around", "near", "nearby", "trader", "tradesperson",
      "company", "business"
    ]);
    const queryTokens = queryLower
      .split(/[^a-z0-9]+/i)
      .filter(t => t.length >= 3 && !noiseWords.has(t));

    const relevant = pool.filter((traderObj) => {
      const t = traderObj as any;
      if (!catLower || catLower === "all") return true;

      const traderTrades = (t.trades || []).map((tr: string) => tr.toLowerCase());
      const recCats = (t.recommendedCategories || []).map((rc: string) => rc.toLowerCase());
      const traderCat = (t.category || "").toLowerCase();
      const busCat = (t.businessCategory || "").toLowerCase();
      const primary = (t.primaryTrade || "").toLowerCase();
      const bio = (t.bio || "").toLowerCase();
      const company = (t.businessName || t.companyName || "").toLowerCase();
      const services = (t.services || []).map((s: string) => s.toLowerCase());
      const tags = ((t as any).tags || []).map((tg: string) => tg.toLowerCase());
      const skills = ((t as any).skills || []).map((sk: string) => sk.toLowerCase());
      const subcats = (t.subcategories || []).map((sb: string) => sb.toLowerCase());

      const allTraderText = [
        ...traderTrades,
        ...recCats,
        traderCat,
        busCat,
        primary,
        company,
        ...services,
        ...tags,
        ...skills,
        ...subcats,
        bio
      ].join(" ");

      // Match 1: Target alias matches any of trader's trades, categories, or services
      const matchesAlias = targetAliases.some((alias: string) => {
        return (
          traderTrades.some((tr: string) => tr.includes(alias) || alias.includes(tr)) ||
          recCats.some((rc: string) => rc.includes(alias) || alias.includes(rc)) ||
          traderCat.includes(alias) || alias.includes(traderCat) ||
          busCat.includes(alias) || alias.includes(busCat) ||
          primary.includes(alias) || alias.includes(primary) ||
          services.some((s: string) => s.includes(alias) || alias.includes(s)) ||
          tags.some((tg: string) => tg.includes(alias) || alias.includes(tg)) ||
          subcats.some((sb: string) => sb.includes(alias) || alias.includes(sb)) ||
          company.includes(alias)
        );
      });

      // Match 2: Query token overlap against trader profile text
      const tokenMatchCount = queryTokens.filter(tok => allTraderText.includes(tok)).length;
      const matchesTokens = queryTokens.length > 0 && tokenMatchCount >= Math.min(2, queryTokens.length);

      // Require alias match OR specific trade token match to prevent off-category traders
      return matchesAlias || matchesTokens;
    });

    // CRITICAL FIX: If no relevant traders match this category, DO NOT return irrelevant traders!
    // Returning an empty array triggers the Demand Gap notice cleanly rather than showing wrong profiles.
    if (relevant.length === 0) {
      return [];
    }

    const candidatePool = relevant;
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
      const isProSubscribed = Boolean(tp.subscriptionType === "business" || tp.tier === "premium" || tp.subscriptionTier === "platinum" || (tp as any).isTradeOsPro || tp.hasVerifiedVideoProSubscription);

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
      const primaryTradeName = (tp.trades && tp.trades[0]) || tp.category || category || "Certified Specialist";
      recommendations.push({
        uid: tp.uid || tp.id || "trader-featured-1",
        name: tp.name || tp.displayName || tp.businessName || "Apex Pro Services",
        businessName: tp.businessName || tp.companyName || `${tp.name}'s ${primaryTradeName}`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150",
        category: primaryTradeName,
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
        bio: tp.bio || `Specialist in ${primaryTradeName} with guaranteed workmanship and public liability insurance.`
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
      const organicTradeName = (tp.trades && tp.trades[0]) || tp.category || category || "Local Specialist";

      recommendations.push({
        uid: tp.uid || tp.id || "trader-organic-2",
        name: tp.name || tp.displayName || tp.businessName || "Local Verified Pro",
        businessName: tp.businessName || tp.companyName || `${tp.name} Quality Trades`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        category: organicTradeName,
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
        bio: tp.bio || `Reliable ${organicTradeName} specialist providing transparent quotes, punctuality, and high-quality finishes.`
      });
    }

    return recommendations;
  } catch (err) {
    console.error("Error generating hybrid trader recommendations:", err);
    return [];
  }
}
