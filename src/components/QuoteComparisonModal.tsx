import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Star, PoundSterling, Clock, MessageSquare, CheckCircle2, Sparkles, 
  RefreshCw, Calendar, Zap, CreditCard, LayoutGrid, LayoutList, ShieldCheck, 
  Video, ChevronDown, ChevronUp, FileText, Tag, ThumbsUp, AlertCircle, Award
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { calculateTraderMatchScore } from "@/src/services/matchingEngine";
import BnplFinancingModal from "./BnplFinancingModal";

interface QuoteComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotes: any[];
  tradespersonProfiles: Record<string, any>;
  quoteAnalyses?: Record<string, any>;
  onAccept: (quote: any) => void;
  onRequestRequote: (quote: any, message: string) => Promise<void>;
  job: any;
}

export default function QuoteComparisonModal({ 
  isOpen, 
  onClose, 
  quotes, 
  tradespersonProfiles, 
  quoteAnalyses = {}, 
  onAccept, 
  onRequestRequote, 
  job 
}: QuoteComparisonModalProps) {
  const [viewMode, setViewMode] = React.useState<"cards" | "matrix">("cards");
  const [requestingRevisionId, setRequestingRevisionId] = React.useState<string | null>(null);
  const [revisionMessage, setRevisionMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAcceptingId, setIsAcceptingId] = React.useState<string | null>(null);
  const [expandedBreakdownId, setExpandedBreakdownId] = React.useState<string | null>(null);

  // BNPL Financing state
  const [showBnplModal, setShowBnplModal] = React.useState(false);
  const [selectedQuoteForBnpl, setSelectedQuoteForBnpl] = React.useState<any>(null);

  // Video preview state
  const [activeVideoUrl, setActiveVideoUrl] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const activeQuotes = quotes.filter(q => q.status !== "rejected");

  const sortedQuotes = [...activeQuotes].sort((a, b) => {
    // 1. Accepted first
    if (a.status === "accepted" && b.status !== "accepted") return -1;
    if (b.status === "accepted" && a.status !== "accepted") return 1;

    // 2. Verified Video Pro Priority Positioning (£15/mo Subscribers & Video Verified)
    const profileA = tradespersonProfiles[a.tradespersonId];
    const profileB = tradespersonProfiles[b.tradespersonId];
    const isVideoProA = Boolean(profileA?.hasVerifiedVideoProSubscription || profileA?.videoVerificationStatus === "verified" || profileA?.videoVerificationUrl);
    const isVideoProB = Boolean(profileB?.hasVerifiedVideoProSubscription || profileB?.videoVerificationStatus === "verified" || profileB?.videoVerificationUrl);
    if (isVideoProA && !isVideoProB) return -1;
    if (isVideoProB && !isVideoProA) return 1;

    // 3. AI Value (Percentile)
    const analysisA = quoteAnalyses[a.id];
    const analysisB = quoteAnalyses[b.id];
    if (analysisA && analysisB) {
      if (analysisA.percentile !== analysisB.percentile) {
        return analysisB.percentile - analysisA.percentile;
      }
    }

    // 3. Trader Rating
    const ratingA = profileA?.rating || 0;
    const ratingB = profileB?.rating || 0;
    if (ratingA !== ratingB) return ratingB - ratingA;

    // 4. Fastest Start (Earliest start date)
    const dateA_start = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const dateB_start = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    if (dateA_start !== dateB_start) return dateA_start - dateB_start;

    // 5. Price (Lower first)
    return a.amount - b.amount;
  });

  const fastestStartId = [...activeQuotes]
    .filter(q => q.startDate || q.isImmediateStart)
    .sort((a, b) => {
      if (a.isImmediateStart && !b.isImmediateStart) return -1;
      if (b.isImmediateStart && !a.isImmediateStart) return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    })[0]?.id;

  const lowestPriceId = [...activeQuotes].sort((a, b) => a.amount - b.amount)[0]?.id;
  const highestRatingId = [...activeQuotes].sort((a, b) => {
    const rA = tradespersonProfiles[a.tradespersonId]?.rating || 0;
    const rB = tradespersonProfiles[b.tradespersonId]?.rating || 0;
    return rB - rA;
  })[0]?.id;

  const handleRequestRevision = async (quote: any) => {
    if (!revisionMessage.trim()) return;
    setIsSubmitting(true);
    try {
      await onRequestRequote(quote, revisionMessage);
      setRequestingRevisionId(null);
      setRevisionMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickChipClick = (chipText: string) => {
    if (revisionMessage.includes(chipText)) return;
    setRevisionMessage(prev => prev ? `${prev} • ${chipText}` : chipText);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="fixed inset-2 sm:inset-6 md:inset-10 z-50 bg-slate-100 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/30"
          >
            {/* Header with View Mode Switcher */}
            <div className="py-3 px-4 md:px-6 bg-white border-b border-black flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm border border-slate-700">
                  {sortedQuotes.length}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">Compare Received Quotes</h2>
                  <p className="text-[11px] font-bold text-slate-500">
                    {job?.title || "Homeowner Job Quotes"}
                  </p>
                </div>
              </div>

              {/* Controls: Mode Switcher & Close */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-2xl border border-black flex items-center gap-1">
                  <button
                    onClick={() => setViewMode("cards")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
                      viewMode === "cards" 
                        ? "bg-slate-900 text-white shadow-2xs" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cards</span>
                  </button>
                  <button
                    onClick={() => setViewMode("matrix")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
                      viewMode === "matrix" 
                        ? "bg-slate-900 text-white shadow-2xs" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Comparison Matrix</span>
                  </button>
                </div>

                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 hover:text-slate-900 border border-black"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6 no-scrollbar">
              {viewMode === "cards" ? (
                /* Card Carousel View */
                <div className="flex gap-6 min-w-max pb-4">
                  {sortedQuotes.map((quote) => {
                    const tpProfile = tradespersonProfiles[quote.tradespersonId];
                    const analysis = quoteAnalyses[quote.id];
                    const isLowestPrice = quote.id === lowestPriceId;
                    const isHighestRating = quote.id === highestRatingId;
                    const isFastestStart = quote.id === fastestStartId;
                    const isExpanded = expandedBreakdownId === quote.id;
                    const hasVideo = tpProfile?.videoVerificationStatus === "verified" || tpProfile?.videoVerificationUrl;

                    return (
                      <div 
                        key={quote.id} 
                        className={cn(
                          "w-80 sm:w-88 bg-white rounded-[2rem] p-5 border-2 transition-all flex flex-col relative shrink-0 shadow-sm hover:shadow-md",
                          quote.status === "accepted" ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-black"
                        )}
                      >
                        {/* Highlights & Badges Top Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          {isLowestPrice && (
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                              <Tag className="w-3 h-3 fill-current" />
                              Best Value
                            </span>
                          )}
                          {!isLowestPrice && isHighestRating && (
                            <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                              <Star className="w-3 h-3 fill-current" />
                              Top Rated
                            </span>
                          )}
                          {isFastestStart && (
                            <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                              <Zap className="w-3 h-3 fill-current" />
                              Fastest Start
                            </span>
                          )}
                          {hasVideo && (
                            <span className={cn(
                              "text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs",
                              tpProfile?.hasVerifiedVideoProSubscription
                                ? "bg-amber-400 text-slate-950 border border-black"
                                : "bg-purple-600 text-white"
                            )}>
                              <Video className="w-3 h-3" />
                              {tpProfile?.hasVerifiedVideoProSubscription ? "⚡ Verified Video Pro" : "Video Verified"}
                            </span>
                          )}
                        </div>

                        {/* Trader Profile Header */}
                        <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-slate-200">
                          <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden border-2 border-black relative shrink-0 shadow-2xs">
                            {tpProfile?.avatarUrl ? (
                              <img src={tpProfile.avatarUrl} alt={tpProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Star className="w-6 h-6" />
                              </div>
                            )}
                            <BadgeOverlay 
                              badges={getTraderBadges(tpProfile)} 
                              className="absolute -bottom-1 -left-2 -right-2 justify-center z-10 scale-[0.65]" 
                            />
                          </div>

                          <div className="flex flex-col text-left min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-black text-slate-900 text-base leading-tight truncate">
                                {tpProfile?.name || "Tradesperson"}
                              </h3>
                              {tpProfile?.trustScore && (
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                                  {tpProfile.trustScore}%
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md text-amber-700 border border-amber-200">
                                <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                                <span className="text-xs font-black">
                                  {tpProfile?.rating ? tpProfile.rating.toFixed(1) : "5.0"}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-600">
                                ({tpProfile?.totalReviews || 0} reviews)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle Content */}
                        <div className="space-y-3 flex-1">
                          {/* 40+ Signal Match Score */}
                          {(() => {
                            const matchResult = tpProfile ? calculateTraderMatchScore(tpProfile, job) : null;

                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-300" />
                                    AI Match Score
                                  </span>
                                  {matchResult && (
                                    <span className="text-xs font-black text-amber-300">
                                      {matchResult.compositeScore}% ({matchResult.rankTier})
                                    </span>
                                  )}
                                </div>

                                {hasVideo && (
                                  <button 
                                    onClick={() => tpProfile?.videoVerificationUrl && setActiveVideoUrl(tpProfile.videoVerificationUrl)}
                                    className="w-full bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/40 text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center justify-between transition-colors"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                                      Video Intro Credential
                                    </span>
                                    <span className="underline">Play 🎥</span>
                                  </button>
                                )}

                                {matchResult?.keyHighlights && matchResult.keyHighlights.length > 0 && (
                                  <p className="text-[10px] text-slate-300 font-medium leading-snug">
                                    {matchResult.keyHighlights[0]}
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          {/* AI Intelligence Label */}
                          {analysis && (
                            <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-[10px] font-black uppercase px-2 py-0.5 rounded-md",
                                  analysis.label === "Budget Friendly" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                                  analysis.label === "Good Value" ? "bg-blue-100 text-blue-800 border border-blue-300" :
                                  "bg-purple-100 text-purple-800 border border-purple-300"
                                )}>
                                  {analysis.label}
                                </span>
                                <span className="text-[10px] font-black text-blue-800 uppercase">{analysis.percentile}th Value Percentile</span>
                              </div>
                              <p className="text-[11px] text-blue-900 font-bold leading-tight">
                                <Sparkles className="w-3 h-3 inline-block mr-1 text-blue-600" />
                                {analysis.winningFactor}
                              </p>
                            </div>
                          )}

                          {/* Price & Scope Box */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-black flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Quote Amount</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-900">£{quote.amount}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200">
                              <span className="bg-white text-slate-800 border border-black text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase">
                                {quote.paymentPreference?.replace('_', ' ') || "Fixed Price"}
                              </span>
                              <span className="bg-white text-slate-800 border border-black text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase">
                                {quote.quoteScope?.replace('_', ' ') || "Complete Package"}
                              </span>
                            </div>

                            {/* Itemized Cost Breakdown Toggle */}
                            <button
                              onClick={() => setExpandedBreakdownId(isExpanded ? null : quote.id)}
                              className="mt-1 pt-1.5 border-t border-slate-200 text-[10px] font-black text-blue-700 hover:text-blue-900 flex items-center justify-between"
                            >
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3 text-blue-600" />
                                Itemized Cost & Scope Breakdown
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-1.5 pt-2 border-t border-slate-200 text-[11px] font-medium text-slate-700 bg-white p-2.5 rounded-xl border border-slate-300"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-bold">Scope Coverage:</span>
                                  <span className="font-black text-slate-900 uppercase">{quote.quoteScope?.replace('_', ' ') || "Complete"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-bold">Deposit Structure:</span>
                                  <span className="font-black text-blue-900">
                                    {quote.depositTerm === "25_percent_upfront" ? "25% Upfront Deposit" : quote.depositTerm === "50_percent_milestone" ? "50/50 Split" : "0% Deposit (Pay on Completion)"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-bold">Workmanship Guarantee:</span>
                                  <span className="font-black text-amber-700 flex items-center gap-1">
                                    <Award className="w-3.5 h-3.5 text-amber-500" />
                                    {quote.guaranteeTerm?.replace(/_/g, ' ') || "1 Year Guarantee"}
                                  </span>
                                </div>
                                {quote.partsWarranty && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-bold">Parts Warranty:</span>
                                    <span className="font-black text-slate-900">
                                      {quote.partsWarranty === "10_year_parts" ? "10 Year Extended" : quote.partsWarranty === "no_parts_warranty" ? "No Warranty" : "Standard Manufacturer"}
                                    </span>
                                  </div>
                                )}
                                {quote.lineItems && quote.lineItems.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200 space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Itemized Line Items:</p>
                                    {quote.lineItems.map((item: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-[10px]">
                                        <span className="text-slate-700 font-medium">{item.description}</span>
                                        <span className="font-black text-slate-900">£{item.amount}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}

                            {/* BNPL Financing option for £1,000+ */}
                            {quote.amount >= 1000 && (
                              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                                <div className="text-[10px] text-indigo-900 font-black flex items-center gap-1">
                                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>From £{Math.round(quote.amount / 12)}/mo (0% APR)</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedQuoteForBnpl(quote);
                                    setShowBnplModal(true);
                                  }}
                                  className="text-[9px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs"
                                >
                                  FlexiPay
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Start Date & Timeline */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider leading-none">Start</p>
                                <p className="text-xs font-black text-blue-900 truncate mt-0.5">
                                  {quote.isImmediateStart ? "Immediately" : quote.startDate ? new Date(quote.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : "Flexible"}
                                </p>
                              </div>
                            </div>

                            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider leading-none">Timeline</p>
                                <p className="text-xs font-black text-indigo-900 truncate mt-0.5">
                                  {quote.estimatedTimeline || "1-2 days"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Message Box */}
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" />
                              Trader Note
                            </p>
                            <div className="bg-slate-50 p-3 rounded-xl border border-black min-h-[70px] max-h-[110px] overflow-y-auto no-scrollbar">
                              <p className="text-xs text-slate-700 font-medium leading-relaxed italic">
                                "{quote.message || "Ready to assist with this job."}"
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="mt-4 pt-4 border-t border-black space-y-2">
                          {requestingRevisionId === quote.id ? (
                            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 bg-amber-50 p-3 rounded-2xl border border-amber-300">
                              <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-amber-600" />
                                Re-quote Request & Feedback
                              </p>

                              {/* Quick Suggestion Chips */}
                              <div className="flex flex-wrap gap-1">
                                {[
                                  "🏷️ Price Revision",
                                  "📦 Include Materials",
                                  "📅 Earlier Start Date",
                                  "🛡️ Clarify Warranty"
                                ].map((chip) => (
                                  <button
                                    key={chip}
                                    onClick={() => handleQuickChipClick(chip)}
                                    className="text-[9px] font-extrabold bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md transition-colors"
                                  >
                                    {chip}
                                  </button>
                                ))}
                              </div>

                              <textarea
                                value={revisionMessage}
                                onChange={(e) => setRevisionMessage(e.target.value)}
                                placeholder="State specific modifications needed..."
                                className="w-full p-2.5 text-xs border border-amber-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none min-h-[70px] font-medium"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setRequestingRevisionId(null)}
                                  className="flex-1 py-2 text-[10px] font-black text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
                                >
                                  CANCEL
                                </button>
                                <button
                                  onClick={() => handleRequestRevision(quote)}
                                  disabled={isSubmitting || !revisionMessage.trim()}
                                  className="flex-[2] py-2 text-[10px] font-black text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50"
                                >
                                  {isSubmitting ? "SENDING..." : "SEND RE-QUOTE"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {quote.status === "accepted" ? (
                                <div className="w-full bg-emerald-100 text-emerald-900 border border-emerald-300 p-3.5 rounded-2xl font-black text-center flex items-center justify-center gap-2 text-xs">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  QUOTE ACCEPTED
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <button 
                                    disabled={isSubmitting || isAcceptingId === quote.id}
                                    onClick={async () => {
                                      if (window.confirm(`Are you sure you want to accept the quote from ${tpProfile?.name || 'this trader'} for £${quote.amount}?`)) {
                                        try {
                                          setIsAcceptingId(quote.id);
                                          await onAccept(quote);
                                          onClose();
                                        } catch (err) {
                                          setIsAcceptingId(null);
                                        }
                                      }
                                    }}
                                    className="w-full bg-[#1e3a5f] text-white p-3.5 rounded-2xl font-black hover:bg-blue-900 transition-all shadow-md active:scale-95 disabled:opacity-50 text-xs tracking-wider"
                                  >
                                    {isAcceptingId === quote.id ? "ACCEPTING..." : "ACCEPT QUOTE"}
                                  </button>
                                  {quote.status === "pending" && (
                                    <button 
                                      onClick={() => setRequestingRevisionId(quote.id)}
                                      className="w-full bg-white text-amber-700 border border-amber-300 p-2.5 rounded-2xl font-black text-[11px] hover:bg-amber-50 transition-all flex items-center justify-center gap-1.5"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      REQUEST REVISION
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Matrix View */
                <div className="bg-white rounded-3xl border border-black overflow-x-auto p-4 shadow-sm">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-wider w-48 bg-slate-50 rounded-tl-2xl">
                          Comparison Factor
                        </th>
                        {sortedQuotes.map((quote) => {
                          const tpProfile = tradespersonProfiles[quote.tradespersonId];
                          const isLowestPrice = quote.id === lowestPriceId;
                          const isHighestRating = quote.id === highestRatingId;

                          return (
                            <th key={quote.id} className="p-3 text-center min-w-[200px] border-l border-slate-200">
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-12 h-12 rounded-full overflow-hidden border border-black relative">
                                  {tpProfile?.avatarUrl ? (
                                    <img src={tpProfile.avatarUrl} alt={tpProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                      <Star className="w-5 h-5 text-slate-400" />
                                    </div>
                                  )}
                                </div>
                                <span className="font-black text-slate-900 text-sm">{tpProfile?.name || "Trader"}</span>
                                <div className="flex items-center gap-1">
                                  {isLowestPrice && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">Best Value</span>
                                  )}
                                  {isHighestRating && (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">Top Rated</span>
                                  )}
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {/* Row 1: Quote Price */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider">
                          Quote Price
                        </td>
                        {sortedQuotes.map((quote) => (
                          <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                            <span className="text-xl font-black text-slate-900">£{quote.amount}</span>
                          </td>
                        ))}
                      </tr>

                      {/* Row 2: Rating & Trust */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider">
                          Rating & Trust Score
                        </td>
                        {sortedQuotes.map((quote) => {
                          const tpProfile = tradespersonProfiles[quote.tradespersonId];
                          return (
                            <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-amber-600 flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 fill-current" />
                                  {tpProfile?.rating ? tpProfile.rating.toFixed(1) : "5.0"} ({tpProfile?.totalReviews || 0})
                                </span>
                                {tpProfile?.trustScore && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    Trust Score: {tpProfile.trustScore}%
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Row 3: Scope & Payment Preference */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider">
                          Scope & Payment Terms
                        </td>
                        {sortedQuotes.map((quote) => (
                          <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                            <div className="flex flex-col items-center gap-1">
                              <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md uppercase text-[10px]">
                                {quote.quoteScope?.replace('_', ' ') || "Complete Package"}
                              </span>
                              <span className="text-slate-500 font-medium text-[10px]">
                                {quote.paymentPreference?.replace('_', ' ') || "Fixed Price"}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Row 3b: Guarantee & Deposit Terms */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider">
                          Guarantee & Deposit Terms
                        </td>
                        {sortedQuotes.map((quote) => (
                          <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                            <div className="flex flex-col items-center gap-1">
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 font-black px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1">
                                <Award className="w-3 h-3 text-amber-500" />
                                {quote.guaranteeTerm?.replace(/_/g, ' ') || "1 Year Guarantee"}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600">
                                {quote.depositTerm === "25_percent_upfront" ? "25% Upfront Deposit" : quote.depositTerm === "50_percent_milestone" ? "50/50 Milestone" : "0% Deposit (Stripe Direct)"}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Row 4: Start Date & Duration */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider">
                          Start Date & Timeline
                        </td>
                        {sortedQuotes.map((quote) => (
                          <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-black text-blue-900">
                                {quote.isImmediateStart ? "⚡ Immediately" : quote.startDate ? new Date(quote.startDate).toLocaleDateString('en-GB') : "Flexible"}
                              </span>
                              <span className="text-slate-500 text-[10px] font-bold">
                                {quote.estimatedTimeline || "1-2 days"}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Row 5: AI Value Analysis */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider">
                          AI Value Assessment
                        </td>
                        {sortedQuotes.map((quote) => {
                          const analysis = quoteAnalyses[quote.id];
                          return (
                            <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                              {analysis ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="bg-blue-50 text-blue-800 font-black px-2 py-0.5 rounded-md text-[10px]">
                                    {analysis.label}
                                  </span>
                                  <p className="text-[10px] text-slate-600 font-medium italic max-w-[180px]">
                                    "{analysis.winningFactor}"
                                  </p>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Standard Quote</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Row 6: Actions */}
                      <tr>
                        <td className="p-3 font-black text-slate-800 bg-slate-50 uppercase tracking-wider rounded-bl-2xl">
                          Select Action
                        </td>
                        {sortedQuotes.map((quote) => {
                          const tpProfile = tradespersonProfiles[quote.tradespersonId];
                          return (
                            <td key={quote.id} className="p-3 text-center border-l border-slate-200">
                              {quote.status === "accepted" ? (
                                <span className="bg-emerald-100 text-emerald-800 font-black px-3 py-1 rounded-xl text-xs">
                                  ACCEPTED
                                </span>
                              ) : (
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Accept quote from ${tpProfile?.name || 'trader'} for £${quote.amount}?`)) {
                                      await onAccept(quote);
                                      onClose();
                                    }
                                  }}
                                  className="bg-[#1e3a5f] hover:bg-blue-900 text-white font-black px-4 py-2 rounded-xl text-xs shadow-2xs"
                                >
                                  ACCEPT
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Video Credential Modal */}
      {activeVideoUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-4 w-full max-w-md space-y-3 relative text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                Trader Video Credential Selfie
              </h3>
              <button onClick={() => setActiveVideoUrl(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800">
              <video src={activeVideoUrl} controls autoPlay className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* BNPL Financing Modal */}
      {showBnplModal && (
        <BnplFinancingModal
          isOpen={showBnplModal}
          onClose={() => setShowBnplModal(false)}
          initialAmount={selectedQuoteForBnpl?.amount || 2500}
          jobTitle={job?.title || "Major Homeowner Repair"}
          onSelectPlan={(plan) => {
            console.log("Selected BNPL plan:", plan);
          }}
        />
      )}
    </AnimatePresence>
  );
}
