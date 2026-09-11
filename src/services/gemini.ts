import { auth } from "../firebase";
import { getApiUrl } from "../lib/apiUrl";

// Clean HTTP proxy to make authorized server-side Gemini calls
async function callServerGemini(functionName: string, args: any[]): Promise<any> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const targetUrl = getApiUrl("/api/gemini/call");
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ functionName, args }),
    });
    
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      let errorMsg = `Failed to execute secure server-side AI function (Status ${response.status})`;
      if (contentType.includes("application/json")) {
        const errData = await response.json().catch(() => ({}));
        if (errData && errData.error) errorMsg = errData.error;
      }
      throw new Error(errorMsg);
    }
    
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      console.warn(`[AI Proxy] Non-JSON response received for ${functionName}:`, text.substring(0, 100));
      throw new Error(`Server returned non-JSON response for ${functionName}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`AI Proxy Secure Execution Error [${functionName}]:`, error?.message || error);
    throw error;
  }
}

// Re-export all necessary TypeScript interfaces to maintain 100% compatibility with components
export interface PlatformHealthInsights {
  healthScore: number;
  summary: string;
  performanceData: {
    metric: string;
    value: string;
    trend: "up" | "down" | "neutral";
    status: "good" | "warning" | "critical";
  }[];
  improvements: string[];
}

export interface AIEstimate {
  isAvailable?: boolean;
  unavailableReason?: string;
  min: number;
  max: number;
  confidence: number;
  confidenceRating?: "High Confidence" | "Medium Confidence" | "Low Confidence";
  confidenceFactors?: string[];
  historicalJobCount?: number;
  postcodeArea?: string;
  historicalAvgPrice?: number;
  historicalMinPrice?: number;
  historicalMaxPrice?: number;
  postcodeBenchmark?: string;
  breakdown: {
    materials: string;
    labour: string;
    duration: string;
  };
  reasoning: string;
  pricingInsights?: {
    seasonalImpact: string;
    regionalPremium: string;
    costSavingTips: string[];
    marketTrend: "rising" | "stable" | "falling";
  };
}

export interface RiskAlert {
  targetId: string;
  targetName: string;
  type: 'user' | 'job';
  riskScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  reason: string;
  recommendedAction: string;
}

export interface QuoteAnalysis {
  label: "Budget Friendly" | "Good Value" | "Average" | "Premium";
  percentile: number;
  winningFactor: string;
  fairnessCheck: string;
}

export interface RejectionFeedback {
  reason: string;
  improvementTip: string;
}

export interface DocumentAnalysisResult {
  isValid: boolean;
  confidence: number;
  extractedData: Record<string, string>;
  flags: string[];
  reasoning: string;
}

export interface CategorySuggestion {
  category: string;
  reason: string;
  demandScore: number;
  trend: "rising" | "stable" | "falling";
  scope: string;
  source: "google_trends" | "internal_search" | "combined";
  topKeywords: string[];
}

export interface MonetizationOpportunity {
  id: string;
  type: "fast_pass" | "premium_lead" | "subscription_upgrade" | "featured_profile";
  title: string;
  description: string;
  potentialMonthlyValueGBP: number;
  unlockedFeatures: string[];
  conversionTips: string[];
}

export interface AiModelRecommendation {
  id: string;
  name: string;
  capabilities: string;
  costEstimate: string;
  reason: string;
  isRecommended: boolean;
}

// Proxy delegates for all 32+ original Gemini operations
export async function getPlatformHealthInsights(
  usersCount: number,
  jobsCount: number,
  disputesCount: number,
  recentLogs: any[]
): Promise<PlatformHealthInsights> {
  return callServerGemini("getPlatformHealthInsights", [usersCount, jobsCount, disputesCount, recentLogs]);
}

export async function getJobEstimate(
  category: string,
  description: string,
  postcode: string,
  urgency: string
): Promise<AIEstimate> {
  return callServerGemini("getJobEstimate", [category, description, postcode, urgency]);
}

export async function generateBroadcastDraft(
  topic: string,
  type: string,
  audience: string
): Promise<string> {
  return callServerGemini("generateBroadcastDraft", [topic, type, audience]);
}

export async function generateQuoteDraft(
  jobTitle: string,
  jobDescription: string,
  tradespersonName: string,
  amount: string,
  scope: string
): Promise<string> {
  return callServerGemini("generateQuoteDraft", [jobTitle, jobDescription, tradespersonName, amount, scope]);
}

export async function summarizeDisputeChat(
  chatMessages: any[],
  disputeReason: string
): Promise<{ summary: string; timeline: string[]; faultAnalysis: string }> {
  return callServerGemini("summarizeDisputeChat", [chatMessages, disputeReason]);
}

export async function getReviewSummary(reviews: any[]): Promise<string> {
  return callServerGemini("getReviewSummary", [reviews]);
}

export async function analyzeFraudRisk(
  usersData: any[],
  jobsData: any[],
  recentLogs: any[]
): Promise<RiskAlert[]> {
  return callServerGemini("analyzeFraudRisk", [usersData, jobsData, recentLogs]);
}

export async function analyzeJobPhoto(imageUrls: string[]): Promise<{ category: string; urgency: string; reasoning: string }> {
  return callServerGemini("analyzeJobPhoto", [imageUrls]);
}

export async function getClarifyingQuestions(
  category: string,
  title: string,
  description: string
): Promise<string[]> {
  return callServerGemini("getClarifyingQuestions", [category, title, description]);
}

export async function getMaterialList(
  category: string,
  title: string,
  description: string
): Promise<string[]> {
  return callServerGemini("getMaterialList", [category, title, description]);
}

export async function analyzeSecurityThreat(
  text: string,
  targetId: string,
  targetType: 'message' | 'job' | 'user'
): Promise<{
  isThreat: boolean;
  threatType: 'phishing' | 'hacking' | 'pii' | 'other' | null;
  riskScore: number;
  details: string;
}> {
  return callServerGemini("analyzeSecurityThreat", [text, targetId, targetType]);
}

export async function improveJobDescription(
  category: string,
  title: string,
  description: string
): Promise<string> {
  return callServerGemini("improveJobDescription", [category, title, description]);
}

export async function parseNaturalLanguageSearch(query: string): Promise<{
  categories: string[];
  urgency: string | null;
  keywords: string[];
}> {
  return callServerGemini("parseNaturalLanguageSearch", [query]);
}

export async function checkSafetyAndPII(text: string): Promise<{
  isSafe: boolean;
  hasPII: boolean;
  redactedText: string;
  issues: string[];
}> {
  return callServerGemini("checkSafetyAndPII", [text]);
}

export async function getDisputeResolution(
  jobTitle: string,
  jobDescription: string,
  disputeReason: string,
  quoteAmount: string
): Promise<{
  summary: string;
  suggestion: string;
  fairPrice?: string;
}> {
  return callServerGemini("getDisputeResolution", [jobTitle, jobDescription, disputeReason, quoteAmount]);
}

export async function getRecommendedJobs(
  tradespersonProfile: any,
  availableJobs: any[],
  activeJobs: any[] = [],
  availability: any = null
): Promise<{ id: string; reason: string }[]> {
  return callServerGemini("getRecommendedJobs", [tradespersonProfile, availableJobs, activeJobs, availability]);
}

export async function getMaintenancePredictions(
  jobHistory: any[]
): Promise<any[]> {
  return callServerGemini("getMaintenancePredictions", [jobHistory]);
}

export async function generateMarketingPost(
  jobTitle: string,
  jobDescription: string,
  category: string,
  tradespersonName: string,
  platformName: string = "AnyTrader"
): Promise<string> {
  return callServerGemini("generateMarketingPost", [jobTitle, jobDescription, category, tradespersonName, platformName]);
}

export async function analyzeQuote(
  jobTitle: string,
  jobDescription: string,
  quoteAmount: number,
  quoteMessage: string,
  estimateMin: number,
  estimateMax: number
): Promise<QuoteAnalysis> {
  return callServerGemini("analyzeQuote", [jobTitle, jobDescription, quoteAmount, quoteMessage, estimateMin, estimateMax]);
}

export async function getRejectionFeedback(
  job: any,
  rejectedQuote: any,
  acceptedQuote: any
): Promise<RejectionFeedback> {
  return callServerGemini("getRejectionFeedback", [job, rejectedQuote, acceptedQuote]);
}

export async function analyzeDocument(
  imageUrl: string,
  documentType: string,
  userName: string
): Promise<DocumentAnalysisResult> {
  return callServerGemini("analyzeDocument", [imageUrl, documentType, userName]);
}

export async function suggestNewCategories(
  existingCategories: string[],
  internalSearchLogs: any[] = []
): Promise<CategorySuggestion[]> {
  return callServerGemini("suggestNewCategories", [existingCategories, internalSearchLogs]);
}

export async function getMonetizationOpportunities(
  userId: string,
  userStats: any
): Promise<MonetizationOpportunity[]> {
  return callServerGemini("getMonetizationOpportunities", [userId, userStats]);
}

export async function transcribeVoiceAudio(audioData: string, mimeType: string): Promise<any> {
  return callServerGemini("transcribeVoiceAudio", [audioData, mimeType]);
}

export async function processVoiceAudio(audioData: string, mimeType: string, categories: string[]): Promise<any> {
  return callServerGemini("processVoiceAudio", [audioData, mimeType, categories]);
}

export async function processVoiceTranscript(transcript: string, categories: string[]): Promise<any> {
  return callServerGemini("processVoiceTranscript", [transcript, categories]);
}

export async function getEquipmentRecommendations(
  jobDescription: string,
  categories: string[]
): Promise<any[]> {
  return callServerGemini("getEquipmentRecommendations", [jobDescription, categories]);
}

export async function getShopRecommendations(role: string, category: string): Promise<any[]> {
  return callServerGemini("getShopRecommendations", [role, category]);
}

export interface BuildingRegsPricingGrounding {
  category: string;
  buildingRegsSummary: string;
  regulationsApplicable: string[];
  gasSafeOrSpecialistNotice?: string;
  supplierMaterialEstimate: {
    min: number;
    max: number;
    summary: string;
    itemizedSupplies: { name: string; approxPrice: string; supplier: string }[];
  };
  sources: { title: string; url: string }[];
}

export async function getBuildingRegsAndSupplierPricing(
  category: string,
  description: string,
  postcode?: string
): Promise<BuildingRegsPricingGrounding> {
  return callServerGemini("getBuildingRegsAndSupplierPricing", [category, description, postcode]);
}

export interface TradeBotUserContext {
  role?: string;
  postcode?: string;
  propertySummary?: string;
  availableCategories?: string[];
  categoryRegistryData?: any[];
  dynamicSynonyms?: any[];
}

export async function callTradeBot(
  userMessage: string, 
  history: {role: "user" | "model", text: string}[],
  userContext?: TradeBotUserContext
): Promise<any> {
  return callServerGemini("callTradeBot", [userMessage, history, userContext]);
}

export interface TradeBotStreamCallbacks {
  onChunk?: (textChunk: string, accumulatedText: string) => void;
  onSources?: (sources: { title: string; url: string }[]) => void;
  onCategories?: (categories: string[]) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: any) => void;
}

export async function callTradeBotStream(
  userMessage: string,
  history: { role: "user" | "model"; text: string }[],
  userContext?: TradeBotUserContext,
  callbacks?: TradeBotStreamCallbacks
): Promise<{ text: string; sources: { title: string; url: string }[]; categories?: string[] }> {
  const targetUrl = getApiUrl("/api/gemini/stream");
  const user = auth.currentUser;
  const token = user ? await user.getIdToken().catch(() => null) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let accumulatedText = "";
  let sources: { title: string; url: string }[] = [];
  let categories: string[] = [];

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task: "callTradeBotStream",
        args: [userMessage, history, userContext]
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming request failed with status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.replace(/^data:\s*/, "");
        if (dataStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === "chunk" && parsed.text) {
            accumulatedText += parsed.text;
            callbacks?.onChunk?.(parsed.text, accumulatedText);
          } else if (parsed.type === "sources" && Array.isArray(parsed.sources)) {
            sources = parsed.sources;
            callbacks?.onSources?.(sources);
          } else if (parsed.type === "categories" && Array.isArray(parsed.categories)) {
            categories = parsed.categories;
            callbacks?.onCategories?.(categories);
          } else if (parsed.type === "error") {
            throw new Error(parsed.error || "Streaming error occurred");
          }
        } catch (e: any) {
          if (e.message && !e.message.includes("JSON")) {
            console.warn("SSE event parsing warning:", e);
          }
        }
      }
    }

    callbacks?.onDone?.(accumulatedText);
    return { text: accumulatedText, sources, categories };
  } catch (error: any) {
    console.warn("SSE Stream failed, falling back to unary call:", error);
    callbacks?.onError?.(error);
    const fallback = await callTradeBot(userMessage, history, userContext);
    const fallbackText = typeof fallback === "object" ? fallback.text : fallback;
    const fallbackSources = typeof fallback === "object" && Array.isArray(fallback.sources) ? fallback.sources : [];
    const fallbackCategories = typeof fallback === "object" && Array.isArray(fallback.categories) ? fallback.categories : [];
    callbacks?.onChunk?.(fallbackText, fallbackText);
    callbacks?.onSources?.(fallbackSources);
    if (fallbackCategories.length > 0) {
      callbacks?.onCategories?.(fallbackCategories);
    }
    callbacks?.onDone?.(fallbackText);
    return { text: fallbackText, sources: fallbackSources, categories: fallbackCategories };
  }
}

export async function streamDiagnostic(
  prompt: string,
  systemInstruction?: string,
  callbacks?: {
    onChunk?: (textChunk: string, accumulatedText: string) => void;
    onDone?: (fullText: string) => void;
    onError?: (error: any) => void;
  }
): Promise<string> {
  const targetUrl = getApiUrl("/api/gemini/stream");
  const user = auth.currentUser;
  const token = user ? await user.getIdToken().catch(() => null) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let accumulatedText = "";

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task: "streamDiagnostic",
        args: [prompt, systemInstruction]
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming failed: HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.replace(/^data:\s*/, "");
        if (dataStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === "chunk" && parsed.text) {
            accumulatedText += parsed.text;
            callbacks?.onChunk?.(parsed.text, accumulatedText);
          } else if (parsed.type === "error") {
            throw new Error(parsed.error || "Streaming error");
          }
        } catch (e) {
          // ignore incomplete lines
        }
      }
    }

    callbacks?.onDone?.(accumulatedText);
    return accumulatedText;
  } catch (error: any) {
    callbacks?.onError?.(error);
    throw error;
  }
}

export async function processTaxiVoiceCommand(text: string, locationContext: string = ""): Promise<any> {
  return callServerGemini("processTaxiVoiceCommand", [text, locationContext]);
}

export async function getAiModelRecommendations(): Promise<AiModelRecommendation[]> {
  return callServerGemini("getAiModelRecommendations", []);
}

export async function getDynamicInstantMatchPricing(
  category: string,
  title: string,
  description: string
): Promise<{ price: number; title: string; desc: string; bullets: { text: string }[] }> {
  try {
    return await callServerGemini("getDynamicInstantMatchPricing", [category, title, description]);
  } catch (err) {
    console.warn("getDynamicInstantMatchPricing fallback used:", err);
    return {
      price: 2.99,
      title: "Instant Match",
      desc: "Get peace of mind instantly! Our Instant Match directly secures a top-rated, fully vetted professional for your job.",
      bullets: [
        { text: "Instant SMS & Push Alert to verified local pros" },
        { text: "Priority placement on active job feed" },
        { text: "100% money-back guarantee if unmatched" }
      ]
    };
  }
}

// Newly introduced helpers
export interface NearbyTradeInsights {
  summary: string;
  popularCategories: { category: string; count: number; urgencyLevel: string }[];
  urgentAlert: string | null;
  insightTip: string;
}

export async function getNearbyTradeInsights(
  locationName: string,
  jobsSummary: Array<{ category: string; title: string; urgency: string; distanceMiles?: number }>
): Promise<NearbyTradeInsights> {
  try {
    return await callServerGemini("getNearbyTradeInsights", [locationName, jobsSummary]);
  } catch (error: any) {
    console.warn("Falling back to local calculation for getNearbyTradeInsights:", error?.message || error);
    
    const categoryCounts: Record<string, { count: number; hasUrgent: boolean }> = {};
    let urgentCount = 0;

    (jobsSummary || []).forEach(j => {
      const cat = j.category || "General Maintenance";
      if (!categoryCounts[cat]) categoryCounts[cat] = { count: 0, hasUrgent: false };
      categoryCounts[cat].count += 1;
      if (j.urgency === "emergency" || j.urgency === "same-day" || j.urgency === "within-24h") {
        categoryCounts[cat].hasUrgent = true;
        urgentCount += 1;
      }
    });

    const sortedCats = Object.entries(categoryCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([category, info]) => ({
        category,
        count: info.count,
        urgencyLevel: info.hasUrgent ? "High" : "Normal"
      }));

    return {
      summary: `Active trade demand detected in ${locationName || "your immediate area"} with ${jobsSummary?.length || 0} nearby requests available.`,
      popularCategories: sortedCats.length > 0 ? sortedCats : [{ category: "General Maintenance", count: jobsSummary?.length || 1, urgencyLevel: "Normal" }],
      urgentAlert: urgentCount > 0 ? `⚡ ${urgentCount} urgent trade ${urgentCount === 1 ? 'request requires' : 'requests require'} immediate response near ${locationName}` : null,
      insightTip: "Jobs posted within 5 miles receive quotes 40% faster on AnyTrader."
    };
  }
}

export async function polishBio(bio: string, trades: string, tags: string): Promise<string> {
  return callServerGemini("polishBio", [bio, trades, tags]);
}

export async function getProMatches(role: any, candidatesContext: any[]): Promise<any[]> {
  return callServerGemini("getProMatches", [role, candidatesContext]);
}

export interface DeepScanForensicsResult {
  scanId: string;
  scannedAt: string;
  overallThreatLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  riskScore: number;
  executiveSummary: string;
  flashDealAnomalies: Array<{
    anomalyType: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    confidenceScore: number;
    recommendedAction: string;
    targetEntityId?: string;
    targetEntityName?: string;
  }>;
  aiAgentAnomalies: Array<{
    anomalyType: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    confidenceScore: number;
    recommendedAction: string;
    targetAgent?: string;
  }>;
  accountCollusionFlags: Array<{
    flagType: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    involvedAccounts: string[];
    recommendedMitigation: string;
  }>;
  platformIntegrityScore: number;
  recommendedImmediateActions: string[];
}

export async function runPlatformMisuseDeepScan(telemetrySummary: any): Promise<DeepScanForensicsResult> {
  return callServerGemini("runServerPlatformMisuseDeepScan", [telemetrySummary]);
}

export interface AiCacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatePercent: number;
  estimatedTokensSaved: number;
  avgHitLatencyMs: number;
  totalEntries: number;
  topIntents: { intent: string; hits: number; sample: string; category: string }[];
}

export async function getAiCacheStats(): Promise<AiCacheStats> {
  const targetUrl = getApiUrl("/api/gemini/cache-stats");
  const res = await fetch(targetUrl);
  if (!res.ok) throw new Error("Failed to fetch AI cache stats");
  return res.json().catch(() => ({
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRatePercent: 0,
    estimatedTokensSaved: 0,
    avgHitLatencyMs: 0,
    totalEntries: 0,
    topIntents: []
  }));
}

export async function clearAiCache(): Promise<{ success: boolean; message: string }> {
  const targetUrl = getApiUrl("/api/gemini/cache-clear");
  const res = await fetch(targetUrl, { method: "POST" });
  if (!res.ok) throw new Error("Failed to clear AI cache");
  return res.json().catch(() => ({ success: true, message: "Cache cleared" }));
}

export interface SynonymClassificationResult {
  categoryName: string;
  tradeTitle: string;
  keywords: string[];
  confidence: number;
  reasoning: string;
}

export async function classifyUnmatchedSearchTerm(term: string, availableCategories?: any[]): Promise<SynonymClassificationResult> {
  return callServerGemini("classifyUnmatchedSearchTermServer", [term, availableCategories]);
}

/**
 * Explicitly sends the dynamic category and synonym registry from client to server
 */
export async function syncCategoryRegistryWithServer(categories?: any[], synonyms?: any[] | Record<string, any>): Promise<{ success: boolean; totalCategories: number; lastSyncedAt: number }> {
  try {
    const targetUrl = getApiUrl("/api/gemini/sync-categories");
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories, synonyms })
    });
    if (!res.ok) {
      console.warn("Category registry server sync notice: endpoint returned", res.status);
      return { success: false, totalCategories: 0, lastSyncedAt: Date.now() };
    }
    return await res.json();
  } catch (err) {
    console.warn("Could not sync category registry with server:", err);
    return { success: false, totalCategories: 0, lastSyncedAt: Date.now() };
  }
}

/**
 * Executes an autonomous AI Agent ecosystem task securely on the server
 */
export async function runServerAutonomousAgentTask(taskType: string, payload: any): Promise<any> {
  return callServerGemini("runServerAutonomousAgentTask", [taskType, payload]);
}



