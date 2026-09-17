import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Security Remediation H2 — Advertisements Budget & State Integrity Audit", () => {
  const rulesCode = fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf-8");
  const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");
  const partnerAdCode = fs.readFileSync(path.resolve(__dirname, "../../src/components/shared/PartnerAdvertisement.tsx"), "utf-8");
  const bannerAdStudioCode = fs.readFileSync(path.resolve(__dirname, "../../src/components/TradesBannerAdStudio.tsx"), "utf-8");
  const traderAdStudioCode = fs.readFileSync(path.resolve(__dirname, "../../src/components/TraderAdStudio.tsx"), "utf-8");
  const findTradesCode = fs.readFileSync(path.resolve(__dirname, "../../src/components/FindTrades.tsx"), "utf-8");

  describe("1. Firestore Security Rules Hardening for /advertisements/{adId}", () => {
    it("restricts advertisement creation to signed-in owners with initial zero balance and unapproved state", () => {
      expect(rulesCode).toContain("match /advertisements/{adId}");
      expect(rulesCode).toContain("request.resource.data.advertiserUid == request.auth.uid");
      expect(rulesCode).toContain("request.resource.data.get('isActive', false) == false");
      expect(rulesCode).toContain("request.resource.data.get('approvalStatus', 'pending') == 'pending'");
      expect(rulesCode).toContain("request.resource.data.get('prepaidBalance', 0) == 0");
    });

    it("strictly isolates protected financial & state fields from client updates", () => {
      // Must contain affectedKeys check forbidding sensitive fields
      expect(rulesCode).toContain("'prepaidBalance'");
      expect(rulesCode).toContain("'isActive'");
      expect(rulesCode).toContain("'lastAutoTopUpAt'");
      expect(rulesCode).toContain("'approvalStatus'");
      expect(rulesCode).toContain("'totalBudget'");
      expect(rulesCode).toContain("'totalCost'");
      expect(rulesCode).toContain("'advertiserUid'");
      expect(rulesCode).toContain("'advertiserId'");
    });

    it("enforces controlled monotonic engagement tracking (+1 step max, no decrement)", () => {
      expect(rulesCode).toContain("hasOnly([\n              'clicks', 'bannerClicks', 'searchFeedClicks', 'impressions'\n            ])");
      expect(rulesCode).toContain("request.resource.data.clicks >= resource.data.get('clicks', 0)");
      expect(rulesCode).toContain("request.resource.data.clicks <= resource.data.get('clicks', 0) + 1");
      expect(rulesCode).toContain("request.resource.data.bannerClicks >= resource.data.get('bannerClicks', 0)");
      expect(rulesCode).toContain("request.resource.data.bannerClicks <= resource.data.get('bannerClicks', 0) + 1");
    });

    it("strictly validates ownership on ad deletion", () => {
      expect(rulesCode).toMatch(/allow delete: if isAdmin\(\) \|\| \(\s*isSignedIn\(\) && \(resource\.data\.advertiserUid == request\.auth\.uid \|\| resource\.data\.get\('advertiserId', ''\) == request\.auth\.uid\)\s*\);/);
    });
  });

  describe("2. Server-Authoritative Endpoints in server.ts", () => {
    it("implements /api/ads/:id/toggle-active with authentication, ownership, and approval validation", () => {
      expect(serverCode).toContain('app.post("/api/ads/:id/toggle-active", requireAuth,');
      expect(serverCode).toContain("adData.advertiserUid === authUid || adData.advertiserId === authUid");
      expect(serverCode).toContain('adData.approvalStatus !== "approved"');
      expect(serverCode).toContain("isActive: nextActive");
    });

    it("implements /api/ads/create-banner with wallet balance verification and atomic deduction", () => {
      expect(serverCode).toContain('app.post("/api/ads/create-banner", requireAuth,');
      expect(serverCode).toContain("currentWallet < totalCost");
      expect(serverCode).toContain("adWalletBalance: admin.firestore.FieldValue.increment(-totalCost)");
      expect(serverCode).toContain("type: \"trader_promo\"");
    });

    it("implements /api/ads/:id/topup with wallet balance verification and atomic credit", () => {
      expect(serverCode).toContain('app.post("/api/ads/:id/topup", requireAuth, paymentLimiter,');
      expect(serverCode).toContain("currentWallet < topupAmount");
      expect(serverCode).toContain("prepaidBalance: admin.firestore.FieldValue.increment(topupAmount)");
    });
  });

  describe("3. Client Components Safety Audit", () => {
    it("PartnerAdvertisement.tsx only updates engagement counters and never client-side balance", () => {
      expect(partnerAdCode).not.toContain("updateData.prepaidBalance");
      expect(partnerAdCode).not.toContain("updateData.lastAutoTopUpAt");
      expect(partnerAdCode).toContain("updateDoc(doc(db, \"advertisements\", clickedAd.id), updateData)");
    });

    it("FindTrades.tsx only updates engagement counters", () => {
      expect(findTradesCode).toContain("clicks: increment(1)");
      expect(findTradesCode).toContain("searchFeedClicks: increment(1)");
      expect(findTradesCode).not.toContain("prepaidBalance: increment");
    });

    it("TradesBannerAdStudio.tsx uses /api/ads/create-banner and /api/ads/:id/toggle-active", () => {
      expect(bannerAdStudioCode).toContain('fetch("/api/ads/create-banner"');
      expect(bannerAdStudioCode).toContain('fetch(`/api/ads/${ad.id}/toggle-active`');
    });

    it("TraderAdStudio.tsx uses /api/ads/:id/topup and /api/ads/:id/toggle-active", () => {
      expect(traderAdStudioCode).toContain('fetch(`/api/ads/${adId}/topup`');
      expect(traderAdStudioCode).toContain('fetch(`/api/ads/${ad.id}/toggle-active`');
    });
  });
});
