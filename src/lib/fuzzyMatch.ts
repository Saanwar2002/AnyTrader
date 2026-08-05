import { TRADE_CATEGORIES } from "@/src/constants";

export interface CandidateItem {
  label: string;
  type: "category" | "subcategory" | "trade" | "trader";
  categoryName?: string;
  keywords?: string[];
}

export interface FuzzyMatchResult {
  suggestion: string;
  type: "category" | "subcategory" | "trade" | "trader";
  categoryName?: string;
  score: number;
  originalQuery: string;
}

/**
 * Calculates Damerau-Levenshtein distance (handles insertions, deletions, substitutions, and transpositions).
 */
export function damerauLevenshteinDistance(source: string, target: string): number {
  if (!source) return target ? target.length : 0;
  if (!target) return source.length;

  const src = source.toLowerCase();
  const tgt = target.toLowerCase();

  const m = src.length;
  const n = tgt.length;

  // Create distance matrix
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = src[i - 1] === tgt[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        src[i - 1] === tgt[j - 2] &&
        src[i - 2] === tgt[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  return d[m][n];
}

/**
 * Computes a normalized similarity score between 0.0 and 1.0.
 */
export function getSimilarityScore(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const maxLength = Math.max(s1.length, s2.length);
  const distance = damerauLevenshteinDistance(s1, s2);

  return 1 - distance / maxLength;
}

/**
 * Rich platform-wide synonym and keyword mappings across all 80+ trade categories.
 */
export const CATEGORY_SYNONYMS: Record<string, { categoryName: string; tradeTitle?: string; keywords: string[] }> = {
  // Carpentry & Joinery
  "joiner": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "kitchen", "door", "stair", "wardrobe", "decking"] },
  "joinery": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "timber", "furniture"] },
  "carpenter": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "skirting", "flooring"] },
  "carpentry": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "timber"] },

  // Plumbing & Gas
  "plumber": { categoryName: "Plumbing", tradeTitle: "Plumber", keywords: ["pipe", "leak", "boiler", "tap", "drain", "heating", "sink", "toilet"] },
  "plumbing": { categoryName: "Plumbing", tradeTitle: "Plumber", keywords: ["pipe", "leak", "boiler", "shower", "radiator"] },
  "gas safe": { categoryName: "Plumbing", tradeTitle: "Gas Safe Engineer", keywords: ["boiler", "heating", "gas"] },
  "boiler": { categoryName: "Plumbing", tradeTitle: "Boiler Engineer", keywords: ["servicing", "heating", "radiator"] },
  "drainage": { categoryName: "Plumbing", tradeTitle: "Drainage Specialist", keywords: ["unblock", "drain", "sewer"] },

  // Electrical
  "electrician": { categoryName: "Electrical", tradeTitle: "Electrician", keywords: ["wire", "fusebox", "rewire", "socket", "switch", "lighting", "eicr"] },
  "electrical": { categoryName: "Electrical", tradeTitle: "Electrician", keywords: ["rewiring", "ev charger", "pat test"] },
  "sparks": { categoryName: "Electrical", tradeTitle: "Electrician", keywords: ["wire", "power"] },

  // Roofing
  "roofer": { categoryName: "Roofing", tradeTitle: "Roofer", keywords: ["roof", "tile", "slate", "gutter", "chimney", "flat roof"] },
  "roofing": { categoryName: "Roofing", tradeTitle: "Roofer", keywords: ["roof", "leadwork", "fascia", "soffit"] },

  // Painting & Decorating
  "painter": { categoryName: "Painting & Decorating", tradeTitle: "Painter & Decorator", keywords: ["paint", "decorator", "wallpaper", "gloss", "emulsion"] },
  "decorator": { categoryName: "Painting & Decorating", tradeTitle: "Painter & Decorator", keywords: ["decorating", "interior", "exterior"] },

  // Gardening & Landscaping
  "gardener": { categoryName: "Gardening & Landscaping", tradeTitle: "Gardener", keywords: ["lawn", "mowing", "hedges", "weeding", "pruning"] },
  "landscaper": { categoryName: "Gardening & Landscaping", tradeTitle: "Landscaper", keywords: ["patio", "paving", "fencing", "decking", "turf"] },
  "tree surgeon": { categoryName: "Gardening & Landscaping", tradeTitle: "Tree Surgeon", keywords: ["tree", "lopping", "stump"] },

  // Childcare & Babysitting
  "babysitter": { categoryName: "Childcare & Babysitting", tradeTitle: "Babysitter & Nanny", keywords: ["babysitting", "childcare", "nanny", "kids", "after school"] },
  "babysitting": { categoryName: "Childcare & Babysitting", tradeTitle: "Babysitter & Nanny", keywords: ["childcare", "kids", "child"] },
  "nanny": { categoryName: "Childcare & Babysitting", tradeTitle: "Nanny", keywords: ["childcare", "baby", "infant", "nursery"] },
  "childcare": { categoryName: "Childcare & Babysitting", tradeTitle: "Childcare Provider", keywords: ["kids", "toddler", "after school"] },

  // Pet Services
  "pet sitter": { categoryName: "Pet Services", tradeTitle: "Pet Sitter & Walker", keywords: ["pet sitting", "dog", "cat", "animals", "house sitting"] },
  "pet sitting": { categoryName: "Pet Services", tradeTitle: "Pet Sitter", keywords: ["dog", "cat", "boarding", "holiday care"] },
  "dog walker": { categoryName: "Pet Services", tradeTitle: "Dog Walker", keywords: ["dog", "walking", "exercise", "puppy"] },
  "dog sitter": { categoryName: "Pet Services", tradeTitle: "Dog Sitter", keywords: ["dog boarding", "kennels", "pets"] },
  "cat sitter": { categoryName: "Pet Services", tradeTitle: "Cat Sitter", keywords: ["cat", "feline", "pets"] },

  // Auto & Vehicle Repairs
  "mechanic": { categoryName: "Auto & Vehicle Repairs", tradeTitle: "Mechanic", keywords: ["car", "mot", "service", "brakes", "clutch", "engine"] },
  "car repair": { categoryName: "Auto & Vehicle Repairs", tradeTitle: "Auto Technician", keywords: ["mechanic", "garage", "diagnostics"] },

  // Locksmith & Security
  "locksmith": { categoryName: "Locksmith & Security", tradeTitle: "Locksmith", keywords: ["lock", "key", "unlock", "door", "intercom", "cctv"] },

  // Cleaning
  "cleaner": { categoryName: "Cleaning Services", tradeTitle: "Cleaner", keywords: ["cleaning", "house", "deep clean", "end of tenancy", "carpet"] },

  // Handyman
  "handyman": { categoryName: "Handyman & Property Maintenance", tradeTitle: "Handyman", keywords: ["flat pack", "tv mounting", "shelving", "odd jobs", "repairs"] },

  // Tiling
  "tiler": { categoryName: "Tiling", tradeTitle: "Tiler", keywords: ["tiles", "grout", "splashback", "bathroom tiles", "kitchen tiles"] },

  // Plastering
  "plasterer": { categoryName: "Plastering & Rendering", tradeTitle: "Plasterer", keywords: ["rendering", "skimming", "drylining", "coving"] },

  // Bricklaying
  "bricklayer": { categoryName: "Bricklaying & Masonry", tradeTitle: "Bricklayer", keywords: ["brickwork", "pointing", "masonry", "wall"] },

  // Glazing
  "glazier": { categoryName: "Glazing & Windows", tradeTitle: "Glazier", keywords: ["glass", "double glazing", "bifold", "upvc", "window repair"] },

  // Pest Control
  "pest controller": { categoryName: "Pest Control", tradeTitle: "Pest Control Specialist", keywords: ["rats", "mice", "wasps", "vermin", "bugs"] },

  // Legal & Accounting
  "accountant": { categoryName: "Accounting & Financial", tradeTitle: "Accountant", keywords: ["tax", "self assessment", "bookkeeping", "vat", "payroll"] },
  "solicitor": { categoryName: "Legal Services (Solicitors)", tradeTitle: "Solicitor", keywords: ["conveyancing", "wills", "probate", "lawyer"] }
};

/**
 * Pre-populated dictionary of common trade category keywords, synonyms, and variations.
 */
export const COMMON_TRADE_VOCABULARY: CandidateItem[] = [
  // Plumbing
  { label: "Plumbing", type: "category", categoryName: "Plumbing" },
  { label: "Plumber", type: "trade", categoryName: "Plumbing" },
  { label: "Boiler Servicing", type: "subcategory", categoryName: "Plumbing" },
  { label: "Unblocking Drains", type: "subcategory", categoryName: "Plumbing" },
  { label: "Radiator Repair", type: "subcategory", categoryName: "Plumbing" },
  { label: "Central Heating", type: "subcategory", categoryName: "Plumbing" },

  // Electrical
  { label: "Electrical", type: "category", categoryName: "Electrical" },
  { label: "Electrician", type: "trade", categoryName: "Electrical" },
  { label: "Rewiring", type: "subcategory", categoryName: "Electrical" },
  { label: "EV Charger Installation", type: "subcategory", categoryName: "Electrical" },
  { label: "Fusebox Upgrade", type: "subcategory", categoryName: "Electrical" },

  // Carpentry
  { label: "Carpentry & Joinery", type: "category", categoryName: "Carpentry & Joinery" },
  { label: "Carpenter", type: "trade", categoryName: "Carpentry & Joinery" },
  { label: "Joiner", type: "trade", categoryName: "Carpentry & Joinery" },
  { label: "Kitchen Fitting", type: "subcategory", categoryName: "Carpentry & Joinery" },
  { label: "Decking Installation", type: "subcategory", categoryName: "Carpentry & Joinery" },

  // Roofing
  { label: "Roofing", type: "category", categoryName: "Roofing" },
  { label: "Roofer", type: "trade", categoryName: "Roofing" },
  { label: "Guttering", type: "subcategory", categoryName: "Roofing" },
  { label: "Flat Roof Repair", type: "subcategory", categoryName: "Roofing" },

  // Painting
  { label: "Painting & Decorating", type: "category", categoryName: "Painting & Decorating" },
  { label: "Painter & Decorator", type: "trade", categoryName: "Painting & Decorating" },
  { label: "Wallpapering", type: "subcategory", categoryName: "Painting & Decorating" },

  // Gardening & Landscaping
  { label: "Gardening & Landscaping", type: "category", categoryName: "Gardening & Landscaping" },
  { label: "Gardener", type: "trade", categoryName: "Gardening & Landscaping" },
  { label: "Landscaper", type: "trade", categoryName: "Gardening & Landscaping" },
  { label: "Lawn Mowing", type: "subcategory", categoryName: "Gardening & Landscaping" },

  // Bricklaying
  { label: "Bricklaying & Masonry", type: "category", categoryName: "Bricklaying & Masonry" },
  { label: "Bricklayer", type: "trade", categoryName: "Bricklaying & Masonry" },
  { label: "Stonemason", type: "trade", categoryName: "Bricklaying & Masonry" },

  // Plastering
  { label: "Plastering & Rendering", type: "category", categoryName: "Plastering & Rendering" },
  { label: "Plasterer", type: "trade", categoryName: "Plastering & Rendering" },
  { label: "Rendering", type: "subcategory", categoryName: "Plastering & Rendering" },

  // Tiling
  { label: "Tiling", type: "category", categoryName: "Tiling" },
  { label: "Tiler", type: "trade", categoryName: "Tiling" },

  // Locksmith
  { label: "Locksmith", type: "trade", categoryName: "Locksmith & Security" },
  { label: "Security & Locksmiths", type: "category", categoryName: "Locksmith & Security" },

  // Handyman
  { label: "Handyman", type: "trade", categoryName: "Handyman & Property Maintenance" },
  { label: "Flat Pack Assembly", type: "subcategory", categoryName: "Handyman & Property Maintenance" },

  // Cleaning
  { label: "Home Cleaning", type: "category", categoryName: "Cleaning Services" },
  { label: "Carpet Cleaning", type: "subcategory", categoryName: "Cleaning Services" },
  { label: "Cleaner", type: "trade", categoryName: "Cleaning Services" },

  // Childcare & Babysitting
  { label: "Childcare & Babysitting", type: "category", categoryName: "Childcare & Babysitting" },
  { label: "Babysitter", type: "trade", categoryName: "Childcare & Babysitting" },
  { label: "Babysitting", type: "subcategory", categoryName: "Childcare & Babysitting" },
  { label: "Nanny", type: "trade", categoryName: "Childcare & Babysitting" },
  { label: "Childcare", type: "category", categoryName: "Childcare & Babysitting" },

  // Pet Services & Pet Sitting
  { label: "Pet Services", type: "category", categoryName: "Pet Services" },
  { label: "Pet Sitting (in-home)", type: "subcategory", categoryName: "Pet Services" },
  { label: "Pet Sitting", type: "subcategory", categoryName: "Pet Services" },
  { label: "Pet Sitter", type: "trade", categoryName: "Pet Services" },
  { label: "Dog Boarding / Kennels", type: "subcategory", categoryName: "Pet Services" },
  { label: "Dog Boarding", type: "subcategory", categoryName: "Pet Services" },
  { label: "Dog Sitting", type: "subcategory", categoryName: "Pet Services" },
  { label: "Dog Sitter", type: "trade", categoryName: "Pet Services" },
  { label: "Cat Sitting", type: "subcategory", categoryName: "Pet Services" },
  { label: "Cat Sitter", type: "trade", categoryName: "Pet Services" },
  { label: "Dog Walking", type: "subcategory", categoryName: "Pet Services" },
  { label: "Dog Walker", type: "trade", categoryName: "Pet Services" },
  { label: "House Sitting", type: "subcategory", categoryName: "Pet Services" },
  { label: "Holiday Pet Care", type: "subcategory", categoryName: "Pet Services" }
];

/**
 * Builds candidate list dynamically combining static category definitions and active trader profiles.
 */
export function buildCandidateDictionary(
  traderList: Array<{ name?: string; trades?: string[]; services?: string[]; tags?: string[]; skills?: string[] }> = []
): CandidateItem[] {
  const dictionaryMap = new Map<string, CandidateItem>();

  // 1. Add static vocab items
  COMMON_TRADE_VOCABULARY.forEach((item) => {
    dictionaryMap.set(item.label.toLowerCase(), item);
  });

  // 2. Add synonyms map
  Object.entries(CATEGORY_SYNONYMS).forEach(([term, meta]) => {
    if (!dictionaryMap.has(term.toLowerCase())) {
      dictionaryMap.set(term.toLowerCase(), {
        label: meta.tradeTitle || term,
        type: "trade",
        categoryName: meta.categoryName,
        keywords: meta.keywords,
      });
    }
  });

  // 3. Add dynamically loaded TRADE_CATEGORIES from constants (All 80+ categories & subcategories)
  if (Array.isArray(TRADE_CATEGORIES)) {
    TRADE_CATEGORIES.forEach((cat: any) => {
      const catName = cat.name || cat;
      if (typeof catName === "string" && !dictionaryMap.has(catName.toLowerCase())) {
        dictionaryMap.set(catName.toLowerCase(), {
          label: catName,
          type: "category",
          categoryName: catName,
        });
      }

      if (cat.subcategories && Array.isArray(cat.subcategories)) {
        cat.subcategories.forEach((sub: string) => {
          if (typeof sub === "string" && !dictionaryMap.has(sub.toLowerCase())) {
            dictionaryMap.set(sub.toLowerCase(), {
              label: sub,
              type: "subcategory",
              categoryName: catName,
            });
          }
        });
      }
    });
  }

  // 4. Add active trader names, trades, services, tags, & skills
  traderList.forEach((trader) => {
    if (trader.name && !dictionaryMap.has(trader.name.toLowerCase())) {
      dictionaryMap.set(trader.name.toLowerCase(), {
        label: trader.name,
        type: "trader",
      });
    }

    if (trader.trades && Array.isArray(trader.trades)) {
      trader.trades.forEach((t) => {
        if (typeof t === "string" && !dictionaryMap.has(t.toLowerCase())) {
          dictionaryMap.set(t.toLowerCase(), {
            label: t,
            type: "trade",
            categoryName: t,
          });
        }
      });
    }

    if (trader.services && Array.isArray(trader.services)) {
      trader.services.forEach((s) => {
        if (typeof s === "string" && !dictionaryMap.has(s.toLowerCase())) {
          dictionaryMap.set(s.toLowerCase(), {
            label: s,
            type: "subcategory",
          });
        }
      });
    }

    if (trader.tags && Array.isArray(trader.tags)) {
      trader.tags.forEach((tag) => {
        if (typeof tag === "string" && !dictionaryMap.has(tag.toLowerCase())) {
          dictionaryMap.set(tag.toLowerCase(), {
            label: tag,
            type: "subcategory",
          });
        }
      });
    }

    if (trader.skills && Array.isArray(trader.skills)) {
      trader.skills.forEach((skill) => {
        if (typeof skill === "string" && !dictionaryMap.has(skill.toLowerCase())) {
          dictionaryMap.set(skill.toLowerCase(), {
            label: skill,
            type: "subcategory",
          });
        }
      });
    }
  });

  return Array.from(dictionaryMap.values());
}

/**
 * Platform-wide Trader & Service Matching Engine.
 * Matches a trader against a search query using:
 * - Direct substring matches (Name, Business, Trades, Services, Tags, Skills, Bio, Location)
 * - Category Synonym Expansion (e.g., "joiner" -> "Carpentry & Joinery")
 * - Multi-word token matching
 * - Fuzzy Levenshtein Distance (handles typos in query, trades, services, tags, and skills)
 */
export function matchTraderWithSearchQuery(
  tp: any,
  rawSearchQuery: string,
  candidates: CandidateItem[] = []
): boolean {
  if (!rawSearchQuery || !rawSearchQuery.trim()) return true;

  const query = rawSearchQuery.trim().toLowerCase();

  // 1. Direct substring matches across scalar fields
  const directFields: (string | undefined)[] = [
    tp.name,
    tp.businessName,
    tp.postcode,
    tp.city,
    tp.bio,
    tp.description,
    tp.tagline,
  ];

  for (const field of directFields) {
    if (field && field.toLowerCase().includes(query)) {
      return true;
    }
  }

  // Array fields (Trades, Services, Tags, Skills, Recommended Categories)
  const arrayFields: string[] = [
    ...(tp.trades || []),
    ...(tp.services || []),
    ...(tp.tags || []),
    ...(tp.skills || []),
    ...(tp.recommendedCategories || []),
  ];

  for (const item of arrayFields) {
    if (typeof item === "string" && item.toLowerCase().includes(query)) {
      return true;
    }
  }

  // 2. Synonym Mappings (e.g., "joiner", "babysitter", "mechanic", "roofer")
  const synonymMeta = CATEGORY_SYNONYMS[query];
  if (synonymMeta) {
    const targetCategory = synonymMeta.categoryName.toLowerCase();
    const targetTitle = synonymMeta.tradeTitle?.toLowerCase();
    const keywords = synonymMeta.keywords || [];

    const matchesCategory = arrayFields.some((item) => {
      if (typeof item !== "string") return false;
      const lower = item.toLowerCase();
      const matchesCat = lower === targetCategory || (targetCategory.length > 4 && lower.includes(targetCategory));
      const matchesTitle = targetTitle ? (lower === targetTitle || (targetTitle.length > 4 && lower.includes(targetTitle))) : false;
      const matchesKw = keywords.some((k) => {
        if (k.length <= 4) {
          const escaped = k.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
        }
        return lower.includes(k);
      });
      return matchesCat || matchesTitle || matchesKw;
    });

    if (matchesCategory) return true;
  }

  // 3. Multi-word Token Matching (e.g., "emergency plumber london", "kitchen fitting joiner")
  const tokens = query.split(/\s+/).filter((t) => t.length >= 2);

  if (tokens.length > 1) {
    const allTokensMatch = tokens.every((token) => {
      // Check direct scalar fields
      const matchesDirect = directFields.some((f) => {
        if (!f) return false;
        const lower = f.toLowerCase();
        if (token.length <= 3) {
          const escaped = token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
        }
        return lower.includes(token);
      });
      if (matchesDirect) return true;

      // Check array fields
      const matchesArray = arrayFields.some((item) => {
        if (typeof item !== "string") return false;
        const lower = item.toLowerCase();
        if (token.length <= 3) {
          const escaped = token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
        }
        return lower.includes(token);
      });
      if (matchesArray) return true;

      // Check token synonym
      const tokenSynonym = CATEGORY_SYNONYMS[token];
      if (tokenSynonym) {
        const catLower = tokenSynonym.categoryName.toLowerCase();
        return arrayFields.some(
          (item) => typeof item === "string" && item.toLowerCase().includes(catLower)
        );
      }

      // Check fuzzy token match
      if (token.length >= 4) {
        return arrayFields.some((item) => {
          if (typeof item !== "string") return false;
          const score = getSimilarityScore(token, item);
          const dist = damerauLevenshteinDistance(token, item.toLowerCase());
          return score >= 0.72 || (dist <= 1 && token.length >= 5);
        });
      }

      return false;
    });

    if (allTokensMatch) return true;
  }

  // 4. Single-token Fuzzy Match (handles typos like "carpntry", "plumbin", "electrcian", "rofing", "babysiter")
  if (!query.includes(" ") && query.length >= 4) {
    for (const item of arrayFields) {
      if (typeof item === "string") {
        const itemLower = item.toLowerCase();
        const score = getSimilarityScore(query, itemLower);
        const dist = damerauLevenshteinDistance(query, itemLower);

        if (score >= 0.75 || (dist <= 1 && query.length >= 5)) {
          return true;
        }

        // Tokenized check inside multi-word trade/service item (e.g. "Carpentry & Joinery")
        const itemTokens = itemLower.split(/[\s&,/]+/);
        for (const iTok of itemTokens) {
          if (iTok.length >= 4) {
            const tokScore = getSimilarityScore(query, iTok);
            const tokDist = damerauLevenshteinDistance(query, iTok);
            if (tokScore >= 0.75 || (tokDist <= 1 && query.length >= 5)) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Finds the best fuzzy match suggestion for a user's search query.
 */
export function findFuzzySuggestion(
  rawQuery: string,
  candidates: CandidateItem[]
): FuzzyMatchResult | null {
  if (!rawQuery) return null;

  const query = rawQuery.trim().toLowerCase();

  // Too short for meaningful spell checking
  if (query.length < 3) return null;

  // Check if query is an EXACT match or substring match for an existing candidate label
  const exactOrSubstringMatch = candidates.some((c) => {
    const labelLower = c.label.toLowerCase();
    return labelLower === query;
  });

  // If user typed an exact valid category/trade/trader, no suggestion needed
  if (exactOrSubstringMatch) return null;

  let bestMatch: CandidateItem | null = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    const labelLower = candidate.label.toLowerCase();

    // 1. Full string similarity
    const score = getSimilarityScore(query, labelLower);

    // 2. Word-by-word token comparison (for multi-word queries or multi-word candidates)
    const queryTokens = query.split(/\s+/);
    const labelTokens = labelLower.split(/\s+/);

    let tokenBestScore = 0;
    queryTokens.forEach((qTok) => {
      if (qTok.length >= 3) {
        labelTokens.forEach((lTok) => {
          if (lTok.length >= 3) {
            const tokScore = getSimilarityScore(qTok, lTok);
            if (tokScore > tokenBestScore) {
              tokenBestScore = tokScore;
            }
          }
        });
      }
    });

    const finalCandidateScore = Math.max(score, tokenBestScore);

    // Filter thresholds based on length:
    const distance = damerauLevenshteinDistance(query, labelLower);
    const maxAllowedDistance = query.length <= 5 ? 2 : 3;

    if (
      finalCandidateScore > highestScore &&
      finalCandidateScore >= 0.62 &&
      distance <= maxAllowedDistance &&
      labelLower !== query
    ) {
      highestScore = finalCandidateScore;
      bestMatch = candidate;
    }
  }

  if (bestMatch && highestScore >= 0.62) {
    return {
      suggestion: bestMatch.label,
      type: bestMatch.type,
      categoryName: bestMatch.categoryName,
      score: highestScore,
      originalQuery: rawQuery,
    };
  }

  return null;
}

