import { useMemo } from "react";
import { useAuth } from "../components/AuthProvider";
import { usePortal } from "./PortalContext";

// Tier Configurations based on Super App Blueprint Phase 2
// These should ideally sync from platform_config/global but we define the schema here

export type ProviderTierName = 'PAYG' | 'Silver Professional' | 'Gold Elite' | 'Platinum Enterprise';
export type CustomerTierName = 'Free' | 'AnyTrader Plus';

export interface ProviderTierEntitlements {
  leadFeeDiscountPerc: number;
  leadAccessDelayMinutes: number;
  quotesPerMonth: number | 'unlimited';
  portfolioPhotoLimit: number | 'unlimited';
  hasVideoPortfolio: boolean;
  hasBasicAnalytics: boolean;
  hasAdvancedAnalytics: boolean;
  hasScheduling: boolean;
  hasBrandedInvoicing: boolean;
  hasTaxReports: boolean;
  hasCRM: boolean;
  hasApiAccess: boolean;
  teamSeats: number;
  searchRankBoost: number;
  rideCommissionPerc: number;
  rideDispatchPriority: number;
  surgeCapMultiplier: number | null;
  propertyLimit: number | 'unlimited';
}

export const PROVIDER_TIERS: Record<ProviderTierName, ProviderTierEntitlements> = {
  'PAYG': {
    leadFeeDiscountPerc: 0,
    leadAccessDelayMinutes: 120, // 2 hours
    quotesPerMonth: 10,
    portfolioPhotoLimit: 5,
    hasVideoPortfolio: false,
    hasBasicAnalytics: false,
    hasAdvancedAnalytics: false,
    hasScheduling: false,
    hasBrandedInvoicing: false,
    hasTaxReports: false,
    hasCRM: false,
    hasApiAccess: false,
    teamSeats: 1,
    searchRankBoost: 0,
    rideCommissionPerc: 15,
    rideDispatchPriority: 0,
    surgeCapMultiplier: null,
    propertyLimit: 3
  },
  'Silver Professional': {
    leadFeeDiscountPerc: 25,
    leadAccessDelayMinutes: 30,
    quotesPerMonth: 50,
    portfolioPhotoLimit: 25,
    hasVideoPortfolio: true,
    hasBasicAnalytics: true,
    hasAdvancedAnalytics: false,
    hasScheduling: true,
    hasBrandedInvoicing: false,
    hasTaxReports: false,
    hasCRM: false,
    hasApiAccess: false,
    teamSeats: 1,
    searchRankBoost: 10,
    rideCommissionPerc: 12,
    rideDispatchPriority: 10,
    surgeCapMultiplier: null,
    propertyLimit: 10
  },
  'Gold Elite': {
    leadFeeDiscountPerc: 40,
    leadAccessDelayMinutes: 0,
    quotesPerMonth: 'unlimited',
    portfolioPhotoLimit: 'unlimited',
    hasVideoPortfolio: true,
    hasBasicAnalytics: true,
    hasAdvancedAnalytics: true,
    hasScheduling: true,
    hasBrandedInvoicing: true,
    hasTaxReports: true,
    hasCRM: false,
    hasApiAccess: false,
    teamSeats: 3,
    searchRankBoost: 20,
    rideCommissionPerc: 10,
    rideDispatchPriority: 20,
    surgeCapMultiplier: 1.5,
    propertyLimit: 50
  },
  'Platinum Enterprise': {
    leadFeeDiscountPerc: 50,
    leadAccessDelayMinutes: 0,
    quotesPerMonth: 'unlimited',
    portfolioPhotoLimit: 'unlimited',
    hasVideoPortfolio: true,
    hasBasicAnalytics: true,
    hasAdvancedAnalytics: true,
    hasScheduling: true,
    hasBrandedInvoicing: true,
    hasTaxReports: true,
    hasCRM: true,
    hasApiAccess: true,
    teamSeats: 10,
    searchRankBoost: 30,
    rideCommissionPerc: 8,
    rideDispatchPriority: 30,
    surgeCapMultiplier: 1.3,
    propertyLimit: 'unlimited'
  }
};

export const resolveTier = (profile: any): ProviderTierName => {
  if (!profile) return 'PAYG';
  
  const rawTier = String(profile.tierId || profile.tier || profile.subscriptionType || '');
  const lower = rawTier.toLowerCase();

  // Founding member reward maps to Silver Professional
  if (profile.isFoundingMember && (rawTier === "Free Trial" || !rawTier)) {
      return 'Silver Professional';
  }
  
  if (lower.includes('platinum') || lower.includes('enterprise powerhouse') || lower.includes('enterprise') || lower === 'platinum') {
    return 'Platinum Enterprise';
  }
  if (lower.includes('gold') || lower.includes('elite') || lower.includes('premium') || lower.includes('business professional')) {
    return 'Gold Elite';
  }
  if (lower.includes('silver') || lower.includes('pro') || lower.includes('professional') || lower === 'pro') {
    return 'Silver Professional';
  }
  
  return 'PAYG';
};

export function useEntitlements() {
  const { profile } = useAuth();
  const { activeRole } = usePortal();

  return useMemo(() => {
    const currentTierName = resolveTier(profile);
    const entitlements = PROVIDER_TIERS[currentTierName];

    // Computed Helpers
    const getCalculatedLeadFee = (baseFeeInPence: number) => {
      const discountMult = 1 - (entitlements.leadFeeDiscountPerc / 100);
      return Math.round(baseFeeInPence * discountMult);
    };

    const getCalculatedCommission = (rideFareInPence: number) => {
      const commMult = entitlements.rideCommissionPerc / 100;
      return Math.round(rideFareInPence * commMult);
    };

    const canBypassLeadDelay = (jobCreationTimeMs: number) => {
      if (entitlements.leadAccessDelayMinutes === 0) return true;
      const delayMs = entitlements.leadAccessDelayMinutes * 60 * 1000;
      return Date.now() - jobCreationTimeMs > delayMs;
    };

    const canSendQuote = (quotesUsedThisMonth: number) => {
      if (entitlements.quotesPerMonth === 'unlimited') return true;
      return quotesUsedThisMonth < entitlements.quotesPerMonth;
    };

    return {
      tierName: currentTierName,
      entitlements,
      // Helper methods for easy UI blocking & calculations
      getCalculatedLeadFee,
      getCalculatedCommission,
      canBypassLeadDelay,
      canSendQuote,
    };
  }, [profile, activeRole]);
}
