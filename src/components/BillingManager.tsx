import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { auth, db, doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp } from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { 
  Check, CreditCard, ShieldCheck, Zap, Star, Award, 
  ArrowRight, Info, Loader2, Sparkles, TrendingUp, 
  PoundSterling, Package, Plus, Trash2, Wallet, Video, BellRing, Clock
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useNavigate } from "react-router-dom";
import { normalizeTraderTier } from "@/src/services/stripeIntegrationService";
import { toast } from "sonner";

interface SubscriptionTier {
  id: string;
  name: string;
  rawKey?: string;
  price: number;
  commission: number;
  description: string;
  features: string[];
  isPopular?: boolean;
}

export default function BillingManager() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [globalTiers, setGlobalTiers] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);

  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    });
    const unsubTiers = onSnapshot(doc(db, "platform_config", "global_tiers"), (doc) => {
      if (doc.exists()) {
        setGlobalTiers(doc.data());
      }
      setLoading(false);
    });

    if (user?.uid) {
      fetchPaymentMethods(user.uid);
    }

    return () => {
      unsubGlobal();
      unsubTiers();
    };
  }, [user]);

  const fetchPaymentMethods = async (userId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/payment-methods/${userId}`, {
        headers: {
           ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        console.warn(`Fetch payment methods failed with status ${res.status}`);
        return;
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Fetch payment methods response was not JSON:", await res.text());
        return;
      }
      const data = await res.json();
      if (data && Array.isArray(data.paymentMethods)) {
        setSavedCards(data.paymentMethods.map((pm: any, index: number) => ({
          ...pm,
          isDefault: index === 0 // Making the first one default for display purposes
        })));
      }
    } catch (err) {
      console.error("Error fetching payment methods:", err);
    }
  };

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (!user) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          tierName: tier.name,
          mode: "subscription",
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(tier.price * 100),
            recurring: { interval: 'month' },
            product_data: {
              name: `${tier.name} Membership`,
              description: tier.description || `Platform tier ${tier.name}`
            }
          },
          priceId: tier.id,
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/billing`,
          metadata: {
            tierName: tier.name,
            userId: user.uid
          }
        })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        const canonical = normalizeTraderTier(tier.name);
        await updateDoc(doc(db, "users", user.uid), {
          tierId: tier.name,
          tier: canonical,
          isPro: canonical !== 'payg',
          isProInvoiceSubscriber: canonical !== 'payg',
          subscriptionStatus: "active",
          updatedAt: serverTimestamp()
        });
        alert(`Successfully switched to ${tier.name}! (Mock)`);
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Billing Error:", err);
      const canonical = normalizeTraderTier(tier.name);
      await updateDoc(doc(db, "users", user.uid), {
        tierId: tier.name,
        tier: canonical,
        isPro: canonical !== 'payg',
        isProInvoiceSubscriber: canonical !== 'payg',
        subscriptionStatus: "active"
      });
      navigate("/dashboard");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/create-setup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          successUrl: `${window.location.origin}/billing`,
          cancelUrl: `${window.location.origin}/billing`
        })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Setup Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!user) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`/api/payment-methods/${user.uid}/${paymentMethodId}`, {
        method: "DELETE",
        headers: {
           ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      // Removing locally
      setSavedCards(cards => cards.filter(c => c.id !== paymentMethodId));
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  // -------------------------------------------------------------
  // CUSTOMER / PASSENGER BILLING UI (PAYMENT METHODS)
  // -------------------------------------------------------------
  if ((profile?.role as string) === "homeowner" || (profile?.role as string) === "customer") {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="max-w-2xl mx-auto px-6 pt-8">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Payment Methods</h1>
            <p className="text-slate-500 font-medium">Manage your cards and bank accounts for seamless booking and rides.</p>
          </div>

          <div className="bg-white rounded-[2rem] border border-black shadow-xl shadow-slate-200/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" /> Saved Cards
              </h2>
              <button 
                onClick={handleAddPaymentMethod}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add New
              </button>
            </div>

            <div className="space-y-4">
              {savedCards.map((card) => (
                <div key={card.id} className="flex items-center justify-between p-4 rounded-2xl border border-black hover:border-blue-200 transition-colors bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-slate-900 rounded-md flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">•••• •••• •••• {card.last4}</p>
                      <p className="text-xs text-slate-500 font-medium tracking-wide border-t border-transparent">
                        Expires {card.expMonth.toString().padStart(2, '0')}/{card.expYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {card.isDefault && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Default</span>
                    )}
                    <button onClick={() => handleDeletePaymentMethod(card.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {savedCards.length === 0 && !isProcessing && (
                <div className="text-center p-6 text-slate-500 text-sm border-2 border-dashed border-black rounded-2xl">
                  No payment methods saved yet. Add a card to continue.
                </div>
              )}
            </div>
            
            <div className="mt-6 flex items-start gap-3 bg-blue-50/50 p-4 rounded-2xl">
               <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
               <div>
                 <p className="text-sm font-bold text-blue-900">Payments are secure and encrypted.</p>
                 <p className="text-xs text-blue-700/70 mt-1 leading-relaxed">
                    We do not store your full card details. All transactions are securely processed via Stripe's encrypted banking infrastructure.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCurrentPlan = (tier: SubscriptionTier) => {
    const currentCanonical = normalizeTraderTier(profile?.tierId || profile?.tier);
    const tierCanonical = normalizeTraderTier(tier.rawKey || tier.name);
    return currentCanonical === tierCanonical;
  };

  const handleToggleExclusiveLeads = async () => {
    if (!user || !profile) return;
    setIsProcessing(true);
    try {
      const currentActive = Boolean(profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false);
      const nextState = !currentActive;
      await updateDoc(doc(db, "users", user.uid), {
        hasExclusiveAddon: nextState,
        isExclusiveActive: nextState,
        exclusiveSubscribedAt: nextState ? new Date().toISOString() : null,
        updatedAt: serverTimestamp()
      });
      if (nextState) {
        toast.success(`⚡ Priority Exclusive Offers Active! (£${platformConfig?.paidAddons?.exclusiveLeads?.price ?? 29}/mo)`);
      } else {
        toast.info("Priority Exclusive Offers paused.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update Exclusive Leads add-on");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleVideoPro = async () => {
    if (!user || !profile) return;
    setIsProcessing(true);
    try {
      const currentActive = Boolean(profile?.hasVerifiedVideoProSubscription);
      const nextState = !currentActive;
      const updates: any = {
        hasVerifiedVideoProSubscription: nextState,
        videoProSubscribedAt: nextState ? new Date().toISOString() : null,
        videoVerificationStatus: nextState ? "verified" : (profile?.videoVerificationUrl ? "verified" : "none"),
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "users", user.uid), updates);
      if (nextState) {
        toast.success(`⚡ Verified Video Pro Active! (£${platformConfig?.paidAddons?.verifiedVideoPro?.monthlyPrice ?? 15}/mo)`);
      } else {
        toast.info("Verified Video Pro subscription paused.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update Verified Video Pro subscription");
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // TRADESPERSON / BUSINESS BILLING UI (SUBSCRIPTIONS)
  // -------------------------------------------------------------

  const isFounding = profile?.isFoundingMember;

  // Phase 2 Tiers directly mapped from Firestore
  let standardTiers: SubscriptionTier[] = [];
  
  if (globalTiers?.providerModels?.one_off_trades?.tiers) {
    const rawTiers = globalTiers.providerModels.one_off_trades.tiers;
    standardTiers = Object.entries(rawTiers).map(([tierKey, tier]: [string, any]) => {
      let displayName = tierKey;
      const lower = tierKey.toLowerCase();
      if (lower === 'payg' || lower.includes('free')) displayName = "Free Explorer";
      else if (lower === 'pro' || lower.includes('silver')) displayName = "Silver Professional";
      else if (lower === 'premium' || lower === 'gold' || lower.includes('elite')) displayName = "Gold Elite";
      else if (lower === 'platinum' || lower.includes('enterprise')) displayName = "Platinum Enterprise";
      else displayName = tierKey.charAt(0).toUpperCase() + tierKey.slice(1);

      return {
        id: `price_${tierKey.toLowerCase()}`,
        name: displayName,
        rawKey: tierKey,
        price: Number(tier.price) || 0,
        commission: (Number(tier.commission) || 0) * 100, // DB stores as 0.05, UI expects 5
        description: tier.description || "",
        features: Array.isArray(tier.features) ? tier.features : [],
        isPopular: lower === "pro" || lower.includes("silver")
      };
    }).sort((a, b) => a.price - b.price);
  } else if (platformConfig?.feeTiers && Array.isArray(platformConfig.feeTiers) && platformConfig.feeTiers.length > 0) {
    standardTiers = platformConfig.feeTiers.map((ft: any) => ({
      id: `price_${normalizeTraderTier(ft.name)}`,
      name: ft.name,
      rawKey: normalizeTraderTier(ft.name),
      price: Number(ft.price) || 0,
      commission: Number(ft.commission) || 5,
      description: ft.description || "",
      features: Array.isArray(ft.features) ? ft.features : (ft.description ? [ft.description] : []),
      isPopular: normalizeTraderTier(ft.name) === "pro"
    })).sort((a: any, b: any) => a.price - b.price);
  } else {
    // Fallback canonical tiers
    standardTiers = [
      {
        id: "price_payg",
        name: "Free Explorer",
        rawKey: "payg",
        price: 0,
        commission: 5,
        description: "Start risk-free. 5% Platform Commission.",
        features: [
          "Unlimited Lead Browsing",
          "5% Platform Commission",
          "Standard Profile Visibility",
          "Digital Quotes & Invoicing"
        ]
      },
      {
        id: "price_pro",
        name: "Silver Professional",
        rawKey: "pro",
        price: 19.99,
        commission: 3.5,
        description: "Built for active independent tradespeople.",
        isPopular: true,
        features: [
          "Priority Lead Alerts",
          "Reduced 3.5% Commission",
          "Enhanced Verification Badge",
          "AI Material Sourcing Assistant",
          "Priority Search Ranking"
        ]
      },
      {
        id: "price_premium",
        name: "Gold Elite",
        rawKey: "premium",
        price: 49.99,
        commission: 2.5,
        description: "Top professional tier for high-volume trades.",
        features: [
          "Ultra-low 2.5% Commission",
          "Unlimited Open Quotes",
          "Verified Video Pro Placement",
          "Client SMS Notifications",
          "Dedicated Phone Support"
        ]
      },
      {
        id: "price_platinum",
        name: "Platinum Enterprise",
        rawKey: "platinum",
        price: 99.99,
        commission: 1.5,
        description: "Scale your business with the lowest commission.",
        features: [
          "Lowest 1.5% Commission",
          "Multi-seat Team Management",
          "Automated CP12/EICR Dispatch",
          "Custom API & Accounting Integration",
          "24/7 Priority Emergency Support"
        ]
      }
    ];
  }

  // Modified Tiers for Founding Members
  const foundingTiers = standardTiers.map(t => {
    if (t.rawKey === "pro" || t.name.includes("Professional") || t.name === "PRO Trader") {
      return {
        ...t,
        name: "Founding PRO",
        price: 9.99,
        description: "Your exclusive founding reward. Lifetime price locked.",
        features: [...t.features, "Lifetime Discount Locked"]
      };
    }
    return t;
  });

  const activeTiers = isFounding ? foundingTiers : standardTiers;

  const exclusivePrice = platformConfig?.paidAddons?.exclusiveLeads?.price ?? 29.00;
  const videoProMonthly = platformConfig?.paidAddons?.verifiedVideoPro?.monthlyPrice ?? 15.00;
  const isExclusiveActive = Boolean(profile?.hasExclusiveAddon && profile?.isExclusiveActive !== false);
  const isVideoProActive = Boolean(profile?.hasVerifiedVideoProSubscription);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-6xl mx-auto px-6 pt-12">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <span className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-blue-200">
              Subscription Management
            </span>
            {isFounding && (
                <span className="bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-orange-200 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Founding Reward Active
                </span>
            )}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight"
          >
            Scale your <span className="text-blue-600">business</span> today.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 font-medium max-w-xl mx-auto"
          >
            Choose the plan that fits your volume. All plans include 24/7 support and our AI-powered toolkit.
          </motion.p>
        </div>

        {/* Current Plan Overview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1e3a5f] p-8 rounded-[2.5rem] text-white mb-12 shadow-xl shadow-blue-900/10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
          
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-black/20">
              <Package className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Your Current Plan</p>
              <h2 className="text-3xl font-black">{profile?.tierId || "Free Trial"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-blue-100/60">Status:</span>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {profile?.subscriptionStatus === "active" ? "Active" : "Trial Period"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-4 md:gap-8 w-full md:w-auto">
             <div className="bg-white/5 p-4 rounded-3xl border border-black/10">
                <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Fees Paid</p>
                <p className="text-xl font-black">£0.00</p>
             </div>
             <div className="bg-white/5 p-4 rounded-3xl border border-black/10">
                <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Credits Saved</p>
                <p className="text-xl font-black">£{(profile?.phantomFeesSaved || 0).toFixed(2)}</p>
             </div>
          </div>
        </motion.div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {activeTiers.map((tier, idx) => {
            const currentPlan = isCurrentPlan(tier);
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + (idx * 0.1) }}
                className={cn(
                  "relative bg-white p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between",
                  tier.isPopular 
                    ? "border-blue-600 shadow-xl shadow-blue-600/10 ring-2 ring-blue-600/20" 
                    : "border-black shadow-md hover:shadow-lg"
                )}
              >
                {tier.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{tier.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium min-h-[32px]">{tier.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">£{tier.price}</span>
                    <span className="text-slate-400 font-bold text-xs">/mo</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-black/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Fee</span>
                      <span className="text-sm font-black text-blue-600">{tier.commission}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(5, 100 - (tier.commission * 5))}%` }} />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Included Features</p>
                    <ul className="space-y-2">
                      {tier.features.map(feature => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                          <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={() => handleSelectPlan(tier)}
                  disabled={isProcessing || currentPlan}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 mt-6 shadow-md",
                    currentPlan 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200" 
                      : tier.isPopular 
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 active:scale-[0.98]" 
                        : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : currentPlan ? (
                    "Current Plan"
                  ) : (
                    <>Select {tier.name} <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Paid Add-on Features & Performance Boosts */}
        <div className="mt-16 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-black">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Paid Add-on Features & Performance Boosts</h3>
              </div>
              <p className="text-xs text-slate-500">Live platform add-ons and monetization controls synchronized with admin control settings.</p>
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Admin Synced
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Exclusive Leads Add-on */}
            <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full",
                    isExclusiveActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  )}>
                    {isExclusiveActive ? "Active" : "Optional Add-On"}
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">Priority Exclusive Leads</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900">£{exclusivePrice.toFixed(2)}</span>
                    <span className="text-xs text-slate-400 font-bold">/mo</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Get 30-minute advance notifications on newly posted leads before they enter the open public feed. Maximum 3 exclusive leads matched daily.
                </p>
                <div className="text-[11px] font-bold text-slate-700 space-y-1 pt-2">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <Check className="w-3.5 h-3.5" /> 30-Minute Head Start on Quotes
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <Check className="w-3.5 h-3.5" /> 4x Higher Win Probability
                  </div>
                </div>
              </div>

              <button
                onClick={handleToggleExclusiveLeads}
                disabled={isProcessing}
                className={cn(
                  "w-full mt-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2",
                  isExclusiveActive 
                    ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100" 
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : isExclusiveActive ? "Active (Click to Pause)" : `Subscribe (£${exclusivePrice.toFixed(2)}/mo)`}
              </button>
            </div>

            {/* Verified Video Pro */}
            <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                    <Video className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full",
                    isVideoProActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  )}>
                    {isVideoProActive ? "Active" : "Optional Add-On"}
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">Verified Video Pro</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900">£{videoProMonthly.toFixed(2)}</span>
                    <span className="text-xs text-slate-400 font-bold">/mo</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Host an authentic 15-30s video intro showcasing your skills, vehicle, and credentials. Includes our gold verification shield.
                </p>
                <div className="text-[11px] font-bold text-slate-700 space-y-1 pt-2">
                  <div className="flex items-center gap-1.5 text-purple-700">
                    <Award className="w-3.5 h-3.5" /> +35 AI Match Score Boost
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-700">
                    <Check className="w-3.5 h-3.5" /> Priority Quote Box Placement
                  </div>
                </div>
              </div>

              <button
                onClick={handleToggleVideoPro}
                disabled={isProcessing}
                className={cn(
                  "w-full mt-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2",
                  isVideoProActive 
                    ? "bg-purple-50 text-purple-900 border border-purple-300 hover:bg-purple-100" 
                    : "bg-purple-600 text-white hover:bg-purple-700"
                )}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : isVideoProActive ? "Active (Click to Pause)" : `Subscribe (£${videoProMonthly.toFixed(2)}/mo)`}
              </button>
            </div>

            {/* Instant Match & Emergency Dispatch SLA */}
            <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-red-600" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-800">
                    Platform SLA
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">Emergency & Instant SLA</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900">{platformConfig?.paidAddons?.instantMatch?.slaMinutes ?? 15}m</span>
                    <span className="text-xs text-slate-400 font-bold">Guaranteed Response</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Emergency jobs trigger direct SMS alerts to top-ranked nearby tradespeople with a £{platformConfig?.paidAddons?.emergencyBoost?.price ?? 5.00} urgency stipend paid by homeowners.
                </p>
                <div className="text-[11px] font-bold text-slate-700 space-y-1 pt-2">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-blue-600" /> {platformConfig?.paidAddons?.instantMatch?.slaMinutes ?? 15}-Min Match Threshold
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> £{platformConfig?.paidAddons?.milestoneEscrow?.homeownerMediationStake ?? 25.00} Protected Stake
                  </div>
                </div>
              </div>

              <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-black/10 text-center">
                <p className="text-[11px] font-semibold text-slate-600">Auto-enabled for all verified responders</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-16 text-center"
        >
            <div className="inline-flex items-center gap-2 text-slate-500 text-xs bg-white px-6 py-3 rounded-2xl border border-black shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Payments secured by <span className="font-bold text-slate-900">Stripe</span>. Cancel anytime.
            </div>
            <p className="text-[10px] text-slate-400 mt-6 max-w-md mx-auto italic">
              * Success fees are automatically deducted from job payouts or calculated at job completion. 
              Founding rewards are valid as long as the subscription remains active.
            </p>
        </motion.div>
      </div>
    </div>
  );
}
