import { db } from "@/src/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface SubscriptionStatus {
    canPostJob: boolean;
    canQuote: boolean;
    tier: string;
    model: string;
}

export interface GothamSaaSPlan {
    tierId: "starter" | "growth" | "enterprise";
    tierName: string;
    ratePerDoor: number; // e.g., 4.50, 3.50, 2.50
    effectiveRatePerDoor: number;
    billingCycle: "monthly" | "annual";
    totalUnits: number;
    monthlyFee: number;
    annualTotal: number;
    annualDiscountSavings: number;
    estimatedAdminHoursSaved: number;
    estimatedRegulatorFineSavings: number;
    features: string[];
}

export function calculateGothamSaaSPlan(totalUnits: number, billingCycle: "monthly" | "annual" = "monthly"): GothamSaaSPlan {
    let tierId: "starter" | "growth" | "enterprise" = "starter";
    let tierName = "Starter Portfolio";
    let ratePerDoor = 4.50; // £4.50 / door / mo
    let features = [
        "Automated Repair Dispatch Engine",
        "CP12 & EICR Compliance Tracker",
        "Digital Property Passport Integration",
        "Tenant Repair Reporting Bridge"
    ];

    if (totalUnits > 1000) {
        tierId = "enterprise";
        tierName = "Gotham Enterprise & Council";
        ratePerDoor = 2.50; // £2.50 / door / mo
        features = [
            "Everything in Growth Association",
            "Unlimited Block Inspection Auto-Dispatch",
            "Awaab's Law Damp & Mould 24h SLA Engine",
            "Custom Housing Regulator Audit Exports",
            "Dedicated Account Manager & 2h SLA Guarantee",
            "Consolidated Monthly Stripe Invoicing (Net 30)"
        ];
    } else if (totalUnits > 100) {
        tierId = "growth";
        tierName = "Growth Association";
        ratePerDoor = 3.50; // £3.50 / door / mo
        features = [
            "Everything in Starter Portfolio",
            "Awaab's Law 24h Damp & Mould SLA Engine",
            "Approved Contractor Performance Matrix",
            "Priority Contractor Allocation",
            "Multi-Block Portfolio Reporting"
        ];
    }

    const discountMultiplier = billingCycle === "annual" ? 0.85 : 1.0;
    const effectiveRatePerDoor = ratePerDoor * discountMultiplier;
    const monthlyFee = totalUnits * effectiveRatePerDoor;
    const annualTotal = monthlyFee * 12;
    const annualDiscountSavings = billingCycle === "annual" ? totalUnits * ratePerDoor * 0.15 * 12 : totalUnits * ratePerDoor * 0.15 * 12;

    // ROI estimation formulas
    const estimatedAdminHoursSaved = Math.round(totalUnits * 0.18); // ~0.18 hrs saved per unit/month
    const estimatedRegulatorFineSavings = Math.round(totalUnits * 14.5); // £14.50 per unit in avoided compliance penalties

    return {
        tierId,
        tierName,
        ratePerDoor,
        effectiveRatePerDoor,
        billingCycle,
        totalUnits,
        monthlyFee,
        annualTotal,
        annualDiscountSavings,
        estimatedAdminHoursSaved,
        estimatedRegulatorFineSavings,
        features
    };
}

export async function getSubscriptionStatus(userId: string, providerModel: string): Promise<SubscriptionStatus> {
    const userSnapshot = await getDoc(doc(db, "users", userId));
    const configSnapshot = await getDoc(doc(db, "platform_config", "global_tiers"));

    if (!userSnapshot.exists() || !configSnapshot.exists()) {
        return { canPostJob: false, canQuote: false, tier: "basic", model: providerModel };
    }

    const userData = userSnapshot.data();
    const configData = configSnapshot.data();
    
    // In our blueprint, tiers are indexed by model
    const modelConfig = configData.providerModels[providerModel];
    const userTier = userData.subscription?.tierId || "basic";
    const tierConfig = modelConfig.tiers[userTier];

    // Placeholder logic - this would be expanded based on the tier configuration
    return {
        canPostJob: true, // simplified for now
        canQuote: true,
        tier: userTier,
        model: providerModel
    };
}

