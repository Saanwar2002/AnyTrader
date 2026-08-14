/**
 * Flash Deals Capacity & Status Utilities
 */

export interface FlashDeal {
  id: string;
  traderId: string;
  traderName: string;
  traderBusinessName?: string;
  traderAvatarUrl?: string;
  service: string;
  category?: string;
  discountPercentage: number;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  dayOfWeek: string;
  description?: string;
  status: "active" | "sold_out" | "paused";
  maxClaims?: number | null; // null or undefined means unlimited
  claimedCount?: number; // default 0
  createdAt: string;
  updatedAt?: string;
  city?: string;
  postcode?: string;
  rating?: number;
  totalReviews?: number;
}

export const isDealSoldOut = (deal: any): boolean => {
  if (!deal) return false;
  if (deal.status === "sold_out") return true;
  if (deal.maxClaims === null || deal.maxClaims === "unlimited") return false;
  const max = typeof deal.maxClaims === "number" && deal.maxClaims > 0 ? deal.maxClaims : 5;
  const claims = Number(deal.claimedCount) || 0;
  return claims >= max;
};

export const isDealPaused = (deal: any): boolean => {
  if (!deal) return false;
  return deal.status === "paused";
};

export const isDealActive = (deal: any): boolean => {
  if (!deal) return false;
  if (isDealPaused(deal)) return false;
  if (isDealSoldOut(deal)) return false;
  return true;
};

export const getRemainingSlots = (deal: any): number | null => {
  if (!deal) return 5;
  if (deal.maxClaims === null || deal.maxClaims === "unlimited" || deal.maxClaims === 0) {
    return null; // Unlimited
  }
  const max = typeof deal.maxClaims === "number" && deal.maxClaims > 0 ? deal.maxClaims : 5;
  const claims = Number(deal.claimedCount) || 0;
  return Math.max(0, max - claims);
};

export interface DealCapacityInfo {
  max: number | null;
  claimed: number;
  remaining: number | null;
  isUnlimited: boolean;
  isSoldOut: boolean;
  progressPct: number;
  badgeText: string;
  statusText: string;
}

export const getDealCapacityInfo = (deal: any): DealCapacityInfo => {
  if (!deal) {
    return {
      max: 5,
      claimed: 0,
      remaining: 5,
      isUnlimited: false,
      isSoldOut: false,
      progressPct: 0,
      badgeText: "🔥 5 of 5 Left",
      statusText: "5 bookings max per day"
    };
  }

  const isExplicitUnlimited = deal.maxClaims === null || deal.maxClaims === "unlimited" || deal.maxClaims === 0;

  if (isExplicitUnlimited) {
    const claimed = Number(deal.claimedCount) || 0;
    const isSoldOut = deal.status === "sold_out";
    return {
      max: null,
      claimed,
      remaining: null,
      isUnlimited: true,
      isSoldOut,
      progressPct: 0,
      badgeText: isSoldOut ? "🔴 Sold Out" : "⚡ Unlimited Deals",
      statusText: isSoldOut ? "Deal paused / closed" : "No booking limit today"
    };
  }

  const max = typeof deal.maxClaims === "number" && deal.maxClaims > 0 ? deal.maxClaims : 5;
  const claimed = typeof deal.claimedCount === "number" ? Math.max(0, deal.claimedCount) : 0;
  const remaining = Math.max(0, max - claimed);
  const isSoldOut = deal.status === "sold_out" || remaining === 0;
  const progressPct = Math.min(100, Math.round((claimed / max) * 100));

  let badgeText = `🔥 ${remaining} of ${max} Left`;
  if (isSoldOut) {
    badgeText = `🔴 Sold Out (${max}/${max} Booked)`;
  } else if (remaining === 1) {
    badgeText = `🔥 Only 1 Left (Max ${max}/day)`;
  } else {
    badgeText = `🔥 ${remaining} of ${max} Left (Cap: ${max})`;
  }

  return {
    max,
    claimed,
    remaining,
    isUnlimited: false,
    isSoldOut,
    progressPct,
    badgeText,
    statusText: isSoldOut ? `Daily limit of ${max} reached` : `${remaining} of ${max} spots remaining today`
  };
};
