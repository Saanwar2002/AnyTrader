import React, { useState } from "react";
import { CreditCard, ShoppingBag, Video, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import BnplFinancingModal from "./BnplFinancingModal";

interface TraderMonetizationBannersProps {
  onOpenVideoVerification?: () => void;
}

export function TraderMonetizationBanners({ onOpenVideoVerification }: TraderMonetizationBannersProps) {
  const [showBnplModal, setShowBnplModal] = useState(false);
  const [showMaterialsInfo, setShowMaterialsInfo] = useState(false);
  const [showVideoProInfo, setShowVideoProInfo] = useState(false);

  return (
    <div className="space-y-3 mt-8">
      {/* 3 Advertising & Growth Offer Containers */}
      <div className="space-y-3">
        {/* Section 5.1 BNPL Financing Card */}
        <div
          id="bnpl-repair-financing-ad-card"
          onClick={() => setShowBnplModal(true)}
          className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl border border-black shadow-sm flex items-center justify-between cursor-pointer hover:from-slate-900 hover:to-indigo-950 transition group active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-indigo-300">BNPL FlexiPay (£1k+)</span>
              <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded border border-black">1.5%–2.5% B2B Fee</span>
            </div>
            <p className="text-xl font-black text-amber-300 mt-1">0% APR Repair Financing</p>
            <p className="text-[9px] text-indigo-200 font-medium">Financing partner pays 1.5–2.5% origination fee • 100% upfront trader payout</p>
          </div>
          <div className="p-3 bg-indigo-800 text-amber-300 rounded-2xl border border-indigo-700 group-hover:scale-105 transition shrink-0 ml-2">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Section 5.2 Materials Sourcing Merchant Affiliate Commission Card */}
        <div
          id="materials-sourcing-ad-card"
          onClick={() => {
            setShowMaterialsInfo(true);
            toast.info("Merchant Procurement: Trade discounts active at Screwfix, Travis Perkins & B&Q.");
          }}
          className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 text-white rounded-3xl border border-black shadow-sm flex items-center justify-between cursor-pointer hover:from-slate-900 hover:to-amber-950 transition group active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-amber-300">Materials Sourcing & Procurement</span>
              <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded border border-black">3.0%–5.0% Affiliate Fee</span>
            </div>
            <p className="text-xl font-black text-amber-300 mt-1">Merchant Referral Commissions</p>
            <p className="text-[9px] text-amber-100 font-medium">Earn 3%–5% on fulfilled Screwfix, Travis Perkins & B&Q materials • 5% trader trade discount</p>
          </div>
          <div className="p-3 bg-amber-800/80 text-amber-300 rounded-2xl border border-amber-600 group-hover:scale-105 transition shrink-0 ml-2">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Section 5.3 Verified Trader Credential & Video Badge Subscription (£15/mo) */}
        <div
          id="verified-video-pro-ad-card"
          onClick={() => {
            if (onOpenVideoVerification) {
              onOpenVideoVerification();
            } else {
              setShowVideoProInfo(true);
            }
          }}
          className="p-4 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl border border-black shadow-sm flex items-center justify-between cursor-pointer hover:from-slate-900 hover:to-purple-950 transition group active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-amber-300">Trader SaaS Subscriptions</span>
              <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded border border-black">£15.00 / month</span>
            </div>
            <p className="text-xl font-black text-amber-300 mt-1">Verified Video Pro Subscriptions</p>
            <p className="text-[9px] text-indigo-100 font-medium">Grants traders +35 match score points • Priority quote positioning • HD video hosting</p>
          </div>
          <div className="p-3 bg-purple-800/80 text-amber-300 rounded-2xl border border-purple-600 group-hover:scale-105 transition shrink-0 ml-2">
            <Video className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* BNPL Financing Modal */}
      {showBnplModal && (
        <BnplFinancingModal
          isOpen={showBnplModal}
          onClose={() => setShowBnplModal(false)}
          initialAmount={2500}
          jobTitle="Major Unexpected Homeowner Repair"
        />
      )}

      {/* Materials Sourcing Modal Info */}
      <AnimatePresence>
        {showMaterialsInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Materials Sourcing & Trade Discounts</h3>
                    <p className="text-[11px] text-slate-500">Screwfix • Travis Perkins • B&Q</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMaterialsInfo(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                When homeowners accept quote materials through TradeOS, purchases through partnered merchants trigger an instant <strong>5% Trade Discount</strong> for your account and earn you a <strong>3%–5% referral commission</strong>.
              </p>

              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Instant trade pricing integration at checkout</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Click & Collect or direct-to-site courier delivery</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Automated invoice VAT receipts generation</span>
                </div>
              </div>

              <button
                onClick={() => setShowMaterialsInfo(false)}
                className="w-full py-3 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl border border-black shadow-sm"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Pro SaaS Modal Info */}
      <AnimatePresence>
        {showVideoProInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-black p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Verified Video Pro Membership</h3>
                    <p className="text-[11px] text-slate-500">£15.00 / month • Cancel anytime</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVideoProInfo(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Video-verified tradespeople win up to <strong>3x more jobs</strong> by giving homeowners instant trust and credential verification before they even receive your quote.
              </p>

              <div className="space-y-2 bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200 text-xs">
                <div className="flex items-center gap-2 text-purple-950 font-bold">
                  <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>+35 Match Score points across discovery algorithms</span>
                </div>
                <div className="flex items-center gap-2 text-purple-950 font-bold">
                  <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>Priority quote ranking atop homeowner comparison boards</span>
                </div>
                <div className="flex items-center gap-2 text-purple-950 font-bold">
                  <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>Unlimited HD video hosting & verified trust badge</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowVideoProInfo(false);
                  if (onOpenVideoVerification) {
                    onOpenVideoVerification();
                  } else {
                    toast.success("Navigate to the Verification tab to upload or record your video selfie.");
                  }
                }}
                className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl border border-black shadow-sm"
              >
                Record Video Selfie & Get Verified
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
