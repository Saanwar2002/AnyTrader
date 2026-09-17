import { db, sendNotification } from "@/src/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { polishBio } from "@/src/services/gemini";
import { TRADE_CATEGORIES } from "@/src/constants";
import { fetchUnmatchedSearches } from "./searchOptimizationService";
import { CATEGORY_SYNONYMS, categoryMatchesSearch } from "@/src/lib/fuzzyMatch";

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export interface ProfileAuditSuggestion {
  id: string;
  category: "bio" | "skills" | "credentials" | "payments" | "settings" | "subscriptions";
  title: string;
  impact: "high" | "medium" | "low";
  description: string;
  currentValue?: string | string[];
  suggestedValue?: string | string[];
  actionType: "apply_bio" | "add_skill" | "upload_media" | "setup_payment" | "update_setting" | "upgrade_subscription" | "explore_ads" | "activate_priority_alerts";
  actionLabel: string;
  isApplied?: boolean;
}

export interface ProfileAuditResult {
  lastAuditedAt: string;
  healthScore: number; // 0 to 100
  status: "optimized" | "needs_attention" | "critical_gaps";
  totalSuggestions: number;
  unreadSuggestionsCount: number;
  summary: string;
  suggestions: ProfileAuditSuggestion[];
  professionalBioDraft?: string;
  recommendedSkillsToAdd?: string[];
  auditType: "initial_signup" | "periodic_audit" | "manual_request";
}

/**
 * Executes the AI Profile Optimization & Readiness Coach Agent audit.
 * Audits trader or homeowner profile completeness, professional wording,
 * category skill parity, credentials, and payment/settings readiness.
 */
export async function auditProfileAndAccountReadiness(
  profile: any,
  forceFresh: boolean = false
): Promise<ProfileAuditResult> {
  if (!profile || !profile.uid) {
    return {
      lastAuditedAt: new Date().toISOString(),
      healthScore: 50,
      status: "needs_attention",
      totalSuggestions: 1,
      unreadSuggestionsCount: 1,
      summary: "Profile details missing or incomplete.",
      suggestions: [
        {
          id: "missing_profile",
          category: "settings",
          title: "Complete Initial Profile Setup",
          impact: "high",
          description: "Your profile information needs to be set up to start matching with jobs.",
          actionType: "update_setting",
          actionLabel: "Edit Profile"
        }
      ],
      auditType: "initial_signup"
    };
  }

  // Check cached audit if not forcing fresh and last audit was within 14 days
  const existingAudit: ProfileAuditResult | undefined = profile.aiProfileAudit;
  if (!forceFresh && existingAudit && existingAudit.lastAuditedAt) {
    const daysSinceLastAudit = (Date.now() - new Date(existingAudit.lastAuditedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastAudit < 14) {
      return existingAudit;
    }
  }

  const isTrader = profile.role === "trader" || profile.isBusinessProfile || profile.trades?.length > 0;
  const auditType: "initial_signup" | "periodic_audit" | "manual_request" = 
    forceFresh ? "manual_request" : 
    (!existingAudit ? "initial_signup" : "periodic_audit");

  const suggestions: ProfileAuditSuggestion[] = [];
  let points = 100;

  // 1. BIO & PROFESSIONAL DESCRIPTION AUDIT
  const rawBio = (profile.bio || profile.description || "").trim();
  let professionalBioDraft = rawBio;

  if (isTrader) {
    if (!rawBio || rawBio.length < 30) {
      points -= 25;
      const generatedBio = generateDefaultProfessionalBio(profile);
      professionalBioDraft = generatedBio;
      suggestions.push({
        id: "sug_bio_short",
        category: "bio",
        title: "Enhance Professional Bio & Service Intro",
        impact: "high",
        description: "Your bio is currently very short or empty. A clear, professional description builds instant trust with homeowners and increases job matches.",
        currentValue: rawBio || "(Empty Bio)",
        suggestedValue: generatedBio,
        actionType: "apply_bio",
        actionLabel: "⚡ Apply Professional Bio"
      });
    } else {
      // Refine bio to simple, professional, plain English (remove jargon / informal phrasing)
      try {
        const tradesStr = (profile.trades || []).join(", ") || "General Trade";
        const tagsStr = (profile.tags || []).join(", ") || "";
        const aiText = await polishBio(rawBio, tradesStr, tagsStr);
        if (aiText && aiText.length > 20 && aiText !== rawBio) {
          professionalBioDraft = aiText;
          suggestions.push({
            id: "sug_bio_refine",
            category: "bio",
            title: "Upgrade to Professional Plain-English Bio",
            impact: "medium",
            description: "AI reframed your bio to sound polished, accessible, and clear for homeowners without overly technical jargon.",
            currentValue: rawBio,
            suggestedValue: aiText,
            actionType: "apply_bio",
            actionLabel: "⚡ Apply Polished Bio"
          });
        }
      } catch (e) {
        console.warn("Gemini bio refinement fallback used:", e);
      }
    }
  }

  // 2. CATEGORY SKILL PARITY & KEYWORD GAP ANALYSIS
  const recommendedSkillsToAdd: string[] = [];
  if (isTrader) {
    const userTrades: string[] = profile.trades || (profile.trade ? [profile.trade] : []);
    const userServices: string[] = profile.services || profile.skills || [];

    // Match against TRADE_CATEGORIES subcategories
    userTrades.forEach(tradeName => {
      const categoryObj = TRADE_CATEGORIES.find(c => c.name.toLowerCase() === tradeName.toLowerCase());
      if (categoryObj && categoryObj.subcategories) {
        categoryObj.subcategories.forEach(subcat => {
          if (!userServices.some(s => s.toLowerCase() === subcat.toLowerCase())) {
            recommendedSkillsToAdd.push(subcat);
          }
        });
      }
    });

    if (recommendedSkillsToAdd.length > 0) {
      points -= 15;
      const top3Recommended = recommendedSkillsToAdd.slice(0, 4);
      suggestions.push({
        id: "sug_skills_gap",
        category: "skills",
        title: "Add Missing Category Search Keywords",
        impact: "high",
        description: `Homeowners frequently search for these sub-services in your main categories: ${top3Recommended.join(", ")}. Adding them will increase your job search visibility.`,
        currentValue: userServices,
        suggestedValue: top3Recommended,
        actionType: "add_skill",
        actionLabel: `➕ Add ${top3Recommended.length} Recommended Skills`
      });
    }

    // 2b. UNMATCHED SEARCH DEMAND TELEMETRY AUDIT (Data-Driven Customer Search Gaps)
    try {
      const unmatchedSearches = await fetchUnmatchedSearches(20);
      const relevantUnmatched = unmatchedSearches.filter((item) => {
        if (item.status === "ignored") return false;
        const q = item.query.toLowerCase().trim();
        
        // Already in user's services or skills?
        const alreadyHas = userServices.some(s => s.toLowerCase() === q || s.toLowerCase().includes(q));
        if (alreadyHas) return false;

        // Does this search match the trader's trades or categories?
        const matchesTrade = userTrades.some((tradeName) => {
          const catObj = TRADE_CATEGORIES.find(c => c.name.toLowerCase() === tradeName.toLowerCase()) || { name: tradeName, subcategories: [] };
          if (categoryMatchesSearch(catObj as any, q)) return true;
          
          const synonymMeta = CATEGORY_SYNONYMS[q];
          if (synonymMeta && synonymMeta.categoryName.toLowerCase() === tradeName.toLowerCase()) return true;

          // Token check: e.g. "pet care" matching "Pet Services"
          const qTokens = q.split(/\s+/);
          const tTokens = tradeName.toLowerCase().split(/[\s,&]+/);
          return qTokens.some(qt => qt.length >= 3 && tTokens.some(tt => tt.startsWith(qt) || qt.startsWith(tt)));
        });

        return matchesTrade;
      });

      // Add top unmet search terms as actionable profile additions
      relevantUnmatched.slice(0, 3).forEach((item) => {
        const displayTerm = toTitleCase(item.query);
        suggestions.push({
          id: `sug_demand_${item.normalizedQuery}`,
          category: "skills",
          title: `🔥 High Search Demand: Add "${displayTerm}"`,
          impact: "high",
          description: `Homeowners searched for "${item.query}" ${item.searchCount > 1 ? `(${item.searchCount} times)` : ""} in your category with zero matching traders found. Add this keyword to your profile to capture these local leads!`,
          currentValue: userServices,
          suggestedValue: [displayTerm],
          actionType: "add_skill",
          actionLabel: `➕ Add "${displayTerm}" (+Match Leads)`
        });
      });
    } catch (telemetryErr) {
      console.warn("Telemetry search gap audit fallback:", telemetryErr);
    }
  }

  // 3. CREDENTIALS, MEDIA & TRUST SIGNALS
  if (isTrader) {
    // Video selfie verification
    if (!profile.videoVerificationUrl && !profile.isVideoVerified) {
      points -= 15;
      suggestions.push({
        id: "sug_video_verified",
        category: "credentials",
        title: "Record 15-Second Video Intro (+35 Match Boost)",
        impact: "high",
        description: "Profiles with a verified video intro rank higher in local homeowner search results and earn a High-Trust Verified badge.",
        actionType: "upload_media",
        actionLabel: "📹 Record Video Intro"
      });
    }

    // Portfolio photos
    const portfolioCount = (profile.portfolio || profile.galleryImages || []).length;
    if (portfolioCount < 3) {
      points -= 10;
      suggestions.push({
        id: "sug_portfolio_photos",
        category: "credentials",
        title: "Upload Past Job Work Photos",
        impact: "medium",
        description: `You currently have ${portfolioCount} portfolio photo(s). Adding 3-5 quality photos of completed work increases quote acceptance rates by up to 3x.`,
        actionType: "upload_media",
        actionLabel: "📷 Add Work Photos"
      });
    }

    // Public Liability Insurance or Gas Safe / NICEIC badges
    if (!profile.insuranceVerified && !profile.publicLiabilityVerified) {
      points -= 10;
      suggestions.push({
        id: "sug_insurance_cert",
        category: "credentials",
        title: "Verify Public Liability Insurance",
        impact: "medium",
        description: "Homeowners prefer traders with verified Public Liability Insurance. Upload your certificate for an instant verification badge.",
        actionType: "upload_media",
        actionLabel: "🛡️ Verify Insurance"
      });
    }
  }

  // 4. ACCOUNT & PAYMENT READINESS CHECK (TRADER & HOMEOWNER)
  const hasPaymentSetup = !!(profile.stripeAccountId || profile.payoutsEnabled || profile.paymentMethodAdded || profile.bankDetails?.sortCode);
  if (!hasPaymentSetup) {
    points -= 15;
    suggestions.push({
      id: "sug_payment_setup",
      category: "payments",
      title: isTrader ? "Connect Payout Bank Account (Stripe Split-Pay)" : "Add Saved Payment Method",
      impact: "high",
      description: isTrader
        ? "Your account is not fully configured to receive direct customer payments or instant milestone payouts."
        : "Add a default payment method for 1-tap booking and job deposits.",
      actionType: "setup_payment",
      actionLabel: isTrader ? "💳 Setup Stripe Payouts" : "💳 Add Payment Method"
    });
  }

  // 5. CONTACT & SETTINGS COMPLETENESS
  const hasPhone = !!(profile.phone || profile.phoneNumber || profile.mobile);
  const hasPostcode = !!(profile.postcode || profile.location?.postcode);

  if (!hasPhone || !hasPostcode) {
    points -= 10;
    suggestions.push({
      id: "sug_settings_contact",
      category: "settings",
      title: "Complete Primary Contact & Service Postcode",
      impact: "high",
      description: "Ensure your phone number and service postcode radius are set to receive SMS job alerts and precise distance calculations.",
      actionType: "update_setting",
      actionLabel: "⚙️ Update Account Settings"
    });
  }

  // 6. PAID FEATURES & SUBSCRIPTION OPTIMIZATION (TRADERS)
  if (isTrader) {
    const isProSubscriber = profile.subscriptionStatus === "active" || profile.isProSubscriber === true;

    if (!isProSubscriber) {
      suggestions.push({
        id: "sug_sub_tradeos_pro",
        category: "subscriptions",
        title: "Upgrade to TradeOS PRO (+50% Match Rate & Lower Commission)",
        impact: "high",
        description: "Free profiles are subject to standard 12% split fees. TradeOS PRO lowers commission to 5%, grants 5-minute early access to incoming local job leads, and adds a Founding Pro Badge to your profile.",
        actionType: "upgrade_subscription",
        actionLabel: "🚀 Explore TradeOS PRO"
      });
    } else {
      // Suggest Featured Directory Placement or Priority SMS Lead Alerts
      if (!profile.priorityAlertsEnabled) {
        suggestions.push({
          id: "sug_sub_priority_alerts",
          category: "subscriptions",
          title: "Activate Priority Instant SMS Lead Alerts",
          impact: "medium",
          description: "Get instant SMS/Push pings as soon as an urgent or emergency job is posted in your service postcode sector.",
          actionType: "activate_priority_alerts",
          actionLabel: "⚡ Activate Priority Alerts"
        });
      }

      if (!profile.hasActiveAdCampaign) {
        suggestions.push({
          id: "sug_sub_ad_studio",
          category: "subscriptions",
          title: "Top-Spot Search Placement via Ad Studio",
          impact: "medium",
          description: "Pin your profile to the top spot in homeowner search results across your local town. Featured directory profiles average 4.2x more quote views.",
          actionType: "explore_ads",
          actionLabel: "📢 View Ad Studio"
        });
      }
    }
  }

  const healthScore = Math.max(10, Math.min(100, points));
  const status: "optimized" | "needs_attention" | "critical_gaps" =
    healthScore >= 90 ? "optimized" : healthScore >= 60 ? "needs_attention" : "critical_gaps";

  const auditResult: ProfileAuditResult = {
    lastAuditedAt: new Date().toISOString(),
    healthScore,
    status,
    totalSuggestions: suggestions.length,
    unreadSuggestionsCount: suggestions.length,
    summary:
      status === "optimized"
        ? "Your profile is fully optimized and ready for maximum job matching!"
        : `AI found ${suggestions.length} improvement(s) to boost your profile readiness and job match rate.`,
    suggestions,
    professionalBioDraft,
    recommendedSkillsToAdd: recommendedSkillsToAdd.slice(0, 6),
    auditType
  };

  // Dispatch In-App Notification if suggestions exist
  if (suggestions.length > 0 && profile.uid) {
    try {
      await sendNotification(
        profile.uid,
        "✨ Profile Optimization Suggestions Available",
        `Our AI Coach found ${suggestions.length} simple ways to improve your profile & match score for local jobs.`,
        "profile_optimization",
        "/profile#ai-profile-optimizer"
      );
    } catch (notifErr) {
      console.warn("Could not dispatch profile optimization notification:", notifErr);
    }
  }

  // Persist audit state to user document in Firestore
  if (profile.uid) {
    try {
      const userRef = doc(db, "users", profile.uid);
      await updateDoc(userRef, {
        aiProfileAudit: auditResult,
        updatedAt: serverTimestamp()
      });
    } catch (dbErr) {
      console.warn("Could not persist aiProfileAudit to Firestore user doc:", dbErr);
    }
  }

  // Log to AI Agent Audit Logs
  try {
    await addDoc(collection(db, "ai_agent_audit_logs"), {
      agentType: "profile_optimization_coach",
      action: "PROFILE_AUDITED",
      details: `Audited ${profile.role || "user"} ${profile.name || profile.uid}`,
      summary: `Health Score: ${healthScore}%. ${suggestions.length} suggestions generated.`,
      timestamp: new Date().toISOString(),
      status: "success",
      triggerSource: auditType
    });
  } catch (auditLogErr) {
    console.warn("Could not record agent audit log:", auditLogErr);
  }

  return auditResult;
}

/**
 * Fallback generator for clean, professional bio text
 */
function generateDefaultProfessionalBio(profile: any): string {
  const name = profile.name || profile.businessName || "Experienced Trader";
  const trades = (profile.trades || [profile.trade || "Trade Professional"]).join(", ");
  const location = profile.postcode || profile.city || "the local region";

  return `Professional ${trades} serving homeowners across ${location}. Focused on delivering high-quality workmanship, transparent upfront pricing, and clean, reliable service on every project. Fully insured and available for planned works and emergency repairs.`;
}
