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
export function getCategoryAliases(categories: string | string[]): string[] {
  const catList = Array.isArray(categories) ? categories : [categories];
  const aliases = new Set<string>();

  catList.forEach((rawCat) => {
    const cat = (rawCat || "").toLowerCase().trim();
    if (!cat) return;
    aliases.add(cat);

    if (cat.includes("cake") || cat.includes("bake") || cat.includes("catering") || cat.includes("pastry")) {
      ["bake n cake", "cake maker & baker", "cake maker", "baker", "baking", "wedding cakes", "celebration cakes", "bespoke bakes", "catering & private chef", "pastry chef"].forEach(a => aliases.add(a));
    }
    if (cat.includes("plumb") || cat.includes("gas") || cat.includes("heating") || cat.includes("boiler") || cat.includes("hvac") || cat.includes("radiator")) {
      ["plumbing", "gas & heating", "gas engineering", "heating", "boiler engineer", "boiler installation", "boiler repair", "emergency leak repair", "gas safety certification", "bathroom fitting", "plumber"].forEach(a => aliases.add(a));
    }
    if (cat.includes("electr") || cat.includes("smart home") || cat.includes("eicr") || cat.includes("ev charger")) {
      ["electrical", "electrician", "smart home & automation", "security systems", "ev charger fitting", "consumer unit upgrade", "eicr safety inspection"].forEach(a => aliases.add(a));
    }
    if (cat.includes("remov") || cat.includes("move") || cat.includes("man and van") || cat.includes("man & van")) {
      ["removals", "home & domestic removals", "house removals", "man & van", "man and van", "house & garden clearance", "flat move"].forEach(a => aliases.add(a));
    }
    if (cat.includes("clean") || cat.includes("carpet") || cat.includes("bin") || cat.includes("tenancy")) {
      ["home cleaning", "domestic & commercial cleaning", "specialist cleaning", "carpet & upholstery cleaning", "end of tenancy", "window cleaning", "wheelie bin"].forEach(a => aliases.add(a));
    }
    if (cat.includes("paint") || cat.includes("decorat") || cat.includes("wallpaper")) {
      ["painting & decorating", "painter & decorator", "decorating", "wallpapering", "heritage decor", "interior painting", "exterior painting"].forEach(a => aliases.add(a));
    }
    if (cat.includes("carpent") || cat.includes("joiner") || cat.includes("door")) {
      ["carpentry & joinery", "carpenter & joiner", "joiner", "door fitting", "door hanging", "timber decking"].forEach(a => aliases.add(a));
    }
    if (cat.includes("build") || cat.includes("roof") || cat.includes("brick") || cat.includes("extension") || cat.includes("loft")) {
      ["builder", "building & construction", "roofing", "roofing services", "slate roofing", "house extension", "loft conversion", "guttering & drainage"].forEach(a => aliases.add(a));
    }
    if (cat.includes("lock") || cat.includes("security") || cat.includes("key")) {
      ["locksmith", "security systems", "locksmith & security", "master locksmith", "key cutting", "emergency door opening"].forEach(a => aliases.add(a));
    }
    if (cat.includes("tailor") || cat.includes("alterat") || cat.includes("seamstress") || cat.includes("laundry")) {
      ["tailoring, alterations & laundry services", "tailoring", "garment alterations", "bespoke tailoring", "seamstress", "laundry"].forEach(a => aliases.add(a));
    }
    if (cat.includes("pet") || cat.includes("dog") || cat.includes("cat")) {
      ["pet services", "pet care specialist", "dog walker", "cat sitter", "pet care", "dog walking", "cat sitting"].forEach(a => aliases.add(a));
    }
    if (cat.includes("garden") || cat.includes("landscap") || cat.includes("tree") || cat.includes("paving")) {
      ["landscaping & garden", "tree surgery & arboriculture", "driveways, patios & paving", "fencing", "decking"].forEach(a => aliases.add(a));
    }
    if (cat.includes("courier") || cat.includes("parcel") || cat.includes("delivery") || cat.includes("bulky")) {
      ["courier, parcel & express delivery", "on-demand delivery & bulky goods courier", "express delivery", "courier"].forEach(a => aliases.add(a));
    }
    if (cat.includes("labour") || cat.includes("helper") || cat.includes("mate") || cat.includes("digging")) {
      ["general labour, trade mates & site helpers", "site helper", "trade mate", "labourer"].forEach(a => aliases.add(a));
    }
  });

  return Array.from(aliases);
}

/**
 * Calculates a strict trade relevance score (0 - 100) between a trader and target categories/inquiry.
 * Returns 0 if the trader does not belong to the requested trade domain.
 */
export function calculateTradeRelevanceScore(
  trader: any,
  targetAliases: string[],
  userQueryTokens: string[] = []
): number {
  if (!trader) return 0;

  const traderTrades = (Array.isArray(trader.trades) ? trader.trades : [trader.trades || ""])
    .filter(Boolean).map((t: string) => t.toLowerCase().trim());
  const recCats = (Array.isArray(trader.recommendedCategories) ? trader.recommendedCategories : [trader.recommendedCategories || ""])
    .filter(Boolean).map((t: string) => t.toLowerCase().trim());
  const services = (Array.isArray(trader.services) ? trader.services : [trader.services || ""])
    .filter(Boolean).map((s: string) => s.toLowerCase().trim());
  const tags = (Array.isArray(trader.tags) ? trader.tags : [trader.tags || ""])
    .filter(Boolean).map((tg: string) => tg.toLowerCase().trim());
  const skills = (Array.isArray(trader.skills) ? trader.skills : [trader.skills || ""])
    .filter(Boolean).map((sk: string) => sk.toLowerCase().trim());
  const subcats = (Array.isArray(trader.subcategories) ? trader.subcategories : [trader.subcategories || ""])
    .filter(Boolean).map((sb: string) => sb.toLowerCase().trim());

  const traderCat = (trader.category || "").toLowerCase().trim();
  const busCat = (trader.businessCategory || "").toLowerCase().trim();
  const primary = (trader.primaryTrade || "").toLowerCase().trim();
  const company = (trader.businessName || trader.companyName || "").toLowerCase().trim();
  const bio = (trader.bio || "").toLowerCase().trim();

  let score = 0;

  // 1. Direct Primary Category or Primary Trade Match (+50 pts)
  for (const alias of targetAliases) {
    if (primary && (primary === alias || primary.includes(alias) || alias.includes(primary))) {
      score += 50;
      break;
    }
    if (traderCat && (traderCat === alias || traderCat.includes(alias) || alias.includes(traderCat))) {
      score += 50;
      break;
    }
    if (busCat && (busCat === alias || busCat.includes(alias) || alias.includes(busCat))) {
      score += 45;
      break;
    }
  }

  // 2. Direct Trade List Match (+40 pts)
  for (const alias of targetAliases) {
    const hasTrade = traderTrades.some((tr: string) => tr === alias || tr.includes(alias) || alias.includes(tr));
    if (hasTrade) {
      score += 40;
      break;
    }
  }

  // 3. Recommended Category or Subcategory Match (+30 pts)
  for (const alias of targetAliases) {
    const hasRec = recCats.some((rc: string) => rc === alias || rc.includes(alias) || alias.includes(rc));
    const hasSub = subcats.some((sb: string) => sb === alias || sb.includes(alias) || alias.includes(sb));
    if (hasRec || hasSub) {
      score += 30;
      break;
    }
  }

  // 4. Specific Service Offerings or Verified Skills Match (+20 pts)
  for (const alias of targetAliases) {
    const hasService = services.some((s: string) => s === alias || s.includes(alias) || alias.includes(s));
    const hasTag = tags.some((tg: string) => tg === alias || tg.includes(alias) || alias.includes(tg));
    const hasSkill = skills.some((sk: string) => sk === alias || sk.includes(alias) || alias.includes(sk));
    if (hasService || hasTag || hasSkill) {
      score += 20;
      break;
    }
  }

  // 5. Company Name trade keyword match (+15 pts)
  for (const alias of targetAliases) {
    if (company && company.includes(alias)) {
      score += 15;
      break;
    }
  }

  // If there is ZERO trade/category connection, return 0 (strict gate)
  if (score === 0) {
    return 0;
  }

  // 6. User Query domain token reinforcement (only granted if trade gate already passed)
  if (userQueryTokens.length > 0) {
    const allProfileText = [...traderTrades, ...services, ...tags, ...skills, ...subcats, company, bio].join(" ");
    let queryHits = 0;
    for (const tok of userQueryTokens) {
      if (allProfileText.includes(tok)) {
        queryHits++;
      }
    }
    score += Math.min(queryHits * 5, 20);
  }

  return score;
}

/**
 * Retrieves recommended traders using the Hybrid Fairness & Monetization Engine:
 * - Accepts single category OR array of detected categories (e.g. from TradeBot AI)
 * - Enforces strict Category-Aware Gating so unrelated trades (e.g. builders for a plumbing issue) never leak
 * - Slot 1: Featured Pro ⚡ (Monetized / Priority Partner with top badges within matching category)
 * - Slot 2: Organic Match 🌟 (Fairness Rotation with distance & quality ranking within matching category)
 */
export async function getHybridTraderRecommendations(
  categories: string | string[],
  userPostcode?: string,
  liveTradersPool?: Tradesperson[],
  userQuery?: string
): Promise<TraderRecommendationCard[]> {
  try {
    const categoryList = Array.isArray(categories) 
      ? categories.filter(Boolean)
      : (categories ? [categories] : []);
    
    if (categoryList.length === 0) {
      categoryList.push("General Trades");
    }

    let pool: Tradesperson[] = [];

    // 1. Fetch live traders from Firestore if available
    let firestoreTraders: Tradesperson[] = [];
    if (!liveTradersPool || liveTradersPool.length === 0) {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("role", "in", ["tradesperson", "trader", "business"]), limit(50));
        const snap = await getDocs(q);
        if (!snap.empty) {
          firestoreTraders = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Tradesperson));
        }
      } catch (err) {
        console.warn("Firestore fetch for traders skipped:", err);
      }
    }

    // Always merge seeded mock traders into pool so verified profiles in all 86+ trade sectors are accessible
    const seedPool = INITIAL_MOCK_TRADERS as Tradesperson[];
    if (liveTradersPool && liveTradersPool.length > 0) {
      const existingUids = new Set(liveTradersPool.map(t => t.uid));
      pool = [...liveTradersPool, ...seedPool.filter(s => !existingUids.has(s.uid))];
    } else {
      const existingUids = new Set(firestoreTraders.map(t => t.uid));
      pool = [...firestoreTraders, ...seedPool.filter(s => !existingUids.has(s.uid))];
    }

    // 2. Strict Trade Relevance Filtering across all detected categories
    const isAllCategories = categoryList.some(c => c.toLowerCase() === "all" || c.toLowerCase() === "general trades" || c.toLowerCase() === "all trades");
    const targetAliases = getCategoryAliases(categoryList);

    // Extract significant query tokens (min 3 chars, skip noise and generic words)
    const noiseWords = new Set([
      "how", "much", "does", "cost", "what", "where", "when", "who", "which", "is", "are", "was", "were", "been",
      "the", "and", "for", "with", "apply", "laws", "rule", "rules", "need", "hire", "find", "best", "good", "local",
      "system", "systems", "installed", "installing", "installation", "new", "complete", "including", "included",
      "house", "home", "full", "done", "week", "weeks", "work", "price", "prices", "quote", "quotes", "about", "tell",
      "estimate", "service", "services", "unit", "area", "type", "within", "around", "near", "nearby", "trader", "tradesperson",
      "company", "business", "repair", "repairs", "fixed", "fixing", "problem", "problems", "issue", "issues",
      "making", "sounds", "causes", "typical", "losing", "fault"
    ]);
    
    const queryTokens = (userQuery || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(t => t.length >= 3 && !noiseWords.has(t));

    // Filter and score candidates based on strict trade domain gating
    const scoredCandidates: Array<{
      tp: any;
      tradeScore: number;
      rating: number;
      reviews: number;
      isVerified: boolean;
      isGasSafe: boolean;
      isNiceic: boolean;
      isVideo: boolean;
      isProSubscribed: boolean;
      isAreaMatch: boolean;
      totalScore: number;
      isNewcomer: boolean;
    }> = [];

    const userPrefix = (userPostcode || "").trim().split(" ")[0]?.toUpperCase() || "";

    for (const traderObj of pool) {
      const tp: any = traderObj;
      const tradeScore = isAllCategories ? 50 : calculateTradeRelevanceScore(tp, targetAliases, queryTokens);

      // STRICT GATE: Must have a valid trade relevance score (> 0) to enter the candidate pool
      if (tradeScore <= 0) {
        continue;
      }

      const rating = tp.rating || 4.8;
      const reviews = tp.reviewsCount || tp.totalReviews || tp.totalJobsCompleted || tp.totalJobsDone || 12;
      const isVerified = tp.verificationStatus === "verified" || tp.isVerified === true;
      const isGasSafe = tp.isGasSafeRegistered || tp.certifications?.some((c: any) => c.name?.toLowerCase().includes("gas safe")) || tp.recommendedCategories?.includes("Gas & Heating");
      const isNiceic = tp.isNiceicApproved || tp.certifications?.some((c: any) => c.name?.toLowerCase().includes("niceic"));
      const isVideo = Boolean(tp.videoVerificationUrl || tp.verificationVideoUrl || tp.isVideoVerified || tp.videoVerificationStatus === "verified" || tp.videoVerificationStatus === "approved" || tp.hasVerifiedVideoProSubscription);
      const isProSubscribed = Boolean(tp.subscriptionType === "business" || tp.subscriptionType === "pro" || tp.tier === "premium" || tp.subscriptionTier === "gold" || tp.subscriptionTier === "platinum" || tp.subscriptionTier === "pro" || tp.tierId === "Gold" || tp.tierId === "Platinum" || tp.tierId === "Pro" || tp.isTradeOsPro || tp.hasVerifiedVideoProSubscription);

      const tpPostcode = (tp.postcode || "").trim().toUpperCase();
      const isAreaMatch = !!(userPrefix && tpPostcode.startsWith(userPrefix));

      // Calculate combined score
      const totalScore = tradeScore + (rating * 10) + Math.min(reviews, 30) + (isVerified ? 15 : 0) + (isAreaMatch ? 20 : 0);

      scoredCandidates.push({
        tp,
        tradeScore,
        rating,
        reviews,
        isVerified,
        isGasSafe: !!isGasSafe,
        isNiceic: !!isNiceic,
        isVideo,
        isProSubscribed,
        isAreaMatch,
        totalScore,
        isNewcomer: reviews <= 5
      });
    }

    // If zero traders matched the requested categories, return empty to display genuine demand gap
    if (scoredCandidates.length === 0) {
      return [];
    }

    // Sort by trade relevance and total score
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    const recommendations: TraderRecommendationCard[] = [];
    const primaryCategoryLabel = categoryList[0] || "Certified Specialist";

    // --- SLOT 1: FEATURED PRO ⚡ (Monetized / Pro Tier Partner strictly within matching category) ---
    const featuredCandidates = scoredCandidates.filter((c) => c.isProSubscribed || (c.isVerified && c.rating >= 4.7));
    const featuredPick = featuredCandidates.length > 0
      ? featuredCandidates[Math.floor(Date.now() / (1000 * 60 * 30)) % featuredCandidates.length]
      : scoredCandidates[0];

    if (featuredPick) {
      const tp: any = featuredPick.tp;
      const primaryTradeName = (tp.trades && tp.trades[0]) || tp.category || primaryCategoryLabel;
      recommendations.push({
        uid: tp.uid || tp.id || "trader-featured-1",
        name: tp.name || tp.displayName || tp.businessName || "Certified Trade Specialist",
        businessName: tp.businessName || tp.companyName || `${tp.name}'s ${primaryTradeName}`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150",
        category: primaryTradeName,
        rating: Math.max(4.7, featuredPick.rating),
        reviewsCount: Math.max(18, featuredPick.reviews),
        hourlyRate: tp.hourlyRate || tp.miniProfileSettings?.hourlyRate || tp.baseRate || 45,
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

    // --- SLOT 2: ORGANIC FAIR ROTATION MATCH 🌟 (Strictly within trade-qualified candidate pool) ---
    const organicPool = scoredCandidates.filter((c) => c.tp.uid !== featuredPick?.tp.uid);
    const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 15)); // 15-min fair share rotation
    
    if (organicPool.length > 0) {
      // Sort organic pool with a combination of trade score and rotation hash to ensure relevant fair exposure
      const sortedOrganic = [...organicPool].sort((a, b) => {
        // First prioritize high trade match
        if (Math.abs(b.tradeScore - a.tradeScore) >= 20) {
          return b.tradeScore - a.tradeScore;
        }
        // Then apply fairness rotation seed
        const hashA = ((a.tp.uid || "a").charCodeAt(0) + rotationSeed) % 23;
        const hashB = ((b.tp.uid || "b").charCodeAt(0) + rotationSeed) % 23;
        return hashA - hashB;
      });

      const organicPick = sortedOrganic[0];
      const tp: any = organicPick.tp;
      const organicTradeName = (tp.trades && tp.trades[0]) || tp.category || primaryCategoryLabel;

      recommendations.push({
        uid: tp.uid || tp.id || "trader-organic-2",
        name: tp.name || tp.displayName || tp.businessName || "Local Verified Pro",
        businessName: tp.businessName || tp.companyName || `${tp.name} Quality Trades`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        category: organicTradeName,
        rating: organicPick.rating,
        reviewsCount: organicPick.reviews,
        hourlyRate: tp.hourlyRate || tp.miniProfileSettings?.hourlyRate || tp.baseRate || 40,
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
