import { auth } from "../firebase";

// Clean HTTP proxy to make authorized server-side Gemini calls
async function callServerGemini(functionName: string, args: any[]): Promise<any> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const response = await fetch("/api/gemini/call", {
      method: "POST",
      headers,
      body: JSON.stringify({ functionName, args }),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to execute secure server-side AI function");
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`AI Proxy Secure Execution Error [${functionName}]:`, error);
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

export async function callTradeBot(userMessage: string, history: {role: "user" | "model", text: string}[]): Promise<any> {
  return callServerGemini("callTradeBot", [userMessage, history]);
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
  return callServerGemini("getDynamicInstantMatchPricing", [category, title, description]);
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
  return callServerGemini("getNearbyTradeInsights", [locationName, jobsSummary]);
}

export async function polishBio(bio: string, trades: string, tags: string): Promise<string> {
  return callServerGemini("polishBio", [bio, trades, tags]);
}

export async function getProMatches(role: any, candidatesContext: any[]): Promise<any[]> {
  return callServerGemini("getProMatches", [role, candidatesContext]);
}
