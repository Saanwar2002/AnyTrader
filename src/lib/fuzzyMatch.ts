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
  };

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
 * and high-fidelity synonyms, ignoring common action/problem "noise" words.
 */
export function categoryMatchesSearch(
  cat: { name: string; subcategories?: string[] },
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
    "company", "business", "building", "unit", "units", "make", "call", "free", "look", "from", "time", "rate"
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

  // A. Category Name (filter noise words like "and", "services", etc.)
  tokenize(cat.name).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));

  // B. Subcategories (filter noise words)
  if (cat.subcategories && Array.isArray(cat.subcategories)) {
    cat.subcategories.forEach((sub) => {
      tokenize(sub).filter(tok => !noiseWords.has(tok.toLowerCase())).forEach(tok => targetTokensSet.add(tok.toLowerCase()));
    });
  }

  // C. Synonyms mapping to this category name
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

  const targetTokens = Array.from(targetTokensSet);

  // Check if AT LEAST ONE significant query token matches a target token
  return queryTokens.some((qTok) =>
    targetTokens.some((tTok) => tokenMatches(qTok, tTok))
  );
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
  "mechanic": { categoryName: "Auto & Vehicle Repairs", tradeTitle: "Mechanic", keywords: ["car", "mot", "service", "brakes", "clutch", "engine"] },
  "car repair": { categoryName: "Auto & Vehicle Repairs", tradeTitle: "Auto Technician", keywords: ["mechanic", "garage", "diagnostics"] },

  // Locksmith & Security
  "locksmith": { categoryName: "Locksmith & Security", tradeTitle: "Locksmith", keywords: ["lock", "key", "unlock", "door", "intercom", "cctv"] },

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
  "curtain alterations": { categoryName: "Tailoring, Alterations & Laundry Services", tradeTitle: "Curtain & Soft Furnishing Specialist", keywords: ["curtains", "drapes", "blinds", "hemming", "cushions", "sewing", "alterations"] }
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

  // 1. If full query matches a synonym (e.g. "house removal" -> "Home & Domestic Removals"), check if trader provides that category/trade/keywords
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

  // 2. Every token in queryTokens must find a valid front-of-word token match
  return queryTokens.every((qTok) => {
    // Direct token match across any field on the trader profile
    const directMatch = allTraderFields.some((field) => textContainsTokenMatch(field, qTok));
    if (directMatch) return true;

    // Token synonym expansion (e.g., qTok = "joiner" -> category "Carpentry & Joinery", tradeTitle "Carpenter & Joiner")
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


