import { db } from "@/src/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface SubscriptionStatus {
    canPostJob: boolean;
    canQuote: boolean;
    tier: string;
    model: string;
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
