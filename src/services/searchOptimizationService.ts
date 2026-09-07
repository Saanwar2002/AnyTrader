import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  increment, 
  serverTimestamp, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "../firebase";
import { registerDynamicSynonyms, SynonymMeta } from "../lib/fuzzyMatch";
import { classifyUnmatchedSearchTerm, SynonymClassificationResult, syncCategoryRegistryWithServer } from "./gemini";
import { categoryRegistry } from "./categoryRegistrySync";

export interface UnmatchedSearchItem {
  id: string;
  query: string;
  normalizedQuery: string;
  searchCount: number;
  lastSearchedAt?: any;
  postcodeArea?: string;
  status: "unmatched" | "synonym_added" | "trader_notified" | "ignored";
  suggestedCategory?: string;
  suggestedTrade?: string;
  source?: "search_bar" | "ai_bot";
  gapType?: "unmatched_category" | "no_traders_found";
}

export interface StoredDynamicSynonym extends SynonymMeta {
  term: string;
  status: "active" | "paused" | "rejected";
  addedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecordUnmatchedOptions {
  source?: "search_bar" | "ai_bot";
  gapType?: "unmatched_category" | "no_traders_found";
  category?: string;
  debounceMs?: number;
}

/**
 * Extracts the primary trade/service inquiry from conversational sentences in the AI bot.
 * e.g. "Do you have someone for mobile car detailing in Manchester?" -> "mobile car detailing"
 */
export function extractCleanTradeQuery(rawText: string): string {
  if (!rawText) return "";
  let text = rawText.trim().toLowerCase();

  // Strip common punctuation (e.g. ? ! . , quotes)
  text = text.replace(/[?!.,;:"'()[\]{}]/g, " ");

  // Remove common conversational AI bot intros/fillers
  const leadingFillers = [
    /^(can you|could you|please)\s+(find|recommend|suggest|give me|get me|help me find)\s+(someone for|a|an|any)?\s*/i,
    /^(do you have|is there|are there)\s+(any|anyone|someone|a|an)?\s+(who does|who can do|for)?\s*/i,
    /^(looking for|searching for|i('?m| am) looking for)\s+(someone for|a|an|any)?\s*/i,
    /^(i need|we need|i want|we want)\s+(someone to|someone for|to hire|to find|a|an)?\s*/i,
    /^(who can|who does|how can i find)\s+(do|fix|install|clean|repair|build)?\s*/i,
    /^(where can i find|help with)\s+(a|an)?\s*/i,
  ];

  for (const regex of leadingFillers) {
    text = text.replace(regex, "");
  }

  // Remove trailing location phrases e.g. "in Manchester", "near me", "in my area", "around Leeds"
  text = text.replace(/\s+(in|around|near|for|within)\s+(my area|me|the area|[a-z]{1,2}\d{1,2}\s*\d?[a-z]{0,2}|[a-z]{3,20})$/i, "");

  // Clean up extra spaces
  text = text.trim().replace(/\s+/g, " ");

  // If extraction resulted in something too short (<3 chars) or empty, fall back to the first 4 words of original text
  if (text.length < 3) {
    text = rawText.trim().toLowerCase().split(/\s+/).slice(0, 4).join(" ");
  }

  return text;
}

// In-memory runtime cache of dynamic synonyms loaded from Firestore
const activeDynamicSynonymsCache: Record<string, SynonymMeta> = {};

// Listeners for dynamic synonym updates
const updateListeners = new Set<() => void>();

export function onDynamicSynonymsUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

function notifyDynamicSynonymsUpdated() {
  updateListeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.warn("Error in dynamic synonym listener:", e);
    }
  });
}

// Session-level de-duplication cache to strictly minimize Firestore write costs
const sessionLoggedTerms = new Set<string>();

// Debounce handle for search query logging
let debounceTimeout: any = null;

/**
 * Initializes dynamic synonym synchronizer.
 * Reads existing dynamic synonyms from Firestore and registers them into fuzzyMatch.ts in memory.
 * Runs with minimal Firestore footprint (single read on boot or snapshot listener).
 */
export function initSearchOptimizationService(): () => void {
  try {
    const colRef = collection(db, "dynamic_search_synonyms");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const dynamicMap: Record<string, SynonymMeta> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as StoredDynamicSynonym;
          if (data && data.status !== "paused" && data.status !== "rejected") {
            const term = (data.term || docSnap.id).toLowerCase().trim();
            dynamicMap[term] = {
              categoryName: data.categoryName,
              tradeTitle: data.tradeTitle,
              keywords: Array.isArray(data.keywords) ? data.keywords : [],
            };
            activeDynamicSynonymsCache[term] = dynamicMap[term];
          }
        });
        registerDynamicSynonyms(dynamicMap);
        categoryRegistry.syncSynonyms(dynamicMap);
        syncCategoryRegistryWithServer(undefined, dynamicMap);
        notifyDynamicSynonymsUpdated();
      },
      (error) => {
        console.warn("[SearchOptimizationService] Snapshot error, falling back to one-off read:", error.message);
        getDocs(colRef)
          .then((snap) => {
            const dynamicMap: Record<string, SynonymMeta> = {};
            snap.forEach((docSnap) => {
              const data = docSnap.data() as StoredDynamicSynonym;
              if (data && data.status !== "paused" && data.status !== "rejected") {
                const term = (data.term || docSnap.id).toLowerCase().trim();
                dynamicMap[term] = {
                  categoryName: data.categoryName,
                  tradeTitle: data.tradeTitle,
                  keywords: Array.isArray(data.keywords) ? data.keywords : [],
                };
              }
            });
            registerDynamicSynonyms(dynamicMap);
            categoryRegistry.syncSynonyms(dynamicMap);
            syncCategoryRegistryWithServer(undefined, dynamicMap);
            notifyDynamicSynonymsUpdated();
          })
          .catch((err) => console.warn("[SearchOptimizationService] Failed to load synonyms:", err));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("[SearchOptimizationService] Initialization failed:", err);
    return () => {};
  }
}

/**
 * Cost-Optimized Unmatched Search Recorder:
 * - 0 Firestore calls if already logged in current browser session
 * - Debounced so keystroke typing doesn't spam the database
 * - Ignores short (<3 chars) or generic noise terms
 */
export function recordUnmatchedSearch(
  rawQuery: string, 
  outwardPostcode?: string,
  options?: RecordUnmatchedOptions
) {
  const clean = (rawQuery || "").trim().toLowerCase();
  
  // Guard 1: Must be at least 3 characters and not pure digits
  if (clean.length < 3 || /^\d+$/.test(clean)) return;

  // Guard 2: Filter trivial noise words
  const trivialWords = new Set(["the", "and", "for", "with", "near", "find", "need", "some", "help", "work", "job", "what", "how"]);
  if (trivialWords.has(clean)) return;

  // Slug normalization
  const slug = clean.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_").substring(0, 50);
  if (!slug) return;

  // Guard 3: Session check - if already logged in this tab session, skip completely ($0 cost)
  const sessionKey = `anytrader_unmatched_${slug}`;
  if (sessionLoggedTerms.has(slug) || sessionStorage.getItem(sessionKey)) {
    return;
  }

  const isAiBot = options?.source === "ai_bot";
  const debounceDelay = options?.debounceMs !== undefined ? options.debounceMs : (isAiBot ? 250 : 1800);

  // Clear pending debounce if user is still typing in search bar
  if (debounceTimeout && !isAiBot) {
    clearTimeout(debounceTimeout);
  }

  const executeWrite = async () => {
    try {
      // Mark in session storage immediately before network call
      sessionLoggedTerms.add(slug);
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        // Safe fallback if sessionStorage is restricted
      }

      const docRef = doc(db, "unmatched_search_telemetry", slug);
      await setDoc(
        docRef,
        {
          id: slug,
          query: clean,
          normalizedQuery: slug,
          searchCount: increment(1),
          lastSearchedAt: serverTimestamp(),
          postcodeArea: (outwardPostcode || "").trim().toUpperCase().split(" ")[0] || "",
          status: "unmatched",
          source: options?.source || "search_bar",
          gapType: options?.gapType || "unmatched_category",
          suggestedCategory: options?.category || "",
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[SearchOptimizationService] Failed to record search telemetry:", err);
    }
  };

  if (debounceDelay <= 0) {
    executeWrite();
  } else {
    debounceTimeout = setTimeout(executeWrite, debounceDelay);
  }
}

/**
 * Fetches recent unmatched search telemetry for AI profile optimization and Admin review.
 */
export async function fetchUnmatchedSearches(maxResults = 30): Promise<UnmatchedSearchItem[]> {
  try {
    const colRef = collection(db, "unmatched_search_telemetry");
    const snap = await getDocs(query(colRef, limit(maxResults)));
    const list: UnmatchedSearchItem[] = [];
    
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        query: data.query || docSnap.id,
        normalizedQuery: data.normalizedQuery || docSnap.id,
        searchCount: typeof data.searchCount === "number" ? data.searchCount : 1,
        lastSearchedAt: data.lastSearchedAt,
        postcodeArea: data.postcodeArea,
        status: data.status || "unmatched",
        suggestedCategory: data.suggestedCategory,
        suggestedTrade: data.suggestedTrade,
        source: data.source || "search_bar",
        gapType: data.gapType || "unmatched_category",
      });
    });

    // Sort descending by searchCount
    return list.sort((a, b) => b.searchCount - a.searchCount);
  } catch (err) {
    console.warn("[SearchOptimizationService] Failed to fetch unmatched searches:", err);
    return [];
  }
}

/**
 * Saves a dynamic synonym to Firestore.
 * Automatically injects it into fuzzyMatch.ts runtime memory for instant platform-wide availability without code changes.
 */
export async function saveDynamicSynonym(
  term: string, 
  meta: SynonymMeta, 
  addedBy = "admin"
): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanTerm = (term || "").trim().toLowerCase();
    if (!cleanTerm || !meta.categoryName) {
      return { success: false, message: "Missing term or categoryName" };
    }

    const slug = cleanTerm.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
    const docRef = doc(db, "dynamic_search_synonyms", slug);

    const docData: StoredDynamicSynonym = {
      term: cleanTerm,
      categoryName: meta.categoryName,
      tradeTitle: meta.tradeTitle || cleanTerm,
      keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
      status: "active",
      addedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, docData, { merge: true });

    // Instantly register in local runtime memory and category registry
    const newSynMap = {
      [cleanTerm]: {
        categoryName: meta.categoryName,
        tradeTitle: meta.tradeTitle,
        keywords: meta.keywords,
      }
    };
    registerDynamicSynonyms(newSynMap);
    categoryRegistry.syncSynonyms(newSynMap);
    syncCategoryRegistryWithServer(undefined, newSynMap);
    notifyDynamicSynonymsUpdated();

    return { success: true };
  } catch (err: any) {
    console.error("[SearchOptimizationService] Error saving dynamic synonym:", err);
    return { success: false, message: err?.message || "Failed to save synonym" };
  }
}

/**
 * Removes a dynamic synonym from Firestore.
 */
export async function deleteDynamicSynonym(term: string): Promise<{ success: boolean }> {
  try {
    const cleanTerm = (term || "").trim().toLowerCase();
    const slug = cleanTerm.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
    await deleteDoc(doc(db, "dynamic_search_synonyms", slug));
    return { success: true };
  } catch (err) {
    console.error("[SearchOptimizationService] Error deleting synonym:", err);
    return { success: false };
  }
}

/**
 * Loads all active dynamic synonyms from Firestore.
 */
export async function fetchAllDynamicSynonyms(): Promise<StoredDynamicSynonym[]> {
  try {
    const colRef = collection(db, "dynamic_search_synonyms");
    const snap = await getDocs(colRef);
    const results: StoredDynamicSynonym[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as StoredDynamicSynonym;
      results.push({
        ...data,
        term: data.term || docSnap.id,
      });
    });
    return results;
  } catch (err) {
    console.warn("[SearchOptimizationService] Error fetching dynamic synonyms:", err);
    return [];
  }
}

/**
 * Uses Gemini AI to classify an unmatched search term and suggest the best category, trade title, and keywords.
 * Dynamically injects registered categories from category registry.
 */
export async function classifySearchTermWithAi(term: string): Promise<SynonymClassificationResult> {
  const availableCategories = categoryRegistry.getAllCategoryNames();
  return classifyUnmatchedSearchTerm(term, availableCategories);
}

/**
 * 1-Click approval of an unmatched search telemetry query into a live dynamic synonym.
 * Updates Firestore and notifies local runtime without code redeployment.
 */
export async function approveTelemetryAsSynonym(
  telemetryId: string, 
  meta: SynonymMeta, 
  addedBy = "admin"
): Promise<{ success: boolean }> {
  try {
    // 1. Save dynamic synonym
    const res = await saveDynamicSynonym(telemetryId.replace(/_/g, " "), meta, addedBy);
    if (!res.success) return { success: false };

    // 2. Mark telemetry record as resolved
    const telRef = doc(db, "unmatched_search_telemetry", telemetryId);
    await setDoc(
      telRef,
      {
        status: "synonym_added",
        suggestedCategory: meta.categoryName,
        suggestedTrade: meta.tradeTitle || "",
      },
      { merge: true }
    );

    return { success: true };
  } catch (err) {
    console.error("[SearchOptimizationService] Error approving telemetry synonym:", err);
    return { success: false };
  }
}
