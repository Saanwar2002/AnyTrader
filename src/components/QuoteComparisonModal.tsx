import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Star, PoundSterling, Clock, MessageSquare, CheckCircle2, Sparkles, RefreshCw, Calendar, Zap } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";

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

export default function QuoteComparisonModal({ isOpen, onClose, quotes, tradespersonProfiles, quoteAnalyses = {}, onAccept, onRequestRequote, job }: QuoteComparisonModalProps) {
  const [requestingRevisionId, setRequestingRevisionId] = React.useState<string | null>(null);
  const [revisionMessage, setRevisionMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const sortedQuotes = [...quotes].sort((a, b) => {
    // 1. Accepted first
    if (a.status === "accepted" && b.status !== "accepted") return -1;
    if (b.status === "accepted" && a.status !== "accepted") return 1;

    // 2. AI Value (Percentile)
    const analysisA = quoteAnalyses[a.id];
    const analysisB = quoteAnalyses[b.id];
    if (analysisA && analysisB) {
      if (analysisA.percentile !== analysisB.percentile) {
        return analysisB.percentile - analysisA.percentile;
      }
    }

    // 3. Trader Rating
    const profileA = tradespersonProfiles[a.tradespersonId];
    const profileB = tradespersonProfiles[b.tradespersonId];
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

  const fastestStartId = [...quotes]
    .filter(q => q.startDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]?.id;

  const lowestPriceId = [...quotes].sort((a, b) => a.amount - b.amount)[0]?.id;
  const highestRatingId = [...quotes].sort((a, b) => {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 z-50 bg-slate-50 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20"
          >
            <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Compare Quotes</h2>
                <p className="text-sm text-slate-500 font-medium">Review and compare all received offers side-by-side</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                    {job.paymentPreference?.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                    {job.quoteScope?.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-x-auto p-6 no-scrollbar">
              <div className="flex gap-6 min-w-max pb-4">
                {quotes.map((quote) => {
                  const tpProfile = tradespersonProfiles[quote.tradespersonId];
                  const analysis = quoteAnalyses[quote.id];
                  const isLowestPrice = quote.id === lowestPriceId;
                  const isHighestRating = quote.id === highestRatingId;

                  return (
                    <div 
                      key={quote.id} 
                      className={cn(
                        "w-80 bg-white rounded-[2rem] p-8 border transition-all flex flex-col relative",
                        quote.status === "accepted" ? "border-green-500 ring-2 ring-green-500/20" : "border-slate-100 shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className="absolute -top-3 left-8 flex gap-2">
                        {isLowestPrice && (
                          <div className="bg-green-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-wider">
                            Best Value
                          </div>
                        )}
                        {!isLowestPrice && isHighestRating && (
                          <div className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-wider">
                            Top Rated
                          </div>
                        )}
                        {quote.id === fastestStartId && (
                          <div className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current" />
                            Fastest Start
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-inner mb-4 relative">
                          {tpProfile?.avatarUrl ? (
                            <img src={tpProfile.avatarUrl} alt={tpProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Star className="w-10 h-10" />
                            </div>
                          )}
                          <BadgeOverlay 
                            badges={getTraderBadges(tpProfile)} 
                            className="absolute -bottom-1 -left-1 -right-1 justify-center z-10 scale-75" 
                          />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-lg leading-tight mb-1">{tpProfile?.name || "Tradesperson"}</h3>
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                              <span className="text-xs font-black text-amber-700">
                                {tpProfile?.rating ? tpProfile.rating.toFixed(1) : "5.0"}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                              ({tpProfile?.totalReviews || 0} reviews)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 flex-1">
                        {/* AI Intelligence Section */}
                        {analysis && (
                          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                analysis.label === "Budget Friendly" ? "bg-green-100 text-green-700" :
                                analysis.label === "Good Value" ? "bg-blue-100 text-blue-700" :
                                analysis.label === "Premium" ? "bg-purple-100 text-purple-700" :
                                "bg-slate-100 text-slate-700"
                              )}>
                                {analysis.label}
                              </span>
                              <span className="text-[9px] font-bold text-blue-600 uppercase">{analysis.percentile}th Value</span>
                            </div>
                            <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${analysis.percentile}%` }} />
                            </div>
                            <p className="text-[10px] text-blue-800 font-semibold leading-tight">
                              <Sparkles className="w-3 h-3 inline-block mr-1" />
                              {analysis.winningFactor}
                            </p>
                          </div>
                        )}

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quote Amount</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-900">£{quote.amount}</span>
                            <span className="text-xs font-bold text-slate-400">total</span>
                          </div>
                        </div>

                        {quote.startDate && (
                          <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/30 flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Start Date</p>
                              <p className="text-xs font-bold text-blue-700">
                                {quote.isImmediateStart ? "Immediately" : new Date(quote.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                        )}

                        {quote.estimatedTimeline && (
                          <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/30 flex items-center gap-3">
                            <Clock className="w-4 h-4 text-indigo-600" />
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Timeline</p>
                              <p className="text-xs font-bold text-indigo-700">{quote.estimatedTimeline}</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            Message
                          </p>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[100px] max-h-[150px] overflow-y-auto no-scrollbar">
                            <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                              "{quote.message}"
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                        {requestingRevisionId === quote.id ? (
                          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <textarea
                              value={revisionMessage}
                              onChange={(e) => setRevisionMessage(e.target.value)}
                              placeholder="What's missing? (e.g. materials, waste removal...)"
                              className="w-full p-3 text-xs border border-amber-200 rounded-xl bg-amber-50 focus:ring-2 focus:ring-amber-500 outline-none min-h-[80px]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setRequestingRevisionId(null)}
                                className="flex-1 py-2 text-[10px] font-black text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
                              >
                                CANCEL
                              </button>
                              <button
                                onClick={() => handleRequestRevision(quote)}
                                disabled={isSubmitting || !revisionMessage.trim()}
                                className="flex-[2] py-2 text-[10px] font-black text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50"
                              >
                                {isSubmitting ? "SENDING..." : "SEND REQUEST"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {quote.status === "accepted" ? (
                              <div className="w-full bg-green-50 text-green-600 p-4 rounded-2xl font-black text-center flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                ACCEPTED
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <button 
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to accept the quote from ${tpProfile?.name} for £${quote.amount}?`)) {
                                      onAccept(quote);
                                      onClose();
                                    }
                                  }}
                                  className="w-full bg-[#1e3a5f] text-white p-4 rounded-2xl font-black hover:bg-blue-900 transition-all shadow-lg shadow-blue-100 active:scale-95"
                                >
                                  ACCEPT QUOTE
                                </button>
                                {quote.status === "pending" && (
                                  <button 
                                    onClick={() => setRequestingRevisionId(quote.id)}
                                    className="w-full bg-white text-amber-600 border border-amber-200 p-3 rounded-2xl font-black text-xs hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                                  >
                                    <RefreshCw className="w-4 h-4" />
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


