import { UNSORTED_TRADE_CATEGORIES } from "@/src/constants";
import { getCategoryMetadata } from "@/src/lib/fuzzyMatch";

export interface CategoryRegistryItem {
  id: string | number;
  name: string;
  icon?: string;
  subcategories?: string[];
  requiredCertifications?: string[];
  subcategoryCertifications?: Record<string, string[] | string>;
  synonyms?: string[];
  related_terms?: string[];
  relatedTerms?: string[];
  description?: string;
}

export interface DynamicSynonymRegistryItem {
  term: string;
  categoryName: string;
  tradeTitle?: string;
  keywords?: string[];
}

/**
 * In-memory synchronized category and synonym registry
 */
class CategoryRegistryManager {
  private categoriesMap: Map<string, CategoryRegistryItem> = new Map();
  private synonymsMap: Map<string, DynamicSynonymRegistryItem> = new Map();
  private lastSyncedAt: number = 0;

  constructor() {
    this.initializeBaseline();
  }

  /**
   * Initializes registry with baseline constants to guarantee zero cold-start delay
   */
  public initializeBaseline() {
    UNSORTED_TRADE_CATEGORIES.forEach((cat: any) => {
      const meta = getCategoryMetadata(cat.name);
      const syns = Array.from(new Set([...(cat.synonyms || []), ...meta.synonyms]));
      const rels = Array.from(new Set([...(cat.related_terms || []), ...(cat.relatedTerms || []), ...meta.related_terms]));
      
      this.categoriesMap.set(cat.name.toLowerCase().trim(), {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        subcategories: cat.subcategories || [],
        requiredCertifications: cat.requiredCertifications || [],
        subcategoryCertifications: cat.subcategoryCertifications || {},
        synonyms: syns,
        related_terms: rels,
        relatedTerms: rels,
        description: cat.description,
      });
    });
    this.lastSyncedAt = Date.now();
  }

  /**
   * Syncs active categories from Firebase Firestore (`platform_categories`)
   */
  public syncCategories(categories: any[]) {
    if (!Array.isArray(categories) || categories.length === 0) return;

    categories.forEach((cat) => {
      if (!cat || !cat.name) return;
      const key = cat.name.toLowerCase().trim();
      const existing: Partial<CategoryRegistryItem> = this.categoriesMap.get(key) || {};
      const meta = getCategoryMetadata(cat.name);

      const mergedSynonyms = Array.from(new Set([
        ...(existing.synonyms || []),
        ...(cat.synonyms || []),
        ...meta.synonyms
      ]));

      const mergedRelated = Array.from(new Set([
        ...(existing.related_terms || []),
        ...(existing.relatedTerms || []),
        ...(cat.related_terms || []),
        ...(cat.relatedTerms || []),
        ...meta.related_terms
      ]));

      this.categoriesMap.set(key, {
        id: cat.id || existing.id || `cat-${Date.now()}`,
        name: cat.name,
        icon: cat.icon || existing.icon || "🛠️",
        subcategories: Array.from(new Set([...(existing.subcategories || []), ...(cat.subcategories || [])])),
        requiredCertifications: Array.from(new Set([...(existing.requiredCertifications || []), ...(cat.requiredCertifications || [])])),
        subcategoryCertifications: { ...(existing.subcategoryCertifications || {}), ...(cat.subcategoryCertifications || {}) },
        synonyms: mergedSynonyms,
        related_terms: mergedRelated,
        relatedTerms: mergedRelated,
        description: cat.description || existing.description,
      });
    });

    this.lastSyncedAt = Date.now();
  }

  /**
   * Syncs active synonyms from Firebase Firestore (`dynamic_search_synonyms`)
   * Accepts either an array of synonym objects or a key-value map
   */
  public syncSynonyms(synonyms: any[] | Record<string, any>) {
    if (!synonyms) return;

    const sanitizeField = (str: string, maxLen = 80): string => {
      if (typeof str !== "string") return "";
      // Strip control characters, backticks, brackets, and line breaks to prevent AI prompt injection
      return str.replace(/[\x00-\x1F\x7F`$<>{}[\\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
    };

    if (Array.isArray(synonyms)) {
      synonyms.forEach((syn) => {
        if (!syn || !syn.term || !syn.categoryName) return;
        const cleanTerm = sanitizeField(syn.term, 80);
        const cleanCategory = sanitizeField(syn.categoryName, 100);
        if (!cleanTerm || !cleanCategory) return;

        const key = cleanTerm.toLowerCase();
        this.synonymsMap.set(key, {
          term: cleanTerm,
          categoryName: cleanCategory,
          tradeTitle: syn.tradeTitle ? sanitizeField(syn.tradeTitle, 100) : undefined,
          keywords: Array.isArray(syn.keywords)
            ? syn.keywords
                .filter((k: any) => typeof k === "string")
                .map((k: string) => sanitizeField(k, 50))
                .filter((k: string) => k.length > 0)
                .slice(0, 20)
            : [],
        });
      });
    } else if (typeof synonyms === "object") {
      Object.entries(synonyms).forEach(([term, meta]) => {
        if (!term || !meta || !meta.categoryName) return;
        const cleanTerm = sanitizeField(term, 80);
        const cleanCategory = sanitizeField(meta.categoryName, 100);
        if (!cleanTerm || !cleanCategory) return;

        const key = cleanTerm.toLowerCase();
        this.synonymsMap.set(key, {
          term: cleanTerm,
          categoryName: cleanCategory,
          tradeTitle: meta.tradeTitle ? sanitizeField(meta.tradeTitle, 100) : undefined,
          keywords: Array.isArray(meta.keywords)
            ? meta.keywords
                .filter((k: any) => typeof k === "string")
                .map((k: string) => sanitizeField(k, 50))
                .filter((k: string) => k.length > 0)
                .slice(0, 20)
            : [],
        });
      });
    }

    this.lastSyncedAt = Date.now();
  }

  public getAllCategories(): CategoryRegistryItem[] {
    return Array.from(this.categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public getAllCategoryNames(): string[] {
    return this.getAllCategories().map((c) => c.name);
  }

  public getCategoryByName(name: string): CategoryRegistryItem | undefined {
    if (!name) return undefined;
    return this.categoriesMap.get(name.toLowerCase().trim());
  }

  public getLastSyncTime(): number {
    return this.lastSyncedAt;
  }

  /**
   * Generates a compact, high-density prompt injection block for Gemini.
   * Formatted to optimize token efficiency while giving Gemini full awareness of all 96+ sectors and their synonyms/related terms.
   */
  public generateGeminiCategoryPromptBlock(limitCount?: number): string {
    const categories = this.getAllCategories();
    const targetCats = limitCount ? categories.slice(0, limitCount) : categories;

    const formattedLines = targetCats.map((c) => {
      const subs = (c.subcategories || []).slice(0, 5).join(", ");
      const syns = (c.synonyms || []).slice(0, 4).join(", ");
      const rels = (c.related_terms || c.relatedTerms || []).slice(0, 4).join(", ");
      const certs = (c.requiredCertifications || []).join(", ");
      let line = `- "${c.name}" (${c.icon || "🛠️"})`;
      if (subs) line += `: Subcategories [${subs}]`;
      if (syns) line += ` | Synonyms: [${syns}]`;
      if (rels) line += ` | Related: [${rels}]`;
      if (certs) line += ` | Key Certs: [${certs}]`;
      return line;
    });

    return `ACTIVE REGISTERED ANYTRADER CATEGORIES (${categories.length} Total Sectors):
${formattedLines.join("\n")}`;
  }

  /**
   * Resolves raw text or AI returned category into an exact canonical category name
   */
  public resolveCanonicalCategory(rawQuery: string, fallback?: string): string {
    if (!rawQuery || !rawQuery.trim()) return fallback || "Handyman Services";
    const clean = rawQuery.trim().toLowerCase();

    // 1. Direct match on category name
    const exact = this.categoriesMap.get(clean);
    if (exact) return exact.name;

    // 2. Direct match on dynamic synonyms
    const syn = this.synonymsMap.get(clean);
    if (syn && this.categoriesMap.has(syn.categoryName.toLowerCase().trim())) {
      return this.categoriesMap.get(syn.categoryName.toLowerCase().trim())!.name;
    }

    // 3. Category metadata synonyms match
    for (const cat of this.categoriesMap.values()) {
      if (cat.synonyms && cat.synonyms.some((s) => s.toLowerCase() === clean || clean === s.toLowerCase())) {
        return cat.name;
      }
    }

    // 4. Subcategory match
    for (const cat of this.categoriesMap.values()) {
      if (cat.subcategories && cat.subcategories.some((s) => s.toLowerCase() === clean || clean.includes(s.toLowerCase()))) {
        return cat.name;
      }
    }

    // 5. Related terms match
    for (const cat of this.categoriesMap.values()) {
      const rels = cat.related_terms || cat.relatedTerms || [];
      if (rels.some((r) => r.toLowerCase() === clean || clean.includes(r.toLowerCase()))) {
        return cat.name;
      }
    }

    // 6. Substring partial match on category name
    for (const [key, cat] of this.categoriesMap.entries()) {
      if (clean.includes(key) || key.includes(clean)) {
        return cat.name;
      }
    }

    return fallback || rawQuery.trim();
  }
}

export const categoryRegistry = new CategoryRegistryManager();

