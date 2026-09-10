/**
 * SERVER-AUTHORITATIVE PRICING CATALOG & PAYMENT RESOLVER
 * Ensures zero client-side price tampering for subscriptions, add-ons, and fees.
 * Enforces the core platform financial constraint:
 * "Platform does NOT hold any client money into platform accounts.
 *  Only payment coming to platform account is commission and fees for add-ons, paid features etc.
 *  All client money (escrow milestones, ride fares) is handled through Stripe Connect."
 */

import { BadRequestError, ForbiddenError, NotFoundError } from "./httpErrors.ts";
import { normalizeTraderTier } from "../services/stripeIntegrationService.ts";

export interface CatalogItem {
  id: string;
  name: string;
  amountPence: number; // In minor units (pence)
  currency: string;
  mode: "subscription" | "payment";
  interval?: "month" | "year";
  description?: string;
}

export const SERVER_PRICING_CATALOG: Record<string, CatalogItem> = {
  // Free / PAYG
  price_payg: {
    id: "price_payg",
    name: "Free Explorer Plan",
    amountPence: 0,
    currency: "gbp",
    mode: "subscription",
  },
  // Tradesperson Subscription Tiers
  price_pro: {
    id: "price_pro",
    name: "Silver Pro Subscription",
    amountPence: 2900, // £29.00
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "Pro platform subscription with instant quote access and lower commissions",
  },
  price_premium: {
    id: "price_premium",
    name: "Gold Elite Subscription",
    amountPence: 4900, // £49.00
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "Premium tier with top placement, priority dispatch, and lowest fees",
  },
  price_platinum: {
    id: "price_platinum",
    name: "Platinum Enterprise Powerhouse",
    amountPence: 9900, // £99.00
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "Full enterprise trader suite with unlimited leads and team seats",
  },
  // Landlord Subscription
  price_landlord: {
    id: "price_landlord",
    name: "Landlord Pro Portfolio Membership",
    amountPence: 1900, // £19.00
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "Multi-property digital twins, compliance alerts & 1-tap dispatch",
  },
  // Driver Subscription
  price_driver_gold: {
    id: "price_driver_gold",
    name: "Gold Driver Subscription",
    amountPence: 4999, // £49.99
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "Reduced 10% commission rate and 4 destination filters",
  },

  // Add-ons
  price_exclusive_leads: {
    id: "price_exclusive_leads",
    name: "Exclusive Priority Lead Dispatch",
    amountPence: 1500, // £15.00
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "30-minute exclusive head start on incoming matching quote requests",
  },
  price_video_pro: {
    id: "price_video_pro",
    name: "Verified Video Pro Add-on",
    amountPence: 1000, // £10.00
    currency: "gbp",
    mode: "subscription",
    interval: "month",
    description: "+35 match score points and verified video selfie badge",
  },
  price_video_pro_annual: {
    id: "price_video_pro_annual",
    name: "Verified Video Pro (Annual)",
    amountPence: 9600, // £96.00/yr (£8/mo)
    currency: "gbp",
    mode: "subscription",
    interval: "year",
    description: "Annual verified video pro membership with 20% discount",
  },

  // One-off Platform Fees
  price_emergency_boost: {
    id: "price_emergency_boost",
    name: "Emergency Dispatch Priority Boost",
    amountPence: 499, // £4.99
    currency: "gbp",
    mode: "payment",
    description: "4-hour priority emergency broadcast to nearby active tradespeople",
  },
  price_instant_match: {
    id: "price_instant_match",
    name: "Instant Match Dispatch Fee",
    amountPence: 299, // £2.99
    currency: "gbp",
    mode: "payment",
    description: "Automated instant trader matching and direct dispatch",
  },
  price_dispute_stake: {
    id: "price_dispute_stake",
    name: "Dispute Mediation Stake",
    amountPence: 2500, // £25.00
    currency: "gbp",
    mode: "payment",
    description: "Independent dispute arbitration and technical assessment deposit",
  },
};

/**
 * Calculates server-authoritative pricing for B2B Social Housing ("Gotham") SaaS subscriptions.
 */
export function calculateGothamSaaSPlanServer(
  doors: number,
  billingCycle: "monthly" | "annual" = "monthly"
): {
  doorsCount: number;
  ratePerDoor: number;
  monthlyTotalPence: number;
  annualTotalPence: number;
  chargeAmountPence: number;
  tierName: string;
} {
  const safeDoors = Math.max(1, Math.min(100000, Math.floor(Number(doors) || 100)));
  let ratePerDoor = 4.50; // Starter: 1-100 doors
  let tierName = "Starter Housing Authority";

  if (safeDoors > 1000) {
    ratePerDoor = 2.50; // Enterprise: 1,001+ doors
    tierName = "Enterprise Housing Authority";
  } else if (safeDoors > 100) {
    ratePerDoor = 3.50; // Growth: 101-1,000 doors
    tierName = "Growth Housing Authority";
  }

  const monthlyTotal = safeDoors * ratePerDoor;
  const annualTotal = Math.round(monthlyTotal * 12 * 0.85); // 15% discount for annual billing

  const monthlyTotalPence = Math.round(monthlyTotal * 100);
  const annualTotalPence = Math.round(annualTotal * 100);

  const chargeAmountPence = billingCycle === "annual" ? annualTotalPence : monthlyTotalPence;

  return {
    doorsCount: safeDoors,
    ratePerDoor,
    monthlyTotalPence,
    annualTotalPence,
    chargeAmountPence,
    tierName,
  };
}

export interface AuthoritativeLineItemResult {
  lineItem: any;
  mode: "subscription" | "payment";
  metadata: Record<string, string>;
  isClientMoney: boolean;
  paymentIntentData?: {
    application_fee_amount: number;
    transfer_data: {
      destination: string;
    };
    metadata?: Record<string, string>;
  };
  authoritativeAmountPence: number;
}

/**
 * Loads dynamic platform configuration saved by platform admins in Firestore.
 * Caches briefly in memory per DB instance to avoid Firestore read amplification while staying responsive to admin updates.
 */
const firestoreConfigCache = new WeakMap<object, {
  globalTiers?: any;
  globalConfig?: any;
  lastFetched?: number;
}>();

export async function getDynamicFirestoreConfigs(firestoreDb: any): Promise<{
  globalTiers: any;
  globalConfig: any;
}> {
  if (!firestoreDb || typeof firestoreDb !== "object") {
    return { globalTiers: null, globalConfig: null };
  }

  const now = Date.now();
  const cached = firestoreConfigCache.get(firestoreDb);
  if (cached?.lastFetched && now - cached.lastFetched < 5000) {
    return {
      globalTiers: cached.globalTiers,
      globalConfig: cached.globalConfig,
    };
  }

  try {
    const [tiersDoc, globalDoc] = await Promise.all([
      firestoreDb.collection("platform_config").doc("global_tiers").get().catch(() => null),
      firestoreDb.collection("platform_config").doc("global").get().catch(() => null),
    ]);

    const globalTiers = tiersDoc?.exists ? (typeof tiersDoc.data === "function" ? tiersDoc.data() : tiersDoc.data) : null;
    const globalConfig = globalDoc?.exists ? (typeof globalDoc.data === "function" ? globalDoc.data() : globalDoc.data) : null;

    firestoreConfigCache.set(firestoreDb, { globalTiers, globalConfig, lastFetched: now });
    return { globalTiers, globalConfig };
  } catch {
    return { globalTiers: null, globalConfig: null };
  }
}

/**
 * Resolves the server-authoritative line item and Stripe Connect routing
 * based strictly on validated server state. DISCARDS client-provided prices.
 */
export async function resolveAuthoritativeLineItem(
  body: any,
  authUid: string,
  firestoreDb: any
): Promise<AuthoritativeLineItemResult> {
  const metadata = body.metadata || {};
  const mode = body.mode || "subscription";

  // Load dynamic admin-managed configs from Firestore (falls back gracefully to SERVER_PRICING_CATALOG if unset)
  const { globalTiers, globalConfig } = await getDynamicFirestoreConfigs(firestoreDb);

  // =========================================================================
  // 1. CLIENT MONEY: Tradesperson Milestone Escrow Funding
  // =========================================================================
  if (metadata.type === "milestone_funding") {
    const { jobId, quoteId, milestoneId } = metadata;
    if (!jobId || !quoteId || !milestoneId) {
      throw new BadRequestError("Milestone funding requires jobId, quoteId, and milestoneId in metadata");
    }

    if (!firestoreDb) {
      throw new BadRequestError("Database unavailable for milestone verification");
    }

    const jobDoc = await firestoreDb.collection("jobs").doc(jobId).get();
    if (!jobDoc.exists) throw new NotFoundError(`Job '${jobId}' not found`);
    const jobData = jobDoc.data();

    // Verify caller is the job owner/homeowner
    const isOwner = jobData?.homeownerId === authUid || jobData?.userId === authUid;
    if (!isOwner) {
      throw new ForbiddenError("Only the job owner can fund milestone escrow payments");
    }

    const quoteRef = firestoreDb.collection("jobs").doc(jobId).collection("quotes").doc(quoteId);
    const quoteDoc = await quoteRef.get();
    if (!quoteDoc.exists) throw new NotFoundError(`Quote '${quoteId}' not found`);
    const quoteData = quoteDoc.data();

    const milestones = quoteData?.milestones || [];
    const targetMilestone = milestones.find((m: any) => m.id === milestoneId);
    if (!targetMilestone) {
      throw new NotFoundError(`Milestone '${milestoneId}' not found in quote`);
    }

    // State machine check: cannot fund an already funded, released, or cancelled milestone
    const currentStatus = targetMilestone.status || "pending";
    if (currentStatus !== "pending") {
      throw new BadRequestError(`Cannot fund milestone in status '${currentStatus}'. Must be 'pending'.`);
    }

    // Authoritative milestone price from DB (DISCARD client amount)
    const rawMilestoneAmount = Number(targetMilestone.amount || targetMilestone.verifiedAmount);
    if (isNaN(rawMilestoneAmount) || rawMilestoneAmount <= 0) {
      throw new BadRequestError("Milestone has invalid or non-positive amount in database");
    }
    const milestoneAmountPence = Math.round(rawMilestoneAmount * 100);

    // Fetch tradesperson's connected Stripe account
    const traderId = quoteData.tradespersonId;
    if (!traderId) {
      throw new BadRequestError("Quote does not have an assigned tradesperson ID");
    }

    const traderDoc = await firestoreDb.collection("users").doc(traderId).get();
    const traderData = traderDoc.data() || {};
    const traderStripeAccountId = traderData.stripeAccountId;

    // Platform constraint check: Client money MUST flow directly to the tradesperson's Stripe Connect account
    // Platform only receives the commission via application_fee_amount
    const isDevMock = process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_PAYMENTS === "true";
    const destinationAccount = traderStripeAccountId || (isDevMock ? `acct_mock_${traderId}` : null);

    if (!destinationAccount && !isDevMock) {
      throw new BadRequestError(
        "Tradesperson has not connected their Stripe account to receive milestone escrow payments. Work with tradesperson to complete Stripe onboarding."
      );
    }

    // Platform commission calculation (standard 12% or tier rate)
    // Checks Firestore platform_config/global_tiers or platform_config/global first
    const traderTier = traderData.tier || traderData.tierId || "payg";
    const normalizedTier = normalizeTraderTier(traderTier);
    let commissionRate = 0.12; // Standard default 12%

    const dynamicCommission = globalTiers?.providerModels?.one_off_trades?.tiers?.[normalizedTier]?.commission;
    if (typeof dynamicCommission === "number" && !isNaN(dynamicCommission) && dynamicCommission >= 0) {
      commissionRate = dynamicCommission > 1 ? dynamicCommission / 100 : dynamicCommission;
    } else {
      if (normalizedTier === "pro") commissionRate = 0.035; // 3.5%
      else if (normalizedTier === "premium") commissionRate = 0.025; // 2.5%
      else if (normalizedTier === "platinum") commissionRate = 0.015; // 1.5%
    }

    const platformFeePence = Math.min(
      Math.round(milestoneAmountPence * commissionRate),
      25000 // £250 cap
    );
    const netPayoutPence = milestoneAmountPence - platformFeePence;

    return {
      mode: "payment",
      isClientMoney: true,
      authoritativeAmountPence: milestoneAmountPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: milestoneAmountPence,
          product_data: {
            name: `Milestone: ${targetMilestone.title || "Project Stage"}`,
            description: `Escrow stage payment for Job #${jobData.jobNo || jobId}. Net funds routed directly to tradesperson via Stripe Connect.`,
          },
        },
        quantity: 1,
      },
      paymentIntentData: destinationAccount
        ? {
            application_fee_amount: platformFeePence,
            transfer_data: {
              destination: destinationAccount,
            },
            metadata: {
              jobId,
              quoteId,
              milestoneId,
              traderId,
              type: "milestone_funding",
              platformFeePence: platformFeePence.toString(),
              netPayoutPence: netPayoutPence.toString(),
            },
          }
        : undefined,
      metadata: {
        type: "milestone_funding",
        jobId,
        quoteId,
        milestoneId,
        traderId,
        milestoneAmountPence: milestoneAmountPence.toString(),
        platformFeePence: platformFeePence.toString(),
        netPayoutPence: netPayoutPence.toString(),
        userId: authUid,
      },
    };
  }

  // =========================================================================
  // 2. B2B SaaS METERED BILLING ("Gotham" Housing Portal)
  // =========================================================================
  if (
    metadata.type === "gotham_saas" ||
    metadata.subscriptionType === "gotham_saas" ||
    body.tierName?.toLowerCase().includes("gotham")
  ) {
    const doors = Number(metadata.gothamDoorsCount || body.doorsCount || 100);
    const cycle = (metadata.gothamBillingCycle || "monthly") as "monthly" | "annual";
    const gothamPlan = calculateGothamSaaSPlanServer(doors, cycle);

    return {
      mode: "subscription",
      isClientMoney: false,
      authoritativeAmountPence: gothamPlan.chargeAmountPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: gothamPlan.chargeAmountPence,
          recurring: { interval: cycle === "annual" ? "year" : "month" },
          product_data: {
            name: `${gothamPlan.tierName} (${gothamPlan.doorsCount} Doors)`,
            description: `TradeOS Gotham B2B SaaS Layer (£${gothamPlan.ratePerDoor.toFixed(2)}/door/mo). 1-tap contractor dispatch, compliance automation & digital twin management.`,
          },
        },
        quantity: 1,
      },
      metadata: {
        type: "gotham_saas",
        subscriptionType: "gotham_saas",
        gothamDoorsCount: gothamPlan.doorsCount.toString(),
        gothamTierName: gothamPlan.tierName,
        gothamBillingCycle: cycle,
        ratePerDoor: gothamPlan.ratePerDoor.toString(),
        chargeAmountPence: gothamPlan.chargeAmountPence.toString(),
        userId: authUid,
      },
    };
  }

  // =========================================================================
  // 3. AD WALLET TOPUP (Bounded Advertising Balance)
  // =========================================================================
  if (metadata.type === "ad_wallet_topup") {
    const rawTopup = Number(metadata.topupAmount || body.price_data?.unit_amount / 100 || 25);
    // Sanitize to valid integer bounds: min £10, max £5,000
    const sanitizedPounds = Math.max(10, Math.min(5000, Math.round(rawTopup)));
    const topupPence = sanitizedPounds * 100;

    return {
      mode: "payment",
      isClientMoney: false,
      authoritativeAmountPence: topupPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: topupPence,
          product_data: {
            name: "Trades Ad Studio Wallet Top-up",
            description: `Pre-paid advertising credit for TradeOS Search & Category Banners (£${sanitizedPounds}.00 balance credit).`,
          },
        },
        quantity: 1,
      },
      metadata: {
        type: "ad_wallet_topup",
        topupAmount: sanitizedPounds.toString(),
        topupPence: topupPence.toString(),
        userId: authUid,
      },
    };
  }

  // =========================================================================
  // 4. DISPUTE MEDIATION STAKE (£25.00)
  // =========================================================================
  if (metadata.type === "mediation_stake" || body.priceId === "price_dispute_stake") {
    const catalogItem = SERVER_PRICING_CATALOG.price_dispute_stake;
    const dynamicStake = Number(globalConfig?.paidAddons?.milestoneEscrow?.homeownerMediationStake);
    const resolvedAmountPence = (!isNaN(dynamicStake) && dynamicStake > 0)
      ? Math.round(dynamicStake * 100)
      : catalogItem.amountPence;

    return {
      mode: "payment",
      isClientMoney: false,
      authoritativeAmountPence: resolvedAmountPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: resolvedAmountPence,
          product_data: {
            name: catalogItem.name,
            description: catalogItem.description,
          },
        },
        quantity: 1,
      },
      metadata: {
        type: "mediation_stake",
        jobId: metadata.jobId || "",
        disputeReason: metadata.disputeReason || "Unspecified",
        technicalFaultReport: metadata.technicalFaultReport || "Unspecified",
        userId: authUid,
      },
    };
  }

  // =========================================================================
  // 5. PRIORITY BOOSTS (Emergency £4.99, Instant Match £2.99)
  // =========================================================================
  if (metadata.type === "boost" || metadata.tier === "emergency_boost" || body.priceId === "price_emergency_boost") {
    const isInstantMatch = metadata.tier === "instant_match" || body.priceId === "price_instant_match";
    const catalogItem = isInstantMatch
      ? SERVER_PRICING_CATALOG.price_instant_match
      : SERVER_PRICING_CATALOG.price_emergency_boost;

    const dynamicPrice = isInstantMatch
      ? Number(globalConfig?.paidAddons?.instantMatch?.price || globalConfig?.instantMatchFee)
      : Number(globalConfig?.paidAddons?.emergencyBoost?.price || globalConfig?.emergencyBoostFee);

    const resolvedAmountPence = (!isNaN(dynamicPrice) && dynamicPrice > 0)
      ? Math.round(dynamicPrice * 100)
      : catalogItem.amountPence;

    return {
      mode: "payment",
      isClientMoney: false,
      authoritativeAmountPence: resolvedAmountPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: resolvedAmountPence,
          product_data: {
            name: catalogItem.name,
            description: catalogItem.description,
          },
        },
        quantity: 1,
      },
      metadata: {
        type: "boost",
        tier: isInstantMatch ? "instant_match" : "emergency_boost",
        jobId: metadata.jobId || "",
        userId: authUid,
      },
    };
  }

  // =========================================================================
  // 6. ADD-ONS: Exclusive Leads (£15/mo), Verified Video Pro (£10/mo or £96/yr)
  // =========================================================================
  if (metadata.isExclusiveAddon === "true" || metadata.type === "exclusive_leads" || body.priceId === "price_exclusive_leads") {
    const catalogItem = SERVER_PRICING_CATALOG.price_exclusive_leads;
    const dynamicPrice = Number(globalConfig?.paidAddons?.exclusiveLeads?.price || globalConfig?.exclusiveLeadsFee);
    const resolvedAmountPence = (!isNaN(dynamicPrice) && dynamicPrice > 0)
      ? Math.round(dynamicPrice * 100)
      : catalogItem.amountPence;

    return {
      mode: "subscription",
      isClientMoney: false,
      authoritativeAmountPence: resolvedAmountPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: resolvedAmountPence,
          recurring: { interval: "month" },
          product_data: {
            name: catalogItem.name,
            description: catalogItem.description,
          },
        },
        quantity: 1,
      },
      metadata: {
        isExclusiveAddon: "true",
        type: "exclusive_leads",
        userId: authUid,
      },
    };
  }

  if (metadata.isVideoPro === "true" || metadata.type === "video_pro_subscription" || body.priceId === "price_video_pro") {
    const isAnnual = metadata.billingCycle === "annual";
    const catalogItem = isAnnual
      ? SERVER_PRICING_CATALOG.price_video_pro_annual
      : SERVER_PRICING_CATALOG.price_video_pro;

    const dynamicMonthly = Number(globalConfig?.paidAddons?.verifiedVideoPro?.monthlyPrice);
    const dynamicAnnual = Number(globalConfig?.paidAddons?.verifiedVideoPro?.annualPrice);
    const dynamicPrice = isAnnual ? dynamicAnnual : dynamicMonthly;
    const resolvedAmountPence = (!isNaN(dynamicPrice) && dynamicPrice > 0)
      ? Math.round(dynamicPrice * 100)
      : catalogItem.amountPence;

    return {
      mode: "subscription",
      isClientMoney: false,
      authoritativeAmountPence: resolvedAmountPence,
      lineItem: {
        price_data: {
          currency: "gbp",
          unit_amount: resolvedAmountPence,
          recurring: { interval: isAnnual ? "year" : "month" },
          product_data: {
            name: catalogItem.name,
            description: catalogItem.description,
          },
        },
        quantity: 1,
      },
      metadata: {
        isVideoPro: "true",
        type: "video_pro_subscription",
        billingCycle: isAnnual ? "annual" : "monthly",
        userId: authUid,
      },
    };
  }

  // =========================================================================
  // 7. MEMBERSHIP TIERS (Landlord Pro, Driver Gold, Trader Pro/Premium/Platinum)
  // =========================================================================
  const rawTier = (body.tierName || metadata.tierName || metadata.tier || body.priceId || "Pro").toString();
  const lowerTier = rawTier.toLowerCase();

  let matchedCatalogKey = "price_pro";
  let canonicalTier = "pro";

  if (
    lowerTier.includes("landlord") ||
    metadata.subscriptionType === "landlord" ||
    body.priceId === "price_landlord"
  ) {
    matchedCatalogKey = "price_landlord";
    canonicalTier = "landlord";
  } else if (
    lowerTier.includes("gold driver") ||
    metadata.subscriptionType === "driver_gold" ||
    body.priceId === "price_driver_gold"
  ) {
    matchedCatalogKey = "price_driver_gold";
    canonicalTier = "driver_gold";
  } else if (lowerTier.includes("platinum") || lowerTier.includes("enterprise powerhouse") || body.priceId === "price_platinum") {
    matchedCatalogKey = "price_platinum";
    canonicalTier = "platinum";
  } else if (lowerTier.includes("gold") || lowerTier.includes("elite") || lowerTier.includes("premium") || body.priceId === "price_premium") {
    matchedCatalogKey = "price_premium";
    canonicalTier = "premium";
  } else if (lowerTier.includes("silver") || lowerTier.includes("pro") || lowerTier.includes("professional") || body.priceId === "price_pro") {
    matchedCatalogKey = "price_pro";
    canonicalTier = "pro";
  } else if (lowerTier.includes("payg") || lowerTier.includes("free") || body.priceId === "price_payg") {
    matchedCatalogKey = "price_payg";
    canonicalTier = "payg";
  }

  const catalogItem = SERVER_PRICING_CATALOG[matchedCatalogKey];
  if (!catalogItem) {
    throw new BadRequestError(`Unrecognized pricing tier or priceId: '${rawTier}'`);
  }

  // Check Firestore admin tier pricing overrides
  let dynamicTierPrice = NaN;
  if (canonicalTier === "landlord") {
    dynamicTierPrice = Number(globalTiers?.providerModels?.homeowners?.tiers?.landlord?.price);
  } else if (canonicalTier === "driver_gold") {
    dynamicTierPrice = Number(globalTiers?.providerModels?.on_demand_transport?.tiers?.gold?.price);
  } else if (canonicalTier === "pro" || canonicalTier === "premium" || canonicalTier === "platinum") {
    dynamicTierPrice = Number(
      globalTiers?.providerModels?.one_off_trades?.tiers?.[canonicalTier]?.price ??
      globalConfig?.feeTiers?.find((t: any) => normalizeTraderTier(t.name) === canonicalTier)?.price
    );
  }

  const resolvedAmountPence = (!isNaN(dynamicTierPrice) && dynamicTierPrice >= 0)
    ? Math.round(dynamicTierPrice * 100)
    : catalogItem.amountPence;

  return {
    mode: "subscription",
    isClientMoney: false,
    authoritativeAmountPence: resolvedAmountPence,
    lineItem: {
      price_data: {
        currency: "gbp",
        unit_amount: resolvedAmountPence,
        recurring: { interval: "month" },
        product_data: {
          name: catalogItem.name,
          description: catalogItem.description || `Platform subscription tier: ${catalogItem.name}`,
        },
      },
      quantity: 1,
    },
    metadata: {
      tierName: catalogItem.name,
      tier: canonicalTier,
      subscriptionType: canonicalTier === "landlord" ? "landlord" : canonicalTier === "driver_gold" ? "driver_gold" : "tier",
      userId: authUid,
      ...metadata,
    },
  };
}
