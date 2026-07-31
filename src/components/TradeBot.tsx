import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, X, Send, Loader2, User, Sparkles, ExternalLink, ShieldCheck, Tag } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { callTradeBot } from "@/src/services/gemini";

interface GroundingSource {
  title: string;
  url: string;
}

interface Message {
  role: "user" | "model";
  text: string;
  sources?: GroundingSource[];
}

interface TradeBotProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TradeBot({ isOpen, onClose }: TradeBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Hello! I'm AnyTrader AI Assistant. I can help you with live UK pricing, safety rules, material costs, or standards for ANY service — from plumbing & rewiring to wedding cakes, catering, cleaning, and events. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    const userMessage = promptText.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const res = await callTradeBot(userMessage, messages);
      const modelText = typeof res === "object" && res.text ? res.text : (typeof res === "string" ? res : "No response from AI assistant.");
      const sources = typeof res === "object" && Array.isArray(res.sources) ? res.sources : [];

      setMessages(prev => [...prev, { role: "model", text: modelText, sources }]);
    } catch (error) {
      console.error("TradeBot Error:", error);
      setMessages(prev => [...prev, { role: "model", text: "Sorry, I'm having trouble searching live web data right now. Please try again shortly." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => handleSendPrompt(input);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85dvh] max-h-[650px] sm:h-[650px] border border-black"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 flex items-center justify-between text-white border-b border-black">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base">AnyTrader AI Assistant</h2>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Live Web Search
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[11px] font-medium text-blue-100">Live UK Standards & Supply Prices Active</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div 
                key={i}
                className={cn(
                  "flex gap-3 max-w-[88%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-black",
                  msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-700"
                )}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="space-y-2">
                  <div className={cn(
                    "p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line border border-black",
                    msg.role === "user" 
                      ? "bg-blue-600 text-white rounded-tr-none" 
                      : "bg-white text-slate-800 rounded-tl-none shadow-sm"
                  )}>
                    {msg.text}
                  </div>

                  {/* Web Sources / Citations */}
                  {msg.role === "model" && msg.sources && msg.sources.length > 0 && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Verified Sources & Web Citations:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-white border border-amber-300 hover:border-amber-500 text-amber-900 text-[11px] px-2 py-0.5 rounded-md transition-colors hover:bg-amber-100/50"
                          >
                            <span className="truncate max-w-[200px]">{source.title}</span>
                            <ExternalLink className="w-3 h-3 text-amber-600 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-white border border-black text-slate-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-black p-3.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600">Searching live UK pricing & safety standards...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Pills */}
          <div className="bg-slate-100 px-4 py-2 border-t border-black flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSendPrompt("What are typical UK prices for a 3-tier custom wedding cake and what food safety/allergen rules apply?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs"
            >
              🍰 Wedding Cake & Food Safety
            </button>
            <button
              onClick={() => handleSendPrompt("What are typical UK prices for emergency plumbing or boiler repair, and what Gas Safe rules apply?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs"
            >
              <Tag className="w-3 h-3 text-amber-600" /> Plumbing & Boiler Costs
            </button>
            <button
              onClick={() => handleSendPrompt("What are standard UK rates for end-of-tenancy house cleaning or carpet cleaning?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs"
            >
              🧹 Deep Cleaning Rates
            </button>
            <button
              onClick={() => handleSendPrompt("What are UK Part P electrical safety rules and BS 7671 standards for home rewiring?")}
              className="shrink-0 bg-white border border-black hover:bg-blue-50 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs"
            >
              <ShieldCheck className="w-3 h-3 text-blue-600" /> Electrical Safety Rules
            </button>
          </div>

          {/* Input */}
          <div className="p-3 sm:p-4 bg-white border-t border-black shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ask about prices, standards, or rules for any service..."
                className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all text-sm font-medium"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 200);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-widest px-1">
              <div className="flex items-center gap-1 text-slate-500">
                <Sparkles className="w-3 h-3 text-amber-500" /> AnyTrader Smart Assistant
              </div>
              <div>Real-Time Web Search for All Services</div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
