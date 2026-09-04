import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  User, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  Tag, 
  Star, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  FileText, 
  PhoneCall, 
  Building2, 
  Wrench, 
  Clock, 
  AlertTriangle,
  RotateCw,
  HelpCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { callTradeBotStream, callTradeBot } from "@/src/services/gemini";
import { useAuth } from "./AuthProvider";
import { 
  findMatchingTradeCategories, 
  getHybridTraderRecommendations, 
  TraderRecommendationCard 
} from "@/src/services/aiRecommendationService";
import { recordUnmatchedSearch, extractCleanTradeQuery } from "@/src/services/searchOptimizationService";
import { triggerHaptic } from "@/src/lib/capacitor";
import { toast } from "sonner";

interface GroundingSource {
  title: string;
  url: string;
}

interface Message {
  role: "user" | "model";
  text: string;
  sources?: GroundingSource[];
  suggestedCategories?: string[];
  recommendedTraders?: TraderRecommendationCard[];
  demandGapNotice?: {
    type: "unmatched_category" | "no_traders_found";
    searchTerm: string;
    category?: string;
  };
  quickAction?: {
    type: "post_job" | "emergency_job" | "find_trades";
    category: string;
    title: string;
    description: string;
    estimatedBudget?: string;
  };
}

interface TradeBotProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TradeBot({ isOpen, onClose }: TradeBotProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const userRole = profile?.role || "homeowner";
  const userPostcode = profile?.postcode || "";

  const initialGreeting: Message = {
    role: "model",
    text: `Hello ${profile?.name ? profile.name.split(" ")[0] : "there"}! I'm AnyTrader AI Copilot. 

I'm trained on AnyTrader's UK platform data across 93+ trade sectors — connecting you with real verified local tradespeople, accurate £ GBP pricing, and safety standards (Gas Safe, Part P, Awaab's Law, FSA).

How can I assist your project today?`,
    suggestedCategories: ["Plumbing", "Electrical", "Painting & Decorating", "Gas & Heating"]
  };

  const [messages, setMessages] = useState<Message[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isStreaming]);

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoading || isStreaming) return;

    const userMessage = promptText.trim();
    setInput("");
    triggerHaptic();

    // 1. Context extraction: Detect matching trade categories
    const matchedCats = findMatchingTradeCategories(userMessage, 3);
    const hasCategoryMatch = matchedCats.length > 0;
    const primaryCategory = matchedCats[0] || "General Trades";
    const cleanExtractedQuery = extractCleanTradeQuery(userMessage);

    // 2. Query hybrid trader recommendations in parallel with all matched categories
    const categoriesForMatching = matchedCats.length > 0 ? matchedCats : [primaryCategory];
    const tradersPromise = getHybridTraderRecommendations(categoriesForMatching, userPostcode, undefined, userMessage).catch(() => []);

    // 3. User context payload for Gemini
    const userContext = {
      role: userRole,
      postcode: userPostcode || "UK Wide",
      propertySummary: (profile as any)?.boilerModel ? `Boiler: ${(profile as any).boilerModel}, EPC: ${(profile as any).epcRating || 'C'}` : undefined
    };

    // Add user message and prepare empty model message for token streaming
    const historyPayload = messages.map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [
      ...prev,
      { role: "user", text: userMessage },
      {
        role: "model",
        text: "",
        suggestedCategories: matchedCats,
      }
    ]);

    setIsLoading(true);
    setIsStreaming(true);

    try {
      let finalAccumulatedText = "";
      let capturedSources: GroundingSource[] = [];

      const streamResult = await callTradeBotStream(
        userMessage,
        historyPayload,
        userContext,
        {
          onChunk: (_chunk, accumulatedText) => {
            finalAccumulatedText = accumulatedText;
            setIsLoading(false); // First token arrived! Transition from loading to active streaming
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "model") {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  text: accumulatedText
                };
              }
              return updated;
            });
          },
          onSources: (sources) => {
            capturedSources = sources;
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "model") {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  sources
                };
              }
              return updated;
            });
          },
          onError: (err) => {
            console.warn("TradeBot stream callback error:", err);
          }
        }
      );

      // Await trader recommendations
      const recommendedTraders = await tradersPromise;
      const modelText = finalAccumulatedText || streamResult.text || "Here is the guidance for your request.";
      const finalSources = capturedSources.length > 0 ? capturedSources : streamResult.sources || [];

      // 4. Telemetry: Record unmatched search terms, categories, or trader supply gaps
      let demandGapNotice: Message["demandGapNotice"] = undefined;
      const queryForTelemetry = cleanExtractedQuery || userMessage.trim().slice(0, 40);

      if (!hasCategoryMatch && queryForTelemetry.length >= 3) {
        demandGapNotice = {
          type: "unmatched_category",
          searchTerm: queryForTelemetry,
        };
        recordUnmatchedSearch(queryForTelemetry, userPostcode, {
          source: "ai_bot",
          gapType: "unmatched_category",
          category: primaryCategory !== "General Trades" ? primaryCategory : "",
        });
      } else if (recommendedTraders.length === 0 && queryForTelemetry.length >= 3) {
        demandGapNotice = {
          type: "no_traders_found",
          searchTerm: queryForTelemetry,
          category: primaryCategory,
        };
        recordUnmatchedSearch(queryForTelemetry, userPostcode, {
          source: "ai_bot",
          gapType: "no_traders_found",
          category: primaryCategory,
        });
      }

      // 5. Generate 1-tap quick action spec
      const quickAction: Message["quickAction"] = {
        type: userMessage.toLowerCase().includes("emergency") || userMessage.toLowerCase().includes("burst") || userMessage.toLowerCase().includes("flooding")
          ? "emergency_job"
          : "post_job",
        category: primaryCategory,
        title: userMessage.length > 50 ? `${primaryCategory} Required` : userMessage,
        description: `Request for ${primaryCategory} assistance.\n\nAI Diagnostic Summary:\n${modelText.slice(0, 200)}...`,
        estimatedBudget: "Market Standard (£120 - £350)"
      };

      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "model") {
          updated[lastIdx] = {
            role: "model",
            text: modelText,
            sources: finalSources,
            suggestedCategories: matchedCats,
            recommendedTraders: recommendedTraders.slice(0, 2),
            demandGapNotice,
            quickAction
          };
        }
        return updated;
      });
    } catch (error) {
      console.error("TradeBot Error:", error);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "model") {
          updated[lastIdx] = {
            role: "model",
            text: "I experienced a brief connection hiccup while grounding with live search. Please ask your question again, or browse verified trades directly below.",
            suggestedCategories: ["Plumbing", "Electrical", "Gas & Heating"]
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    triggerHaptic();
    onClose();
    navigate(`/find-trades?category=${encodeURIComponent(categoryName)}`);
    toast.success(`Showing top verified trades in ${categoryName}`);
  };

  const handleTraderClick = (uid: string) => {
    triggerHaptic();
    onClose();
    navigate(`/profile/${uid}`);
  };

  const handleQuickPostJob = (action: NonNullable<Message["quickAction"]>) => {
    triggerHaptic();
    onClose();
    if (action.type === "emergency_job") {
      navigate(`/post-emergency-job?category=${encodeURIComponent(action.category)}`);
    } else {
      const params = new URLSearchParams({
        category: action.category,
        title: action.title,
        description: action.description,
        source: "tradebot",
        prefilledByAI: "true"
      });
      navigate(`/post-job?${params.toString()}`);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90dvh] max-h-[720px] sm:h-[700px] border border-black"
        >
          {/* Top Header */}
          <div className="bg-slate-900 p-4 flex items-center justify-between text-white border-b border-black">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center border border-white/30 shadow-inner">
                <Bot className="w-5 h-5 text-white" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base leading-tight">Ask AnyTrader AI</h2>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5" /> Fair Match Engine
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-medium text-slate-300">
                    Live UK Pricing • 93+ Trade Categories • Gas Safe & NICEIC
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Close AI Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-slate-50">
            {messages.map((msg, i) => (
              <div 
                key={i}
                className={cn(
                  "flex gap-3 max-w-[92%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                {/* Avatar Icon */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-black shadow-2xs",
                  msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-800"
                )}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-blue-600" />}
                </div>

                <div className="space-y-3 flex-1 min-w-0">
                  {/* Message Bubble */}
                  {msg.text ? (
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line border border-black shadow-xs",
                      msg.role === "user" 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-white text-slate-900 rounded-tl-none font-medium"
                    )}>
                      {msg.text}
                      {isStreaming && i === messages.length - 1 && msg.role === "model" && (
                        <span className="inline-block w-1.5 h-4 bg-blue-600 animate-pulse ml-1.5 align-middle rounded-xs shadow-2xs" />
                      )}
                    </div>
                  ) : (
                    msg.role === "model" && isStreaming && (
                      <div className="p-3.5 rounded-2xl bg-white border border-black rounded-tl-none shadow-xs flex items-center gap-2.5 text-xs text-slate-700">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                        <span className="font-semibold animate-pulse">Streaming live response from AnyTrader AI...</span>
                      </div>
                    )
                  )}

                  {/* Grounding Web Citations */}
                  {msg.role === "model" && msg.sources && msg.sources.length > 0 && (
                    <div className="bg-amber-50 border border-black rounded-xl p-3 space-y-1.5 shadow-2xs">
                      <div className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                        <span>Verified Live UK Sources:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 hover:bg-amber-100/60 text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors shadow-2xs"
                          >
                            <span className="truncate max-w-[220px]">{source.title}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Category Chips */}
                  {msg.role === "model" && msg.suggestedCategories && msg.suggestedCategories.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-blue-600" /> Suggested Trade Categories:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedCategories.map((cat, catIdx) => (
                          <button
                            key={catIdx}
                            onClick={() => handleCategoryClick(cat)}
                            className="inline-flex items-center gap-1.5 bg-white border border-black hover:bg-blue-50 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full transition-all shadow-2xs group active:scale-95"
                          >
                            <span>{cat}</span>
                            <ArrowRight className="w-3 h-3 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Demand Gap Notification for Homeowner (Unmatched Category or 0 Local Traders) */}
                  {msg.role === "model" && msg.demandGapNotice && (
                    <div className="bg-amber-50/90 border border-black rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {msg.demandGapNotice.type === "no_traders_found"
                            ? `Demand Logged: 0 Verified Traders Currently Found for "${msg.demandGapNotice.searchTerm}"`
                            : `New Specialty Logged: "${msg.demandGapNotice.searchTerm}"`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-800 leading-relaxed font-medium">
                        {msg.demandGapNotice.type === "no_traders_found"
                          ? `We've recorded this request in AnyTrader's High-Demand Queue to alert verified trades in your area. You can still post a job below so nearby trade professionals can quote directly.`
                          : `We've logged "${msg.demandGapNotice.searchTerm}" in AnyTrader's search demand telemetry. Our trade matching engine is indexing this service. You can post a job below to receive quotes from related trades.`}
                      </p>
                    </div>
                  )}

                  {/* Interactive Trader Recommendation Cards (Hybrid Monetized + Fairness Engine) */}
                  {msg.role === "model" && msg.recommendedTraders && msg.recommendedTraders.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <span className="flex items-center gap-1 text-slate-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Matching Verified Local Traders
                        </span>
                        <span className="text-slate-400 font-normal text-[10px] lowercase">
                          fair rotation active
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {msg.recommendedTraders.map((trader) => (
                          <div
                            key={trader.uid}
                            className={cn(
                              "bg-white border rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 text-left relative overflow-hidden",
                              trader.isSponsored ? "border-amber-400 ring-1 ring-amber-400/40 bg-amber-50/20" : "border-black"
                            )}
                          >
                            {/* Slot Badge */}
                            <div className="flex items-center justify-between gap-2">
                              {trader.isSponsored ? (
                                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border border-black/20 shadow-2xs">
                                  <Zap className="w-3 h-3 fill-slate-950" /> Featured Pro
                                </span>
                              ) : trader.isNewcomerBoost ? (
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-emerald-600" /> Newcomer Boost
                                </span>
                              ) : (
                                <span className="bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <RotateCw className="w-2.5 h-2.5 text-blue-600" /> Fair Match
                                </span>
                              )}

                              <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>{trader.rating.toFixed(1)}</span>
                                <span className="text-slate-400 font-normal text-[11px]">({trader.reviewsCount})</span>
                              </div>
                            </div>

                            {/* Trader Info */}
                            <div className="flex items-center gap-3">
                              <img
                                src={trader.avatarUrl}
                                alt={trader.name}
                                className="w-11 h-11 rounded-full object-cover border border-black shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-slate-900 truncate leading-tight">
                                  {trader.name}
                                </h4>
                                <p className="text-xs text-slate-600 truncate font-medium">
                                  {trader.businessName || trader.category}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{trader.distanceMiles} miles away</span>
                                  {trader.isGasSafe && <span className="text-amber-600 font-bold">• Gas Safe</span>}
                                  {trader.isNiceic && <span className="text-blue-600 font-bold">• NICEIC</span>}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                              <button
                                onClick={() => handleTraderClick(trader.uid)}
                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-xl border border-black transition-colors flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                              >
                                <span>View Profile</span>
                                <ArrowRight className="w-3 h-3 text-amber-400" />
                              </button>
                              <button
                                onClick={() => {
                                  triggerHaptic();
                                  onClose();
                                  navigate(`/profile/${trader.uid}`);
                                }}
                                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs py-2 px-3 rounded-xl border border-black transition-colors shadow-2xs active:scale-95"
                                title="Request Quote"
                              >
                                Quote
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1-Tap Quick Action CTA (Post Job with AI Specs) */}
                  {msg.role === "model" && msg.quickAction && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-black rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-700" />
                          <span>1-Tap Action: Ready to request quotes?</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Post job with AI pre-filled specs & benchmark pricing ({msg.quickAction.category}).
                        </p>
                      </div>
                      <button
                        onClick={() => handleQuickPostJob(msg.quickAction!)}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl border border-black flex items-center justify-center gap-2 shadow-2xs transition-all shrink-0 active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>Post Job with AI Specs</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Messages Feed End Ref */}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Carousel Pills */}
          <div className="bg-slate-100 px-4 py-2.5 border-t border-black flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSendPrompt("My boiler is losing pressure and making banging sounds. What causes this and what are typical UK repair costs?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-900 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <Wrench className="w-3 h-3 text-blue-600" /> Boiler Pressure & Banging Faults
            </button>
            <button
              onClick={() => handleSendPrompt("What are the UK Part P building regulations for installing new downlights and sockets in a kitchen?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-900 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <Zap className="w-3 h-3 text-amber-500" /> Part P Kitchen Electrical Rules
            </button>
            <button
              onClick={() => handleSendPrompt("What are standard UK rates for end-of-tenancy deep cleaning and carpet steam washing?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-900 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> End of Tenancy Cleaning Rates
            </button>
            <button
              onClick={() => handleSendPrompt("How much does a 3-tier custom wedding cake cost in the UK and what food allergen laws apply?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-900 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              🎂 Wedding Cake Pricing & Natasha's Law
            </button>
          </div>

          {/* User Input Bar */}
          <div className="p-3 sm:p-4 bg-white border-t border-black shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ask about prices, regulations, or describe a job to match trades..."
                className="w-full pl-4 pr-12 py-3.5 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendPrompt(input)}
              />
              <button 
                onClick={() => handleSendPrompt(input)}
                disabled={!input.trim() || isLoading || isStreaming}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
              <div className="flex items-center gap-1 text-slate-700">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Trained on AnyTrader UK Database & Standards</span>
              </div>
              <div className="text-slate-400">
                Fairness Rotation Engine Active
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
