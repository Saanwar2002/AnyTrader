import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, PoundSterling, Calendar, Clock, Sparkles, Send, 
  CheckCircle2, AlertCircle, Loader2, Info, FileText, ChevronRight, ShieldCheck, Zap
} from "lucide-react";
import { db, doc, collection, setDoc, updateDoc, serverTimestamp, sendNotification, handleFirestoreError, OperationType } from "@/src/firebase";
import { generateQuoteDraft } from "@/src/services/gemini";
import { calculatePayoutBreakdown } from "@/src/services/stripeIntegrationService";
import { toast } from "sonner";
import { cn, formatJobLocation } from "@/src/lib/utils";

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  user: any;
  profile: any;
  onQuoteSubmitted?: (jobId: string, quoteData: any) => void;
}

export const QuickQuoteModal: React.FC<QuickQuoteModalProps> = ({
  isOpen,
  onClose,
  job,
  user,
  profile,
  onQuoteSubmitted,
}) => {
  if (!isOpen || !job) return null;

  const minEstimate = Number(job.estimateMin || 0);
  const maxEstimate = Number(job.estimateMax || 0);
  const avgEstimate = minEstimate && maxEstimate ? Math.round((minEstimate + maxEstimate) / 2) : (minEstimate || maxEstimate || 150);

  const [quoteAmount, setQuoteAmount] = useState<string>(avgEstimate ? String(avgEstimate) : "");
  const [pricingType, setPricingType] = useState<"fixed" | "hourly" | "daily">("fixed");
  const [quoteMessage, setQuoteMessage] = useState<string>("");
  const [startDateType, setStartDateType] = useState<"immediate" | "tomorrow" | "3_days" | "next_week" | "custom">("immediate");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<string>("1_day");
  const [quoteScope, setQuoteScope] = useState<string>("complete_package");
  const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user has already submitted a quote for this job & prefill
  useEffect(() => {
    if (!isOpen || !job || !user) return;
    let isMounted = true;
    const checkExistingQuote = async () => {
      try {
        const { getDocs, query, where } = await import("firebase/firestore");
        const q = query(collection(db, "jobs", job.id, "quotes"), where("tradespersonId", "==", user.uid));
        const snap = await getDocs(q);
        if (isMounted && !snap.empty) {
          const existingDoc = snap.docs[0];
          const existing = existingDoc.data();
          setExistingQuoteId(existingDoc.id);
          setQuoteAmount(existing.amount?.toString() || String(avgEstimate));
          setQuoteMessage(existing.message || "");
          if (existing.quoteScope) setQuoteScope(existing.quoteScope);
          if (existing.estimatedTimeline) setEstimatedDuration(existing.estimatedTimeline.replace(/ /g, "_"));
        } else if (isMounted && !quoteMessage) {
          const traderName = profile?.businessName || profile?.name || "Professional Trader";
          const initialMessage = `Hello, I'm available to assist with your ${job.title || "job"}. I have extensive experience in ${job.category || "this trade"} and can ensure high-quality workmanship.`;
          setQuoteMessage(initialMessage);
        }
      } catch (err) {
        console.error("Error checking existing quote in modal:", err);
      }
    };
    checkExistingQuote();
    return () => { isMounted = false; };
  }, [isOpen, job?.id, user?.uid]);

  const numAmount = parseFloat(quoteAmount) || 0;
  const payout = calculatePayoutBreakdown(numAmount);

  const handleGenerateAiDraft = async () => {
    setIsGeneratingAiDraft(true);
    try {
      const traderName = profile?.businessName || profile?.name || "Local Trader";
      const draft = await generateQuoteDraft(
        job.title || "Trade Job",
        job.description || "",
        traderName,
        numAmount || avgEstimate,
        quoteScope
      );
      if (draft) {
        setQuoteMessage(draft);
        toast.success("AI Quote draft generated!");
      }
    } catch (err) {
      console.error("Error generating quote draft:", err);
      toast.error("Failed to generate AI draft. Please write your message manually.");
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const calculateActualStartDate = () => {
    const today = new Date();
    if (startDateType === "immediate") return today.toISOString().split("T")[0];
    if (startDateType === "tomorrow") {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    }
    if (startDateType === "3_days") {
      const threeDays = new Date(today);
      threeDays.setDate(today.getDate() + 3);
      return threeDays.toISOString().split("T")[0];
    }
    if (startDateType === "next_week") {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return nextWeek.toISOString().split("T")[0];
    }
    return customStartDate || today.toISOString().split("T")[0];
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !job) return;

    if (!quoteAmount || numAmount <= 0) {
      toast.error("Please enter a valid quote amount.");
      return;
    }

    if (!existingQuoteId && (job.quoteCount || 0) >= 5) {
      toast.error("This job has reached the maximum limit of 5 quotes.");
      return;
    }

    setIsSubmitting(true);
    try {
      const quoteRef = existingQuoteId 
        ? doc(db, "jobs", job.id, "quotes", existingQuoteId) 
        : doc(collection(db, "jobs", job.id, "quotes"));

      const isQuickTrack = numAmount < 400;

      const milestones = !isQuickTrack
        ? [
            { id: "m1", title: "Commencement & Materials", amount: Math.floor(numAmount * 0.3), status: "pending_funding" },
            { id: "m2", title: "Mid-way Progress", amount: Math.floor(numAmount * 0.4), status: "pending_funding" },
            { id: "m3", title: "Final Completion & Handover", amount: numAmount - Math.floor(numAmount * 0.3) - Math.floor(numAmount * 0.4), status: "pending_funding" }
          ]
        : [
            { id: "m1", title: "Service Delivery", amount: numAmount, status: "pending_funding" }
          ];

      const resolvedStartDate = calculateActualStartDate();

      const quoteData: any = {
        id: quoteRef.id,
        jobId: job.id,
        jobTitle: job.title || "",
        tradespersonId: user.uid,
        tradespersonName: profile?.businessName || profile?.name || "Tradesperson",
        tradespersonPhone: profile?.phone || "",
        tradespersonRating: profile?.rating || 5.0,
        tradespersonCategory: profile?.trades?.[0] || profile?.trade || profile?.category || job.category,
        homeownerId: job.homeownerId,
        amount: numAmount,
        originalAmount: numAmount,
        pricingType,
        netPayoutValue: payout.netPayout,
        stripeFeeAmount: payout.stripeFee,
        platformCommission: payout.platformCommission,
        paymentRail: payout.paymentRail,
        message: quoteMessage.trim(),
        startDate: resolvedStartDate,
        isImmediateStart: startDateType === "immediate",
        estimatedTimeline: estimatedDuration.replace(/_/g, " "),
        paymentPreference: "fixed_price",
        quoteScope,
        depositTerm: "0_percent_completion",
        guaranteeTerm: "1_year_workmanship",
        partsWarranty: "standard_parts",
        status: "pending",
        paymentTrack: isQuickTrack ? "quick" : "project",
        milestones,
        updatedAt: serverTimestamp(),
      };

      if (job.jobNo !== undefined) {
        quoteData.jobNo = job.jobNo;
      }

      if (existingQuoteId) {
        const { arrayUnion } = await import("firebase/firestore");
        quoteData.history = arrayUnion({
          amount: numAmount,
          message: quoteMessage.trim(),
          timestamp: new Date().toISOString(),
          reason: "Quick Quote Update"
        });
        await setDoc(quoteRef, quoteData, { merge: true });
      } else {
        quoteData.createdAt = serverTimestamp();
        await setDoc(quoteRef, quoteData);

        const { increment } = await import("firebase/firestore");
        await updateDoc(doc(db, "jobs", job.id), {
          quoteCount: increment(1),
          lastQuoteDate: serverTimestamp(),
        });
      }

      // Send in-app notification to homeowner
      await sendNotification(
        job.homeownerId,
        existingQuoteId ? "Quote Updated" : "New Quote Received",
        `${profile?.businessName || profile?.name || "A tradesperson"} ${existingQuoteId ? 'updated their quote to' : 'submitted a quote of'} £${numAmount} for: ${job.title}`,
        "quote",
        `/job/${job.id}`
      );

      toast.success(existingQuoteId ? `Quote updated to £${numAmount}!` : `Quote of £${numAmount} submitted successfully!`);
      if (onQuoteSubmitted) {
        onQuoteSubmitted(job.id, quoteData);
      }
      onClose();
    } catch (err: any) {
      console.error("Error submitting quick quote:", err);
      toast.error(err.message || "Failed to submit quote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl border border-black shadow-2xl max-w-lg w-full overflow-hidden my-6"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider">
                  Quick Quote
                </span>
                {job.jobNo && (
                  <span className="text-xs font-mono text-slate-400">#{job.jobNo}</span>
                )}
                <span className="text-xs text-blue-400 font-bold">• {job.category}</span>
              </div>
              <h2 className="text-lg font-black text-white leading-snug line-clamp-1">
                {job.title}
              </h2>
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <span>Location: {formatJobLocation(job)}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitQuote} className="p-5 space-y-5">
            {/* AI Benchmark Budget Helper */}
            {(minEstimate > 0 || maxEstimate > 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                    AI Price Transparency Guide
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    £{minEstimate} – £{maxEstimate}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuoteAmount(String(minEstimate))}
                    className="px-2.5 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-900 hover:bg-blue-100 transition-colors"
                  >
                    Low £{minEstimate}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteAmount(String(avgEstimate))}
                    className="px-2.5 py-1 bg-blue-600 rounded-lg text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    Target £{avgEstimate}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteAmount(String(maxEstimate))}
                    className="px-2.5 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-900 hover:bg-blue-100 transition-colors"
                  >
                    High £{maxEstimate}
                  </button>
                </div>
              </div>
            )}

            {/* Quote Amount & Pricing Structure */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center justify-between">
                <span>Quote Amount (£ GBP) *</span>
                <span className="text-slate-500 font-normal">0% Lead Fee on AnyTrader</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">
                  £
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 250"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-2xl border border-black text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500"
                />
              </div>

              {/* Net Payout Calculator Info */}
              {numAmount > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-black/10">
                  <span>Estimated Net Take-Home:</span>
                  <span className="text-emerald-700 font-black text-sm">£{payout.netPayout.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Earliest Start Date */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>When can you start?</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "immediate", label: "⚡ Immediate / Today" },
                  { id: "tomorrow", label: "Tomorrow" },
                  { id: "3_days", label: "In 2-3 Days" },
                  { id: "next_week", label: "Next Week" },
                  { id: "custom", label: "Custom Date" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStartDateType(option.id as any)}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center",
                      startDateType === option.id
                        ? "bg-slate-900 text-white border-black shadow-xs"
                        : "bg-white text-slate-700 border-black/20 hover:border-black"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {startDateType === "custom" && (
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full mt-2 px-4 py-2.5 rounded-xl border border-black text-xs font-bold"
                />
              )}
            </div>

            {/* Estimated Duration */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Estimated Job Duration</span>
              </label>
              <select
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-black text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1_2_hours">1 - 2 Hours</option>
                <option value="half_day">Half Day (3 - 4 Hours)</option>
                <option value="1_day">1 Full Day</option>
                <option value="2_3_days">2 - 3 Days</option>
                <option value="1_week">1 Week</option>
                <option value="2_plus_weeks">2+ Weeks</option>
              </select>
            </div>

            {/* Quote Message with AI Assistant */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Message / Scope of Work</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={isGeneratingAiDraft}
                  className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {isGeneratingAiDraft ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                  )}
                  <span>AI Polish Message</span>
                </button>
              </div>
              <textarea
                rows={3}
                required
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                placeholder="Introduce yourself, mention your availability and relevant qualifications..."
                className="w-full p-3.5 rounded-2xl border border-black text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 rounded-2xl border border-black font-extrabold text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !quoteAmount}
                className="w-2/3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Quote...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Quote (£{numAmount || 0})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
