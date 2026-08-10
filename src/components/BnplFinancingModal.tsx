import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, ShieldCheck, Zap, Sparkles, CheckCircle2,
  Calendar, PoundSterling, Clock, ArrowRight, Info, AlertCircle, X, Sliders, DollarSign, Building2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";
import { calculateFlexiPayMerchantFee } from "@/src/services/stripeIntegrationService";

interface BnplFinancingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number;
  jobTitle?: string;
  onSelectPlan?: (planDetails: any) => void;
}

export default function BnplFinancingModal({
  isOpen,
  onClose,
  initialAmount = 2400,
  jobTitle = "Emergency Roof & Structural Repair",
  onSelectPlan
}: BnplFinancingModalProps) {
  const [repairAmount, setRepairAmount] = useState<number>(initialAmount >= 500 ? initialAmount : 1500);
  const [selectedTerm, setSelectedTerm] = useState<number>(12); // 3, 6, 12, 24, 36 months
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isPreApproved, setIsPreApproved] = useState(false);

  if (!isOpen) return null;

  // Financing Calculation
  const financedAmount = Math.max(0, repairAmount - depositAmount);

  // Interest Rates
  let apr = 0; // 0% APR default for 3 & 6 months
  if (selectedTerm === 12) apr = 4.9;
  if (selectedTerm === 24) apr = 7.9;
  if (selectedTerm === 36) apr = 9.9;

  // Monthly Payment Logic
  const monthlyRate = apr / 100 / 12;
  let monthlyPayment = 0;
  if (apr === 0) {
    monthlyPayment = financedAmount / selectedTerm;
  } else {
    monthlyPayment =
      (financedAmount * monthlyRate * Math.pow(1 + monthlyRate, selectedTerm)) /
      (Math.pow(1 + monthlyRate, selectedTerm) - 1);
  }

  const totalRepayable = monthlyPayment * selectedTerm + depositAmount;
  const totalInterest = totalRepayable - repairAmount;

  // B2B Financing Partner Merchant Fee (1.5% - 2.5%)
  const merchantFeeBreakdown = calculateFlexiPayMerchantFee(
    financedAmount,
    selectedTerm,
    selectedTerm <= 6 ? "Klarna / TradeOS 0% Flexi" : "Novuna Personal Finance"
  );

  const handleSimulatePreApproval = () => {
    setIsCheckingEligibility(true);
    setTimeout(() => {
      setIsCheckingEligibility(false);
      setIsPreApproved(true);
      toast.success("⚡ Instant Soft Credit Check Approved! £" + repairAmount.toLocaleString('en-GB') + " TradeOS FlexiPay credit line unlocked (No impact on credit score).");
    }, 1200);
  };

  const handleConfirmPlan = () => {
    const plan = {
      repairAmount,
      depositAmount,
      financedAmount,
      termMonths: selectedTerm,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      apr,
      totalRepayable: Math.round(totalRepayable * 100) / 100,
      provider: merchantFeeBreakdown.provider,
      merchantFeeRate: merchantFeeBreakdown.merchantFeeRate,
      merchantFeeAmount: merchantFeeBreakdown.merchantFeeAmount
    };
    if (onSelectPlan) onSelectPlan(plan);
    toast.success(`💳 BNPL Financing Plan selected: £${Math.round(monthlyPayment)}/mo over ${selectedTerm} months!`);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-[2.5rem] border border-black shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 overflow-hidden relative max-h-[92vh] overflow-y-auto"
        >
          {/* Top Branding Banner */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <span>TradeOS FlexiPay BNPL Financing (£1,000+)</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Major Repair Payment Plan
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Spread unexpected homeowner repair costs (£1,000–£25,000) into manageable monthly payments with 0% APR options.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Job & Amount Input */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-black space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Repair Project</p>
                <h4 className="text-sm font-black text-slate-900">{jobTitle}</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-600">Cost:</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-900 text-sm">£</span>
                  <input
                    type="number"
                    min={1000}
                    max={25000}
                    step={100}
                    value={repairAmount}
                    onChange={(e) => setRepairAmount(Math.max(500, parseInt(e.target.value) || 0))}
                    className="w-32 pl-7 pr-3 py-1.5 bg-white border border-black rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Range Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>£1,000</span>
                <span>£10,000</span>
                <span>£25,000</span>
              </div>
              <input
                type="range"
                min={1000}
                max={25000}
                step={250}
                value={repairAmount}
                onChange={(e) => setRepairAmount(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Term Selection (3, 6, 12, 24, 36 Months) */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase text-slate-700 flex items-center justify-between">
              <span>Select Repayment Period:</span>
              <span className="text-indigo-600 font-bold">{apr === 0 ? "⚡ 0% Interest (Interest Free)" : `${apr}% Fixed APR`}</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[3, 6, 12, 24, 36].map((months) => {
                const termApr = months <= 6 ? 0 : months === 12 ? 4.9 : months === 24 ? 7.9 : 9.9;
                return (
                  <button
                    key={months}
                    onClick={() => setSelectedTerm(months)}
                    className={cn(
                      "p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1",
                      selectedTerm === months
                        ? "bg-slate-900 text-white border-black shadow-md ring-2 ring-indigo-500"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-xs font-black">{months} Months</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                      termApr === 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-indigo-500/20 text-indigo-300"
                    )}>
                      {termApr === 0 ? "0% APR" : `${termApr}% APR`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Monthly Payment Breakdown Box */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-black shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-wider">Estimated Monthly Payment</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-amber-300">£{monthlyPayment.toFixed(2)}</span>
                  <span className="text-xs font-bold text-slate-300">/ month</span>
                </div>
              </div>

              <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-right text-xs">
                <p className="text-[10px] text-slate-300 font-bold uppercase">Total Repayable</p>
                <p className="font-black text-white text-sm">£{totalRepayable.toFixed(2)}</p>
                {totalInterest > 0 ? (
                  <p className="text-[10px] text-indigo-300">Total Interest: £{totalInterest.toFixed(2)}</p>
                ) : (
                  <p className="text-[10px] text-emerald-400 font-bold">✓ Save £0 in interest (0% APR)</p>
                )}
              </div>
            </div>

            {/* Instant Soft Credit Pre-Approval Simulator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Soft credit check only — does not impact your credit score.</span>
              </div>

              {isPreApproved ? (
                <div className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Pre-Approved for £{repairAmount.toLocaleString('en-GB')}
                </div>
              ) : (
                <button
                  onClick={handleSimulatePreApproval}
                  disabled={isCheckingEligibility}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl border border-black shadow-md transition flex items-center gap-1.5 shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  {isCheckingEligibility ? "Checking..." : "Check Pre-Approval Eligibility"}
                </button>
              )}
            </div>
          </div>

          {/* B2B Merchant Origination Fee & Platform Economics Card */}
          <div className="bg-slate-50 border border-black p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-900">
              <div className="flex items-center gap-1.5 text-indigo-900">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>B2B Merchant Origination Economics:</span>
              </div>
              <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-300 text-[10px] font-black">
                {(merchantFeeBreakdown.merchantFeeRate * 100).toFixed(1)}% Origination Fee
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-black">
                <p className="text-[9px] font-extrabold uppercase text-slate-400">Financing Partner</p>
                <p className="font-extrabold text-slate-900 text-xs mt-0.5">{merchantFeeBreakdown.provider}</p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-black">
                <p className="text-[9px] font-extrabold uppercase text-slate-400">Platform Merchant Fee</p>
                <p className="font-extrabold text-indigo-700 text-xs mt-0.5">
                  +£{merchantFeeBreakdown.merchantFeeAmount.toFixed(2)} <span className="text-[9px] text-slate-500 font-normal">({(merchantFeeBreakdown.merchantFeeRate * 100).toFixed(1)}%)</span>
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-black">
                <p className="text-[9px] font-extrabold uppercase text-slate-400">Trader Payout Guarantee</p>
                <p className="font-extrabold text-emerald-700 text-xs mt-0.5">
                  100% Upfront Payout
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              * The <strong>{(merchantFeeBreakdown.merchantFeeRate * 100).toFixed(1)}% merchant origination fee (£{merchantFeeBreakdown.merchantFeeAmount.toFixed(2)})</strong> is paid directly by {merchantFeeBreakdown.provider} to TradeOS upon loan origination. The tradesperson receives 100% upfront payment upon job completion with zero default risk.
            </p>
          </div>

          {/* Partner Financing Logos */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold pt-1">
            <span>Financing Powered By:</span>
            <div className="flex items-center gap-3">
              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300 font-extrabold">Klarna.</span>
              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300 font-extrabold">Clearpay</span>
              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300 font-extrabold">Novuna</span>
              <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-300 font-black">TradeOS Flexi</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleConfirmPlan}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-2xl border border-black shadow-lg flex items-center justify-center gap-2 transition active:scale-95"
            >
              <span>Apply BNPL Financing to Job</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-2xl border border-black transition"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
