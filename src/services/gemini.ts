import { GoogleGenAI, Type } from "@google/genai";

// Helper to call the server-side AI proxy
async function callAiProxy(prompt: string, model: string = "gemini-1.5-flash", config?: any) {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, config })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "AI Proxy request failed");
  }

  return await response.json();
}

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

export async function getPlatformHealthInsights(
  usersCount: number,
  jobsCount: number,
  disputesCount: number,
  recentLogs: any[]
): Promise<PlatformHealthInsights> {
  const prompt = `
    As an expert platform operations AI, analyze the following platform data and provide health, performance insights, and suggested improvements.
    
    Data:
    - Total Users: ${usersCount}
    - Total Jobs: ${jobsCount}
    - Active Disputes: ${disputesCount}
    - Recent Activity Logs: ${JSON.stringify(recentLogs.slice(0, 20))}
    
    Return a JSON object with:
    {
      "healthScore": number (0-100),
      "summary": "string (brief overview of platform health)",
      "performanceData": [
        {
          "metric": "string (e.g., User Growth, Dispute Rate)",
          "value": "string (e.g., 5%, 2/100)",
          "trend": "up" | "down" | "neutral",
          "status": "good" | "warning" | "critical"
        }
      ],
      "improvements": ["string (actionable suggestions)"]
    }
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          healthScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          performanceData: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                metric: { type: Type.STRING },
                value: { type: Type.STRING },
                trend: { type: Type.STRING, enum: ["up", "down", "neutral"] },
                status: { type: Type.STRING, enum: ["good", "warning", "critical"] }
              },
              required: ["metric", "value", "trend", "status"]
            }
          },
          improvements: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["healthScore", "summary", "performanceData", "improvements"]
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Platform Health Error:", error);
    return {
      healthScore: 85,
      summary: "Platform is operating normally, but AI analysis is currently unavailable.",
      performanceData: [
        { metric: "System Status", value: "Online", trend: "neutral", status: "good" }
      ],
      improvements: ["Check AI service connection."]
    };
  }
}

export interface AIEstimate {
  isAvailable?: boolean;
  unavailableReason?: string;
  min: number;
  max: number;
  confidence: number;
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

export async function getJobEstimate(
  category: string,
  description: string,
  postcode: string,
  urgency: string
): Promise<AIEstimate> {
  const prompt = `
    As an expert UK construction estimator, provide a realistic price range for this job:
    Category: ${category}
    Description: ${description}
    Postcode: ${postcode}
    Urgency: ${urgency}

    Consider UK market rates, material costs, and regional variations.
    
    CRITICAL INSTRUCTION: If the job is complex, lacks sufficient detail, or requires a site visit to provide a meaningful estimate (e.g., building an extension, full rewire, complex landscaping, building a garden wall), set "isAvailable" to false and provide an "unavailableReason" explaining why a trader needs to assess it first. For straightforward jobs (e.g., fixing a leaky tap, jet washing a patio), set "isAvailable" to true.

    Return a JSON object with:
    {
      "isAvailable": boolean (true if estimate is possible, false if it requires a site visit/more info),
      "unavailableReason": "string (if isAvailable is false, explain why. else empty string)",
      "min": number (minimum total cost in GBP, use 0 if not available),
      "max": number (maximum total cost in GBP, use 0 if not available),
      "confidence": number (0-1),
      "breakdown": {
        "materials": "string description of material costs",
        "labour": "string description of labour costs",
        "duration": "estimated time to complete"
      },
      "reasoning": "brief explanation of the estimate",
      "pricingInsights": {
        "seasonalImpact": "string (how current season affects price/availability)",
        "regionalPremium": "string (how the postcode area affects the price)",
        "costSavingTips": ["string"],
        "marketTrend": "rising" | "stable" | "falling"
      }
    }
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isAvailable: { type: Type.BOOLEAN },
          unavailableReason: { type: Type.STRING },
          min: { type: Type.NUMBER },
          max: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          breakdown: {
            type: Type.OBJECT,
            properties: {
              materials: { type: Type.STRING },
              labour: { type: Type.STRING },
              duration: { type: Type.STRING }
            },
            required: ["materials", "labour", "duration"]
          },
          reasoning: { type: Type.STRING },
          pricingInsights: {
            type: Type.OBJECT,
            properties: {
              seasonalImpact: { type: Type.STRING },
              regionalPremium: { type: Type.STRING },
              costSavingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              marketTrend: { type: Type.STRING, enum: ["rising", "stable", "falling"] }
            },
            required: ["seasonalImpact", "regionalPremium", "costSavingTips", "marketTrend"]
          }
        },
        required: ["isAvailable", "min", "max", "confidence", "breakdown", "reasoning", "pricingInsights"]
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Estimate Error:", error);
    // Fallback estimate
    return {
      isAvailable: true,
      min: 150,
      max: 450,
      confidence: 0.5,
      breakdown: {
        materials: "Basic materials and call-out fee.",
        labour: "Standard hourly rate for 2-4 hours.",
        duration: "Half a day"
      },
      reasoning: "Based on average UK trade rates for general maintenance."
    };
  }
}

export async function generateBroadcastDraft(
  topic: string,
  type: string,
  audience: string
): Promise<string> {
  const prompt = `
    Write a professional, engaging broadcast message for a UK tradesperson marketplace platform.
    Audience: ${audience}
    Message Type: ${type}
    Topic/Rough Idea: ${topic}
    
    Keep it concise, clear, and action-oriented. Do not include placeholders like [Your Name] or [Platform Name]. Just the raw message content.
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash");
    return response.text || "";
  } catch (error) {
    console.error("Gemini Broadcast Draft Error:", error);
    throw new Error("Failed to generate draft.");
  }
}

export async function generateQuoteDraft(
  jobTitle: string,
  jobDescription: string,
  tradespersonName: string,
  amount: string,
  scope: string
): Promise<string> {
  const prompt = `
    As a professional tradesperson named ${tradespersonName}, write a polite and professional quote message for this job:
    Job: ${jobTitle}
    Details: ${jobDescription}
    My Quote: £${amount}
    Scope: ${scope}

    The message should:
    1. Acknowledge the specific job details.
    2. Explain why I am a good fit.
    3. Be concise and professional.
    4. End with a call to action (e.g., "Let me know if you'd like to proceed").

    Return ONLY the message text.
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash");

    return response.text || "I would be happy to help with this job. Please let me know if you have any questions.";
  } catch (error) {
    console.error("Gemini Quote Draft Error:", error);
    return "I would be happy to help with this job. I have extensive experience in this type of work and can ensure a high-quality finish. Please let me know if you'd like to discuss the details further.";
  }
}

export async function summarizeDisputeChat(
  chatMessages: any[],
  disputeReason: string
): Promise<{ summary: string; timeline: string[]; faultAnalysis: string }> {
  if (!chatMessages || chatMessages.length === 0) {
    return {
      summary: "No chat history available.",
      timeline: [],
      faultAnalysis: "Cannot determine fault without chat history."
    };
  }

  const formattedChat = chatMessages
    .sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    })
    .map(m => `[${new Date(m.createdAt?.seconds * 1000).toLocaleString()}] ${m.senderId}: ${m.text}`)
    .join("\n");

  const prompt = `
    As an expert dispute mediator for a UK tradesperson marketplace, analyze the following chat history and dispute reason.
    
    Dispute Reason provided by user: "${disputeReason}"
    
    Chat History:
    ${formattedChat}
    
    Provide a JSON response with:
    {
      "summary": "A 2-3 sentence summary of the core disagreement.",
      "timeline": ["Key event 1", "Key event 2", "Key event 3"],
      "faultAnalysis": "A brief, objective analysis of who is likely at fault based on the chat evidence and standard marketplace terms."
    }
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          timeline: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          faultAnalysis: { type: Type.STRING }
        },
        required: ["summary", "timeline", "faultAnalysis"]
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Dispute Summary Error:", error);
    return {
      summary: "Failed to generate AI summary.",
      timeline: ["Error analyzing chat history."],
      faultAnalysis: "Manual review required."
    };
  }
}
export async function getReviewSummary(reviews: any[]): Promise<string> {
  if (!reviews || reviews.length === 0) return "No reviews yet.";
  
  const reviewsText = reviews.map(r => `- [${r.rating} stars]: ${r.comment}`).join("\n");
  const prompt = `
    Summarize the following reviews for a tradesperson into a single, punchy sentence that highlights their strengths.
    Reviews:
    ${reviewsText}
 
    The summary should be professional and helpful for a homeowner.
    Example: "Highly rated for punctuality and clean work, specializing in complex plumbing repairs."
    
    Return ONLY the summary text.
  `;
 
  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash");
    return response.text || "Consistently high-quality work with positive customer feedback.";
  } catch (error) {
    console.error("Gemini Review Summary Error:", error);
    return "Consistently high-quality work with positive customer feedback.";
  }
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

export async function analyzeFraudRisk(
  usersData: any[],
  jobsData: any[],
  recentLogs: any[]
): Promise<RiskAlert[]> {
  const summarizedUsers = usersData.map(u => ({ id: u.id, name: u.name, role: u.role, status: u.verificationStatus, reports: u.reports || 0 }));
  const summarizedJobs = jobsData.map(j => ({ id: j.id, title: j.title, status: j.status, dispute: !!j.dispute }));
  const summarizedLogs = recentLogs.slice(0, 20).map(l => ({ action: l.action, target: l.targetType }));

  const prompt = `
    As an expert AI Fraud & Risk Monitor for a UK tradesperson marketplace, analyze the following platform data to identify suspicious activities, potential fraud, or high-risk users.
    
    Users: ${JSON.stringify(summarizedUsers)}
    Recent Jobs: ${JSON.stringify(summarizedJobs)}
    Recent Admin Logs: ${JSON.stringify(summarizedLogs)}
    
    Identify up to 5 highest risk entities (users or jobs).
    Return a JSON array of objects with the following schema:
    [{
      "targetId": "string",
      "targetName": "string",
      "type": "user" | "job",
      "riskScore": number (0-100),
      "riskLevel": "High" | "Medium" | "Low",
      "reason": "string (detailed explanation of why this was flagged)",
      "recommendedAction": "string (e.g., 'Suspend account', 'Request manual review')"
    }]
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            targetId: { type: Type.STRING },
            targetName: { type: Type.STRING },
            type: { type: Type.STRING },
            riskScore: { type: Type.NUMBER },
            riskLevel: { type: Type.STRING },
            reason: { type: Type.STRING },
            recommendedAction: { type: Type.STRING }
          },
          required: ["targetId", "targetName", "type", "riskScore", "riskLevel", "reason", "recommendedAction"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Fraud Risk Error:", error);
    return [];
  }
}

export async function analyzeJobPhoto(imageUrls: string[]): Promise<{ category: string; urgency: string; reasoning: string }> {
  if (!imageUrls || imageUrls.length === 0) throw new Error("No images provided");

  const prompt = `
    Analyze these job photos from a homeowner. 
    Identify:
    1. The likely trade category (e.g., Plumbing, Electrical, Carpentry, Roofing, etc.)
    2. The urgency level (Emergency, Routine, or Specific Date)
    3. A brief reasoning for your choice.

    Return the response in JSON format:
    {
      "category": "string",
      "urgency": "string",
      "reasoning": "string"
    }
  `;

  try {
    // Fetch images and convert to parts
    const imageParts = await Promise.all(imageUrls.map(async (url) => {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      return {
        inlineData: {
          data: Buffer.from(buffer).toString("base64"),
          mimeType: "image/jpeg",
        },
      };
    }));

    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          urgency: { type: Type.STRING },
          reasoning: { type: Type.STRING }
        },
        required: ["category", "urgency", "reasoning"]
      }
    });

    return result;
  } catch (error) {
    console.error("Gemini Photo Analysis Error:", error);
    return {
      category: "General Maintenance",
      urgency: "Routine",
      reasoning: "Could not analyze photo clearly."
    };
  }
}

export async function getClarifyingQuestions(
  category: string,
  title: string,
  description: string
): Promise<string[]> {
  const prompt = `
    You are a professional tradesperson helping a homeowner refine their job post.
    Job: ${title} (${category})
    Description: ${description}

    Ask 3 brief, specific clarifying questions that would help a tradesperson give a more accurate quote.
    Focus on technical details (e.g., access, specific materials, dimensions, or hidden issues).
    
    Return the response as a JSON array of strings:
    ["Question 1?", "Question 2?", "Question 3?"]
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    });

    return result || [];
  } catch (error) {
    console.error("Gemini Clarifying Questions Error:", error);
    return [
      "Are there any specific materials you've already purchased?",
      "Is there easy access to the work area?",
      "Are there any specific deadlines for this work?"
    ];
  }
}

export async function getMaterialList(
  category: string,
  title: string,
  description: string
): Promise<string[]> {
  const prompt = `
    You are a professional tradesperson. A homeowner is doing a "Labour Only" job and needs to buy materials themselves.
    Job: ${title} (${category})
    Description: ${description}

    Generate a comprehensive list of standard materials, tools, or consumables the homeowner should have ready.
    
    Return the response as a JSON array of strings:
    ["Material 1", "Material 2", ...]
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    });

    return result || [];
  } catch (error) {
    console.error("Gemini Material List Error:", error);
    return ["Standard trade materials related to " + category];
  }
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
  const prompt = `
    As a security analyst for a tradesperson platform, analyze the following text for potential security threats:
    - Phishing: Attempts to steal credentials or redirect to malicious sites.
    - Hacking: Attempts to inject malicious code, SQL injection, or unauthorized access.
    - PII: Excessive sharing of sensitive personal information.
    
    Text: "${text}"
    
    Return a JSON object:
    {
      "isThreat": boolean,
      "threatType": "phishing" | "hacking" | "pii" | "other" | null,
      "riskScore": number (0-100),
      "details": "string (brief explanation)"
    }
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json"
    });

    return result || { isThreat: false, threatType: null, riskScore: 0, details: "No threat detected." };
  } catch (error) {
    console.error("Gemini Security Threat Analysis Error:", error);
    return { isThreat: false, threatType: null, riskScore: 0, details: "Error analyzing text." };
  }
}

export async function improveJobDescription(
  category: string,
  title: string,
  description: string
): Promise<string> {
  const prompt = `
    You are a professional tradesperson helping a homeowner write a clear and detailed job description.
    Job: ${title} (${category})
    Current Description: ${description}

    Rewrite this description to be more professional, structured, and helpful for tradespeople.
    - Use bullet points for key requirements.
    - Mention likely access needs.
    - Keep it concise but thorough.
    - Do NOT include contact details or PII.
    
    Return ONLY the improved description text.
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash");
    return result || description;
  } catch (error) {
    console.error("Gemini Improve Description Error:", error);
    return description;
  }
}

export async function parseNaturalLanguageSearch(query: string): Promise<{
  categories: string[];
  urgency: string | null;
  keywords: string[];
}> {
  const prompt = `
    You are an AI assistant for a tradesperson job platform.
    The user is searching for jobs using natural language: "${query}"
    
    Extract the following structured information:
    1. categories: An array of trade categories (e.g., "Plumbing", "Electrical", "Carpentry"). Use standard trade names.
    2. urgency: One of "emergency", "asap", "flexible", or null if not specified.
    3. keywords: An array of specific keywords or job types mentioned (e.g., "leaking tap", "rewiring", "kitchen").
    
    Return ONLY a JSON object.
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json"
    });

    return result || { categories: [], urgency: null, keywords: [] };
  } catch (error) {
    console.error("Gemini Search Parse Error:", error);
    return { categories: [], urgency: null, keywords: [] };
  }
}

export async function checkSafetyAndPII(text: string): Promise<{
  isSafe: boolean;
  hasPII: boolean;
  redactedText: string;
  issues: string[];
}> {
  const prompt = `
    You are a safety moderator for a tradesperson platform.
    Analyze the following text for:
    1. PII (Personally Identifiable Information): Phone numbers, email addresses, specific home addresses (street names/numbers).
    2. Safety/Inappropriate content: Offensive language, scams, or dangerous requests.
    
    Text: "${text}"
    
    Return a JSON object with:
    - isSafe: boolean (false if offensive or scammy)
    - hasPII: boolean (true if any PII found)
    - redactedText: string (the text with PII replaced by [REDACTED])
    - issues: string[] (list of specific issues found)
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json"
    });

    return result || { isSafe: true, hasPII: false, redactedText: text, issues: [] };
  } catch (error) {
    console.error("Gemini Safety Check Error:", error);
    return { isSafe: true, hasPII: false, redactedText: text, issues: [] };
  }
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
  const prompt = `
    You are an expert mediator for a tradesperson platform.
    Job: ${jobTitle}
    Original Description: ${jobDescription}
    Quote Amount: £${quoteAmount}
    Dispute Reason: ${disputeReason}
    
    Analyze the situation and provide:
    1. A neutral summary of the conflict.
    2. A fair suggestion for resolution (e.g., partial refund, rework, or full payment).
    3. A suggested "fair price" if a refund is appropriate.
    
    Return ONLY a JSON object.
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json"
    });

    return result || { summary: "Unable to analyze", suggestion: "Manual review required" };
  } catch (error) {
    console.error("Gemini Dispute Mediator Error:", error);
    return { summary: "Error analyzing dispute", suggestion: "Please contact support" };
  }
}

export async function getRecommendedJobs(
  tradespersonProfile: any,
  availableJobs: any[],
  activeJobs: any[] = [],
  availability: any = null
): Promise<{ id: string; reason: string }[]> {
  const prompt = `
    You are an AI job matcher and schedule optimizer for a tradesperson platform.
    
    Tradesperson Profile:
    - Category: ${tradespersonProfile.category}
    - Bio: ${tradespersonProfile.bio}
    - Skills: ${tradespersonProfile.skills?.join(", ")}
    - Home Postcode: ${tradespersonProfile.postcode}
    
    Current Schedule (Active Jobs):
    ${activeJobs.length > 0 ? activeJobs.map(j => `- Job: ${j.title}, Location: ${j.postcode}, Status: ${j.status}`).join("\n") : "No active jobs - fully available for new work."}
    
    Availability Preferences (Standard hours and specific date overrides):
    ${availability ? JSON.stringify(availability) : "Standard working hours"}
    
    Available Jobs to Match:
    ${availableJobs.length > 0 ? availableJobs.map(j => {
      const isEmergency = j.urgency === 'emergency';
      const isExpired = isEmergency && (j.boostExpiresAt ? new Date().getTime() > new Date(j.boostExpiresAt).getTime() : (new Date().getTime() - (j.createdAt?.seconds ? j.createdAt.seconds * 1000 : new Date(j.createdAt).getTime()) > 2 * 60 * 60 * 1000));
      return `- ID: ${j.id}, Title: ${j.title}, Category: ${j.category}, Postcode: ${j.postcode}, Urgency: ${j.urgency || "Routine"}${isExpired ? " (Status: Emergency Expired)" : ""}, Description: ${j.description}`;
    }).join("\n") : "No jobs currently available."}
    
    Task:
    Select the top 3 job IDs that best match this tradesperson's skills, category, and schedule. If the tradesperson has no active jobs, prioritize all available jobs based on skill, proximity, and urgency.
    
    Ranking Criteria (Highest Priority First):
    1. Urgency: Prioritize "Emergency" or "ASAP" jobs if they fit the tradesperson's availability. **Crucially, include "Emergency Expired" jobs as high priority, as these homeowners are still actively seeking quotes and need urgent help.**
    2. Proximity: Use the postcodes to prioritize jobs closest to their home (${tradespersonProfile.postcode}) or near their current active jobs to minimize travel time (clustering).
    3. Availability Patterns: Match the job's urgency/date with the tradesperson's specified availability (${availability ? JSON.stringify(availability) : "Standard working hours"}).
    4. Skill Alignment: Ensure the job description matches their specific skills (${tradespersonProfile.skills?.join(", ")}).
    
    Return ONLY a JSON array of objects:
    [
      { "id": "job_id_1", "reason": "Short explanation why (e.g., 'Matches your skills and is only 2 miles from your current job on Tuesday')" },
      ...
    ]
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["id", "reason"]
        }
      }
    });

    return result || [];
  } catch (error) {
    console.error("Gemini Job Recommendation Error:", error);
    return [];
  }
}

export async function getMaintenancePredictions(
  jobHistory: any[]
): Promise<any[]> {
  const prompt = `
    Analyze the following home maintenance job history and predict upcoming maintenance needs.
    
    Job History:
    ${jobHistory.map(j => `- ${j.title} (${j.category}) completed on ${new Date(j.completedAt?.seconds * 1000 || j.completedAt).toLocaleDateString()}`).join("\n")}
    
    For each prediction, provide:
    1. Title (e.g., "Annual Boiler Service")
    2. Category
    3. Estimated Due Date (ISO string)
    4. Reason (why it's needed now)
    5. Urgency (Low, Medium, High)
    
    Return the result as a JSON array of objects.
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash");
    const text = response.text || "[]";
    const jsonMatch = text.match(/\[.*\]/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (error) {
    console.error("Gemini Maintenance Prediction Error:", error);
    return [];
  }
}

export async function generateMarketingPost(
  jobTitle: string,
  jobDescription: string,
  category: string,
  tradespersonName: string,
  platformName: string = "AnyTrader"
): Promise<string> {
  const prompt = `
    As a professional tradesperson named ${tradespersonName}, write an engaging social media post (for Instagram/Facebook) to showcase a successfully completed job.
    
    Job: ${jobTitle}
    Category: ${category}
    Details: ${jobDescription}
    Platform: ${platformName}
    
    The post should:
    1. Sound proud and professional.
    2. Highlight the quality of work.
    3. Include relevant emojis.
    4. Include relevant hashtags (e.g., #UKTrades, #${category.replace(/\s+/g, '')}, #AnyTrader).
    5. Encourage others to book via ${platformName}.
    
    Return ONLY the post content.
  `;

  try {
    const response = await callAiProxy(prompt, "gemini-1.5-flash");
    return response.text || "Just finished another great job! Check out my profile on AnyTrader for your next project.";
  } catch (error) {
    console.error("Gemini Marketing Post Error:", error);
    return "Just finished another great job! Check out my profile on AnyTrader for your next project.";
  }
}

export interface QuoteAnalysis {
  label: "Budget Friendly" | "Good Value" | "Average" | "Premium";
  percentile: number;
  winningFactor: string;
  fairnessCheck: string;
}

export async function analyzeQuote(
  jobTitle: string,
  jobDescription: string,
  quoteAmount: number,
  quoteMessage: string,
  estimateMin: number,
  estimateMax: number
): Promise<QuoteAnalysis> {
  const prompt = `
    As an expert UK construction cost analyst, analyze this quote against the job requirements and AI estimate.
    
    Job: ${jobTitle}
    Description: ${jobDescription}
    AI Estimate: £${estimateMin} - £${estimateMax}
    
    Quote Amount: £${quoteAmount}
    Quote Message: "${quoteMessage}"
    
    Tasks:
    1. Categorize the quote:
       - "Budget Friendly": Significantly below the average estimate.
       - "Good Value": Competitive price with good scope/extras.
       - "Average": Standard pricing.
       - "Premium": High price, likely for high-end service or materials.
    2. Calculate a "Value Percentile" (0-100): How good is this value compared to the area average? (Higher is better value).
    3. Identify a "Winning Factor": A one-sentence highlight of why this quote is attractive (e.g., "Includes 10-year warranty", "Fastest start date").
    4. Fairness Check: A brief note if the price seems too low (risk of hidden costs) or too high.
    
    Return a JSON object:
    {
      "label": "Budget Friendly" | "Good Value" | "Average" | "Premium",
      "percentile": number,
      "winningFactor": "string",
      "fairnessCheck": "string"
    }
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json"
    });
    return result;
  } catch (error) {
    console.error("Gemini Quote Analysis Error:", error);
    // Fallback logic
    let label: any = "Average";
    let percentile = 50;
    if (quoteAmount < estimateMin) { label = "Budget Friendly"; percentile = 85; }
    else if (quoteAmount > estimateMax) { label = "Premium"; percentile = 25; }
    
    return {
      label,
      percentile,
      winningFactor: "Professional quote matching your requirements.",
      fairnessCheck: "Price appears to be within expected market range."
    };
  }
}

export interface RejectionFeedback {
  reason: string;
  improvementTip: string;
}

export async function getRejectionFeedback(
  job: any,
  rejectedQuote: any,
  acceptedQuote: any
): Promise<RejectionFeedback> {
  const prompt = `
    As an expert UK construction business coach, provide constructive feedback to a tradesperson whose quote was not accepted.
    
    Job Title: ${job.title}
    Job Description: ${job.description}
    
    Rejected Quote Amount: £${rejectedQuote.amount}
    Rejected Quote Message: "${rejectedQuote.message}"
    
    Accepted Quote Amount: £${acceptedQuote.amount}
    Accepted Quote Scope: ${acceptedQuote.quoteScope}
    
    Tasks:
    1. Identify the primary reason for rejection (e.g., price too high, message lacked detail, scope mismatch). Be professional and constructive.
    2. Provide a specific, actionable tip for how they can improve their next quote to increase their chances of winning.
    
    Return a JSON object:
    {
      "reason": "string",
      "improvementTip": "string"
    }
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json"
    });
    return result;
  } catch (error) {
    console.error("Gemini Rejection Feedback Error:", error);
    return {
      reason: "The homeowner chose another quote that better matched their current budget or timeline.",
      improvementTip: "Try adding more detail about your specific experience with this type of job in your next quote message."
    };
  }
}

export interface DocumentAnalysisResult {
  isValid: boolean;
  confidence: number;
  extractedData: Record<string, string>;
  flags: string[];
  reasoning: string;
}

export async function analyzeDocument(
  imageUrl: string,
  documentType: string,
  userName: string
): Promise<DocumentAnalysisResult> {
  const prompt = `
    As an expert KYC (Know Your Customer) and Document Verification AI for a UK tradesperson platform, analyze this document image.
    
    Expected Document Type: ${documentType}
    User Claimed Name: ${userName}
    
    Perform the following checks:
    1. Verify if the document matches the expected type (e.g., ID, Insurance, Certification).
    2. Extract key data (Name, Expiry Date, License/ID Number).
    3. Check if the extracted name matches or closely resembles the User Claimed Name.
    4. Check if the document appears expired, tampered with, blurry, or invalid.
    
    Return a JSON response with the following schema:
    {
      "isValid": boolean (true if it appears to be a valid, unexpired document matching the user),
      "confidence": number (0-100),
      "extractedData": { "name": "string", "expiryDate": "string", "documentNumber": "string" },
      "flags": ["string"] (array of warnings, e.g., "Blurry", "Name mismatch", "Expired", or empty if none),
      "reasoning": "string" (brief explanation of the decision)
    }
  `;

  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const imagePart = {
      inlineData: {
        data: Buffer.from(buffer).toString("base64"),
        mimeType: "image/jpeg",
      },
    };

    const aiResponse = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          extractedData: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              expiryDate: { type: Type.STRING },
              documentNumber: { type: Type.STRING }
            }
          },
          flags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          reasoning: { type: Type.STRING }
        },
        required: ["isValid", "confidence", "extractedData", "flags", "reasoning"]
      }
    });

    return aiResponse;
  } catch (error) {
    console.error("Gemini Document Analysis Error:", error);
    return {
      isValid: false,
      confidence: 0,
      extractedData: {},
      flags: ["Error analyzing document"],
      reasoning: "An error occurred during AI analysis. Manual review required."
    };
  }
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

export async function suggestNewCategories(
  existingCategories: string[],
  internalSearchLogs: any[] = []
): Promise<CategorySuggestion[]> {
  const topInternalSearches = internalSearchLogs.length > 0 
    ? `Top internal search queries on our platform (these are terms users are actively typing into our search bar): ${JSON.stringify(internalSearchLogs.slice(0, 100))}`
    : "";

  const prompt = `
    As an expert market analyst for a home services platform, analyze both LIVE Google Search trends and our platform's internal search data to suggest new trade categories.
    
    ${topInternalSearches}
    
    Search Google for the latest search trends, rising queries, and breakout topics related to 'home services', 'tradespeople', 'contractors', and 'home improvement'. 
    
    Based on these sources, suggest 5 new, high-demand trade categories we should add to our platform. 
    Pay special attention to terms from our internal search logs that don't match existing categories.
    
    Existing Categories (DO NOT suggest these): ${existingCategories.join(", ")}
    
    Return a JSON array of objects with:
    [
      {
        "category": "string (The name of the new category)",
        "reason": "string (Why this is a good addition based on trends and internal searches)",
        "demandScore": number (0-100, estimated demand),
        "trend": "rising" | "stable" | "falling",
        "scope": "string (Briefly describe what this trade covers)",
        "source": "google_trends" | "internal_search" | "combined",
        "topKeywords": ["string"] (List 3-5 specific search terms or keywords that led to this suggestion, especially from internal logs if applicable)
      }
    ]
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            demandScore: { type: Type.NUMBER },
            trend: { type: Type.STRING, enum: ["rising", "stable", "falling"] },
            scope: { type: Type.STRING },
            source: { type: Type.STRING, enum: ["google_trends", "internal_search", "combined"] },
            topKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["category", "reason", "demandScore", "trend", "scope", "source", "topKeywords"]
        }
      }
    });

    return result || [];
  } catch (error) {
    console.error("Gemini Category Suggestion Error:", error);
    return [];
  }
}

export interface MonetizationOpportunity {
  title: string;
  description: string;
  type: "Seasonal" | "Behavioral" | "Trend";
  impact: "High" | "Medium" | "Low";
  action: string;
  targetRole: "homeowner" | "tradesperson" | "both";
  suggestedPartnerCategory: string;
}

export async function getMonetizationOpportunities(
  platformStats: any
): Promise<MonetizationOpportunity[]> {
  const prompt = `
    As an expert AI Revenue Strategist for a UK tradesperson marketplace (AnyTrader), analyze the following platform statistics and suggest 5 high-conversion monetization opportunities.
    
    Platform Stats:
    ${JSON.stringify(platformStats)}
    
    Consider:
    1. Seasonal Trends (e.g., Boiler service in winter, Garden work in spring).
    2. User Behavior (e.g., Homeowners with multiple high-value jobs, Traders with high volume but no insurance).
    3. Document Expiries (e.g., Upcoming insurance renewals).
    4. Emerging Trends (e.g., EV charger installs, Heat pumps).
    
    Return a JSON array of objects:
    [{
      "title": "string",
      "description": "string",
      "type": "Seasonal" | "Behavioral" | "Trend",
      "impact": "High" | "Medium" | "Low",
      "action": "string (e.g., 'Launch Campaign', 'Target Users')",
      "targetRole": "homeowner" | "tradesperson" | "both",
      "suggestedPartnerCategory": "string (e.g., 'Insurance', 'Finance', 'Supplies')"
    }]
  `;

  try {
    const result = await callAiProxy(prompt, "gemini-1.5-flash", {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["Seasonal", "Behavioral", "Trend"] },
            impact: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            action: { type: Type.STRING },
            targetRole: { type: Type.STRING, enum: ["homeowner", "tradesperson", "both"] },
            suggestedPartnerCategory: { type: Type.STRING }
          },
          required: ["title", "description", "type", "impact", "action", "targetRole", "suggestedPartnerCategory"]
        }
      }
    });

    return result || [];
  } catch (error) {
    console.error("Gemini Monetization Error:", error);
    return [];
  }
}
