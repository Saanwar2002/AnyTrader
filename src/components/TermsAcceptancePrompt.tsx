import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, doc, updateDoc } from "@/src/firebase";
import { 
  ShieldCheck, 
  Lock, 
  Check, 
  FileText, 
  AlertTriangle, 
  Sparkles, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  Building2,
  Car,
  Utensils,
  Dog,
  Truck,
  DollarSign
} from "lucide-react";
import { 
  CURRENT_TERMS_VERSION, 
  TERMS_LAST_UPDATED, 
  TERMS_AND_PRIVACY_SECTIONS, 
  PRIVACY_SUMMARY_POINTS 
} from "../constants/termsAndPrivacy";
import { TermsModal } from "./TermsModal";
import { logout } from "@/src/firebase";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

export const TermsAcceptancePrompt: React.FC = () => {
  const { user, profile, setProfile } = useAuth();
  const [compulsoryAgreed, setCompulsoryAgreed] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [partnerSharingOptIn, setPartnerSharingOptIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFullTermsModal, setShowFullTermsModal] = useState(false);
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);

  // Check if current user needs to accept terms
  const needsAcceptance = user && profile && profile.termsAcceptedVersion !== CURRENT_TERMS_VERSION;

  if (!needsAcceptance) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      setHasScrolledTerms(true);
    }
  };

  const handleAcceptTerms = async () => {
    if (!compulsoryAgreed || !user) {
      toast.error("Please tick the compulsory agreement checkbox to proceed.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const userAgentStr = typeof navigator !== "undefined" ? navigator.userAgent : "Web";

      const updateData = {
        termsAcceptedAt: timestamp,
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
        termsAcceptedIp: userAgentStr,
        marketingOptIn: marketingOptIn,
        partnerDataSharingOptIn: partnerSharingOptIn,
        updatedAt: timestamp
      };

      await updateDoc(doc(db, "users", user.uid), updateData);

      // Update local profile state
      setProfile((prev) => prev ? { ...prev, ...updateData } : null);

      toast.success("Terms & Conditions successfully accepted!", {
        description: `Agreed to Version ${CURRENT_TERMS_VERSION} on ${new Date().toLocaleDateString("en-GB")}`
      });
    } catch (err: any) {
      console.error("Error accepting terms:", err);
      toast.error("Failed to save agreement. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-2.5 sm:p-6 bg-slate-950/90 backdrop-blur-lg overflow-hidden">
        <div className="bg-white w-full max-w-2xl h-[92vh] sm:h-[88vh] rounded-[24px] sm:rounded-[32px] border border-black shadow-2xl overflow-hidden flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header Banner */}
          <div className="p-3.5 sm:p-5 bg-slate-900 text-white border-b border-black relative overflow-hidden shrink-0">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="p-2 sm:p-3 bg-emerald-500/20 rounded-xl sm:rounded-2xl border border-emerald-400/30 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <h2 className="text-sm sm:text-lg font-black text-white truncate">Action Required: Platform Terms</h2>
                    <span className="bg-emerald-500 text-slate-950 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      v{CURRENT_TERMS_VERSION}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
                    Please review and accept our Master Platform Agreement to continue.
                  </p>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-slate-700 shrink-0"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>

          {/* Scrollable Summary & Core Clauses */}
          <div 
            onScroll={handleScroll}
            className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 min-h-0 text-xs sm:text-sm text-slate-800 leading-relaxed"
          >
            {/* Alert Box */}
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-950 font-medium leading-relaxed">
                To keep our multi-portal ecosystem (Trades, AnyRoller Taxi, Gotham Housing, Food & Delivery) safe and legally compliant, all registered users must agree to our updated Terms.
              </p>
            </div>

            {/* Core Terms Highlights */}
            <div className="space-y-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>Core Agreement Highlights</span>
                <button
                  onClick={() => setShowFullTermsModal(true)}
                  className="text-emerald-600 hover:text-emerald-700 font-black flex items-center gap-1 normal-case text-xs"
                >
                  Read Full Document <ExternalLink className="w-3 h-3" />
                </button>
              </h3>

              <div className="grid grid-cols-1 gap-2.5">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-black space-y-1">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    1. Software Intermediary Role & Liability Exemption
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    AnyTrader is a pure software platform. All contracts are directly between Customers and Independent Service Providers. AnyTrader is not liable for work quality, damages, or personal injury.
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-black space-y-1">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    2. Unilateral Pricing, Tier & Fee Adjustments
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    AnyTrader reserves the right to modify pricing tiers, subscription rates, B2B SaaS per-door fees, and split-payment commissions without individual prior notice.
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-black space-y-1">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    3. Multi-Portal Scope (Trades, Taxi, Food, Pets, Delivery & Care)
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    Specific rules govern Property Passports, Gas Safe/CP12 compliance, AnyRoller PHV licensing, FSA food hygiene, animal welfare, and DBS carer disclosures.
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-black space-y-1">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    4. UK GDPR Privacy & Marketing Preferences
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    Your data is stored securely under UK GDPR rules. You control marketing and partner data sharing preferences via checkboxes below.
                  </p>
                </div>
              </div>
            </div>

            {/* Checkbox Section */}
            <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-300 space-y-4">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                User Declarations & Consents
              </h4>

              {/* Checkbox 1: Compulsory */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={compulsoryAgreed}
                  onChange={(e) => setCompulsoryAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded-lg border-2 border-black text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="font-black text-slate-900 text-xs group-hover:text-emerald-700 transition-colors">
                    I agree to the Terms & Conditions and Privacy Policy (Compulsory) *
                  </span>
                  <p className="text-[11px] text-slate-600 font-medium">
                    I confirm I have read, understood, and accept the AnyTrader Master Intermediary Agreement v{CURRENT_TERMS_VERSION}, including liability exemptions and multi-portal terms.
                  </p>
                </div>
              </label>

              <hr className="border-emerald-200" />

              {/* Checkbox 2: Optional Marketing */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-slate-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 text-[11px] group-hover:text-slate-900">
                    Receive Promotional Offers, Cross-Selling Deals & Updates (Optional)
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Allow AnyTrader to send personalized deals, tool hire offers, insurance discounts, and platform announcements via Email, SMS & WhatsApp.
                  </p>
                </div>
              </label>

              {/* Checkbox 3: Optional Partner Sharing */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={partnerSharingOptIn}
                  onChange={(e) => setPartnerSharingOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-slate-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 text-[11px] group-hover:text-slate-900">
                    Partner Data Sharing for Material Sourcing & Quotes (Optional)
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Allow sharing relevant job specs with vetted trade material suppliers (e.g., Travis Perkins, Jewson) and insurance partners for competitive quotes.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 bg-slate-900 text-white border-t border-black flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              onClick={() => setShowFullTermsModal(true)}
              className="text-xs text-slate-400 hover:text-white font-bold underline transition-colors"
            >
              View Complete v{CURRENT_TERMS_VERSION} Legal Text
            </button>

            <button
              onClick={handleAcceptTerms}
              disabled={!compulsoryAgreed || isSubmitting}
              className={cn(
                "w-full sm:w-auto px-8 py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 border border-black shadow-lg",
                compulsoryAgreed && !isSubmitting
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105 active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700"
              )}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Saving Timestamp...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Accept Terms & Continue
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full Terms Document Modal */}
      <TermsModal
        isOpen={showFullTermsModal}
        onClose={() => setShowFullTermsModal(false)}
      />
    </>
  );
};
