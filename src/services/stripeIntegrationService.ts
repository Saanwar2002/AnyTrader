import { db } from "@/src/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

/**
 * STRIPE INTEGRATION SERVICE
 * This service handles the business logic for the Dual-Rail Payment System.
 * Shared between AnyTrader Home and AnyTrader Rides.
 */

export const STRIPE_CONFIG = {
  CARD_FEE_PERCENT: 0.024, // 2.4% standard card fee
  CARD_FEE_FLAT: 0.20,     // 20p flat fee
  BANK_TRANSFER_FEE_MAX: 10.00, // Capped at £10 for large jobs
  BANK_TRANSFER_FEE_PERCENT: 0.005, // 0.5% for bank pay
  COMMISSION_CAP: 250.00,   // Max platform commission per job
  PAYMENT_RAIL_THRESHOLD: 400.00, // Jobs >= 400 use Bank Transfer
};

export interface PayoutBreakdown {
  grossAmount: number;
  stripeFee: number;
  platformCommission: number;
  netPayout: number;
  paymentRail: 'card' | 'bank_transfer';
}

/**
 * Calculates the financial breakdown for a quote based on the user's tier.
 */
export function calculatePayoutBreakdown(amount: number, tier: string = 'payg'): PayoutBreakdown {
  const isLargeJob = amount >= STRIPE_CONFIG.PAYMENT_RAIL_THRESHOLD;
  const paymentRail = isLargeJob ? 'bank_transfer' : 'card';

  // 1. Calculate Stripe Fee
  let stripeFee = 0;
  if (isLargeJob) {
    stripeFee = Math.min(amount * STRIPE_CONFIG.BANK_TRANSFER_FEE_PERCENT, STRIPE_CONFIG.BANK_TRANSFER_FEE_MAX);
  } else {
    stripeFee = (amount * STRIPE_CONFIG.CARD_FEE_PERCENT) + STRIPE_CONFIG.CARD_FEE_FLAT;
  }

  // 2. Calculate Platform Commission based on Tier
  let commissionRate = 0.15; // Default PAYG
  if (tier === 'pro') commissionRate = 0.10;
  if (tier === 'premium') commissionRate = 0.05;
  if (tier === 'platinum') commissionRate = 0.03; // Ultra low for big builders

  let platformCommission = Math.min(amount * commissionRate, STRIPE_CONFIG.COMMISSION_CAP);

  // 3. Final Net
  const netPayout = amount - stripeFee - platformCommission;

  return {
    grossAmount: amount,
    stripeFee,
    platformCommission,
    netPayout,
    paymentRail
  };
}

export interface VerifiedVideoProPlan {
  monthlyPrice: number; // £15.00
  annualPrice: number; // £144.00 (saving £36/yr)
  billingCycle: "monthly" | "annual";
  matchScoreBonus: number; // +35 points
  hasPriorityQuotePositioning: boolean;
  hasVideoSelfieHosting: boolean;
  badgeLabel: string;
  features: string[];
}

/**
 * Verified Trader Credential & Video Badge Subscription (£15/mo)
 * - Grants traders +35 match score points
  * - Priority quote positioning on homeowner comparison screens
  * - HD Video Selfie & Credential hosting
 */
export function calculateVerifiedVideoProSubscription(billingCycle: "monthly" | "annual" = "monthly"): VerifiedVideoProPlan {
  const monthlyPrice = 15.00;
  const annualPrice = 144.00; // £12/mo effective rate (20% discount)
  
  return {
    monthlyPrice: billingCycle === "monthly" ? monthlyPrice : 12.00,
    annualPrice,
    billingCycle,
    matchScoreBonus: 35,
    hasPriorityQuotePositioning: true,
    hasVideoSelfieHosting: true,
    badgeLabel: "Verified Video Pro",
    features: [
      "⚡ +35 Match Score Points in 40+ Signal Intelligent Matching Engine",
      "🚀 Priority Quote Positioning (Top Placement on Homeowner Feeds)",
      "📹 HD 15-60s Live Video Selfie & Credential Video Hosting",
      "🏅 Verified Video Pro Gold Trust Badge on Profile & Quotes",
      "📈 3x Higher Homeowner Quote Conversion Rate"
    ]
  };
}

export interface FlexiPayMerchantFeeBreakdown {
  financedAmount: number;
  termMonths: number;
  merchantFeeRate: number; // e.g. 0.025 (2.5%), 0.020 (2.0%), 0.015 (1.5%)
  merchantFeeAmount: number; // e.g. £80.00
  provider: string; // e.g. "Klarna / TradeOS 0% Flexi" | "Novuna Personal Finance" | "Clearpay"
  platformRevenueShare: number; // 100% of origination fee goes to TradeOS platform
  traderGuaranteedPayout: number; // Full job payout to tradesperson without non-payment risk
}

export interface MaterialMerchantAffiliateBreakdown {
  materialTotal: number;
  merchantName: string;
  affiliateRate: number; // 3.0% to 5.0%
  affiliateCommissionAmount: number; // Fee earned by TradeOS
  traderDiscountRate: number; // 5% trade discount for trader
  traderDiscountAmount: number;
  traderDiscountCode: string;
  affiliateNetwork: string;
  itemCount: number;
}

/**
 * Calculates Materials Sourcing & Merchant Affiliate Referral Commission (3% - 5%)
 * collected by TradeOS when traders source materials from partner merchants.
 * - Travis Perkins & Jewson: 5.0% affiliate referral commission
 * - Toolstation & Selco: 4.5% affiliate referral commission
 * - Screwfix Trade: 4.0% affiliate referral commission
 * - B&Q TradePoint & Wickes: 3.5% affiliate referral commission
 */
export function calculateMaterialMerchantAffiliateCommission(
  materialTotal: number,
  merchantName: string = "Screwfix",
  itemCount: number = 1
): MaterialMerchantAffiliateBreakdown {
  let affiliateRate = 0.040; // Default 4.0%
  const lowerMerchant = merchantName.toLowerCase();

  if (lowerMerchant.includes("travis") || lowerMerchant.includes("jewson")) {
    affiliateRate = 0.050; // 5.0% top tier
  } else if (lowerMerchant.includes("toolstation") || lowerMerchant.includes("selco")) {
    affiliateRate = 0.045; // 4.5% tier
  } else if (lowerMerchant.includes("screwfix")) {
    affiliateRate = 0.040; // 4.0% standard trade tier
  } else if (lowerMerchant.includes("b&q") || lowerMerchant.includes("tradepoint") || lowerMerchant.includes("wickes")) {
    affiliateRate = 0.035; // 3.5% DIY trade tier
  } else {
    affiliateRate = 0.030; // 3.0% general merchant tier
  }

  const affiliateCommissionAmount = Math.round(materialTotal * affiliateRate * 100) / 100;
  const traderDiscountRate = 0.05; // 5% exclusive trade perk for trader
  const traderDiscountAmount = Math.round(materialTotal * traderDiscountRate * 100) / 100;

  const merchantClean = merchantName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 8) || "TRADE";
  const traderDiscountCode = `TRADEOS-${merchantClean}-5OFF`;

  return {
    materialTotal,
    merchantName,
    affiliateRate,
    affiliateCommissionAmount,
    traderDiscountRate,
    traderDiscountAmount,
    traderDiscountCode,
    affiliateNetwork: "TradeOS Merchant Connect / Awin Network",
    itemCount
  };
}

/**
 * Calculates the FlexiPay BNPL Merchant Origination Fee (1.5% - 2.5%) charged to the financing partner.
 * - Short Term (3-6 Months 0% APR): 2.5% merchant origination fee
 * - Standard Term (12 Months): 2.0% merchant origination fee
 * - Heavy Repair Term (24-36 Months): 1.5% merchant origination fee
 */
export function calculateFlexiPayMerchantFee(
  financedAmount: number,
  termMonths: number,
  provider?: string
): FlexiPayMerchantFeeBreakdown {
  let rate = 0.020; // Default 2.0%
  if (termMonths <= 6) {
    rate = 0.025; // 2.5% on 0% APR promo terms
  } else if (termMonths === 12) {
    rate = 0.020; // 2.0% standard term
  } else if (termMonths >= 24) {
    rate = 0.015; // 1.5% long-term volume tier
  }

  const merchantFeeAmount = Math.round(financedAmount * rate * 100) / 100;
  const resolvedProvider = provider || (termMonths <= 6 ? "Klarna / TradeOS 0% Flexi" : "Novuna Personal Finance");

  return {
    financedAmount,
    termMonths,
    merchantFeeRate: rate,
    merchantFeeAmount,
    provider: resolvedProvider,
    platformRevenueShare: merchantFeeAmount,
    traderGuaranteedPayout: financedAmount
  };
}

/**
 * Generates the Stripe Onboarding Link for a trader.
 * In a real app, this calls your backend. Here we simulate the logic.
 */
export async function getStripeOnboardingLink(userId: string) {
  // Simulate API call to backend
  // return await fetch('/api/stripe/onboard', { method: 'POST', body: JSON.stringify({ userId }) });
  
  // For AI Studio demo, we'll return a mock Stripe Connect URL
  return `https://connect.stripe.com/express/onboard/${userId}_mock_session`;
}

/**
 * Marks a trader as onboarded (simulate webhook behavior).
 */
export async function completeStripeOnboarding(userId: string, accountId: string) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    stripeAccountId: accountId,
    stripeOnboardingComplete: true,
    payoutsEnabled: true
  });
}
