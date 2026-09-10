import { describe, it, expect } from "vitest";
import { resolveAuthoritativeLineItem, SERVER_PRICING_CATALOG, calculateGothamSaaSPlanServer } from "../../src/server/pricingCatalog";

describe("Stripe Connect & Financial Flow Invariants", () => {
  it("enforces that all platform catalog products route 100% of fees to platform account", async () => {
    const catalogEntries = [
      { body: { metadata: { type: "boost", tier: "emergency_boost" } }, expectedAmount: 499 },
      { body: { metadata: { type: "boost", tier: "instant_match" } }, expectedAmount: 299 },
      { body: { priceId: "price_landlord" }, expectedAmount: 1900 },
      { body: { priceId: "price_pro" }, expectedAmount: 2900 },
      { body: { priceId: "price_premium" }, expectedAmount: 4900 },
      { body: { priceId: "price_driver_gold" }, expectedAmount: 4999 },
      { body: { metadata: { type: "mediation_stake" } }, expectedAmount: 2500 },
      { body: { priceId: "price_video_pro" }, expectedAmount: 1000 },
      { body: { priceId: "price_exclusive_leads" }, expectedAmount: 1500 },
    ];

    for (const item of catalogEntries) {
      const lineItem = await resolveAuthoritativeLineItem(item.body, "user_test_123", undefined);
      expect(lineItem.authoritativeAmountPence).toBe(item.expectedAmount);
      expect(lineItem.lineItem.price_data.currency).toBe("gbp");
      // Platform owns these products: NEVER client money
      expect(lineItem.isClientMoney).toBe(false);
      expect(lineItem.paymentIntentData).toBeUndefined();
    }
  });

  it("strictly enforces Stripe Connect destination routing when handling Client Money (milestone escrow)", async () => {
    const traderStripeAccountId = "acct_1NZX456789ABCDEF";

    // Mock Firestore DB for milestone lookup
    const mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (col === "jobs") {
              return {
                exists: true,
                data: () => ({ homeownerId: "cust_111", jobNo: "1001" })
              };
            }
            if (col === "users") {
              return {
                exists: true,
                data: () => ({ stripeAccountId: traderStripeAccountId, tier: "payg" })
              };
            }
            return { exists: false };
          },
          collection: () => ({
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({
                  tradespersonId: "trader_999",
                  milestones: [
                    { id: "m1", title: "Phase 1 - Prep", amount: 500.00, status: "pending" }
                  ]
                })
              })
            })
          })
        })
      })
    };

    const lineItem = await resolveAuthoritativeLineItem({
      metadata: {
        type: "milestone_funding",
        jobId: "job_xyz_123",
        quoteId: "quote_456",
        milestoneId: "m1"
      }
    }, "cust_111", mockDb);

    expect(lineItem.authoritativeAmountPence).toBe(50000);
    expect(lineItem.isClientMoney).toBe(true);

    // Platform NEVER holds client funds:
    // Destination charge routes directly to the tradesperson's connected account
    expect(lineItem.paymentIntentData).toBeDefined();
    expect(lineItem.paymentIntentData?.transfer_data?.destination).toBe(traderStripeAccountId);
    
    // Platform fee is deducted automatically by Stripe as application_fee_amount (12% of £500 = £60)
    expect(lineItem.paymentIntentData?.application_fee_amount).toBe(6000);
  });

  it("calculates volume-tiered B2B Gotham SaaS monthly licensing accurately", () => {
    // 50 doors @ £4.50 = £225.00 (22500p)
    const tier1 = calculateGothamSaaSPlanServer(50, "monthly");
    expect(tier1.chargeAmountPence).toBe(22500);

    // 200 doors @ £3.50 = £700.00 (70000p)
    const tier2 = calculateGothamSaaSPlanServer(200, "monthly");
    expect(tier2.chargeAmountPence).toBe(70000);

    // 1500 doors @ £2.50 = £3,750.00 (375000p)
    const tier3 = calculateGothamSaaSPlanServer(1500, "monthly");
    expect(tier3.chargeAmountPence).toBe(375000);
  });

  it("prevents client-side price tampering by ignoring arbitrary client inputs", async () => {
    // Malicious attacker sends £1.00 for emergency boost
    const tamperedPayload = {
      metadata: {
        type: "boost",
        tier: "emergency_boost",
      },
      price_data: {
        unit_amount: 100, // Attacker tries £1.00
      },
      amount: 1.00,
      customAmount: 1
    };

    const authoritative = await resolveAuthoritativeLineItem(tamperedPayload, "attacker_uid", undefined);
    // Server must strictly return the catalog price (£4.99 = 499p)
    expect(authoritative.authoritativeAmountPence).toBe(499);
  });

  it("prevents client-side price tampering on dispute mediation stake", async () => {
    // Malicious attacker attempts to pay £0.01 for dispute mediation
    const tamperedPayload = {
      metadata: {
        type: "mediation_stake",
      },
      price_data: {
        unit_amount: 1
      },
      amount: 0.01,
    };

    const authoritative = await resolveAuthoritativeLineItem(tamperedPayload, "attacker_uid", undefined);
    // Server must strictly return £25.00 (2500p)
    expect(authoritative.authoritativeAmountPence).toBe(2500);
  });

  it("authoritatively honors dynamic admin pricing and commission overrides saved in Firestore", async () => {
    // Mock Firestore containing custom admin-configured pricing in platform_config
    const mockDbWithAdminOverrides = {
      collection: (col: string) => ({
        doc: (docId: string) => ({
          get: async () => {
            if (col === "platform_config" && docId === "global_tiers") {
              return {
                exists: true,
                data: () => ({
                  providerModels: {
                    one_off_trades: {
                      tiers: {
                        pro: { price: 35.00, commission: 0.02 }, // Admin customized Pro to £35/mo and 2% commission
                      }
                    }
                  }
                })
              };
            }
            if (col === "platform_config" && docId === "global") {
              return {
                exists: true,
                data: () => ({
                  paidAddons: {
                    emergencyBoost: { price: 7.50 }, // Admin customized Emergency Boost to £7.50
                  }
                })
              };
            }
            if (col === "jobs" && docId === "job_override_1") {
              return {
                exists: true,
                data: () => ({ homeownerId: "cust_override", jobNo: "9001" })
              };
            }
            if (col === "users" && docId === "trader_pro_override") {
              return {
                exists: true,
                data: () => ({ stripeAccountId: "acct_trader_pro_custom", tier: "pro" })
              };
            }
            return { exists: false };
          },
          collection: () => ({
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({
                  tradespersonId: "trader_pro_override",
                  milestones: [
                    { id: "m_custom", title: "Custom Stage", amount: 1000.00, status: "pending" }
                  ]
                })
              })
            })
          })
        })
      })
    };

    // 1. Subscription tier price dynamically honors admin's £35.00 override
    const proSubResult = await resolveAuthoritativeLineItem({
      priceId: "price_pro",
    }, "trader_pro_user", mockDbWithAdminOverrides);
    expect(proSubResult.authoritativeAmountPence).toBe(3500); // £35.00

    // 2. Emergency boost dynamically honors admin's £7.50 override
    const boostResult = await resolveAuthoritativeLineItem({
      metadata: { type: "boost", tier: "emergency_boost" },
      price_data: { unit_amount: 100 } // Attacker attempts to tamper, ignored!
    }, "homeowner_user", mockDbWithAdminOverrides);
    expect(boostResult.authoritativeAmountPence).toBe(750); // £7.50

    // 3. Milestone escrow funding calculates 2% commission based on admin's tier override
    const milestoneResult = await resolveAuthoritativeLineItem({
      metadata: {
        type: "milestone_funding",
        jobId: "job_override_1",
        quoteId: "quote_override_1",
        milestoneId: "m_custom"
      }
    }, "cust_override", mockDbWithAdminOverrides);
    expect(milestoneResult.authoritativeAmountPence).toBe(100000); // £1,000.00
    // 2% of £1,000 = £20.00 (2000p)
    expect(milestoneResult.paymentIntentData?.application_fee_amount).toBe(2000);
  });
});
