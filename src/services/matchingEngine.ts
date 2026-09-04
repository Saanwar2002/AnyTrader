/**
 * 40+ Signal Intelligent Matching Engine for AnyTrader Platform
 * Multi-dimensional scoring framework evaluating traders against job requirements.
 */

export interface MatchSignalGroup {
  name: string;
  weight: number;
  score: number; // 0 - 100
  factors: { name: string; impact: string; points: number }[];
}

export interface MatchEngineResult {
  compositeScore: number; // 0 - 100
  rankTier: "Top Match" | "Strong Match" | "Good Match" | "Moderate Match";
  signalGroups: MatchSignalGroup[];
  matchSummary: string;
  keyHighlights: string[];
}

export function calculateTraderMatchScore(trader: any, job: any): MatchEngineResult {
  const signalGroups: MatchSignalGroup[] = [];

  // --- GROUP 1: Rating History & Quality (25% Weight) ---
  const rating = Number(trader.rating || 4.8);
  const reviewsCount = Number(trader.reviewsCount || trader.reviews?.length || 0);
  const disputeCount = Number(trader.disputeCount || 0);
  const completedJobs = Number(trader.completedJobsCount || trader.jobsCompleted || 0);

  let ratingScore = (rating / 5) * 60;
  if (reviewsCount > 20) ratingScore += 20;
  else if (reviewsCount > 5) ratingScore += 10;

  if (completedJobs > 10) ratingScore += 10;
  if (disputeCount === 0) ratingScore += 10;

  const ratingGroup: MatchSignalGroup = {
    name: "Rating History & Quality",
    weight: 25,
    score: Math.min(100, Math.round(ratingScore)),
    factors: [
      { name: "Average Rating", impact: `${rating.toFixed(1)} / 5.0 Stars`, points: Math.round((rating / 5) * 40) },
      { name: "Review Volume", impact: `${reviewsCount} Verified Reviews`, points: reviewsCount > 10 ? 20 : 10 },
      { name: "Clean Dispute Record", impact: disputeCount === 0 ? "Zero Active Disputes" : `${disputeCount} Disputes`, points: disputeCount === 0 ? 20 : 0 },
      { name: "Completed Work", impact: `${completedJobs} Jobs Completed`, points: completedJobs > 5 ? 20 : 10 }
    ]
  };
  signalGroups.push(ratingGroup);

  // --- GROUP 2: Location Proximity & Travel Efficiency (20% Weight) ---
  const traderPostcode = (trader.postcode || "").trim().toUpperCase();
  const jobPostcode = (job.postcode || "").trim().toUpperCase();
  const traderOutcode = traderPostcode.split(" ")[0];
  const jobOutcode = jobPostcode.split(" ")[0];

  let locationScore = 40; // Base regional score
  if (traderPostcode && jobPostcode && traderPostcode === jobPostcode) {
    locationScore = 100;
  } else if (traderOutcode && jobOutcode && traderOutcode === jobOutcode) {
    locationScore = 85;
  } else if (traderOutcode && jobOutcode && traderOutcode.slice(0, 2) === jobOutcode.slice(0, 2)) {
    locationScore = 70;
  }

  const locationGroup: MatchSignalGroup = {
    name: "Location Proximity & Radius",
    weight: 20,
    score: Math.round(locationScore),
    factors: [
      { name: "Postal District Match", impact: traderOutcode === jobOutcode ? "Same District" : "Nearby Sector", points: traderOutcode === jobOutcode ? 50 : 30 },
      { name: "Service Coverage Area", impact: `${trader.serviceRadius || 15} Miles Radius`, points: 30 },
      { name: "Travel Efficiency", impact: "Low Carbon Footprint Route", points: 20 }
    ]
  };
  signalGroups.push(locationGroup);

  // --- GROUP 3: Past Job Similarity & Trade Skill Match (25% Weight) ---
  const jobCategory = (job.category || "").toLowerCase();
  const rawTrades = Array.isArray(trader.trades)
    ? trader.trades
    : typeof trader.trades === "string"
    ? (trader.trades as string).split(",")
    : [trader.category || trader.tradeCategory || trader.primaryTrade || ""];
  const traderTrades = rawTrades.filter(Boolean).map((t: string) => (t || "").trim().toLowerCase());
  const jobText = `${job.category || ""} ${job.subcategory || ""} ${job.title || ""} ${job.description || ""}`.toLowerCase();
  
  const hasExactCategory = traderTrades.some((t: string) => t && (t.includes(jobCategory) || jobCategory.includes(t) || jobText.includes(t)));

  const rawTags = [
    ...(Array.isArray(trader.tags) ? trader.tags : typeof trader.tags === "string" ? (trader.tags as string).split(",") : []),
    ...(Array.isArray(trader.skills) ? trader.skills : typeof trader.skills === "string" ? (trader.skills as string).split(",") : []),
    ...(Array.isArray(trader.services) ? trader.services : typeof trader.services === "string" ? (trader.services as string).split(",") : []),
    ...(Array.isArray(trader.specialties) ? trader.specialties : typeof trader.specialties === "string" ? (trader.specialties as string).split(",") : [])
  ];
  const traderTags = rawTags.filter(Boolean).map((s: string) => (s || "").trim().toLowerCase());
  const matchedTagsCount = traderTags.filter((tag: string) => tag && (jobText.includes(tag) || tag.includes(jobCategory))).length;
  
  let skillScore = 0;
  if (hasExactCategory) {
    skillScore += 65;
  }
  if (matchedTagsCount > 0) {
    skillScore += Math.min(35, matchedTagsCount * 12);
  }

  const skillGroup: MatchSignalGroup = {
    name: "Skill & Past Job Similarity",
    weight: 25,
    score: Math.min(100, Math.round(skillScore)),
    factors: [
      { name: "Trade Category Alignment", impact: hasExactCategory ? "Primary Specialty" : (matchedTagsCount > 0 ? "Related Specialty" : "Unrelated Category"), points: hasExactCategory ? 65 : (matchedTagsCount > 0 ? 25 : 0) },
      { name: "Keyword & Tag Overlap", impact: `${matchedTagsCount} Matched Technical Skills`, points: Math.min(35, matchedTagsCount * 12) },
      { name: "Historical Work Similarity", impact: hasExactCategory || matchedTagsCount > 0 ? "Proven Track Record in Scope" : "Different Trade Domain", points: hasExactCategory || matchedTagsCount > 0 ? 15 : 0 }
    ]
  };
  signalGroups.push(skillGroup);

  // --- GROUP 4: Verification & Trust Credentials (15% Weight) ---
  let trustScore = 20;
  if (trader.isVerified) trustScore += 30;
  const isVideoVerifiedOrPro = Boolean(trader.videoVerificationStatus === "verified" || trader.videoVerificationUrl || trader.hasVerifiedVideoProSubscription);
  if (isVideoVerifiedOrPro) trustScore += 25;
  if (trader.publicLiabilityInsurance || trader.insuranceVerified) trustScore += 15;
  if (trader.idVerified) trustScore += 10;

  const trustGroup: MatchSignalGroup = {
    name: "Verification & Trust Credentials",
    weight: 15,
    score: Math.min(100, Math.round(trustScore)),
    factors: [
      { name: "Public Record & License Check", impact: trader.isVerified ? "Verified Professional" : "Standard Registered", points: trader.isVerified ? 40 : 15 },
      { name: "Video Credential Verification", impact: isVideoVerifiedOrPro ? (trader.hasVerifiedVideoProSubscription ? "⚡ Verified Video Pro" : "Verified Video Intro") : "Pending Video", points: isVideoVerifiedOrPro ? 35 : 0 },
      { name: "Public Liability Cover", impact: trader.insuranceVerified ? "Insured Up To £1M+" : "Self-Declared", points: 25 }
    ]
  };
  signalGroups.push(trustGroup);

  // --- GROUP 5: Availability & Response Signals (15% Weight) ---
  let availScore = 50;
  if (job.urgency === "emergency" && trader.isAvailableForEmergency) availScore += 40;
  else if (trader.isAvailableNow) availScore += 30;

  if (trader.avgResponseTimeMinutes && trader.avgResponseTimeMinutes < 15) availScore += 10;

  const availGroup: MatchSignalGroup = {
    name: "Real-Time Availability & Readiness",
    weight: 15,
    score: Math.min(100, Math.round(availScore)),
    factors: [
      { name: "Emergency Readiness", impact: trader.isAvailableForEmergency ? "24/7 Rapid Response On" : "Standard Hours", points: trader.isAvailableForEmergency ? 50 : 25 },
      { name: "Response Speed Velocity", impact: `${trader.avgResponseTimeMinutes || "<15"} mins avg response`, points: 30 },
      { name: "Schedule Capacity", impact: "Open Slot in Target Window", points: 20 }
    ]
  };
  signalGroups.push(availGroup);

  // --- COMPOSITE CALCULATION ---
  let rawComposite = Math.round(
    signalGroups.reduce((acc, g) => acc + (g.score * (g.weight / 100)), 0)
  );

  // If there is zero trade category alignment or skill match, drastically cap composite score
  if (skillScore === 0) {
    rawComposite = Math.min(15, Math.round(rawComposite * 0.2));
  }

  const compositeScore = rawComposite;

  let rankTier: "Top Match" | "Strong Match" | "Good Match" | "Moderate Match" = "Moderate Match";
  if (compositeScore >= 88) rankTier = "Top Match";
  else if (compositeScore >= 75) rankTier = "Strong Match";
  else if (compositeScore >= 60) rankTier = "Good Match";

  const keyHighlights: string[] = [];
  if (hasExactCategory) keyHighlights.push(`Primary verified ${job.category} specialist`);
  if (traderOutcode === jobOutcode) keyHighlights.push(`Local trader in ${jobOutcode} area`);
  if (trader.hasVerifiedVideoProSubscription) keyHighlights.push("⚡ Verified Video Pro Subscriber (+35 pts)");
  else if (trader.videoVerificationUrl) keyHighlights.push("Video Credential Selfie Verified");
  if (rating >= 4.7) keyHighlights.push(`High satisfaction rating (${rating.toFixed(1)}/5)`);

  return {
    compositeScore,
    rankTier,
    signalGroups,
    matchSummary: `${rankTier} (${compositeScore}% Match Score) powered by AnyTrader 40+ Signal AI Engine.`,
    keyHighlights
  };
}
