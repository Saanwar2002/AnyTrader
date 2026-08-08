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

export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
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
 * Checks if a query word token (qTok) matches a target word token (tTok).
 * CRITICAL RULE: Matching MUST occur at the START (prefix) of target tokens.
 * A query token like "pet" will NEVER match "carpet" because "carpet" does not start with "pet".
 */
export function tokenMatches(qTok: string, tTok: string): boolean {
  if (!qTok || !tTok) return false;
  const q = qTok.toLowerCase().trim();
  const t = tTok.toLowerCase().trim();

  // Exact token match
  if (q === t) return true;

  // Very short query tokens (1-2 chars e.g. "ev", "tv")
  if (q.length <= 2) {
    return t === q || (t.startsWith(q) && t.length <= 3);
  }

  // Prefix match: Target token starts with query token (e.g., q="pet" matches t="pet", "pets", "petting")
  if (t.startsWith(q)) return true;

  // Query token starts with target token if query is longer (e.g. q="plumber", t="plum")
  if (q.length >= 4 && q.startsWith(t) && t.length >= 3) return true;

  // Prefix-constrained fuzzy match for typos (e.g. "plumbin" vs "plumbing", "electrcian" vs "electrician")
  // MUST share at least the first 3 or 4 letters at the VERY START of the word token!
  if (q.length >= 4 && t.length >= 4) {
    const prefixLen = Math.min(4, q.length, t.length);
    if (q.slice(0, prefixLen) === t.slice(0, prefixLen)) {
      const dist = damerauLevenshteinDistance(q, t);
      const maxDist = Math.max(q.length, t.length) <= 6 ? 1 : 2;
      if (dist <= maxDist) return true;
    }
  }

  return false;
}

/**
 * Checks if targetText contains any word token that matches query token(s).
 * Supports multi-token query where EVERY query token must find a tokenized match in targetText.
 */
export function textContainsTokenMatch(targetText: string, searchQuery: string): boolean {
  if (!targetText || !searchQuery) return false;
  const targetTokens = tokenize(targetText);
  const queryTokens = tokenize(searchQuery);

  if (targetTokens.length === 0 || queryTokens.length === 0) return false;

  // All query tokens must match a target token in targetText
  return queryTokens.every((qTok) =>
    targetTokens.some((tTok) => tokenMatches(qTok, tTok))
  );
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
  "cleaner": { categoryName: "Home Cleaning", tradeTitle: "Cleaner", keywords: ["cleaning", "house", "deep clean", "end of tenancy", "carpet"] },
  "bin cleaning": { categoryName: "Specialist Cleaning", tradeTitle: "Wheelie Bin Cleaner", keywords: ["wheelie bin", "mobile bin wash", "bin cleaning", "bin store", "domestic bin wash"] },
  "wheelie bin cleaning": { categoryName: "Specialist Cleaning", tradeTitle: "Wheelie Bin Cleaner", keywords: ["bin wash", "domestic bin cleaning", "wheelie bin", "mobile bin cleaning"] },
  "bin store cleaning": { categoryName: "Industrial & Commercial Cleaning", tradeTitle: "Commercial Bin Store Cleaner", keywords: ["bin store", "refuse area", "commercial bin", "refuse store"] },

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
  "solicitor": { categoryName: "Legal Services (Solicitors)", tradeTitle: "Solicitor", keywords: ["conveyancing", "wills", "probate", "lawyer"] },

  // Courier, Parcel & Bulky Delivery
  "parcel delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Express Courier", keywords: ["parcel", "package", "courier", "delivery", "post", "asap", "same day", "on demand"] },
  "courier": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Courier & Delivery Driver", keywords: ["parcel", "dispatch", "express", "urgent", "same day", "van delivery"] },
  "delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Delivery Driver / Courier", keywords: ["parcel", "bulky item", "washing machine", "fridge", "dishwasher", "courier"] },
  "bulky item delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Bulky Goods Carrier", keywords: ["washing machine", "fridge", "dishwasher", "appliance", "furniture", "heavy item", "sofa"] },
  "washing machine delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Appliance Courier", keywords: ["washing machine", "white goods", "appliance transport", "plumb in", "bulky delivery"] },
  "fridge delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Appliance Courier", keywords: ["fridge", "freezer", "american fridge freezer", "white goods", "bulky delivery"] },
  "dishwasher delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "Appliance Courier", keywords: ["dishwasher", "kitchen appliance", "white goods", "bulky delivery"] },
  "appliance delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "White Goods Transport Specialist", keywords: ["washing machine", "fridge", "dishwasher", "cooker", "tumble dryer", "bulky delivery"] },
  "on demand delivery": { categoryName: "Courier, Parcel & Express Delivery", tradeTitle: "On-Demand Courier", keywords: ["asap delivery", "instant courier", "same day van", "express pickup", "fast courier"] },
  "man and van": { categoryName: "Removals", tradeTitle: "Man & Van Driver", keywords: ["van delivery", "bulky items", "furniture", "appliance transport", "pickup", "moving"] }
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
  { label: "Holiday Pet Care", type: "subcategory", categoryName: "Pet Services" },

  // Courier, Parcel & Express Delivery
  { label: "Courier, Parcel & Express Delivery", type: "category", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Parcel Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Express Courier", type: "trade", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "ASAP Express Parcel Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Bulky Item & Heavy Appliance Transport", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Washing Machine Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Fridge / Freezer Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Dishwasher Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "White Goods & Furniture Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "On-Demand Van Delivery", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Marketplace & Store Pickup", type: "subcategory", categoryName: "Courier, Parcel & Express Delivery" },
  { label: "Same-Day Courier", type: "trade", categoryName: "Courier, Parcel & Express Delivery" }
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
 * Matches a trader against a search query using tokenized prefix matching:
 * - Prevents partial word substring matches in the middle/end of words (e.g. "pet" won't match "carpet")
 * - Enforces front-of-word prefix matching for query tokens against trader fields, trades, services, tags, & skills
 * - Supports synonym expansion (e.g. "joiner" -> "Carpentry & Joinery", "sparks" -> "Electrical")
 */
export function matchTraderWithSearchQuery(
  tp: any,
  rawSearchQuery: string,
  candidates: CandidateItem[] = []
): boolean {
  if (!rawSearchQuery || !rawSearchQuery.trim()) return true;

  const queryTokens = tokenize(rawSearchQuery);
  if (queryTokens.length === 0) return true;

  // Extract all scalar text fields from trader profile
  const directFields: string[] = [
    tp.name,
    tp.businessName,
    tp.postcode,
    tp.city,
    tp.bio,
    tp.description,
    tp.tagline,
  ].filter((f): f is string => typeof f === "string" && f.trim().length > 0);

  // Extract all array fields from trader profile
  const arrayFields: string[] = [
    ...(tp.trades || []),
    ...(tp.services || []),
    ...(tp.tags || []),
    ...(tp.skills || []),
    ...(tp.recommendedCategories || []),
  ].filter((f): f is string => typeof f === "string" && f.trim().length > 0);

  const allTraderFields = [...directFields, ...arrayFields];

  const rawQueryLower = rawSearchQuery.trim().toLowerCase();
  const mainSynonym = CATEGORY_SYNONYMS[rawQueryLower];

  // Every token in queryTokens must find a valid front-of-word token match
  return queryTokens.every((qTok) => {
    // 1. Direct token match across any field on the trader profile
    const directMatch = allTraderFields.some((field) => textContainsTokenMatch(field, qTok));
    if (directMatch) return true;

    // 2. Token synonym expansion (e.g., qTok = "joiner" -> category "Carpentry & Joinery", tradeTitle "Carpenter & Joiner")
    const tokenSynonym = CATEGORY_SYNONYMS[qTok] || (qTok === rawQueryLower ? mainSynonym : undefined);
    if (tokenSynonym) {
      const targetCategory = tokenSynonym.categoryName;
      const targetTitle = tokenSynonym.tradeTitle;
      const keywords = tokenSynonym.keywords || [];

      const synonymMatch = allTraderFields.some((field) => {
        if (targetCategory && textContainsTokenMatch(field, targetCategory)) return true;
        if (targetTitle && textContainsTokenMatch(field, targetTitle)) return true;
        return keywords.some((kw) => textContainsTokenMatch(field, kw));
      });

      if (synonymMatch) return true;
    }

    return false;
  });
}

/**
 * Finds the best fuzzy match suggestion for a user's search query based on tokenized prefix matching.
 */
export function findFuzzySuggestion(
  rawQuery: string,
  candidates: CandidateItem[]
): FuzzyMatchResult | null {
  if (!rawQuery) return null;

  const query = rawQuery.trim().toLowerCase();
  if (query.length < 3) return null;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return null;

  // Check if query is ALREADY a token match for an existing candidate label
  const exactOrTokenMatch = candidates.some((c) => {
    return textContainsTokenMatch(c.label, query);
  });

  if (exactOrTokenMatch) return null;

  let bestMatch: CandidateItem | null = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    const labelTokens = tokenize(candidate.label);

    let matchedTokenCount = 0;
    let tokenScoreSum = 0;

    queryTokens.forEach((qTok) => {
      let maxTokScore = 0;
      labelTokens.forEach((cTok) => {
        if (tokenMatches(qTok, cTok)) {
          maxTokScore = 1.0;
        } else if (qTok.length >= 4 && cTok.length >= 4) {
          const prefixLen = Math.min(3, qTok.length, cTok.length);
          if (qTok.slice(0, prefixLen) === cTok.slice(0, prefixLen)) {
            const tokScore = getSimilarityScore(qTok, cTok);
            if (tokScore > maxTokScore) {
              maxTokScore = tokScore;
            }
          }
        }
      });

      if (maxTokScore > 0) {
        matchedTokenCount++;
        tokenScoreSum += maxTokScore;
      }
    });

    if (matchedTokenCount > 0) {
      const avgScore = tokenScoreSum / queryTokens.length;
      if (avgScore > highestScore && avgScore >= 0.65) {
        highestScore = avgScore;
        bestMatch = candidate;
      }
    }
  }

  if (bestMatch && highestScore >= 0.65) {
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

