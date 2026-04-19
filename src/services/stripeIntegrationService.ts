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
