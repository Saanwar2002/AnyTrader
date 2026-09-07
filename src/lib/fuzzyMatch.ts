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

const VALID_INFLECTION_SUFFIXES = new Set([
  "", "s", "es", "ed", "ing", "er", "ers", "or", "ors", "ies", "y", 
  "ment", "ments", "tion", "tions", "ation", "ations", "ian", "ians", "ist", "ists", "al", "ic", "able", "ible"
]);

/**
 * Validates morphological English inflections between a longer word and a shorter root.
 * Prevents false-positive root substring matches (e.g., 'tier' matching 'tie', or 'carpet' matching 'car').
 */
function isInflectionalMatch(longer: string, shorter: string): boolean {
  if (longer.startsWith(shorter)) {
    const suffix = longer.slice(shorter.length);
    if (VALID_INFLECTION_SUFFIXES.has(suffix)) return true;
  }
  // If shorter ends in "e", e.g. "pipe" -> "piping", "bake" -> "baking", "wire" -> "wiring"
  if (shorter.endsWith("e") && shorter.length >= 4) {
    const stem = shorter.slice(0, -1);
    if (longer.startsWith(stem)) {
      const suffix = longer.slice(stem.length);
      if (VALID_INFLECTION_SUFFIXES.has(suffix)) return true;
    }
  }
  // If shorter ends in "y", e.g. "battery" -> "batteries"
  if (shorter.endsWith("y") && shorter.length >= 4) {
    const stem = shorter.slice(0, -1);
    if (longer.startsWith(stem)) {
      const suffix = longer.slice(stem.length);
      if (suffix === "ies" || suffix === "ied" || suffix === "ying") return true;
    }
  }
  return false;
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

  // Very short query tokens (1-2 chars e.g. "ev", "tv", "cp", "pv")
  // Strict exact match only for 1-2 char tokens to prevent single letter prefix collisions (e.g. 's' matching 'sky')
  if (q.length <= 2) {
    return t === q;
  }

  // Known accidental root collision guards
  const falsePrefixMap: Record<string, string[]> = {
    all: ["allergen", "allergy", "allerg", "allotment", "allow", "alloy", "alligator"],
    cat: ["cater", "catch", "categ", "cattl", "catas", "catal", "cathe"],
    car: ["carpet", "carpen", "carv", "cart", "carr", "card"],
    tax: ["taxi"],
    tap: ["tape", "tapest"],
    pet: ["petrol", "petit", "petri"],
    van: ["vanta", "vangu", "vanis", "vanil"],
    pan: ["panel", "panic", "pant"],
    bar: ["barri", "baron", "barom", "bark"],
    man: ["manner", "mania", "manual", "mandat", "manag", "manic", "manif"],
    pin: ["pinn", "pint", "pine", "ping"],
    bin: ["bind", "bing", "bino"],
    saw: ["sausage"],
    gas: ["gasket", "gasp", "gastro"],
    rat: ["rate", "ratio", "ration", "rating"],
    bat: ["batter", "battle", "batch"],
    tie: ["tier", "tiered", "ties"],
    walk: ["walker"],
  };

  if ((q === "walk" && t === "walker") || (q === "walker" && t === "walk")) {
    return false;
  }

  const invalidPrefixes = falsePrefixMap[q];
  if (invalidPrefixes && invalidPrefixes.some((p) => t.startsWith(p))) {
    return false;
  }

  // Inflectional morphological match: (e.g. "plumber" vs "plumbing", "radiators" vs "radiator", "pipes" vs "pipe")
  if (t.length >= q.length) {
    if (isInflectionalMatch(t, q)) return true;
  } else {
    if (isInflectionalMatch(q, t)) return true;
  }

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
 * Smart Category Matching Engine. Matches category based on name, subcategories,
 * dynamic synonyms, and related_terms metadata with strict priority, ignoring common action/problem "noise" words.
 */
export function categoryMatchesSearch(
  cat: { 
    name: string; 
    subcategories?: string[]; 
    synonyms?: string[]; 
    related_terms?: string[]; 
    relatedTerms?: string[];
  },
  searchQuery: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const rawQueryTokens = tokenize(searchQuery);
  if (rawQueryTokens.length === 0) return true;

  // Identify "noise" or "action" problem-descriptor and generic non-trade words
  const noiseWords = new Set([
    "my", "is", "are", "was", "were", "been", "will", "would", "should", "can", "could", "have", "has", "had", 
    "do", "does", "did", "need", "needed", "needs", "want", "wants", "wanted", "fix", "fixing", "fixed", 
    "repair", "repairing", "repairs", "repaired", "broken", "broke", "break", "leaking", "leaky", "leak", "leaks", 
    "damaged", "damage", "damaging", "urgent", "emergency", "fast", "asap", "quick", "quickly", "help", "helping", 
    "helped", "with", "the", "a", "an", "some", "of", "for", "to", "in", "on", "at", "by", "and", "or", 
    "new", "old", "replace", "replacing", "replaced", "replacement", "install", "installing", "installed", 
    "installation", "installations", "service", "servicing", "serviced", "maintenance", "problem", "problems", 
    "issue", "issues", "trouble", "work", "worker", "job", "jobs", "hire", "hiring", "hired", "please", 
    "thank", "thanks", "find", "finding", "get", "getting", "about",
    // Generic non-trade descriptors, spaces, quantities, and question words
    "house", "home", "bedroom", "room", "rooms", "flat", "property", "full", "complete", "system", "systems",
    "done", "week", "weeks", "month", "months", "day", "days", "area", "type", "cost", "price", "prices",
    "quote", "quotes", "estimate", "tell", "much", "where", "how", "what", "when", "why", "who", "including",
    "included", "within", "around", "near", "nearby", "best", "good", "local", "trader", "tradesperson",
    "company", "business", "building", "unit", "units", "make", "call", "free", "look", "from", "time", "rate",
    // Prepositions, timeframes, and non-trade general terms
    "over", "under", "into", "onto", "out", "off", "back", "up", "down", "weekend", "weekends", "someone", 
    "somebody", "anyone", "anybody", "looking", "living", "dining", "hallway", "guest", "guests", "during", "after", "before"
  ]);

  // Filter query tokens to get significant trade-specific tokens (min length 3 unless specific acronym)
  const allowedShortTokens = new Set(["ev", "tv", "cp", "ep", "pv", "ac", "wc", "ai", "3d"]);
  let queryTokens = rawQueryTokens.filter((tok) => {
    const tLower = tok.toLowerCase();
    if (noiseWords.has(tLower)) return false;
    if (tLower.length < 3 && !allowedShortTokens.has(tLower)) return false;
    return true;
  });
  
  // If the query contains ONLY noise words (e.g. user just searched "repair" or "leaking"),
  // then we fall back to searching all raw tokens (with length >= 3).
  if (queryTokens.length === 0) {
    queryTokens = rawQueryTokens.filter(t => t.length >= 3);
  }

  // Collect ALL target tokens for this category
  const targetTokensSet = new Set<string>();

  // A. Priority 1: Category Name
  tokenize(cat.name).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));

  // B. Priority 1 (High): Category Synonyms metadata (explicit from CategoryProvider / Firestore)
  const categorySynonyms = cat.synonyms || [];
  categorySynonyms.forEach((syn) => {
    if (typeof syn === "string") {
      tokenize(syn).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));
    }
  });

  // C. Priority 2: Category Related Terms metadata
  const relatedTerms = [
    ...(cat.related_terms || []),
    ...(cat.relatedTerms || [])
  ];
  relatedTerms.forEach((term) => {
    if (typeof term === "string") {
      tokenize(term).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));
    }
  });

  // D. Global Synonyms mapping to this category name
  Object.entries(CATEGORY_SYNONYMS).forEach(([term, meta]) => {
    if (meta.categoryName.toLowerCase() === cat.name.toLowerCase()) {
      // Add the synonym term itself (e.g., "plumber")
      tokenize(term).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));
      // Add synonym keywords (e.g., "pipe", "leak", "boiler")
      if (meta.keywords && Array.isArray(meta.keywords)) {
        meta.keywords.forEach((keyword) => {
          tokenize(keyword).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));
        });
      }
    }
  });

  // E. Subcategories
  if (cat.subcategories && Array.isArray(cat.subcategories)) {
    cat.subcategories.forEach((sub) => {
      tokenize(sub).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));
    });
  }

  const targetTokens = Array.from(targetTokensSet);

  // Check if AT LEAST ONE significant query token matches a target token
  return queryTokens.some((qTok) =>
    targetTokens.some((tTok) => tokenMatches(qTok, tTok))
  );
}

/**
 * Calculates a prioritized relevance score for matching a category against a search query.
 * Priorities:
 * - Direct Name Match: 120 pts
 * - Synonyms Match (Category Metadata & Global Synonyms): 100 pts
 * - Related Terms Match (Category Metadata): 80 pts
 * - Subcategory Match: 60 pts
 * - General Token Match: 40 pts
 */
export function scoreCategorySearchMatch(
  cat: {
    name: string;
    subcategories?: string[];
    synonyms?: string[];
    related_terms?: string[];
    relatedTerms?: string[];
  },
  searchQuery: string
): number {
  if (!searchQuery || !searchQuery.trim()) return 0;
  const rawQueryLower = searchQuery.trim().toLowerCase();
  const queryTokens = tokenize(searchQuery).filter(t => t.length >= 3);

  // 1. Direct Name Match
  if (cat.name.toLowerCase() === rawQueryLower || cat.name.toLowerCase().includes(rawQueryLower)) {
    return 120;
  }

  // 2. Category Synonyms Match (Top Priority)
  const synonyms = [
    ...(cat.synonyms || []),
    ...Object.entries(CATEGORY_SYNONYMS)
      .filter(([_, meta]) => meta.categoryName.toLowerCase() === cat.name.toLowerCase())
      .map(([term]) => term)
  ];
  const hasSynonymMatch = synonyms.some(syn => {
    const sLower = syn.toLowerCase();
    if (sLower === rawQueryLower || rawQueryLower.includes(sLower) || sLower.includes(rawQueryLower)) return true;
    return queryTokens.some(qTok => textContainsTokenMatch(sLower, qTok));
  });
  if (hasSynonymMatch) return 100;

  // 3. Related Terms Match (High Priority)
  const related = [
    ...(cat.related_terms || []),
    ...(cat.relatedTerms || []),
    ...Object.entries(CATEGORY_SYNONYMS)
      .filter(([_, meta]) => meta.categoryName.toLowerCase() === cat.name.toLowerCase())
      .flatMap(([_, meta]) => meta.keywords || [])
  ];
  const hasRelatedMatch = related.some(term => {
    const tLower = term.toLowerCase();
    if (tLower === rawQueryLower || rawQueryLower.includes(tLower) || tLower.includes(rawQueryLower)) return true;
    return queryTokens.some(qTok => textContainsTokenMatch(tLower, qTok));
  });
  if (hasRelatedMatch) return 80;

  // 4. Subcategory Match
  if (cat.subcategories && Array.isArray(cat.subcategories)) {
    const hasSubMatch = cat.subcategories.some(sub => {
      const subLower = sub.toLowerCase();
      if (subLower === rawQueryLower || rawQueryLower.includes(subLower) || subLower.includes(rawQueryLower)) return true;
      return queryTokens.some(qTok => textContainsTokenMatch(subLower, qTok));
    });
    if (hasSubMatch) return 60;
  }

  // 5. General categoryMatchesSearch check
  if (categoryMatchesSearch(cat, searchQuery)) {
    return 40;
  }

  return 0;
}

export interface SynonymMeta {
  categoryName: string;
  tradeTitle?: string;
  keywords: string[];
}

/**
 * Rich platform-wide synonym and keyword mappings across all 80+ trade categories.
 */
export const BASE_CATEGORY_SYNONYMS: Record<string, SynonymMeta> = {
  // Carpentry & Joinery
  "joiner": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "kitchen", "door", "stair", "wardrobe", "decking"] },
  "joinery": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "timber", "furniture"] },
  "carpenter": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "skirting", "flooring"] },
  "carpentry": { categoryName: "Carpentry & Joinery", tradeTitle: "Carpenter & Joiner", keywords: ["wood", "timber"] },

  // Plumbing & Gas
  "plumber": { categoryName: "Plumbing", tradeTitle: "Plumber", keywords: ["pipe", "piping", "leak", "tap", "drain", "sink", "toilet", "radiator", "radiators", "water", "cylinder"] },
  "plumbing": { categoryName: "Plumbing", tradeTitle: "Plumber", keywords: ["pipe", "piping", "leak", "shower", "radiator", "radiators", "water tank", "power flush", "bathroom"] },
  "radiator": { categoryName: "Plumbing", tradeTitle: "Heating & Plumbing Specialist", keywords: ["radiators", "valves", "trv", "balancing", "bleeding", "piping"] },
  "radiators": { categoryName: "Plumbing", tradeTitle: "Heating & Plumbing Specialist", keywords: ["radiator", "valves", "trv", "balancing", "bleeding", "piping"] },
  "piping": { categoryName: "Plumbing", tradeTitle: "Plumber & Pipefitter", keywords: ["pipes", "copper pipe", "plastic pipe", "pipework", "leak"] },
  "pipework": { categoryName: "Plumbing", tradeTitle: "Plumber & Pipefitter", keywords: ["pipes", "piping", "copper", "soldering"] },
  "drainage": { categoryName: "Plumbing", tradeTitle: "Drainage Specialist", keywords: ["unblock", "drain", "sewer", "blocked drain"] },

  // Gas Engineering & Heating
  "gas safe": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["boiler", "heating", "gas", "combi", "central heating", "cp12", "gas safe register"] },
  "gas engineer": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["boiler", "heating", "gas", "central heating", "flue", "cp12", "gas fire", "gas hob"] },
  "gas engineering": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["gas boiler", "central heating", "boiler replacement", "boiler installation", "cp12"] },
  "gas safe engineer": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["boiler installation", "central heating", "boiler repair", "cp12 certificate"] },
  "boiler": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["servicing", "heating", "combi", "boiler replacement", "boiler installation", "central heating"] },
  "boiler installation": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["new boiler", "combi boiler", "system boiler", "central heating", "worcester", "vaillant", "baxi", "ideal"] },
  "boiler replacement": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["new boiler", "boiler change", "combi boiler", "central heating"] },
  "central heating": { categoryName: "Gas Engineering", tradeTitle: "Central Heating & Gas Engineer", keywords: ["boiler", "radiators", "piping", "heating system", "full central heating", "combi"] },
  "central heating system": { categoryName: "Gas Engineering", tradeTitle: "Central Heating & Gas Engineer", keywords: ["boiler", "radiators", "new piping", "heating installation", "power flush"] },
  "combi boiler": { categoryName: "Gas Engineering", tradeTitle: "Gas Safe Heating Engineer", keywords: ["boiler", "central heating", "hot water", "gas"] },

  // Plant & Machinery Hire
  "plant hire": { categoryName: "Plant & Operated Machinery Hire", tradeTitle: "Plant & Machinery Operator", keywords: ["digger", "mini digger", "micro digger", "excavator", "cherry picker", "telehandler", "dumper", "compactor"] },
  "digger hire": { categoryName: "Plant & Operated Machinery Hire", tradeTitle: "Plant & Machinery Operator", keywords: ["mini digger", "micro digger", "excavator", "tracked dumper", "groundwork machine"] },
  "mini digger": { categoryName: "Plant & Operated Machinery Hire", tradeTitle: "Mini Digger Operator", keywords: ["digger hire", "excavator", "trenching", "groundwork", "narrow access digger"] },
  "excavator": { categoryName: "Plant & Operated Machinery Hire", tradeTitle: "Excavator Operator", keywords: ["digger", "plant hire", "earthmoving", "demolition machinery"] },
  "cherry picker": { categoryName: "Plant & Operated Machinery Hire", tradeTitle: "IPAF Cherry Picker Operator", keywords: ["mewp", "boom lift", "scissor lift", "high access platform"] },
  "telehandler": { categoryName: "Plant & Operated Machinery Hire", tradeTitle: "Telehandler Operator", keywords: ["forklift", "rough terrain", "cpcs operator"] },

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
  "pet sitter": { categoryName: "Pet Services", tradeTitle: "Pet Sitter & Walker", keywords: ["pet sitting", "dog sitting", "cat sitting", "pet care", "house sitting"] },
  "pet sitting": { categoryName: "Pet Services", tradeTitle: "Pet Sitter", keywords: ["pet sitting", "dog sitting", "cat sitting", "pet care", "dog boarding", "holiday pet care"] },
  "pet care": { categoryName: "Pet Services", tradeTitle: "Pet Care Specialist", keywords: ["pet care", "pet sitting", "dog walking", "cat sitting", "pet boarding", "pet grooming", "puppy care", "animal care"] },
  "pet carer": { categoryName: "Pet Services", tradeTitle: "Pet Carer", keywords: ["pet care", "pet sitting", "dog walking", "cat sitting", "animal care", "pet sitter"] },
  "dog walker": { categoryName: "Pet Services", tradeTitle: "Dog Walker", keywords: ["dog walking", "dog exercise", "puppy care", "dog walker", "pet care"] },
  "dog walking": { categoryName: "Pet Services", tradeTitle: "Dog Walker", keywords: ["dog walker", "dog sitting", "pet care", "dog exercise"] },
  "dog sitter": { categoryName: "Pet Services", tradeTitle: "Dog Sitter", keywords: ["dog sitting", "dog boarding", "kennels", "pet care"] },
  "cat sitter": { categoryName: "Pet Services", tradeTitle: "Cat Sitter", keywords: ["cat sitting", "feline care", "cat care", "cattery", "pet care"] },
  "cat sitting": { categoryName: "Pet Services", tradeTitle: "Cat Sitter", keywords: ["cat sitter", "feline care", "cat care", "cattery", "pet care"] },

  // Auto & Vehicle Repairs
  "mechanic": { categoryName: "Vehicle Repair & Maintenance", tradeTitle: "Mechanic", keywords: ["car", "mot", "service", "brakes", "clutch", "engine", "vehicle repair", "mobile mechanic"] },
  "car repair": { categoryName: "Vehicle Repair & Maintenance", tradeTitle: "Auto Technician", keywords: ["mechanic", "garage", "diagnostics", "servicing", "brakes", "clutch"] },
  "mobile mechanic": { categoryName: "Vehicle Repair & Maintenance", tradeTitle: "Mobile Mechanic", keywords: ["mechanic", "car repair", "diagnostics", "brakes", "servicing", "home visit mechanic"] },

  // Vehicle Recovery & Roadside Assistance (Cars & Commercial Vehicles)
  "vehicle recovery": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Vehicle Recovery & Towing Specialist", keywords: ["tow truck", "breakdown", "towing", "flatbed", "roadside", "accident recovery", "garage tow", "broken down"] },
  "breakdown recovery": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "24/7 Breakdown Recovery Operator", keywords: ["tow truck", "recovery", "towing", "broken down", "roadside assistance", "garage tow", "flatbed tow"] },
  "tow truck": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Tow Truck Operator", keywords: ["towing", "recovery", "flatbed", "breakdown", "tow to garage", "stuck car", "accident recovery"] },
  "towing": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Vehicle Recovery & Towing Specialist", keywords: ["tow truck", "breakdown recovery", "tow car", "garage tow", "flatbed transport", "commercial recovery"] },
  "car tow": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Vehicle Towing & Recovery Specialist", keywords: ["tow truck", "towing", "breakdown", "tow to garage", "flatbed"] },
  "tow to garage": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Vehicle Recovery Specialist", keywords: ["towing", "tow truck", "breakdown recovery", "garage delivery", "flatbed"] },
  "broken down": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Roadside Breakdown Recovery Specialist", keywords: ["breakdown", "recovery", "tow truck", "roadside assistance", "jump start", "fuel drain", "flat tyre"] },
  "roadside assistance": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Roadside Assistance & Recovery Specialist", keywords: ["breakdown", "jump start", "mobile tyre change", "fuel drain", "recovery", "tow truck"] },
  "commercial vehicle recovery": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Commercial Van & HGV Recovery Specialist", keywords: ["van recovery", "hgv recovery", "lorry recovery", "heavy recovery", "truck tow", "fleet recovery"] },
  "van recovery": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Van & Light Commercial Recovery Specialist", keywords: ["commercial recovery", "transit van tow", "light commercial", "breakdown recovery", "tow truck"] },
  "hgv recovery": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Heavy HGV & Commercial Recovery Operator", keywords: ["heavy recovery", "lorry recovery", "truck towing", "commercial breakdown", "heavy winch"] },
  "jump start": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Roadside Battery & Jump Start Specialist", keywords: ["flat battery", "car battery", "battery boost", "mobile jump start", "roadside"] },
  "fuel drain": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Roadside Fuel Drain Specialist", keywords: ["wrong fuel", "misfuel", "petrol in diesel", "diesel in petrol", "fuel flush"] },
  "wrong fuel": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Wrong Fuel Drain Specialist", keywords: ["fuel drain", "misfuel", "petrol in diesel", "diesel in petrol", "fuel contamination"] },
  "stuck vehicle": { categoryName: "Vehicle Recovery & Roadside", tradeTitle: "Vehicle Winching & Extraction Specialist", keywords: ["winch", "mud extraction", "snow recovery", "ditch extraction", "stuck car"] },

  // Locksmith & Electronic Security
  "locksmith": { categoryName: "Locksmith & Security", tradeTitle: "Locksmith", keywords: ["lock", "key", "unlock", "door", "intercom", "cctv"] },

  // Manned Security, Guarding, Site & Event Security
  "security guard": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "SIA Security Officer", keywords: ["security", "guard", "sia", "manned guarding", "site security", "patrol", "door staff", "bouncer"] },
  "security guards": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "SIA Security Officer", keywords: ["security guard", "guards", "sia", "site security", "event security", "patrol"] },
  "site security": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Construction Site Security Specialist", keywords: ["construction security", "site guard", "night watch", "gatehouse", "compound security", "static guard"] },
  "patrolling": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Mobile Patrol & Keyholding Officer", keywords: ["mobile patrol", "patrols", "perimeter check", "security patrol", "property check", "keyholding"] },
  "security patrol": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Mobile Patrol Officer", keywords: ["patrol", "patrolling", "mobile security", "keyholding", "perimeter check"] },
  "event security": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Event Security & Crowd Safety Specialist", keywords: ["door supervisor", "venue security", "party security", "bouncers", "stewarding", "festival security", "crowd control"] },
  "stadium security": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Stadium & Arena Safety Steward", keywords: ["stadium steward", "arena security", "matchday security", "turnstile security", "crowd safety", "spectator safety"] },
  "stadium steward": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Stadium Safety Steward", keywords: ["stadium security", "matchday steward", "spectator safety", "crowd management", "arena security"] },
  "door supervisor": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "SIA Door Supervisor", keywords: ["bouncer", "door staff", "club security", "venue security", "event security", "sia"] },
  "bouncer": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "SIA Door Supervisor", keywords: ["door supervisor", "club bouncer", "venue security", "door staff", "event security"] },
  "bouncers": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "SIA Door Supervisors", keywords: ["door supervisors", "venue security", "door staff", "event security", "club bouncers"] },
  "close protection": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Close Protection Officer (Bodyguard)", keywords: ["bodyguard", "vip security", "celebrity protection", "executive protection", "close protection officer"] },
  "bodyguard": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Close Protection Bodyguard", keywords: ["close protection", "vip security", "personal security", "executive protection"] },
  "cctv monitoring": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "CCTV Control Room Operator", keywords: ["cctv security", "control room", "remote monitoring", "cctv surveillance", "sia cctv"] },
  "cctv security": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "CCTV Security & Surveillance Specialist", keywords: ["cctv monitoring", "remote surveillance", "control room operator", "sia cctv"] },
  "dog handler": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "K9 Security Dog Handler", keywords: ["k9 security", "guard dogs", "patrol dog", "nasdu", "security dogs"] },
  "k9 security": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "K9 Security Dog Handler", keywords: ["dog handler", "patrol dogs", "guard dog", "nasdu"] },
  "keyholding": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Keyholding & Alarm Response Officer", keywords: ["alarm response", "lock and unlock", "mobile patrol", "out of hours response"] },
  "manned guarding": { categoryName: "Security Services, Manned Guarding & Event Security", tradeTitle: "Manned Guarding Specialist", keywords: ["static guard", "security guard", "site security", "building security", "concierge security"] },

  // Cleaning
  "cleaner": { categoryName: "Home Cleaning", tradeTitle: "Cleaner", keywords: ["cleaning", "house", "deep clean", "end of tenancy", "carpet"] },
  "bin cleaning": { categoryName: "Specialist Cleaning", tradeTitle: "Wheelie Bin Cleaner", keywords: ["wheelie bin", "mobile bin wash", "bin cleaning", "bin store", "domestic bin wash"] },
  "wheelie bin cleaning": { categoryName: "Specialist Cleaning", tradeTitle: "Wheelie Bin Cleaner", keywords: ["bin wash", "domestic bin cleaning", "wheelie bin", "mobile bin cleaning"] },
  "bin store cleaning": { categoryName: "Industrial & Commercial Cleaning", tradeTitle: "Commercial Bin Store Cleaner", keywords: ["bin store", "refuse area", "commercial bin", "refuse store"] },

  // Bake N Cake, Pastry & Catering
  "cake": { categoryName: "Bake N Cake", tradeTitle: "Cake Maker & Baker", keywords: ["baking", "baker", "wedding cake", "birthday cake", "cupcakes", "dessert", "pastry", "catering", "food", "patisserie", "sweet treats", "afternoon tea", "bespoke bakes", "tier cake", "fondant"] },
  "baker": { categoryName: "Bake N Cake", tradeTitle: "Baker & Cake Designer", keywords: ["cake", "baking", "wedding cake", "birthday cake", "pastry", "cupcakes", "bread", "dessert", "patisserie"] },
  "baking": { categoryName: "Bake N Cake", tradeTitle: "Cake Maker & Baker", keywords: ["cake", "baker", "wedding cake", "birthday cake", "pastry", "cupcakes", "dessert", "patisserie"] },
  "bake n cake": { categoryName: "Bake N Cake", tradeTitle: "Cake Maker & Baker", keywords: ["cake", "baker", "baking", "wedding cake", "birthday cake", "cupcake", "dessert", "pastry", "patisserie", "bespoke bakes", "afternoon tea"] },
  "cake maker": { categoryName: "Bake N Cake", tradeTitle: "Cake Maker & Decorator", keywords: ["wedding cake", "birthday cake", "cupcakes", "celebration cake", "bespoke bakes", "tier cake", "fondant", "baking"] },
  "cake maker & baker": { categoryName: "Bake N Cake", tradeTitle: "Cake Maker & Baker", keywords: ["wedding cake", "birthday cake", "cupcakes", "celebration cake", "bespoke bakes", "pastry", "desserts"] },
  "wedding cake": { categoryName: "Bake N Cake", tradeTitle: "Wedding Cake Designer", keywords: ["wedding cakes", "tier cake", "3 tier cake", "cake maker", "baker", "tasting", "fondant", "allergen", "bespoke bakes", "celebration cake"] },
  "wedding cakes": { categoryName: "Bake N Cake", tradeTitle: "Wedding Cake Designer", keywords: ["wedding cake", "tier cake", "3 tier cake", "cake maker", "baker", "tasting", "fondant", "allergen", "bespoke bakes"] },
  "birthday cake": { categoryName: "Bake N Cake", tradeTitle: "Birthday Cake Maker", keywords: ["celebration cake", "custom cake", "cupcakes", "baker", "cake maker", "baking"] },
  "birthday cakes": { categoryName: "Bake N Cake", tradeTitle: "Birthday Cake Maker", keywords: ["celebration cake", "custom cake", "cupcakes", "baker", "cake maker", "baking"] },
  "cupcake": { categoryName: "Bake N Cake", tradeTitle: "Cupcake & Dessert Specialist", keywords: ["cupcakes", "dessert table", "sweet treats", "baking", "mini treats", "pastry"] },
  "cupcakes": { categoryName: "Bake N Cake", tradeTitle: "Cupcake & Dessert Specialist", keywords: ["cupcake", "dessert table", "sweet treats", "baking", "mini treats", "pastry"] },
  "pastry chef": { categoryName: "Bake N Cake", tradeTitle: "Pastry Chef & Baker", keywords: ["patisserie", "desserts", "french pastry", "cake", "baking", "afternoon tea", "croissant", "tarts"] },
  "bespoke bakes": { categoryName: "Bake N Cake", tradeTitle: "Bespoke Cake Designer", keywords: ["custom cake", "wedding cake", "birthday cake", "artisan bakes", "desserts"] },
  "catering": { categoryName: "Bake N Cake", tradeTitle: "Caterer & Private Chef", keywords: ["caterer", "buffet", "event food", "private chef", "wedding food", "canapes", "party food", "platter"] },
  "caterer": { categoryName: "Bake N Cake", tradeTitle: "Caterer & Private Chef", keywords: ["catering", "buffet", "event food", "private chef", "wedding food", "party food", "platters"] },

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

  // Removals, House Moves & Relocations
  "removals": { categoryName: "Home & Domestic Removals", tradeTitle: "Removals & Relocation Specialist", keywords: ["house removal", "house move", "moving", "man and van", "home removals", "flat move", "packing", "furniture transport"] },
  "removal": { categoryName: "Home & Domestic Removals", tradeTitle: "Removals Specialist", keywords: ["house removal", "house move", "moving", "man and van", "home removals", "flat move", "packing", "furniture transport"] },
  "house removal": { categoryName: "Home & Domestic Removals", tradeTitle: "House Removals Specialist", keywords: ["house removals", "house move", "moving house", "home removals", "full house move", "man and van", "packing", "flat move", "removals"] },
  "house removals": { categoryName: "Home & Domestic Removals", tradeTitle: "House Removals Specialist", keywords: ["house removal", "house move", "moving house", "home removals", "full house move", "man and van", "packing", "flat move", "removals"] },
  "home removals": { categoryName: "Home & Domestic Removals", tradeTitle: "Home Removals Specialist", keywords: ["house removal", "house move", "moving house", "full house move", "packing", "removals", "relocation"] },
  "home removal": { categoryName: "Home & Domestic Removals", tradeTitle: "Home Removals Specialist", keywords: ["house removal", "house move", "moving house", "full house move", "packing", "removals", "relocation"] },
  "house move": { categoryName: "Home & Domestic Removals", tradeTitle: "Home Removals Specialist", keywords: ["house removal", "moving house", "full house move", "flat move", "removals", "packing", "man and van"] },
  "house moving": { categoryName: "Home & Domestic Removals", tradeTitle: "Home Removals Specialist", keywords: ["house removal", "moving house", "full house move", "flat move", "removals", "packing", "man and van"] },
  "moving house": { categoryName: "Home & Domestic Removals", tradeTitle: "Home Removals Specialist", keywords: ["house removal", "house move", "full house move", "home removals", "packing", "removals"] },
  "moving": { categoryName: "Home & Domestic Removals", tradeTitle: "Removals & Moving Specialist", keywords: ["house move", "house removal", "flat move", "man and van", "relocation", "removals", "luton van"] },
  "relocation": { categoryName: "Home & Domestic Removals", tradeTitle: "Relocation & Removals Specialist", keywords: ["house move", "office move", "corporate move", "removals", "relocating", "house removal"] },
  "flat move": { categoryName: "Home & Domestic Removals", tradeTitle: "Flat & Apartment Removals Specialist", keywords: ["apartment move", "house removal", "small move", "man and van", "removals", "student move"] },
  "furniture removal": { categoryName: "Home & Domestic Removals", tradeTitle: "Furniture Removals Specialist", keywords: ["sofa", "wardrobe", "bulky item", "house removal", "man and van", "removals", "disassembly"] },
  "furniture moving": { categoryName: "Home & Domestic Removals", tradeTitle: "Furniture Removals Specialist", keywords: ["sofa", "wardrobe", "bulky item", "house removal", "man and van", "removals"] },
  "man and van": { categoryName: "Removals", tradeTitle: "Man & Van Removals Driver", keywords: ["man with a van", "van delivery", "house removal", "small move", "furniture move", "removals", "pickup", "moving"] },
  "man with a van": { categoryName: "Removals", tradeTitle: "Man & Van Removals Driver", keywords: ["man and van", "van delivery", "house removal", "small move", "furniture move", "removals", "pickup", "moving"] },
  "office removal": { categoryName: "Office & Commercial Removals", tradeTitle: "Commercial Removals Specialist", keywords: ["office move", "business relocation", "commercial removals", "desk move", "it relocation"] },
  "office removals": { categoryName: "Office & Commercial Removals", tradeTitle: "Commercial Removals Specialist", keywords: ["office move", "business relocation", "commercial removals", "desk move", "it relocation"] },
  "piano removal": { categoryName: "Specialist & Heavy Item Removals", tradeTitle: "Piano & Heavy Item Mover", keywords: ["piano move", "grand piano", "upright piano", "heavy lifting", "specialist removals", "safe moving"] },
  "piano move": { categoryName: "Specialist & Heavy Item Removals", tradeTitle: "Piano & Heavy Item Mover", keywords: ["piano moving", "grand piano", "upright piano", "heavy lifting", "specialist removals"] },
  "house clearance": { categoryName: "House & Garden Clearance", tradeTitle: "House Clearance Specialist", keywords: ["probate clearance", "rubbish removal", "waste clearance", "garage clearance", "property clearance", "estate clearance"] },

  // General Labour, Trade Mates & Site Helpers
  "labourer": { categoryName: "General Labour, Trade Mates & Site Helpers", tradeTitle: "General Labourer", keywords: ["digging", "trench", "garden", "heavy lifting", "site helper", "demolition", "clearing", "rubble", "skip", "carrying"] },
  "trade mate": { categoryName: "General Labour, Trade Mates & Site Helpers", tradeTitle: "Trade Mate & Helper", keywords: ["plumber mate", "sparky mate", "builder mate", "apprentice", "helping hand", "site assistant", "extra hands"] },
  "site helper": { categoryName: "General Labour, Trade Mates & Site Helpers", tradeTitle: "Site Helper", keywords: ["heavy lifting", "carrying", "plasterboard", "timber", "rubble bagging", "site cleanup", "digging"] },
  "garden digging": { categoryName: "General Labour, Trade Mates & Site Helpers", tradeTitle: "Groundwork Labourer", keywords: ["trenching", "digging patio", "soil clearing", "turf laying", "garden helper", "manual labour"] },
  "helping hand": { categoryName: "General Labour, Trade Mates & Site Helpers", tradeTitle: "General Labourer & Helper", keywords: ["helper", "mate", "extra hands", "lifting", "moving", "day rate", "on demand helper"] },

  // Graphics & Signages / Signage & Display Boards
  "signs": { categoryName: "Graphics & Signages", tradeTitle: "Sign Maker & Signage Installer", keywords: ["shop signs", "fascia", "display boards", "safety boards", "vinyl", "lettering", "graphics", "lightboxes", "banners"] },
  "signage": { categoryName: "Graphics & Signages", tradeTitle: "Signage Specialist", keywords: ["shop signs", "shopfront", "acrylic", "neon", "illuminated", "pavement sign", "totem", "site safety", "wayfinding"] },
  "signages": { categoryName: "Graphics & Signages", tradeTitle: "Signage Specialist", keywords: ["signs", "graphics", "shopfront", "display boards", "signage", "fascias"] },
  "sinages": { categoryName: "Graphics & Signages", tradeTitle: "Signage Specialist", keywords: ["signs", "graphics", "shopfront", "display boards", "signage", "fascias"] },
  "graphics": { categoryName: "Graphics & Signages", tradeTitle: "Graphics & Signage Installer", keywords: ["window graphics", "vinyl decals", "frosted vinyl", "display boards", "banners", "vehicle graphics", "wall graphics"] },
  "display boards": { categoryName: "Graphics & Signages", tradeTitle: "Display Board & Print Specialist", keywords: ["foamex", "correx", "dibond", "acrylic", "poster boards", "exhibition boards", "site boards", "rigid panels"] },
  "site safety boards": { categoryName: "Graphics & Signages", tradeTitle: "Site Safety Signage Installer", keywords: ["ppe signs", "hazard boards", "construction signs", "scaffold banners", "hoarding signs", "health and safety notices"] },
  "shop front signs": { categoryName: "Graphics & Signages", tradeTitle: "Shopfront Sign Maker", keywords: ["fascia", "3d letters", "lightbox", "illuminated signs", "neon", "projecting sign", "window display", "retail signs"] },
  "window graphics": { categoryName: "Graphics & Signages", tradeTitle: "Window Vinyl & Graphics Installer", keywords: ["frosted vinyl", "manifestations", "window decals", "contra vision", "privacy film", "shop window graphics"] },
  "foamex boards": { categoryName: "Graphics & Signages", tradeTitle: "Board Printing & Sign Specialist", keywords: ["foamex", "correx", "dibond", "aluminium composite", "printed boards", "display panels", "fluted boards"] },
  "scaffold banners": { categoryName: "Graphics & Signages", tradeTitle: "Banners & Hoarding Specialist", keywords: ["mesh banners", "hoarding graphics", "site banners", "pvc banners", "construction hoarding"] },
  "pavement signs": { categoryName: "Graphics & Signages", tradeTitle: "Pavement Signs & Displays", keywords: ["a board", "swing signs", "chalkboard", "sandwich board", "shop display", "forecourt signs"] },

  // Tailoring, Garment Alterations, Seamstress & Laundry
  "tailor": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Master Tailor & Alterations Specialist", keywords: ["tailoring", "suits", "hemming", "alteration", "sewing", "made to measure", "trousers", "dressmaking", "clothes"] },
  "tailoring": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Tailor", keywords: ["garment", "suit", "fitting", "alterations", "bespoke", "jacket", "trousers"] },
  "tailering": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Tailor", keywords: ["garment", "suit", "fitting", "alterations", "bespoke", "tailor"] },
  "alteration": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Garment Alterations Specialist", keywords: ["seamstress", "hemming", "tapering", "waist", "zip", "sleeves", "shortening", "lengthening", "dress"] },
  "alterations": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Garment Alterations Specialist", keywords: ["tailor", "seamstress", "hemming", "tapering", "waist", "zip", "sleeves", "clothing repairs", "dress"] },
  "garment alterations": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Garment Alterations Specialist", keywords: ["clothing", "tailoring", "seamstress", "sewing", "hemming", "trousers", "suit"] },
  "seamstress": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Seamstress & Dressmaker", keywords: ["dress", "wedding dress", "bridal", "gown", "sewing", "alterations", "pattern cutting", "curtains"] },
  "dressmaker": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Dressmaker & Seamstress", keywords: ["dress", "prom dress", "bridal", "gown", "clothing", "tailoring", "fashion"] },
  "dressmaking": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Dressmaker & Seamstress", keywords: ["dress", "prom dress", "bridal", "gown", "clothing", "tailoring"] },
  "ironing": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Professional Ironing & Pressing Service", keywords: ["ironing", "pressing", "steam pressing", "shirts", "bedding", "laundry", "wash and iron"] },
  "laundry": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Mobile Laundry & Ironing Specialist", keywords: ["wash and fold", "washing", "dry cleaning", "ironing", "clothes washing", "duvet cleaning", "linen"] },
  "dry clean": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Dry Cleaning Specialist", keywords: ["dry cleaning", "suit cleaning", "coat cleaning", "eco dry cleaning", "curtain cleaning", "stain removal"] },
  "dry cleaning": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Dry Cleaning & Garment Care", keywords: ["dry clean", "suit cleaning", "coat cleaning", "eco dry cleaning", "curtain cleaning", "stain removal"] },
  "dry cleaner": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Dry Cleaner", keywords: ["dry clean", "laundry", "suit cleaning", "stain removal", "garment care"] },
  "clothing repairs": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Clothing Repair & Tailoring Specialist", keywords: ["zip replacement", "buttons", "torn seam", "patches", "relining", "leather repair", "zip repair"] },
  "clothes repair": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Clothing Repair Specialist", keywords: ["zip replacement", "buttons", "torn seam", "patches", "relining", "tailoring"] },
  "curtain alterations": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Curtain & Soft Furnishing Specialist", keywords: ["curtains", "drapes", "blinds", "hemming", "cushions", "sewing", "alterations"] },

  // Comprehensive Category Mappings across all 94 UK Trade Categories
  "stairlift": { categoryName: "Accessibility & Adaptations", tradeTitle: "Accessibility & Mobility Adaptation Specialist", keywords: ["stair lift","curved stairlift","straight stairlift","disabled access","mobility","chair lift"] },
  "stairlifts": { categoryName: "Accessibility & Adaptations", tradeTitle: "Accessibility & Mobility Adaptation Specialist", keywords: ["stairlift","mobility lift","home lift","disabled adaptation"] },
  "walk in shower": { categoryName: "Accessibility & Adaptations", tradeTitle: "Disabled Bathroom & Wet Room Specialist", keywords: ["wet room","level access shower","grab rails","disabled bathroom","mobility bathroom"] },
  "disabled adaptations": { categoryName: "Accessibility & Adaptations", tradeTitle: "Disabled Adaptations Specialist", keywords: ["stairlift","ramps","grab rails","dfg grant","wheelchair ramp","widened doors"] },
  "wheelchair ramp": { categoryName: "Accessibility & Adaptations", tradeTitle: "Mobility Ramp & Access Specialist", keywords: ["disabled ramp","access ramp","threshold ramp","concrete ramp","metal ramp"] },
  "grab rails": { categoryName: "Accessibility & Adaptations", tradeTitle: "Accessibility Installation Specialist", keywords: ["handrails","shower rails","toilet rails","mobility rails","safety rails"] },
  "virtual assistant": { categoryName: "Admin & Virtual Assistant", tradeTitle: "Virtual Assistant (VA)", keywords: ["va","admin","data entry","invoicing","email management","customer service","calendar"] },
  "va": { categoryName: "Admin & Virtual Assistant", tradeTitle: "Virtual Assistant", keywords: ["virtual assistant","admin support","remote assistant","typing","bookkeeping"] },
  "bookkeeper": { categoryName: "Admin & Virtual Assistant", tradeTitle: "Bookkeeper & Accounts Assistant", keywords: ["bookkeeping","invoicing","quickbooks","xero","receipts","bank reconciliation"] },
  "data entry": { categoryName: "Admin & Virtual Assistant", tradeTitle: "Data Entry & Admin Specialist", keywords: ["typing","excel","spreadsheet","transcription","copy typing","admin"] },
  "tv aerial": { categoryName: "Aerial & Satellite", tradeTitle: "TV Aerial & Satellite Engineer", keywords: ["aerial","digital aerial","freeview","antenna","bad reception","tv signal"] },
  "satellite dish": { categoryName: "Aerial & Satellite", tradeTitle: "Satellite Dish Installation Engineer", keywords: ["sky dish","freesat","satellite","lnb","sky q","dish alignment"] },
  "starlink": { categoryName: "Aerial & Satellite", tradeTitle: "Starlink & Satellite Internet Installer", keywords: ["starlink dish","satellite broadband","satellite internet","dish mount","high speed internet"] },
  "tv wall mounting": { categoryName: "Aerial & Satellite", tradeTitle: "TV Wall Mounting Specialist", keywords: ["tv mount","bracket","flat screen mount","cable hiding","soundbar mount"] },
  "washing machine repair": { categoryName: "Appliance Repair", tradeTitle: "Domestic Appliance Repair Technician", keywords: ["washing machine","washer dryer","drum repair","not draining","not spinning","bosch","hotpoint","beko"] },
  "dishwasher repair": { categoryName: "Appliance Repair", tradeTitle: "Dishwasher Repair Specialist", keywords: ["dishwasher","not draining","leaking dishwasher","e24 error","tablet not dissolving"] },
  "oven repair": { categoryName: "Appliance Repair", tradeTitle: "Cooker & Oven Repair Specialist", keywords: ["electric oven","fan oven","element replacement","cooker repair","oven thermostat","range cooker"] },
  "tumble dryer repair": { categoryName: "Appliance Repair", tradeTitle: "Tumble Dryer Repair Technician", keywords: ["dryer not heating","condenser dryer","heat pump dryer","dryer belt"] },
  "fridge repair": { categoryName: "Appliance Repair", tradeTitle: "Refrigeration & Freezer Repair Technician", keywords: ["fridge freezer","not cooling","thermostat","compressor","american fridge"] },
  "asbestos": { categoryName: "Asbestos Removal & Testing", tradeTitle: "Licensed Asbestos Specialist", keywords: ["asbestos testing","asbestos survey","asbestos removal","artex","chrysotile","garage roof","hazardous"] },
  "asbestos survey": { categoryName: "Asbestos Removal & Testing", tradeTitle: "Asbestos Surveyor", keywords: ["refurbishment survey","management survey","asbestos test","artex sampling","homebuyer asbestos"] },
  "artex testing": { categoryName: "Asbestos Removal & Testing", tradeTitle: "Asbestos Testing Specialist", keywords: ["artex ceiling","asbestos in artex","texture ceiling","sample kit","lab testing"] },
  "asbestos garage roof": { categoryName: "Asbestos Removal & Testing", tradeTitle: "Asbestos Roof Removal Specialist", keywords: ["corrugated roof","cement sheets","garage replacement","hazardous waste"] },
  "bathroom fitter": { categoryName: "Bathroom & Kitchen Fitting", tradeTitle: "Bathroom Fitter & Installer", keywords: ["bathroom renovation","suite","shower","bath","wet room","vanity unit","tiles"] },
  "bathroom installation": { categoryName: "Bathroom & Kitchen Fitting", tradeTitle: "Bathroom Specialist", keywords: ["ensuite","family bathroom","walk in shower","toilet fitting","bathroom refurbishment"] },
  "kitchen fitter": { categoryName: "Bathroom & Kitchen Fitting", tradeTitle: "Kitchen Fitter & Installer", keywords: ["kitchen renovation","kitchen units","cabinets","worktop","howdens","wren","ikea kitchen"] },
  "kitchen installation": { categoryName: "Bathroom & Kitchen Fitting", tradeTitle: "Kitchen Specialist", keywords: ["worktop fitting","kitchen cupboards","appliances installation","kitchen refit"] },
  "worktop fitting": { categoryName: "Bathroom & Kitchen Fitting", tradeTitle: "Worktop Installation Specialist", keywords: ["quartz worktop","granite worktop","laminate worktop","solid oak worktop","mitred joint"] },
  "mobile hairdresser": { categoryName: "Beauty & Mobile Spa", tradeTitle: "Mobile Hairdresser & Stylist", keywords: ["haircut at home","hair colouring","highlights","balayage","blow dry","hairdresser"] },
  "mobile beauty": { categoryName: "Beauty & Mobile Spa", tradeTitle: "Mobile Beautician", keywords: ["beauty therapist","manicure","pedicure","gel nails","waxing","lashes","brows","facials"] },
  "makeup artist": { categoryName: "Beauty & Mobile Spa", tradeTitle: "Makeup Artist (MUA)", keywords: ["bridal makeup","wedding makeup","glam makeup","prom makeup","evening makeup"] },
  "builder": { categoryName: "Building & Construction", tradeTitle: "General Builder & Construction Specialist", keywords: ["building","extension","loft conversion","bricklayer","structural alterations","rsj","foundations","renovation"] },
  "building extension": { categoryName: "Building & Construction", tradeTitle: "Home Extension Builder", keywords: ["rear extension","side return","double storey extension","single storey","kitchen extension"] },
  "loft conversion": { categoryName: "Building & Construction", tradeTitle: "Loft Conversion Specialist", keywords: ["attic conversion","dormer loft","velux loft","mansard","hip to gable","loft room"] },
  "garage conversion": { categoryName: "Building & Construction", tradeTitle: "Garage Conversion Specialist", keywords: ["annexe","home office conversion","habitable room","garage conversion"] },
  "rsj": { categoryName: "Building & Construction", tradeTitle: "Structural Steel & RSJ Specialist", keywords: ["steel beam","knock through","load bearing wall","structural opening","building regs"] },
  "car valeting": { categoryName: "Car Detailing & Valeting", tradeTitle: "Mobile Car Valeting Specialist", keywords: ["car wash","mobile car wash","interior deep clean","seat shampoo","car detailing","valeting"] },
  "car detailing": { categoryName: "Car Detailing & Valeting", tradeTitle: "Car Detailing Specialist", keywords: ["paint correction","machine polish","ceramic coating","scratch removal","swirl marks","ppf"] },
  "ceramic coating": { categoryName: "Car Detailing & Valeting", tradeTitle: "Ceramic Coating & Paint Protection Specialist", keywords: ["graphene coating","paint seal","hydrophobic","9h coating","car protection"] },
  "carer": { categoryName: "Care & Home Support", tradeTitle: "Home Care & Support Worker", keywords: ["care assistant","elderly care","domiciliary care","companion","home support","respite care"] },
  "elderly care": { categoryName: "Care & Home Support", tradeTitle: "Elderly Care Specialist", keywords: ["sitting service","dementia care","companionship","mobility assistance","morning visits"] },
  "chimney sweep": { categoryName: "Chimney & Fireplace", tradeTitle: "Certified Chimney Sweep", keywords: ["chimney cleaning","soot removal","cctv flue inspection","sweep certificate","open fire"] },
  "log burner": { categoryName: "Chimney & Fireplace", tradeTitle: "Log Burner & Stove Installer (HETAS)", keywords: ["wood burner","multi fuel stove","stove installation","flue liner","twin wall flue","hearth"] },
  "stove installer": { categoryName: "Chimney & Fireplace", tradeTitle: "HETAS Stove & Fireplace Engineer", keywords: ["woodburning stove","log burner","fireplace fitout","chimney liner"] },
  "blinds": { categoryName: "Curtains, Blinds & Shutters", tradeTitle: "Blinds & Window Covering Specialist", keywords: ["roller blinds","venetian blinds","vertical blinds","roman blinds","perfect fit blinds","day and night blinds"] },
  "shutters": { categoryName: "Curtains, Blinds & Shutters", tradeTitle: "Plantation Shutters Specialist", keywords: ["wooden shutters","window shutters","tier on tier","cafe style","full height shutters"] },
  "curtain fitting": { categoryName: "Curtains, Blinds & Shutters", tradeTitle: "Curtain Maker & Fitter", keywords: ["curtain poles","tracks","bay window curtains","blackout curtains","made to measure"] },
  "damp": { categoryName: "Damp Proofing & Waterproofing", tradeTitle: "Damp Proofing & Mould Remediation Specialist", keywords: ["rising damp","black mould","damp survey","penetrating damp","condensation","dpc","damp patch"] },
  "damp proofing": { categoryName: "Damp Proofing & Waterproofing", tradeTitle: "Damp Proofing Specialist", keywords: ["dpc injection","chemical damp proof course","tanking","waterproofing","damp survey","woodworm"] },
  "black mould": { categoryName: "Damp Proofing & Waterproofing", tradeTitle: "Mould Removal & Condensation Specialist", keywords: ["toxic mould","mould treatment","positive input ventilation","piv unit","condensation"] },
  "tanking": { categoryName: "Damp Proofing & Waterproofing", tradeTitle: "Basement Tanking & Waterproofing Specialist", keywords: ["cellar waterproofing","membrane","sump pump","basement drying","damp proof membrane"] },
  "data recovery": { categoryName: "Data & Tech Recovery", tradeTitle: "Data Recovery & IT Specialist", keywords: ["hard drive recovery","crashed laptop","dead phone","ssd recovery","corrupt files","water damage"] },
  "computer repair": { categoryName: "Data & Tech Recovery", tradeTitle: "Computer & Laptop Repair Specialist", keywords: ["laptop repair","pc repair","macbook repair","screen replacement","virus removal","slow computer"] },
  "decluttering": { categoryName: "Decluttering & Home Sorting", tradeTitle: "Professional Home Organizer", keywords: ["home organizer","wardrobe declutter","pantry sorting","hoarding help","marie kondo","declutter house"] },
  "home organizer": { categoryName: "Decluttering & Home Sorting", tradeTitle: "Professional Declutterer & Organizer", keywords: ["declutter","space planning","cupboard tidy","downsizing","room sorting"] },
  "demolition": { categoryName: "Demolition & Strip-Out", tradeTitle: "Demolition & Strip-Out Specialist", keywords: ["internal strip out","shed demolition","garage demolition","wall knocking","concrete breaking","site clearing"] },
  "strip out": { categoryName: "Demolition & Strip-Out", tradeTitle: "Internal Strip-Out Specialist", keywords: ["kitchen strip out","bathroom strip out","non structural demolition","de-fit","commercial strip out"] },
  "flood damage": { categoryName: "Disaster Recovery & Restoration", tradeTitle: "Flood & Water Damage Restoration Specialist", keywords: ["water damage","drying","dehumidifiers","sewage backup","flood cleanup","insurance restoration"] },
  "fire damage": { categoryName: "Disaster Recovery & Restoration", tradeTitle: "Fire & Smoke Damage Restoration Specialist", keywords: ["smoke remediation","soot cleaning","fire restoration","emergency board up","odour removal"] },
  "driving lessons": { categoryName: "Driving Instructors", tradeTitle: "Approved Driving Instructor (ADI)", keywords: ["driving instructor","manual driving lessons","automatic driving lessons","intensive course","pass plus","learn to drive"] },
  "driving instructor": { categoryName: "Driving Instructors", tradeTitle: "Approved Driving Instructor (ADI)", keywords: ["driving teacher","driving lessons","automatic","manual","mock driving test","theory test"] },
  "eco home": { categoryName: "Eco-Home & Healthy Living", tradeTitle: "Eco Home & Energy Efficiency Consultant", keywords: ["thermal imaging","energy audit","air quality check","healthy living","lower energy bills","green home"] },
  "dj hire": { categoryName: "Entertainers", tradeTitle: "Professional DJ & Event Host", keywords: ["wedding dj","party dj","mobile disco","sound and lighting","playlist","club dj"] },
  "magician": { categoryName: "Entertainers", tradeTitle: "Close-Up Magician & Illusionist", keywords: ["wedding magician","party magician","childrens magician","mind reader","card tricks"] },
  "live band": { categoryName: "Entertainers", tradeTitle: "Live Event & Function Band", keywords: ["wedding band","party band","covers band","acoustic singer","jazz band"] },
  "letting agent": { categoryName: "Estate Agent & Landlord Services", tradeTitle: "Letting & Property Management Agent", keywords: ["property management","landlord services","tenant check in","inventory report","rent collection","epc"] },
  "property inventory": { categoryName: "Estate Agent & Landlord Services", tradeTitle: "Property Inventory Clerk", keywords: ["check in","check out report","schedule of condition","deposit dispute","mid term inspection"] },
  "wedding planner": { categoryName: "Event Management", tradeTitle: "Wedding Planner & Coordinator", keywords: ["wedding coordination","venue dressing","event styling","wedding supplier","on the day coordinator"] },
  "event planner": { categoryName: "Event Management", tradeTitle: "Event Planning Specialist", keywords: ["party planner","corporate events","anniversary party","marquee hire","festival coordinator"] },
  "mortgage advisor": { categoryName: "Financial Services", tradeTitle: "Independent Mortgage Broker", keywords: ["mortgage broker","remortgage","first time buyer","buy to let","equity release","life insurance"] },
  "fire door": { categoryName: "Fire Safety, Fire Doors & Passive Protection", tradeTitle: "Certified Fire Door Installer & Inspector", keywords: ["fd30","fd60","fire door inspection","intumescent seals","fire door certification","fire door fitting"] },
  "fire safety": { categoryName: "Fire Safety, Fire Doors & Passive Protection", tradeTitle: "Fire Safety & Passive Fire Protection Specialist", keywords: ["fire risk assessment","fra","fire stopping","fire extinguishers","dry riser","emergency lighting"] },
  "fire risk assessment": { categoryName: "Fire Safety, Fire Doors & Passive Protection", tradeTitle: "Fire Risk Assessor", keywords: ["fra type 1","fra type 3","landlord fire safety","commercial fire assessment","hmo fire safety"] },
  "carpet fitter": { categoryName: "Flooring", tradeTitle: "Carpet & Flooring Fitter", keywords: ["carpet fitting","underlay","stair carpet","gripper rods","carpet supplier","flooring"] },
  "laminate flooring": { categoryName: "Flooring", tradeTitle: "Laminate & Wood Flooring Installer", keywords: ["wood flooring","engineered oak","lvt","luxury vinyl tile","herringbone","click flooring"] },
  "floor sanding": { categoryName: "Flooring", tradeTitle: "Hardwood Floor Sanding & Restoration", keywords: ["wood floor restoration","lacquer","floor varnishing","parquet sanding","gap filling"] },
  "garage door": { categoryName: "Garage & Driveway", tradeTitle: "Garage Door Installation & Repair Specialist", keywords: ["roller garage door","sectional garage door","electric garage door","garage door cables","remote control door"] },
  "driveway": { categoryName: "Garage & Driveway", tradeTitle: "Driveway & Paving Specialist", keywords: ["block paving driveway","resin bound driveway","tarmac driveway","gravel driveway","dropped kerb","driveway sealing"] },
  "dropped kerb": { categoryName: "Garage & Driveway", tradeTitle: "Dropped Kerb & Vehicle Crossover Contractor", keywords: ["council crossover","driveway access","pavement kerb lowering","dropped kerb streetworks"] },
  "double glazing repair": { categoryName: "Glazing & Glass", tradeTitle: "Double Glazing Repair Specialist", keywords: ["blown window","condensation inside window","misted sealed unit","window glass replacement"] },
  "glass balustrade": { categoryName: "Glazing & Glass", tradeTitle: "Glass Balustrade Specialist", keywords: ["frameless glass","stair glass","balcony glass","shower glass","toughened laminated glass"] },
  "groundworks": { categoryName: "Groundworks", tradeTitle: "Groundworks & Excavation Contractor", keywords: ["mini digger","foundations","drainage","trench digging","site clearance","concrete slab base","footings"] },
  "gutter cleaning": { categoryName: "Guttering & Drainage", tradeTitle: "Gutter Cleaning & Clearance Specialist", keywords: ["blocked gutters","gutter vacuum","clearing gutters","downpipes","fascias","soffits"] },
  "blocked drain": { categoryName: "Guttering & Drainage", tradeTitle: "Drain Unblocking & Jetting Specialist", keywords: ["drain jetting","cctv drain survey","blocked toilet","manhole overflowing","sewer unblocking"] },
  "gutters": { categoryName: "Guttering & Drainage", tradeTitle: "Guttering & Drainage Specialist", keywords: ["gutter replacement","upvc gutters","cast iron guttering","leaking gutter","drainage"] },
  "flat pack assembly": { categoryName: "Handyman / General", tradeTitle: "Flat Pack Furniture Assembly Specialist", keywords: ["ikea assembly","wardrobe assembly","bed build","pax wardrobe","furniture assembly"] },
  "hard surface repair": { categoryName: "Hard Surface Repair & Cosmetic Resurfacing", tradeTitle: "Hard Surface Repair & Cosmetic Technician", keywords: ["bath chip repair","worktop burn repair","chipped tile fix","upvc scratch repair","granite repair"] },
  "bath repair": { categoryName: "Hard Surface Repair & Cosmetic Resurfacing", tradeTitle: "Bath & Sanitaryware Resurfacing Specialist", keywords: ["enamel chip repair","acrylic bath crack","shower tray repair","chipped sink","bath re-enamelling"] },
  "worktop repair": { categoryName: "Hard Surface Repair & Cosmetic Resurfacing", tradeTitle: "Worktop Chip & Scratch Repair Specialist", keywords: ["quartz chip","laminate burn","corian repair","granite edge repair","surface resurfacing"] },
  "knotweed": { categoryName: "Hazardous Material Removal", tradeTitle: "Japanese Knotweed & Invasive Plant Specialist", keywords: ["japanese knotweed","knotweed removal","herbicide treatment","excavation","pca accredited"] },
  "japanese knotweed": { categoryName: "Hazardous Material Removal", tradeTitle: "Japanese Knotweed Remediation Specialist", keywords: ["knotweed survey","knotweed treatment","mortgage guarantee","invasive weed"] },
  "oil tank removal": { categoryName: "Hazardous Material Removal", tradeTitle: "Heating Oil Tank Removal Specialist", keywords: ["decommissioning oil tank","kerosene tank","tank disposal","bunded oil tank"] },
  "personal trainer": { categoryName: "Health, Fitness & Wellbeing", tradeTitle: "Certified Personal Trainer (PT)", keywords: ["pt","fitness coach","weight loss","strength training","home workouts","gym trainer"] },
  "sports massage": { categoryName: "Health, Fitness & Wellbeing", tradeTitle: "Sports Massage Therapist", keywords: ["deep tissue massage","muscle recovery","injury rehab","back pain massage","physiotherapy"] },
  "acupuncture": { categoryName: "Holistic & Alternative Health", tradeTitle: "Licensed Acupuncturist", keywords: ["traditional acupuncture","dry needling","pain relief","fertility acupuncture","tcm"] },
  "hypnotherapy": { categoryName: "Holistic & Alternative Health", tradeTitle: "Clinical Hypnotherapist", keywords: ["hypnosis","stop smoking","anxiety","weight loss hypnosis","phobia treatment"] },
  "home help": { categoryName: "Home Help & Personal Errands", tradeTitle: "Home Helper & Personal Assistant", keywords: ["errands","grocery shopping","prescription pickup","meal prep","waiting in for delivery","elderly helper"] },
  "wifi": { categoryName: "Home Network & AV", tradeTitle: "Home Network & Wi-Fi Specialist", keywords: ["mesh wifi","wifi dead zones","cat6 ethernet","network cabling","router setup","home cinema"] },
  "home network": { categoryName: "Home Network & AV", tradeTitle: "Home Networking & AV Engineer", keywords: ["ethernet cable","broadband setup","cctv network","smart home automation","audio visual"] },
  "loft insulation": { categoryName: "Insulation", tradeTitle: "Loft & Cavity Insulation Specialist", keywords: ["roof insulation","mineral wool","insulation rolls","loft boarding","energy saving grant"] },
  "cavity wall insulation": { categoryName: "Insulation", tradeTitle: "Cavity Wall Insulation Contractor", keywords: ["blown insulation","bead insulation","external wall insulation","soundproofing","internal wall insulation"] },
  "soundproofing": { categoryName: "Insulation", tradeTitle: "Acoustic Insulation & Soundproofing Specialist", keywords: ["acoustic panels","soundproof wall","ceiling soundproofing","noisy neighbours","resilient bar"] },
  "interior designer": { categoryName: "Interior Design & Home Staging", tradeTitle: "Interior Designer & Space Planner", keywords: ["interior design","room makeover","moodboards","space planning","colour consultant","home staging"] },
  "home staging": { categoryName: "Interior Design & Home Staging", tradeTitle: "Home Staging & Property Styling Specialist", keywords: ["property staging for sale","show home furniture","declutter for selling","rental staging"] },
  "landscaping": { categoryName: "Landscaping & Garden", tradeTitle: "Landscaper & Garden Designer", keywords: ["patio paving","indian stone","porcelain patio","decking","artificial grass","raised beds","garden design"] },
  "fencing": { categoryName: "Landscaping & Garden", tradeTitle: "Fencing Contractor & Installer", keywords: ["fence panels","closeboard fence","concrete posts","feather edge","garden gate","trellis"] },
  "artificial grass": { categoryName: "Landscaping & Garden", tradeTitle: "Artificial Lawn & Astro Turf Specialist", keywords: ["astro turf","fake lawn","artificial lawn installation","pet friendly grass"] },
  "web design": { categoryName: "Logo, Design & Websites", tradeTitle: "Web Designer & Developer", keywords: ["website builder","wordpress","ecommerce website","shopify","responsive website","landing page"] },
  "logo design": { categoryName: "Logo, Design & Websites", tradeTitle: "Graphic Designer & Brand Identity Specialist", keywords: ["brand logo","graphic design","business branding","social media graphics","vector logo"] },
  "seo": { categoryName: "Marketing & Growing Your Business", tradeTitle: "Local SEO & Digital Marketing Specialist", keywords: ["local seo","google ranking","google my business","google ads","facebook ads","lead generation"] },
  "repointing": { categoryName: "Masonry & Stonework", tradeTitle: "Brickwork Repointing Specialist", keywords: ["pointing","mortar replacement","weather struck","lime pointing","stone repointing"] },
  "welder": { categoryName: "Metalwork & Welding", tradeTitle: "Mobile Welder & Fabricator", keywords: ["mobile welding","mig welding","tig welding","metal gates","railings","ironwork","fire escape"] },
  "metal gates": { categoryName: "Metalwork & Welding", tradeTitle: "Wrought Iron & Metal Gate Fabricator", keywords: ["iron gates","driveway gates","railings","security grilles","balustrade"] },
  "errand runner": { categoryName: "OnDemand & Lifestyle", tradeTitle: "Lifestyle & On-Demand Assistant", keywords: ["urgent pickup","queue standing","delivery waiting","local errands","leaf clearing"] },
  "tutor": { categoryName: "Online Lessons & Tutoring", tradeTitle: "Private Online & Home Tutor", keywords: ["maths tutor","english tutor","science tutor","gcse tutor","a level tuition","11 plus"] },
  "balloon arch": { categoryName: "Party Planner", tradeTitle: "Party Decorator & Balloon Artist", keywords: ["balloon garland","light up numbers","party styling","backdrop","photo booth hire","candy cart"] },
  "cat flap": { categoryName: "Pet Home Installations", tradeTitle: "Cat Flap & Pet Door Fitter", keywords: ["cat flap in upvc door","microchip cat flap","dog flap","catio builder","pet door fitting"] },
  "catio": { categoryName: "Pet Home Installations", tradeTitle: "Outdoor Cat Enclosure & Catio Builder", keywords: ["cat enclosure","cat netting","pet run","outdoor dog run","rabbit hutch"] },
  "skimming": { categoryName: "Plastering", tradeTitle: "Plasterer", keywords: ["plaster skimming","smooth walls","over artex","plasterboard finishing","coving"] },
  "rendering": { categoryName: "Plastering", tradeTitle: "External Rendering Specialist", keywords: ["k rend","monocouche","silicone render","sand and cement render","external wall render"] },
  "ready mix concrete": { categoryName: "Ready-Mix Concrete & Tarmacadam Surfacing", tradeTitle: "Ready-Mix Concrete Supplier & Pumping", keywords: ["concrete delivery","volumetric concrete","barrow mix","concrete boom pump","foundation pour"] },
  "tarmac": { categoryName: "Ready-Mix Concrete & Tarmacadam Surfacing", tradeTitle: "Tarmacadam & Asphalt Surfacing Contractor", keywords: ["tarmac driveway","asphalt paving","car park resurfacing","road surfacing","pothole repair"] },
  "air conditioning": { categoryName: "Refrigerator/AC & Commercial HVAC", tradeTitle: "Air Conditioning & Heat Pump Engineer (F-Gas)", keywords: ["air con installation","ac regas","split system ac","commercial cooling","f-gas","heat pump"] },
  "commercial refrigeration": { categoryName: "Refrigerator/AC & Commercial HVAC", tradeTitle: "Commercial Refrigeration Engineer", keywords: ["cold room","walk in chiller","display fridge","cellar cooling","ice machine"] },
  "scaffolding": { categoryName: "Scaffolding", tradeTitle: "Licensed Scaffolder & Access Specialist", keywords: ["scaffold hire","access tower","chimney scaffolding","temporary roof","scaffold erectors","edge protection"] },
  "scaffolder": { categoryName: "Scaffolding", tradeTitle: "Scaffolder (CISRS)", keywords: ["scaffolding hire","domestic scaffolding","commercial scaffolding","tin hat"] },
  "cctv": { categoryName: "Security Systems", tradeTitle: "CCTV & Electronic Security Specialist", keywords: ["cctv installation","security cameras","hikvision","ring doorbell","burglar alarm","smart security"] },
  "burglar alarm": { categoryName: "Security Systems", tradeTitle: "Security Alarm Installation Engineer", keywords: ["intruder alarm","wireless alarm","ajax alarm","veritas","alarm servicing","monitored alarm"] },
  "solar panels": { categoryName: "Solar, Heat Pumps & Renewable Energy", tradeTitle: "MCS Certified Solar PV & Battery Engineer", keywords: ["solar pv","battery storage","inverter","solar panel installation","givenergy","tesla powerwall"] },
  "heat pump": { categoryName: "Solar, Heat Pumps & Renewable Energy", tradeTitle: "Air Source Heat Pump Specialist (MCS)", keywords: ["ashp","ground source heat pump","boiler upgrade scheme","bus grant","renewable heating"] },
  "architect": { categoryName: "Surveying & Architecture", tradeTitle: "Architect & Architectural Designer (RIBA)", keywords: ["architectural drawings","planning permission","building regulations plans","extension design","cad drawings"] },
  "surveyor": { categoryName: "Surveying & Architecture", tradeTitle: "Chartered Building Surveyor (RICS)", keywords: ["homebuyer report","level 2 survey","level 3 building survey","structural survey","party wall surveyor"] },
  "party wall": { categoryName: "Surveying & Architecture", tradeTitle: "Party Wall Surveyor", keywords: ["party wall agreement","party wall award","building notice","boundary dispute"] },
  "hot tub": { categoryName: "Swimming Pool & Hot Tub", tradeTitle: "Hot Tub & Spa Technician", keywords: ["hot tub repair","hot tub servicing","spa maintenance","water chemicals","hot tub install"] },
  "swimming pool": { categoryName: "Swimming Pool & Hot Tub", tradeTitle: "Swimming Pool Maintenance Specialist", keywords: ["pool pump","pool liner","pool heating","pool cleaning","winterise pool"] },
  "airport transfer": { categoryName: "Taxi & Transport", tradeTitle: "Airport Transfer & Private Hire Chauffeur", keywords: ["airport taxi","heathrow transfer","gatwick transfer","manchester airport","executive travel"] },
  "private hire": { categoryName: "Taxi & Transport", tradeTitle: "Private Hire Taxi & Transport Specialist", keywords: ["taxi","cab","chauffeur","minibus hire","long distance taxi","wheelchair accessible taxi"] },
  "tile fitting": { categoryName: "Tiling", tradeTitle: "Tile Installer", keywords: ["floor tiler","wall tiler","natural stone","marble tiling","wet room tiling"] },
  "tool hire": { categoryName: "Tool & Equipment Hire", tradeTitle: "Plant & Tool Equipment Hire", keywords: ["carpet cleaner hire","cement mixer hire","floor sander hire","pressure washer hire","scaffold tower hire"] },
  "stump grinding": { categoryName: "Tree Surgery & Arboriculture", tradeTitle: "Stump Grinding & Tree Removal Specialist", keywords: ["tree stump","root removal","stump removal","tree felling"] },
  "reupholstery": { categoryName: "Upholstery & Soft Furnishings", tradeTitle: "Upholsterer & Furniture Restorer", keywords: ["sofa reupholstery","chair fabric replacement","foam replacement","leather restoration","cushion filling"] },
  "upholstery": { categoryName: "Upholstery & Soft Furnishings", tradeTitle: "Master Upholsterer", keywords: ["furniture upholstery","dining chairs","headboard","antique upholstery","spring repair"] },
  "car body repair": { categoryName: "Vehicle Bodywork & Cosmetic", tradeTitle: "Vehicle Bodywork & SMART Repair Specialist", keywords: ["dent repair","bumper scuff","car respray","paint chip","scratch repair","alloy wheel refurbishment"] },
  "alloy wheel refurbishment": { categoryName: "Vehicle Bodywork & Cosmetic", tradeTitle: "Alloy Wheel Refurbishment Specialist", keywords: ["kerbed alloy","powder coating","diamond cut wheels","wheel repair"] },
  "mobile vet": { categoryName: "Veterinary & Pet Health", tradeTitle: "Mobile Veterinary Surgeon (MRCVS)", keywords: ["home visit vet","pet vaccination","dog microchipping","home euthanasia","flea treatment","pet checkup"] },
  "void turnaround": { categoryName: "Void Property Turnaround & Tenancy Refresh", tradeTitle: "Void Property Turnaround Specialist", keywords: ["social housing void","end of tenancy turnaround","key safe","lock change","sparkle clean","property refresh"] },
  "skip hire": { categoryName: "Waste & Skip Services", tradeTitle: "Skip Hire & Waste Management Contractor", keywords: ["skip","mini skip","6 yard skip","8 yard skip","builders skip","roro skip","skip permit"] },
  "rubbish removal": { categoryName: "Waste & Skip Services", tradeTitle: "Licensed Waste Carrier & Rubbish Removal", keywords: ["waste clearance","house clearance","builders waste","grab hire","junk removal","waste disposal"] },
  "grab hire": { categoryName: "Waste & Skip Services", tradeTitle: "Grab Lorry Hire & Muck Away Specialist", keywords: ["muck away","grab lorry","soil removal","rubble clearance","aggregates delivery"] },
  "water softener": { categoryName: "Water Treatment", tradeTitle: "Water Softener & Filtration Specialist", keywords: ["limescale","drinking water filter","reverse osmosis","water softener salt","descaler","hard water"] },
  "window fitter": { categoryName: "Windows & Doors", tradeTitle: "Window & Door Installer (FENSA / CERTASS)", keywords: ["upvc windows","double glazing","composite door","bifold doors","french doors","sash windows","window repair"] },
  "composite door": { categoryName: "Windows & Doors", tradeTitle: "Composite Door Specialist", keywords: ["front door","rockdoor","endurance door","secure door","door replacement"] },
  "bifold doors": { categoryName: "Windows & Doors", tradeTitle: "Aluminium Bi-Fold & Sliding Door Specialist", keywords: ["bi fold doors","aluminium doors","patio sliding doors","panoramic doors"] },
  "upvc door repair": { categoryName: "Windows & Doors", tradeTitle: "uPVC Door & Window Repair Specialist", keywords: ["door dropped","hinge adjustment","lock mechanism","drafty door","glass replacement"] },
  "locked out": { categoryName: "Locksmith", tradeTitle: "24/7 Emergency Locksmith", keywords: ["locksmith","lost keys","lockout","door open","gain entry","broken key"] },
  "lock replacement": { categoryName: "Locksmith", tradeTitle: "Locksmith & Security Specialist", keywords: ["new locks","british standard lock","mortice lock","cylinder change","anti snap cylinder"] },
  "van hire": { categoryName: "Van Hire & Commercial Vehicle Rental", tradeTitle: "Van Hire & Commercial Vehicle Rental Company", keywords: ["van rental","rent a van","hire a van","self drive van","transit hire","luton van hire","tipper hire","commercial vehicle hire","dropside hire","minibus hire","moving van hire","small van hire"] },
  "van rental": { categoryName: "Van Hire & Commercial Vehicle Rental", tradeTitle: "Van Rental & Fleet Specialist", keywords: ["van hire","rent a van","hire a van","self drive van hire","commercial vehicle rental","moving van rental","luton van","transit van hire"] },
  "rent a van": { categoryName: "Van Hire & Commercial Vehicle Rental", tradeTitle: "Self-Drive Van Hire Company", keywords: ["van hire","van rental","hire a van","short term van hire","transit rental","luton tail lift hire","swb van rental","lwb van hire"] },
  "hire a van": { categoryName: "Van Hire & Commercial Vehicle Rental", tradeTitle: "Commercial Vehicle & Van Hire Specialist", keywords: ["van hire","van rental","rent a van","moving van hire","weekend van hire","daily van hire","trade replacement van"] },
  "luton van hire": { categoryName: "Van Hire & Commercial Vehicle Rental", tradeTitle: "Luton Van & Tail Lift Hire Specialist", keywords: ["tail lift van hire","house move van","box van hire","3.5 tonne van hire","large van hire"] },
  "tyres": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "Tyre Specialist & Tyre Fitting Centre", keywords: ["tyre shop","buy tyres","new tyres","part worn tyres","puncture repair","mobile tyre fitting","wheel tracking","wheel alignment","tyre replacement","car tyres","van tyres"] },
  "tyre shop": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "Tyre Centre & Wheel Specialist", keywords: ["buy tyres","tyre fitting","new tyres","part worn tyres","puncture repair","wheel alignment","tyre garage","budget tyres","premium tyres"] },
  "tyre fitting": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "Mobile & Workshop Tyre Fitter", keywords: ["mobile tyre fitting","new tyre supply","puncture repair","tyre change","wheel balance","run flat tyres","tyre technician"] },
  "mobile tyre fitting": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "24/7 Mobile Tyre Fitting Specialist", keywords: ["mobile tyres","roadside tyre change","home tyre fitting","emergency tyre replacement","tyre blowout","punctured tyre","workplace tyre fitting"] },
  "buy tyres": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "Tyre Supply & Fitting Specialist", keywords: ["tyre shop","new tyres","cheap tyres","michelin","continental","pirelli","goodyear","budget tyres","part worn tyres"] },
  "puncture repair": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "Tyre & Puncture Repair Specialist", keywords: ["flat tyre","punctured tyre","slow puncture","nail in tyre","tyre plug","emergency tyre repair"] },
  "wheel alignment": { categoryName: "Tyres, Wheels & Mobile Tyre Fitting", tradeTitle: "4-Wheel Laser Tracking & Alignment Specialist", keywords: ["wheel tracking","laser alignment","camber adjustment","steering pull","uneven tyre wear","wheel balancing"] },
};

/**
 * Active runtime synonyms dictionary combining hardcoded base synonyms with
 * dynamic synonyms fetched from Firestore (without requiring any code redeployments).
 */
export let CATEGORY_SYNONYMS: Record<string, SynonymMeta> = { ...BASE_CATEGORY_SYNONYMS };

/**
 * Registers dynamic synonyms loaded from Firestore or AI suggestions at runtime.
 * Allows adding new categories, trade titles, and keyword synonyms without any code redeployments!
 */
export function registerDynamicSynonyms(dynamicSynonyms: Record<string, SynonymMeta>) {
  if (!dynamicSynonyms || typeof dynamicSynonyms !== "object") return;
  CATEGORY_SYNONYMS = {
    ...BASE_CATEGORY_SYNONYMS,
    ...dynamicSynonyms,
  };
}

/**
 * Returns currently active synonyms.
 */
export function getActiveCategorySynonyms(): Record<string, SynonymMeta> {
  return CATEGORY_SYNONYMS;
}

/**
 * Pre-populated dictionary of common trade category keywords, synonyms, and variations.
 */
export const COMMON_TRADE_VOCABULARY: CandidateItem[] = [
  // Bake N Cake, Wedding Cakes & Catering
  { label: "Bake N Cake", type: "category", categoryName: "Bake N Cake" },
  { label: "Cake Maker & Baker", type: "trade", categoryName: "Bake N Cake" },
  { label: "Baker", type: "trade", categoryName: "Bake N Cake" },
  { label: "Pastry Chef", type: "trade", categoryName: "Bake N Cake" },
  { label: "Caterer & Private Chef", type: "trade", categoryName: "Bake N Cake" },
  { label: "Wedding Cakes", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Birthday Cakes", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Cupcakes & Mini Treats", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Dessert Tables", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Celebration Cakes", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Party Food Platters", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Afternoon Tea", type: "subcategory", categoryName: "Bake N Cake" },
  { label: "Bespoke Bakes", type: "subcategory", categoryName: "Bake N Cake" },

  // Tailoring, Garment Alterations & Laundry
  { label: "Tailoring, Alterations & Laundry Services", type: "category", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Tailor", type: "trade", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Seamstress", type: "trade", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Dressmaker", type: "trade", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Ironing & Laundry Service", type: "trade", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Garment Alterations", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Bespoke Tailoring & Suits", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Wedding Dress & Bridal Alterations", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Professional Ironing & Pressing", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Dry Cleaning Collection & Delivery", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Clothing & Zip Repairs", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
  { label: "Curtain & Blind Alterations", type: "subcategory", categoryName: "Tailoring, Alterations & Laundry Services" },
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

  // Vehicle Recovery & Roadside Assistance
  { label: "Vehicle Recovery & Roadside", type: "category", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Breakdown Recovery (24/7)", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Breakdown Recovery", type: "trade", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Tow Truck Operator", type: "trade", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Towing", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Car Tow to Garage", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Van & Light Commercial Recovery", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "HGV & Heavy Vehicle Recovery", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Flatbed Towing", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Accident Recovery & Towing", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Mobile Jump Start Service", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Fuel Drain (Wrong Fuel)", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Roadside Tyre Change", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },
  { label: "Stuck Vehicle Extraction & Winching", type: "subcategory", categoryName: "Vehicle Recovery & Roadside" },

  // Manned Security, Guarding & Event Security
  { label: "Security Services, Manned Guarding & Event Security", type: "category", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Security Guard", type: "trade", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Site Security", type: "subcategory", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Patrolling", type: "subcategory", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Event Security", type: "subcategory", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Stadium Security", type: "subcategory", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Door Supervisor", type: "trade", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Bouncers", type: "trade", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "CCTV Security", type: "subcategory", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "Close Protection", type: "trade", categoryName: "Security Services, Manned Guarding & Event Security" },
  { label: "K9 Security Dog Handlers", type: "subcategory", categoryName: "Security Services, Manned Guarding & Event Security" },

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
  { label: "Same-Day Courier", type: "trade", categoryName: "Courier, Parcel & Express Delivery" },

  // General Labour, Trade Mates & Site Helpers
  { label: "General Labour, Trade Mates & Site Helpers", type: "category", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "General Labourer", type: "trade", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Trade Mate & Helper", type: "trade", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Site Helper", type: "trade", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Garden Digging, Trenching & Groundwork Assistance", type: "subcategory", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "General Site Labourer & Heavy Lifting", type: "subcategory", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Demolition & Non-Structural Wall Strip-Out Helper", type: "subcategory", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Material Offloading, Plasterboard, Bricks & Timber Carrying", type: "subcategory", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Skip Loading, Rubble Bagging & Waste Clearance Helper", type: "subcategory", categoryName: "General Labour, Trade Mates & Site Helpers" },
  { label: "Urgent Same-Day On-Demand Site Helper & Extra Hands", type: "subcategory", categoryName: "General Labour, Trade Mates & Site Helpers" },

  // Graphics & Signages
  { label: "Graphics & Signages", type: "category", categoryName: "Graphics & Signages" },
  { label: "Graphics & Sinages", type: "category", categoryName: "Graphics & Signages" },
  { label: "Signage & Display Boards", type: "category", categoryName: "Graphics & Signages" },
  { label: "Sign Maker", type: "trade", categoryName: "Graphics & Signages" },
  { label: "Signage Specialist", type: "trade", categoryName: "Graphics & Signages" },
  { label: "Shopfront Sign Maker", type: "trade", categoryName: "Graphics & Signages" },
  { label: "Window Vinyl & Graphics Installer", type: "trade", categoryName: "Graphics & Signages" },
  { label: "Site Safety Signage Installer", type: "trade", categoryName: "Graphics & Signages" },
  { label: "Shopfront Fascias, 3D Built-Up Lettering & Illuminated Signs", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Construction Site Safety Boards, PPE Notices & Hazard Signs", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Display Boards & Large Format Printing (Foamex, Correx, Dibond & Acrylic)", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Window Graphics, Frosted Privacy Vinyl & Manifestations", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Wayfinding, Architectural Directory Boards & Door Plaques", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Pavement Signs, A-Boards, Swing Signs & Chalkboards", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Scaffold Banners, Site Hoarding Graphics & Mesh Banners", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Exhibition Stands, Roll-Up Banners & Pop-Up Displays", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Vehicle Signwriting, Fleet Decals & Van Lettering", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Illuminated Lightboxes, Neon & LED Shopfront Fascias", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Estate Agent & Property Boards (T-Boards, Flag Boards & V-Boards)", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "Post, Panel & Monolith / Totem Roadside Signs", type: "subcategory", categoryName: "Graphics & Signages" },
  { label: "High-Level Building Signage Installation & Abseil / Cherry Picker Access", type: "subcategory", categoryName: "Graphics & Signages" },

  // Removals & House Moves
  { label: "Home & Domestic Removals", type: "category", categoryName: "Home & Domestic Removals" },
  { label: "Removals", type: "category", categoryName: "Removals" },
  { label: "House Removals", type: "trade", categoryName: "Home & Domestic Removals" },
  { label: "House Removal", type: "trade", categoryName: "Home & Domestic Removals" },
  { label: "Home Removals", type: "trade", categoryName: "Home & Domestic Removals" },
  { label: "Full House Move", type: "subcategory", categoryName: "Home & Domestic Removals" },
  { label: "Flat & Apartment Move", type: "subcategory", categoryName: "Home & Domestic Removals" },
  { label: "Man & Van Removals", type: "trade", categoryName: "Removals" },
  { label: "Man and Van", type: "trade", categoryName: "Removals" },
  { label: "Office & Commercial Removals", type: "category", categoryName: "Office & Commercial Removals" },
  { label: "Specialist & Heavy Item Removals", type: "category", categoryName: "Specialist & Heavy Item Removals" },
  { label: "House & Garden Clearance", type: "category", categoryName: "House & Garden Clearance" },
  { label: "House Clearance", type: "subcategory", categoryName: "House & Garden Clearance" },

  // Van Hire & Commercial Vehicle Rental
  { label: "Van Hire & Commercial Vehicle Rental", type: "category", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Van Hire", type: "trade", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Van Rental", type: "trade", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Rent a Van", type: "trade", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Self Drive Van Hire", type: "trade", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Luton Van with Tail Lift Hire", type: "subcategory", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Tipper & Dropside Van Hire", type: "subcategory", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Transit Van Hire", type: "trade", categoryName: "Van Hire & Commercial Vehicle Rental" },
  { label: "Minibus Hire", type: "subcategory", categoryName: "Van Hire & Commercial Vehicle Rental" },

  // Tyres, Wheels & Mobile Tyre Fitting
  { label: "Tyres, Wheels & Mobile Tyre Fitting", type: "category", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Tyres Shop", type: "trade", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Tyre Shop", type: "trade", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Tyre Fitter", type: "trade", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Mobile Tyre Fitting", type: "trade", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Buy Tyres", type: "trade", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "New Tyres Supply & Fitting", type: "subcategory", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Part-Worn Tyres", type: "subcategory", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Emergency Puncture Repair", type: "subcategory", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Wheel Laser Alignment & Tracking", type: "subcategory", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },
  { label: "Locking Wheel Nut Removal", type: "subcategory", categoryName: "Tyres, Wheels & Mobile Tyre Fitting" },

  // Pet Services
  { label: "Pet Services", type: "category", categoryName: "Pet Services" },
  { label: "Pet Care", type: "trade", categoryName: "Pet Services" },
  { label: "Pet Carer", type: "trade", categoryName: "Pet Services" },
  { label: "Pet Sitting", type: "trade", categoryName: "Pet Services" },
  { label: "Pet Sitter", type: "trade", categoryName: "Pet Services" },
  { label: "Pet Sitting (in-home)", type: "subcategory", categoryName: "Pet Services" },
  { label: "Dog Walking", type: "subcategory", categoryName: "Pet Services" },
  { label: "Dog Walker", type: "trade", categoryName: "Pet Services" },
  { label: "Cat Sitting", type: "subcategory", categoryName: "Pet Services" },
  { label: "Cat Sitter", type: "trade", categoryName: "Pet Services" },
  { label: "Dog Boarding / Kennels", type: "subcategory", categoryName: "Pet Services" },
  { label: "Pet Grooming", type: "subcategory", categoryName: "Pet Services" }
];

/**
 * Derives canonical synonyms and related terms metadata for a given trade category name.
 * Pulls from BASE_CATEGORY_SYNONYMS, active CATEGORY_SYNONYMS, and standard trade vocabulary.
 */
export function getCategoryMetadata(categoryName: string): { synonyms: string[]; related_terms: string[] } {
  if (!categoryName) return { synonyms: [], related_terms: [] };
  const targetCatLower = categoryName.trim().toLowerCase();

  const synonymsSet = new Set<string>();
  const relatedTermsSet = new Set<string>();

  // Add the category name itself (and stripped variations)
  synonymsSet.add(categoryName.toLowerCase());
  if (categoryName.includes("&")) {
    categoryName.split("&").forEach(p => {
      const trimmed = p.trim().toLowerCase();
      if (trimmed) synonymsSet.add(trimmed);
    });
  }

  // Scan CATEGORY_SYNONYMS
  Object.entries(CATEGORY_SYNONYMS).forEach(([term, meta]) => {
    if (meta.categoryName.toLowerCase() === targetCatLower) {
      synonymsSet.add(term.toLowerCase());
      if (meta.tradeTitle) {
        synonymsSet.add(meta.tradeTitle.toLowerCase());
      }
      if (meta.keywords && Array.isArray(meta.keywords)) {
        meta.keywords.forEach(kw => relatedTermsSet.add(kw.toLowerCase()));
      }
    }
  });

  // Scan BASE_CATEGORY_SYNONYMS
  Object.entries(BASE_CATEGORY_SYNONYMS).forEach(([term, meta]) => {
    if (meta.categoryName.toLowerCase() === targetCatLower) {
      synonymsSet.add(term.toLowerCase());
      if (meta.tradeTitle) {
        synonymsSet.add(meta.tradeTitle.toLowerCase());
      }
      if (meta.keywords && Array.isArray(meta.keywords)) {
        meta.keywords.forEach(kw => relatedTermsSet.add(kw.toLowerCase()));
      }
    }
  });

  // Sector specific curated fallbacks
  const sectorKnowledge: Record<string, { synonyms: string[]; related_terms: string[] }> = {
    "plumbing": {
      synonyms: ["plumber", "plumbing", "radiator", "radiators", "pipework", "piping", "drainage"],
      related_terms: ["leak", "tap", "sink", "toilet", "boiler", "water heater", "cylinder", "unblocking", "power flush", "bathroom", "shower", "trv", "valve"]
    },
    "electrical": {
      synonyms: ["electrician", "electrical", "sparks", "sparky", "electrical contractor"],
      related_terms: ["rewire", "fusebox", "consumer unit", "socket", "switch", "lighting", "eicr", "ev charger", "pat testing", "cctv", "alarm", "smart home"]
    },
    "gas engineering": {
      synonyms: ["gas safe", "gas engineer", "heating engineer", "boiler engineer", "central heating engineer"],
      related_terms: ["boiler", "combi boiler", "central heating", "cp12", "gas fire", "gas hob", "flue", "power flush", "servicing", "radiator replacement"]
    },
    "carpentry & joinery": {
      synonyms: ["joiner", "joinery", "carpenter", "carpentry", "woodworker"],
      related_terms: ["wood", "timber", "kitchen", "door", "stair", "wardrobe", "decking", "skirting", "flooring", "stud wall", "fitted furniture"]
    },
    "roofing": {
      synonyms: ["roofer", "roofing", "roof repairs", "roofing contractor"],
      related_terms: ["tile", "slate", "gutter", "chimney", "flat roof", "leadwork", "fascia", "soffit", "pitched roof", "felt roof", "roof leak"]
    },
    "painting & decorating": {
      synonyms: ["painter", "decorator", "painter & decorator", "decorating"],
      related_terms: ["paint", "wallpaper", "gloss", "emulsion", "interior painting", "exterior painting", "plaster painting", "woodwork painting"]
    },
    "gardening & landscaping": {
      synonyms: ["gardener", "landscaper", "tree surgeon", "garden maintenance"],
      related_terms: ["lawn", "mowing", "hedges", "weeding", "pruning", "patio", "paving", "fencing", "decking", "turf", "garden clearance"]
    },
    "van hire & commercial vehicle rental": {
      synonyms: ["van hire", "rent a van", "van rental", "transit van hire", "commercial vehicle rental", "self drive van hire"],
      related_terms: ["luton van", "tail lift", "dropside", "tipper", "short wheelbase", "long wheelbase", "hourly van hire", "daily van rental", "moving van"]
    },
    "tyres, wheels & mobile tyre fitting": {
      synonyms: ["tyre shop", "tyres shop", "tyre fitter", "mobile tyre fitting", "buy tyres", "tyres"],
      related_terms: ["puncture repair", "wheel alignment", "tracking", "locking wheel nut", "part-worn tyres", "new tyres", "run flat tyres", "emergency tyre change"]
    },
    "general labour, trade mates & site helpers": {
      synonyms: ["labourer", "general labour", "trade mate", "site helper", "builder mate", "hand"],
      related_terms: ["skip loading", "material offloading", "demolition", "digging", "trenching", "site clearance", "strip out", "heavy lifting", "cscs"]
    },
    "bake n cake": {
      synonyms: ["cake", "baker", "baking", "cake maker", "pastry chef", "bespoke bakes"],
      related_terms: ["wedding cake", "birthday cake", "cupcakes", "dessert", "fondant", "patisserie", "afternoon tea", "catering", "buffet", "party food"]
    },
    "vehicle recovery & roadside": {
      synonyms: ["tow truck", "vehicle recovery", "breakdown recovery", "towing", "roadside assistance"],
      related_terms: ["jump start", "fuel drain", "wrong fuel", "flatbed", "winch", "flat tyre", "broken down", "accident recovery"]
    }
  };

  const sectorFallback = sectorKnowledge[targetCatLower];
  if (sectorFallback) {
    sectorFallback.synonyms.forEach(s => synonymsSet.add(s.toLowerCase()));
    sectorFallback.related_terms.forEach(r => relatedTermsSet.add(r.toLowerCase()));
  }

  return {
    synonyms: Array.from(synonymsSet),
    related_terms: Array.from(relatedTermsSet)
  };
}

/**
 * Builds candidate list dynamically combining static category definitions and active trader profiles.
 */
export function buildCandidateDictionary(
  traderList: Array<{ name?: string; trades?: string[]; services?: string[]; tags?: string[]; skills?: string[] }> = [],
  categoryList: Array<{ name: string; subcategories?: string[]; synonyms?: string[]; related_terms?: string[]; relatedTerms?: string[] }> = []
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

  // 3. Add dynamically loaded TRADE_CATEGORIES and passed categoryList
  const allCategories = categoryList.length > 0 ? categoryList : (Array.isArray(TRADE_CATEGORIES) ? TRADE_CATEGORIES : []);
  allCategories.forEach((cat: any) => {
    const catName = cat.name || cat;
    if (typeof catName === "string" && !dictionaryMap.has(catName.toLowerCase())) {
      dictionaryMap.set(catName.toLowerCase(), {
        label: catName,
        type: "category",
        categoryName: catName,
      });
    }

    // Add category synonyms metadata to dictionary
    const synonyms = cat.synonyms || [];
    synonyms.forEach((syn: string) => {
      if (typeof syn === "string" && !dictionaryMap.has(syn.toLowerCase())) {
        dictionaryMap.set(syn.toLowerCase(), {
          label: syn,
          type: "trade",
          categoryName: catName,
        });
      }
    });

    // Add category related terms metadata to dictionary
    const related = [...(cat.related_terms || []), ...(cat.relatedTerms || [])];
    related.forEach((term: string) => {
      if (typeof term === "string" && !dictionaryMap.has(term.toLowerCase())) {
        dictionaryMap.set(term.toLowerCase(), {
          label: term,
          type: "subcategory",
          categoryName: catName,
        });
      }
    });

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
 * - Prioritizes category synonyms & related terms metadata
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
    ...(tp.categories || []),
  ].filter((f): f is string => typeof f === "string" && f.trim().length > 0);

  const allTraderFields = [...directFields, ...arrayFields];

  const rawQueryLower = rawSearchQuery.trim().toLowerCase();
  const mainSynonym = CATEGORY_SYNONYMS[rawQueryLower] || BASE_CATEGORY_SYNONYMS[rawQueryLower];

  // 1. High Priority: If full query matches a synonym (e.g. "house removal" -> "Home & Domestic Removals"), check if trader provides that category/trade/keywords
  if (mainSynonym) {
    const targetCategory = mainSynonym.categoryName;
    const targetTitle = mainSynonym.tradeTitle;
    const keywords = mainSynonym.keywords || [];

    const isMatch =
      (targetCategory && allTraderFields.some((field) => textContainsTokenMatch(field, targetCategory) || field.toLowerCase().includes(targetCategory.toLowerCase()))) ||
      (targetTitle && allTraderFields.some((field) => textContainsTokenMatch(field, targetTitle) || field.toLowerCase().includes(targetTitle.toLowerCase()))) ||
      keywords.some((kw) => arrayFields.some((field) => textContainsTokenMatch(field, kw)));

    if (isMatch) return true;
  }

  // 2. Check candidates dictionary for matching category synonyms / related terms
  const matchedCandidate = candidates.find(c => textContainsTokenMatch(c.label, rawSearchQuery) || c.label.toLowerCase() === rawQueryLower);
  if (matchedCandidate && matchedCandidate.categoryName) {
    const targetCat = matchedCandidate.categoryName.toLowerCase();
    const isTraderInCat = allTraderFields.some(f => f.toLowerCase().includes(targetCat) || targetCat.includes(f.toLowerCase()));
    if (isTraderInCat) return true;
  }

  // 3. Every token in queryTokens must find a valid front-of-word token match or synonym match
  return queryTokens.every((qTok) => {
    // Direct token match across any field on the trader profile
    const directMatch = allTraderFields.some((field) => textContainsTokenMatch(field, qTok));
    if (directMatch) return true;

    // Token synonym expansion (e.g., qTok = "joiner" -> category "Carpentry & Joinery", tradeTitle "Carpenter & Joiner")
    const tokenSynonym = CATEGORY_SYNONYMS[qTok] || BASE_CATEGORY_SYNONYMS[qTok] || (qTok === rawQueryLower ? mainSynonym : undefined);
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

/**
 * Accurately finds only the categories that match a specific trader's registered trades/specialties.
 * Prevents false-positive matches (such as showing Car Detailing or Scaffolding to a Painter/Plasterer)
 * by matching strictly on category names, trade titles, and canonical synonyms rather than scanning
 * unrelated subcategories of other industries.
 */
export function getMatchingCategoriesForTrader<T extends { name: string; id?: string | number; docId?: string; subcategories?: string[] }>(
  categories: T[],
  targetTrades: string | string[] | undefined | null
): T[] {
  if (!targetTrades || categories.length === 0) return categories;

  // Flatten and clean all trade strings (splitting on separators like bullet, slash, comma)
  const rawTrades = Array.isArray(targetTrades) ? targetTrades : [targetTrades];
  const tradesArray: string[] = [];

  rawTrades.forEach(t => {
    if (!t) return;
    const str = String(t).trim();
    if (!str) return;
    // Split bullet points or slashes if packed in a single string
    if (str.includes("•") || str.includes("|") || str.includes(",")) {
      str.split(/[•|,]+/).forEach(part => {
        const p = part.trim();
        if (p) tradesArray.push(p.toLowerCase());
      });
    } else {
      tradesArray.push(str.toLowerCase());
    }
  });

  if (tradesArray.length === 0) return categories;

  const stopWords = new Set([
    "and", "or", "the", "with", "for", "our", "your", "its", "n", "of", "to", "in", 
    "at", "by", "on", "a", "an", "private", "services", "general", "domestic", 
    "commercial", "specialist", "management", "coordination", "about"
  ]);

  // Pass 1: High-precision match against Category Name, Category ID, and Canonical Synonyms
  const directMatches = categories.filter(cat => {
    const catNameLower = cat.name.toLowerCase();
    const catIdStr = String(cat.id || cat.docId || "").toLowerCase();

    return tradesArray.some(trade => {
      // 1. Exact match on category name or ID
      if (catNameLower === trade || catIdStr === trade) return true;

      // 2. Canonical synonym resolution (e.g. "painter" -> "Painting & Decorating")
      const synonym = CATEGORY_SYNONYMS[trade] || BASE_CATEGORY_SYNONYMS[trade];
      if (synonym && synonym.categoryName.toLowerCase() === catNameLower) return true;

      // Check if trade is a known keyword of this category
      if (synonym && synonym.keywords && synonym.keywords.some(k => k.toLowerCase() === catNameLower)) {
        return true;
      }

      // 3. Category Name Token Overlap (matching strictly against cat.name, NOT unrelated subcategories)
      const tradeTokens = tokenize(trade).filter(tok => !stopWords.has(tok));
      const catTokens = tokenize(cat.name).filter(tok => !stopWords.has(tok));
      
      if (tradeTokens.length === 0 || catTokens.length === 0) return false;

      // Every significant trade token should match a category token, or vice versa
      const hasTokenMatch = tradeTokens.some(traderTok =>
        catTokens.some(catTok => tokenMatches(traderTok, catTok))
      );

      return hasTokenMatch;
    });
  });

  if (directMatches.length > 0) {
    return directMatches;
  }

  // Pass 2: Fallback only if no direct category name/synonym match was found
  const fallbackMatches = categories.filter(cat => {
    return tradesArray.some(trade => categoryMatchesSearch(cat, trade));
  });

  return fallbackMatches.length > 0 ? fallbackMatches : categories;
}


