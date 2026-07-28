import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { auth, db, doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp } from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { 
  Check, CreditCard, ShieldCheck, Zap, Star, Award, 
  ArrowRight, Info, Loader2, Sparkles, TrendingUp, 
  PoundSterling, Package, Plus, Trash2, Wallet
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useNavigate } from "react-router-dom";

interface SubscriptionTier {
  id: string;
  name: string;
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
      const data = await res.json();
      if (data.paymentMethods) {
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
          priceId: tier.id,
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/billing`
        })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        await updateDoc(doc(db, "users", user.uid), {
          tierId: tier.name,
          subscriptionStatus: "active",
          updatedAt: serverTimestamp()
        });
        alert(`Successfully switched to ${tier.name}! (Mock)`);
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Billing Error:", err);
      await updateDoc(doc(db, "users", user.uid), {
        tierId: tier.name,
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
  if (profile?.role === "homeowner" || profile?.role === "customer") {
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

  // -------------------------------------------------------------
  // TRADESPERSON / BUSINESS BILLING UI (SUBSCRIPTIONS)
  // -------------------------------------------------------------

  const isFounding = profile?.isFoundingMember;

  // Phase 2 Tiers directly mapped from Firestore
  let standardTiers: SubscriptionTier[] = [];
  
  if (globalTiers?.providerModels?.one_off_trades?.tiers) {
    const rawTiers = globalTiers.providerModels.one_off_trades.tiers;
    standardTiers = Object.entries(rawTiers).map(([tierKey, tier]: [string, any]) => ({
      id: `price_${tierKey.toLowerCase()}`,
      name: tierKey,
      price: tier.price || 0,
      commission: (tier.commission || 0) * 100, // DB stores as 0.1, UI expects 10 
      description: tier.description || "",
      features: tier.features || [],
      isPopular: tierKey.toLowerCase() === "pro"
    })).sort((a, b) => a.price - b.price);
  } else {
    // Fallback if not configured in DB yet
    standardTiers = [
      {
        id: "price_payg",
        name: "Standard PAYG",
        price: 0,
        commission: 15,
        description: "Pay only when you win. Zero risk.",
        features: [
          "Unlimited Lead Browsing",
          "Up to 5 Open Quotes",
          "15% Platform Success Fee",
          "Standard Profile Visibility"
        ]
      },
      {
        id: "price_pro",
        name: "PRO Trader",
        price: 19.99,
        commission: 10,
        description: "Built for active professionals.",
        isPopular: true,
        features: [
          "Priority Lead Alerts",
          "Unlimited Open Quotes",
          "Reduced 10% Success Fee",
          "Enhanced Verification Badge",
          "AI Material List Assistant"
        ]
      }
    ];
  }

  // Modified Tiers for Founding Members
  const foundingTiers = standardTiers.map(t => {
    if (t.name === "PRO Trader") {
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {activeTiers.map((tier, idx) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + (idx * 0.1) }}
              className={cn(
                "relative bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-300",
                tier.isPopular ? "border-blue-600 shadow-2xl shadow-blue-600/10 scale-105 z-10" : "border-black hover:border-black shadow-lg shadow-slate-200/50"
              )}
            >
              {tier.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-blue-200">
                  Most Popular
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">{tier.name}</h3>
                  <p className="text-sm text-slate-500 mt-2 font-medium">{tier.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">£{tier.price}</span>
                  <span className="text-slate-400 font-bold text-sm">/mo</span>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-black">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Fee</span>
                    <span className="text-sm font-black text-blue-600">{tier.commission}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(100 - tier.commission)}%` }} />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Included Features</p>
                  <ul className="space-y-3">
                    {tier.features.map(feature => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => handleSelectPlan(tier)}
                  disabled={isProcessing || profile?.tierId === tier.name}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 mt-4 shadow-lg",
                    profile?.tierId === tier.name 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                      : tier.isPopular 
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 active:scale-[0.98]" 
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200 active:scale-[0.98]"
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : profile?.tierId === tier.name ? (
                    "Current Plan"
                  ) : (
                    <>Select {tier.name} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
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
